import React, { useState, useEffect, useMemo } from 'react';
import {
  Car,
  Search,
  Filter,
  Plus,
  Download,
  Printer,
  Copy,
  Check,
  Building2,
  Calendar,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RefreshCw,
  Eye,
  Edit2,
  Trash2,
  AlertTriangle,
  LogOut,
  FileSpreadsheet,
  FileText,
  Receipt,
  Clock,
  Camera,
  AlertCircle,
  CheckSquare,
  Layers,
  Truck,
  SlidersHorizontal,
  Fuel,
  X,
  RotateCcw,
} from 'lucide-react';
import { Vehicle, Site, VehicleStatus, UserRole, Invoice, Movement } from '../types';
import { formatDateTime } from '../lib/dateUtils';
import { api } from '../lib/api';
import { generateStockReportPDF } from '../lib/pdfStock';
import { getImporterForBrand } from '../data/importers';
import { getModelsForBrand } from '../data/carCatalog';
import { NewVehicleStockModal } from './NewVehicleStockModal';
import { QuickBillVehicleModal } from './QuickBillVehicleModal';
import { QrBarcodeScannerModal } from './QrBarcodeScannerModal';
import { BatchMovementModal } from './BatchMovementModal';
import { isVehicleSolded, getVehicleSoldedDetails } from '../lib/soldedUtils';
import { CheckCircle2, FileCheck, ArrowRight } from 'lucide-react';

interface VehiclesListProps {
  vehicles: Vehicle[];
  sites: Site[];
  invoices?: Invoice[];
  movements?: Movement[];
  loading: boolean;
  initialSearchTerm?: string;
  onSelectVehicle: (vehicle: Vehicle) => void;
  onOpenAddModal: () => void;
  userRole: UserRole;
  onRefresh: () => void;
  onNavigateToSolded?: () => void;
}

export const VehiclesList: React.FC<VehiclesListProps> = ({
  vehicles = [],
  sites = [],
  invoices = [],
  movements = [],
  loading,
  initialSearchTerm,
  onSelectVehicle,
  onOpenAddModal,
  userRole,
  onRefresh,
  onNavigateToSolded,
}) => {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
  const [stockScope, setStockScope] = useState<'active' | 'soldes' | 'unbilled_delivered' | 'all'>('active');
  const [billingVehicle, setBillingVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    if (initialSearchTerm !== undefined) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm]);
  const [selectedSite, setSelectedSite] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | '7days' | '30days' | 'month' | 'year' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Advanced Filters State
  const [selectedCarrier, setSelectedCarrier] = useState('');
  const [carrierSearch, setCarrierSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedFuelType, setSelectedFuelType] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [copiedChassis, setCopiedChassis] = useState<string | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  // New Modals State for CSV Import, Manual Creation, and Purge
  const [showManualModal, setShowManualModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeConfirmInput, setPurgeConfirmInput] = useState('');
  const [submittingPurge, setSubmittingPurge] = useState(false);
  const [purgeSuccessMsg, setPurgeSuccessMsg] = useState<string | null>(null);

  // Scanner State
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannedVinFeedback, setScannedVinFeedback] = useState<string | null>(null);
  const [initialVinForAddModal, setInitialVinForAddModal] = useState<string | undefined>(undefined);

  // Multi-Selection State for Batch Movements
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [showBatchMovementModal, setShowBatchMovementModal] = useState(false);
  const [batchSuccessMsg, setBatchSuccessMsg] = useState<string | null>(null);

  const handleToggleSelectAll = () => {
    if (selectedVehicleIds.length === filteredVehicles.length && filteredVehicles.length > 0) {
      setSelectedVehicleIds([]);
    } else {
      setSelectedVehicleIds(filteredVehicles.map((v) => v.id));
    }
  };

  const handleToggleSelectVehicle = (e: React.ChangeEvent<HTMLInputElement> | React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedVehicleIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleScanSuccess = (scannedVin: string) => {
    const cleanVin = scannedVin.trim().toUpperCase();
    setSearchTerm(cleanVin);
    setScannedVinFeedback(cleanVin);
    setShowScannerModal(false);
    setTimeout(() => setScannedVinFeedback(null), 12000);
  };

  const matchedScannedVehicle = useMemo(() => {
    if (!scannedVinFeedback) return null;
    return vehicles.find(
      (v) => (v.chassis_number || v.vin || '').toUpperCase() === scannedVinFeedback
    );
  }, [scannedVinFeedback, vehicles]);

  const handlePurgeStock = async () => {
    if (purgeConfirmInput.trim().toUpperCase() !== 'SUPPRIMER') return;
    setSubmittingPurge(true);
    try {
      const res = await api.purgeAllVehicles();
      setPurgeSuccessMsg(res.message || 'Le stock a été intégralement réinitialisé.');
      setShowPurgeModal(false);
      setPurgeConfirmInput('');
      onRefresh();
      setTimeout(() => setPurgeSuccessMsg(null), 6000);
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la suppression du stock.');
    } finally {
      setSubmittingPurge(false);
    }
  };

  const handleDownloadSampleCsv = () => {
    const csvContent =
      'VIN,marque,modele,site_depart,site_arrivee\n' +
      'VF1AAAAA123456789,Renault,Clio,Tunis,Sfax\n' +
      'VF3P208AX99999001,Peugeot,208,Port Megrine,Entrepôt Central\n' +
      'VF7C300B99999002,Citroen,C3,Port de La Goulette,Parc Megrine\n';

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modele_import_vehicules.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteVehicle = async () => {
    if (!deletingVehicle) return;
    setSubmittingDelete(true);
    try {
      await api.deleteVehicle(deletingVehicle.id);
      setDeletingVehicle(null);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la suppression du véhicule.');
    } finally {
      setSubmittingDelete(false);
    }
  };

  const siteMap = new Map<string, string>();
  sites.forEach((s) => siteMap.set(s.id, s.name));

  // Extract unique brands for filter with counts
  const brandCounts = vehicles.reduce((acc: Record<string, number>, v) => {
    acc[v.brand] = (acc[v.brand] || 0) + 1;
    return acc;
  }, {});
  const brands = Object.keys(brandCounts).sort();

  // Extract available models (filtered by brand if selected, combining stock and catalog)
  const stockModels = vehicles
    .filter((v) => !selectedBrand || v.brand.toLowerCase() === selectedBrand.toLowerCase())
    .map((v) => v.model)
    .filter(Boolean);

  const catalogModels = selectedBrand
    ? getModelsForBrand(selectedBrand).filter((m) => m !== 'Autre')
    : [];

  const availableModels = Array.from(new Set([...stockModels, ...catalogModels])).sort();

  // Extract distinct carriers from vehicles and movements
  const availableCarriers = useMemo(() => {
    const set = new Set<string>();
    vehicles.forEach((v) => {
      if (v.carrier_name && v.carrier_name.trim()) set.add(v.carrier_name.trim());
    });
    movements.forEach((m) => {
      if (m.transporter_name && m.transporter_name.trim()) set.add(m.transporter_name.trim());
    });
    return Array.from(set).sort();
  }, [vehicles, movements]);

  // Extract distinct vehicle categories and body styles
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    vehicles.forEach((v) => {
      if (v.category && v.category.trim()) set.add(v.category.trim());
      if (v.body_style && v.body_style.trim()) set.add(v.body_style.trim());
    });
    ['Citadine', 'Berline', 'SUV / 4x4', 'Utilitaire / VU', 'Pick-up', 'Compacte', 'Monospace'].forEach((c) => set.add(c));
    return Array.from(set).sort();
  }, [vehicles]);

  // Extract distinct fuel types
  const availableFuelTypes = useMemo(() => {
    const set = new Set<string>();
    vehicles.forEach((v) => {
      if (v.fuel_type && v.fuel_type.trim()) set.add(v.fuel_type.trim());
    });
    ['Essence', 'Diesel', 'Hybride', 'Électrique'].forEach((f) => set.add(f));
    return Array.from(set).sort();
  }, [vehicles]);

  // Helper to match vehicle category / silhouette
  const matchCategoryHelper = (v: Vehicle, catFilter: string): boolean => {
    if (!catFilter) return true;
    const target = catFilter.toLowerCase().trim();
    if (v.category && v.category.toLowerCase().includes(target)) return true;
    if (v.body_style && v.body_style.toLowerCase().includes(target)) return true;

    const m = (v.model || '').toLowerCase();
    if (target.includes('suv') || target.includes('4x4')) {
      const suvKeywords = ['2008', '3008', '5008', 'c3 aircross', 'c5 aircross', 'duster', 'tucson', 'sportage', 'rav4', 't-roc', 'tiguan', 'crossland', 'grandland', 'mokka', 'captur', 'austral', 'qashqai', 'kona', 'bayon', 'stonic', 'sorento', 'renegade', 'compass', 'wrangler', 'tonale', 'stelvio', 'puma', 'kuga', 'cx-30', 'cx-5', 'tiggo', 'coolray', 'azkarra', 'jolion', 'h6', 'atto 3', 'cs35', 'cs55', 'cs75', 'stepway'];
      if (suvKeywords.some((k) => m.includes(k))) return true;
    }
    if (target.includes('citadine') || target.includes('compacte')) {
      const smallKeywords = ['108', '208', 'c1', 'c3', 'clio', 'sandero', 'polo', 'golf', 'yaris', 'i10', 'i20', 'picanto', 'rio', 'swift', 'dzire', 'baleno', '500', 'panda', 'corsa', 'fiesta', 'fabia', 'ibiza', 'mg3', 'dolphin', 'spring', 'ami', 'zoe', 'twingo'];
      if (smallKeywords.some((k) => m.includes(k))) return true;
    }
    if (target.includes('utilitaire') || target.includes('vu') || target.includes('fourgon')) {
      const vanKeywords = ['partner', 'expert', 'boxer', 'rifter', 'berlingo', 'jumpy', 'jumper', 'express', 'kangoo', 'trafic', 'master', 'fiorino', 'doblo', 'ducato', 'scudo', 'combo', 'vivaro', 'movano', 'caddy', 'crafter', 'transporter', 'proace', 'sprinter', 'vito', 'transit', 'townstar', 'k2500', 'h100', 'staria'];
      if (vanKeywords.some((k) => m.includes(k))) return true;
    }
    if (target.includes('pick-up') || target.includes('pickup')) {
      const pickupKeywords = ['landtrek', 'hilux', 'navara', 'ranger', 'amarok', 'titano', 'wingle', 'poer', 'hunter'];
      if (pickupKeywords.some((k) => m.includes(k))) return true;
    }
    if (target.includes('berline')) {
      const sedanKeywords = ['301', '308', '408', '508', 'c-elysee', 'c4', 'c4 x', 'tipo', 'logan', 'megane', 'passat', 'corolla', 'i30', 'ceed', 'civic', 'alsvin', 'arrizo', 'emgrand', 'seal', 'han', 'octavia', 'superb', 'classe c', 'classe e', 'serie 3', 'serie 5'];
      if (sedanKeywords.some((k) => m.includes(k))) return true;
    }
    if (target.includes('monospace')) {
      const monoKeywords = ['rifter', 'berlingo', 'combo', 'caddy', 'jogger', 'scenic', 'espace', 'staria'];
      if (monoKeywords.some((k) => m.includes(k))) return true;
    }
    return false;
  };

  // Date preset handler
  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset as any);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === '7days') {
      const d7 = new Date();
      d7.setDate(d7.getDate() - 7);
      setStartDate(d7.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === '30days') {
      const d30 = new Date();
      d30.setDate(d30.getDate() - 30);
      setStartDate(d30.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'year') {
      const firstDay = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(todayStr);
    }
  };

  // Count active advanced filters
  const activeAdvancedCount = useMemo(() => {
    let count = 0;
    if (datePreset !== 'all' || startDate || endDate) count++;
    if (selectedCarrier || carrierSearch) count++;
    if (selectedCategory || selectedFuelType) count++;
    return count;
  }, [datePreset, startDate, endDate, selectedCarrier, carrierSearch, selectedCategory, selectedFuelType]);

  // Calculate counts for stockScope
  const soldedCount = useMemo(() => {
    return vehicles.filter((v) => isVehicleSolded(v, invoices, movements)).length;
  }, [vehicles, invoices, movements]);

  const activeCount = useMemo(() => {
    return vehicles.filter((v) => !isVehicleSolded(v, invoices, movements)).length;
  }, [vehicles, invoices, movements]);

  const unbilledDeliveredCount = useMemo(() => {
    return vehicles.filter((v) => {
      const details = getVehicleSoldedDetails(v, invoices, movements);
      return details.isDelivered && !details.isBilled;
    }).length;
  }, [vehicles, invoices, movements]);

  // Filter vehicles logic
  const filteredVehicles = vehicles.filter((v) => {
    const isSold = isVehicleSolded(v, invoices, movements);
    const details = getVehicleSoldedDetails(v, invoices, movements);

    if (stockScope === 'active' && isSold) return false;
    if (stockScope === 'soldes' && !isSold) return false;
    if (stockScope === 'unbilled_delivered' && (!details.isDelivered || details.isBilled)) return false;

    const matchesSearch =
      !searchTerm ||
      v.chassis_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.color.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.registration_number && v.registration_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (v.stock_number && v.stock_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (v.notes && v.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (v.carrier_name && v.carrier_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (v.driver_name && v.driver_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (v.truck_plate && v.truck_plate.toLowerCase().includes(searchTerm.toLowerCase()));

    const selectedSiteObj = sites.find((s) => s.id === selectedSite);
    const importerOfBrand = getImporterForBrand(v.brand);

    const matchesSite =
      !selectedSite ||
      v.current_site_id === selectedSite ||
      (selectedSiteObj &&
        importerOfBrand &&
        selectedSiteObj.name.toLowerCase().includes(importerOfBrand.code.toLowerCase())) ||
      (selectedSiteObj &&
        selectedSiteObj.name.toLowerCase().includes('city cars') &&
        v.brand.toLowerCase() === 'kia');
    const matchesBrand = !selectedBrand || v.brand.toLowerCase() === selectedBrand.toLowerCase();
    const matchesModel = !selectedModel || v.model.toLowerCase() === selectedModel.toLowerCase();
    const matchesStatus = !selectedStatus || v.status === selectedStatus;

    // Carrier & Driver filter
    const matchesCarrier = (() => {
      if (!selectedCarrier && !carrierSearch) return true;

      if (selectedCarrier) {
        const cLower = selectedCarrier.toLowerCase();
        const vCarrier = (v.carrier_name || '').toLowerCase();
        if (!vCarrier.includes(cLower)) return false;
      }

      if (carrierSearch) {
        const qLower = carrierSearch.toLowerCase().trim();
        const vCarrier = (v.carrier_name || '').toLowerCase();
        const vDriver = (v.driver_name || '').toLowerCase();
        const vPlate = (v.truck_plate || '').toLowerCase();
        const vDeliveryRef = (v.delivery_note_ref || '').toLowerCase();
        if (
          !vCarrier.includes(qLower) &&
          !vDriver.includes(qLower) &&
          !vPlate.includes(qLower) &&
          !vDeliveryRef.includes(qLower)
        ) {
          return false;
        }
      }

      return true;
    })();

    // Category / Silhouette filter
    const matchesCategory = !selectedCategory || matchCategoryHelper(v, selectedCategory);

    // Fuel / Energy type filter
    const matchesFuelType = (() => {
      if (!selectedFuelType) return true;
      const fLower = selectedFuelType.toLowerCase();
      if (v.fuel_type && v.fuel_type.toLowerCase().includes(fLower)) return true;
      const mLower = (v.model || '').toLowerCase();
      if (fLower.includes('électrique') || fLower.includes('electrique')) {
        if (['e-208', 'e-2008', 'ami', 'spring', 'id.3', 'id.4', 'ioniq', 'ev6', 'zoe', 'atto 3', 'dolphin', 'seal'].some((em) => mLower.includes(em))) return true;
      }
      if (fLower.includes('hybride')) {
        if (['hybrid', 'phev', 'yaris cross', 'c-hr', 'rav4', 'austral', 'arkana', 'jogger'].some((hm) => mLower.includes(hm))) return true;
      }
      return false;
    })();

    // Date filtering logic
    const matchesDate = (() => {
      if (datePreset === 'all' && !startDate && !endDate) return true;
      const vDateStr = (v.arrival_date || v.reception_date || v.created_at || '').split('T')[0];
      if (!vDateStr) return true;

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      if (datePreset === 'today') {
        return vDateStr === todayStr;
      }
      if (datePreset === '7days') {
        const d7 = new Date();
        d7.setDate(d7.getDate() - 7);
        const d7Str = d7.toISOString().split('T')[0];
        return vDateStr >= d7Str && vDateStr <= todayStr;
      }
      if (datePreset === '30days') {
        const d30 = new Date();
        d30.setDate(d30.getDate() - 30);
        const d30Str = d30.toISOString().split('T')[0];
        return vDateStr >= d30Str && vDateStr <= todayStr;
      }
      if (datePreset === 'month') {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
        return vDateStr >= firstDay && vDateStr <= lastDay;
      }
      if (datePreset === 'year') {
        const firstDay = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
        return vDateStr >= firstDay && vDateStr <= todayStr;
      }

      if (startDate && vDateStr < startDate) return false;
      if (endDate && vDateStr > endDate) return false;

      return true;
    })();

    return (
      matchesSearch &&
      matchesSite &&
      matchesBrand &&
      matchesModel &&
      matchesStatus &&
      matchesCarrier &&
      matchesCategory &&
      matchesFuelType &&
      matchesDate
    );
  });

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedSite('');
    setSelectedBrand('');
    setSelectedModel('');
    setSelectedStatus('');
    setSelectedCarrier('');
    setCarrierSearch('');
    setSelectedCategory('');
    setSelectedFuelType('');
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
  };

  const handleCopyChassis = (e: React.MouseEvent, chassis: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(chassis);
    setCopiedChassis(chassis);
    setTimeout(() => setCopiedChassis(null), 2000);
  };

  const handleExportCSV = () => {
    const headers = [
      'VIN_Chassis',
      'Marque',
      'Modele',
      'Localisation_Actuelle',
      'Date_Entree',
      'Couleur',
      'Statut',
      'Numero_Stock',
      'Notes'
    ];

    const rows = filteredVehicles.map((v) => {
      const siteName = v.current_site_id
        ? siteMap.get(v.current_site_id) || 'Emplacement inconnu'
        : v.status === 'livre'
        ? 'Livré (Client)'
        : 'Stock Principal';

      const arrivalDateFormatted = v.arrival_date ? formatDateTime(v.arrival_date) : '';

      return [
        `"${(v.chassis_number || v.vin || '').replace(/"/g, '""')}"`,
        `"${(v.brand || '').replace(/"/g, '""')}"`,
        `"${(v.model || '').replace(/"/g, '""')}"`,
        `"${siteName.replace(/"/g, '""')}"`,
        `"${arrivalDateFormatted.replace(/"/g, '""')}"`,
        `"${(v.color || '').replace(/"/g, '""')}"`,
        `"${v.status}"`,
        `"${(v.stock_number || '').replace(/"/g, '""')}"`,
        `"${(v.notes || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `etat_stock_vehicules_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintPDFStock = () => {
    generateStockReportPDF({
      vehicles: filteredVehicles,
      sites,
      selectedSite,
      selectedBrand,
      selectedModel,
      selectedStatus,
    });
  };

  const getStatusBadge = (status: VehicleStatus) => {
    switch (status) {
      case 'en_stock':
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
            En Stock
          </span>
        );
      case 'en_transit':
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase bg-amber-100 text-amber-900 border border-amber-300">
            En Transit
          </span>
        );
      case 'livre':
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-300">
            Livré (Sorti)
          </span>
        );
      case 'en_panne':
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase bg-rose-100 text-rose-800 border border-rose-300">
            En Panne
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 border-b-4 border-slate-900 border-x border-t border-slate-200 shadow-sm">
        <div>
          <h1 className="text-lg font-black uppercase tracking-wider text-slate-900 flex items-center space-x-2">
            <Car className="w-5 h-5 text-blue-600" />
            <span>Véhicules Suivis &amp; Missions</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Gestion par numéro de châssis VIN 17 caractères. Total filtré :{' '}
            <strong className="text-slate-900 font-mono">{filteredVehicles.length}</strong> / {vehicles.length} véhicules.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowScannerModal(true)}
            className="flex items-center space-x-1.5 bg-blue-700 hover:bg-blue-600 text-white px-3.5 py-2 text-xs font-black uppercase tracking-wider transition border border-blue-700 shadow-xs print:hidden"
            title="Scanner un code-barres VIN avec la caméra du téléphone/PC ou importer une photo"
          >
            <Camera className="w-4 h-4 text-amber-300" />
            <span>Scanner Code-Barres / VIN</span>
          </button>

          <button
            onClick={handlePrintPDFStock}
            className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 text-xs font-bold uppercase tracking-wider transition border border-slate-900 shadow-xs print:hidden"
            title="Générer, imprimer et télécharger le rapport PDF officiel du stock filtré"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>Imprimer & PDF Stock</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-2 text-xs font-bold uppercase tracking-wider transition border border-slate-300 print:hidden"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Exporter CSV</span>
          </button>

          <button
            onClick={handleDownloadSampleCsv}
            className="flex items-center space-x-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 px-3 py-2 text-xs font-bold uppercase tracking-wider transition border border-amber-300 print:hidden"
            title="Télécharger le modèle CSV exemple"
          >
            <FileText className="w-4 h-4 text-amber-600" />
            <span>Modèle CSV</span>
          </button>

          {userRole !== 'viewer' && (
            <>
              <button
                onClick={() => setShowPurgeModal(true)}
                className="flex items-center space-x-1.5 bg-rose-700 hover:bg-rose-600 text-white px-3.5 py-2 text-xs font-black uppercase tracking-wider transition shadow-xs print:hidden"
                title="Vider tout le stock actuel pour lancer l'importation d'un nouveau stock"
              >
                <Trash2 className="w-4 h-4 text-rose-200" />
                <span>Vider Tout le Stock</span>
              </button>

              <button
                onClick={() => setShowCsvModal(true)}
                className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 text-xs font-black uppercase tracking-wider transition shadow-xs print:hidden"
                title="Importer des véhicules en masse à partir d'un fichier CSV"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Importer CSV</span>
              </button>

              <button
                onClick={() => setShowManualModal(true)}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 text-xs font-black uppercase tracking-wider transition shadow-sm print:hidden"
              >
                <Plus className="w-4 h-4" />
                <span>+ Nouveau Véhicule</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Scanned VIN Notification Banner */}
      {scannedVinFeedback && (
        <div className="bg-slate-900 text-white p-4 flex flex-wrap items-center justify-between gap-3 border-l-4 border-amber-400 shadow-md print:hidden">
          <div className="flex items-center space-x-3">
            <Camera className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-2 py-0.5">
                  Châssis Scanné
                </span>
                <span className="font-mono font-black text-amber-300 text-sm">{scannedVinFeedback}</span>
              </div>
              <p className="text-xs text-slate-300 mt-1 font-medium">
                {matchedScannedVehicle ? (
                  <>
                    Véhicule identifié : <strong>{matchedScannedVehicle.brand} {matchedScannedVehicle.model}</strong> — Site :{' '}
                    <strong>{siteMap.get(matchedScannedVehicle.current_site_id) || 'Stock'}</strong>
                  </>
                ) : (
                  <>Aucun véhicule correspondant à ce châssis n'a été trouvé dans le stock actuel.</>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {matchedScannedVehicle ? (
              <button
                onClick={() => onSelectVehicle(matchedScannedVehicle)}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-3.5 py-1.5 text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-sm transition"
              >
                <Eye className="w-4 h-4" />
                <span>Voir Fiche Complète</span>
              </button>
            ) : userRole !== 'viewer' ? (
              <button
                onClick={() => {
                  setInitialVinForAddModal(scannedVinFeedback);
                  setShowManualModal(true);
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>+ Ajouter ce véhicule au Stock</span>
              </button>
            ) : null}

            <button
              onClick={() => setScannedVinFeedback(null)}
              className="p-1.5 text-slate-400 hover:text-white transition"
              title="Fermer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {purgeSuccessMsg && (
        <div className="bg-emerald-600 text-white px-4 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-between shadow-md print:hidden">
          <div className="flex items-center space-x-2">
            <Check className="w-5 h-5" />
            <span>{purgeSuccessMsg}</span>
          </div>
          <button onClick={() => setPurgeSuccessMsg(null)} className="text-white hover:text-emerald-200 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Scope Selector Tabs (Stock Actif vs Livrés à Facturer vs Soldés) */}
      <div className="bg-slate-900 text-white p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setStockScope('active')}
            className={`px-3.5 py-1.5 text-xs font-black uppercase tracking-wider transition flex items-center space-x-1.5 ${
              stockScope === 'active'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span>Stock Actif ({activeCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setStockScope('unbilled_delivered')}
            className={`px-3.5 py-1.5 text-xs font-black uppercase tracking-wider transition flex items-center space-x-1.5 ${
              stockScope === 'unbilled_delivered'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-800 text-amber-400 hover:bg-slate-700'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Livrés À Facturer ({unbilledDeliveredCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setStockScope('soldes')}
            className={`px-3.5 py-1.5 text-xs font-black uppercase tracking-wider transition flex items-center space-x-1.5 ${
              stockScope === 'soldes'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Véhicules Soldés ({soldedCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setStockScope('all')}
            className={`px-3.5 py-1.5 text-xs font-black uppercase tracking-wider transition ${
              stockScope === 'all'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <span>Tous ({vehicles.length})</span>
          </button>
        </div>

        {onNavigateToSolded && soldedCount > 0 && (
          <button
            type="button"
            onClick={onNavigateToSolded}
            className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold uppercase tracking-wider transition flex items-center space-x-1"
          >
            <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ouvrir le Module Véhicules Soldés ({soldedCount}) &rarr;</span>
          </button>
        )}
      </div>

      {/* Search & Filters Toolbar */}
      <div className="bg-white p-5 border border-slate-200 shadow-sm space-y-4">
        {/* Section Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
              Recherche & Filtres Avancés Stock
            </h2>
            <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 border border-slate-200">
              {filteredVehicles.length} / {vehicles.length} véhicules
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border transition flex items-center space-x-1.5 ${
                showAdvancedFilters || activeAdvancedCount > 0
                  ? 'bg-blue-50 border-blue-400 text-blue-800 shadow-xs'
                  : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              <span>Filtres Avancés</span>
              {activeAdvancedCount > 0 && (
                <span className="bg-blue-600 text-white text-[10px] font-mono px-1.5 py-0.2 font-black rounded-full">
                  {activeAdvancedCount}
                </span>
              )}
              {showAdvancedFilters ? <ChevronUp className="w-3.5 h-3.5 ml-1 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 ml-1 text-slate-500" />}
            </button>

            {(searchTerm || selectedSite || selectedBrand || selectedModel || selectedStatus || selectedCarrier || carrierSearch || selectedCategory || selectedFuelType || datePreset !== 'all' || startDate || endDate) && (
              <button
                onClick={resetFilters}
                className="text-xs text-rose-600 hover:text-rose-800 font-bold uppercase tracking-wider flex items-center space-x-1 hover:underline px-2 py-1"
                title="Effacer tous les filtres"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Réinitialiser</span>
              </button>
            )}
          </div>
        </div>

        {/* Brand Quick Pills */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">
            Filtrer par Marque ({brands.length} marques au parc) :
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedBrand('')}
              className={`px-3 py-1 text-xs font-bold uppercase tracking-wider border transition ${
                !selectedBrand
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              Toutes ({vehicles.length})
            </button>

            {brands.map((b) => {
              const count = brandCounts[b] || 0;
              const isSelected = selectedBrand.toLowerCase() === b.toLowerCase();
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => setSelectedBrand(isSelected ? '' : b)}
                  className={`px-3 py-1 text-xs font-bold uppercase tracking-wider border transition flex items-center space-x-1.5 ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <span>{b}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 font-mono font-black ${
                      isSelected ? 'bg-blue-800 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary Controls Grid: Search, Site, Model, Status & Quick Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
          {/* Main Search VIN / Model */}
          <div className="relative">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
              Recherche (VIN / Modèle / Couleur)
            </label>
            <div className="flex gap-1">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Ex: VF1..., Hilux..."
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 text-xs pl-9 pr-3 py-2 focus:outline-none focus:border-blue-600 font-mono"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowScannerModal(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-2 text-xs font-black uppercase tracking-wider flex items-center space-x-1 transition flex-shrink-0"
                title="Scanner un code-barres VIN"
              >
                <Camera className="w-4 h-4 text-amber-300" />
                <span className="hidden xl:inline">Scan</span>
              </button>
            </div>
          </div>

          {/* Filter Site */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
              Site / Emplacement
            </label>
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold p-2 focus:outline-none focus:border-blue-600"
            >
              <option value="">Tous les sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.type})
                </option>
              ))}
            </select>
          </div>

          {/* Filter Model */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
              Modèle
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold p-2 focus:outline-none focus:border-blue-600"
            >
              <option value="">Tous les modèles</option>
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Status */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
              Statut Logistique
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold p-2 focus:outline-none focus:border-blue-600"
            >
              <option value="">Tous les statuts</option>
              <option value="en_stock">En Stock</option>
              <option value="en_transit">En Transit</option>
              <option value="livre">Livré (Sorti)</option>
              <option value="en_panne">En Panne</option>
            </select>
          </div>

          {/* Date d'Arrivée Quick Preset */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1 flex items-center space-x-1">
              <Calendar className="w-3 h-3 text-blue-600" />
              <span>Date d'Arrivée au Parc</span>
            </label>
            <select
              value={datePreset}
              onChange={(e) => handleDatePresetChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold p-2 focus:outline-none focus:border-blue-600"
            >
              <option value="all">Toutes les dates</option>
              <option value="today">Aujourd'hui</option>
              <option value="7days">7 derniers jours</option>
              <option value="30days">30 derniers jours</option>
              <option value="month">Mois en cours</option>
              <option value="year">Année en cours</option>
              <option value="custom">Plage personnalisée (Du/Au)...</option>
            </select>
          </div>
        </div>

        {/* Collapsible Advanced Filters Section */}
        {showAdvancedFilters && (
          <div className="bg-slate-50 p-4 border border-slate-200 space-y-4 animate-in fade-in duration-200">
            <div className="text-[11px] font-black uppercase tracking-widest text-blue-900 border-b border-slate-200 pb-2 flex items-center space-x-2">
              <SlidersHorizontal className="w-4 h-4 text-blue-600" />
              <span>Filtres de Recherche Avancée (Date, Transporteur, Type de Véhicule)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Section 1: Filtre par Date Avancé */}
              <div className="bg-white p-3.5 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Filtre par Date d'Arrivée</span>
                  </label>
                  {(startDate || endDate || datePreset !== 'all') && (
                    <button
                      type="button"
                      onClick={() => handleDatePresetChange('all')}
                      className="text-[10px] text-rose-600 hover:text-rose-800 font-bold uppercase"
                    >
                      Effacer
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  {[
                    { id: 'today', label: "Aujourd'hui" },
                    { id: '7days', label: '7J' },
                    { id: '30days', label: '30J' },
                    { id: 'month', label: 'Ce mois' },
                    { id: 'year', label: 'Cette année' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleDatePresetChange(datePreset === p.id ? 'all' : p.id)}
                      className={`px-2 py-0.5 text-[10px] font-bold border transition ${
                        datePreset === p.id
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-500 block mb-0.5">Date Début (Du)</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setDatePreset('custom');
                      }}
                      className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs p-1.5 focus:outline-none focus:border-blue-600 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-slate-500 block mb-0.5">Date Fin (Au)</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setDatePreset('custom');
                      }}
                      className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs p-1.5 focus:outline-none focus:border-blue-600 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Filtre par Transporteur & Chauffeur */}
              <div className="bg-white p-3.5 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center space-x-1.5">
                    <Truck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Filtre par Transporteur</span>
                  </label>
                  {(selectedCarrier || carrierSearch) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCarrier('');
                        setCarrierSearch('');
                      }}
                      className="text-[10px] text-rose-600 hover:text-rose-800 font-bold uppercase"
                    >
                      Effacer
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase text-slate-500 block mb-0.5">Société de Transport</label>
                  <select
                    value={selectedCarrier}
                    onChange={(e) => setSelectedCarrier(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold p-1.5 focus:outline-none focus:border-blue-600"
                  >
                    <option value="">Tous les transporteurs</option>
                    {availableCarriers.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase text-slate-500 block mb-0.5">Chauffeur / Plaque Camion</label>
                  <input
                    type="text"
                    value={carrierSearch}
                    onChange={(e) => setCarrierSearch(e.target.value)}
                    placeholder="Nom chauffeur, immatriculation camion..."
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 text-xs p-1.5 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Section 3: Filtre par Type & Silhouette de Véhicule */}
              <div className="bg-white p-3.5 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center space-x-1.5">
                    <Car className="w-3.5 h-3.5 text-blue-600" />
                    <span>Filtre Type de Véhicule</span>
                  </label>
                  {(selectedCategory || selectedFuelType) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('');
                        setSelectedFuelType('');
                      }}
                      className="text-[10px] text-rose-600 hover:text-rose-800 font-bold uppercase"
                    >
                      Effacer
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase text-slate-500 block mb-0.5">Type / Silhouette</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold p-1.5 focus:outline-none focus:border-blue-600"
                  >
                    <option value="">Tous les types (SUV, Berline, VU...)</option>
                    {availableCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase text-slate-500 block mb-0.5">Énergie / Carburant</label>
                  <select
                    value={selectedFuelType}
                    onChange={(e) => setSelectedFuelType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold p-1.5 focus:outline-none focus:border-blue-600"
                  >
                    <option value="">Toutes les motorisations</option>
                    {availableFuelTypes.map((fuel) => (
                      <option key={fuel} value={fuel}>
                        {fuel}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active Filters Summary Pills */}
        {(searchTerm ||
          selectedSite ||
          selectedBrand ||
          selectedModel ||
          selectedStatus ||
          selectedCarrier ||
          carrierSearch ||
          selectedCategory ||
          selectedFuelType ||
          datePreset !== 'all' ||
          startDate ||
          endDate) && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="text-[10px] font-black uppercase text-slate-400">Filtres actifs :</span>
            {selectedBrand && (
              <span className="bg-blue-100 text-blue-900 border border-blue-300 text-[10px] font-bold uppercase px-2 py-0.5 flex items-center space-x-1">
                <span>Marque: {selectedBrand}</span>
                <button onClick={() => setSelectedBrand('')} className="hover:text-rose-600 font-black ml-1">
                  ✕
                </button>
              </span>
            )}
            {selectedModel && (
              <span className="bg-sky-100 text-sky-900 border border-sky-300 text-[10px] font-bold uppercase px-2 py-0.5 flex items-center space-x-1">
                <span>Modèle: {selectedModel}</span>
                <button onClick={() => setSelectedModel('')} className="hover:text-rose-600 font-black ml-1">
                  ✕
                </button>
              </span>
            )}
            {selectedSite && (
              <span className="bg-indigo-100 text-indigo-900 border border-indigo-300 text-[10px] font-bold uppercase px-2 py-0.5 flex items-center space-x-1">
                <span>Site: {siteMap.get(selectedSite) || selectedSite}</span>
                <button onClick={() => setSelectedSite('')} className="hover:text-rose-600 font-black ml-1">
                  ✕
                </button>
              </span>
            )}
            {selectedStatus && (
              <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold uppercase px-2 py-0.5 flex items-center space-x-1">
                <span>Statut: {selectedStatus}</span>
                <button onClick={() => setSelectedStatus('')} className="hover:text-rose-600 font-black ml-1">
                  ✕
                </button>
              </span>
            )}
            {selectedCarrier && (
              <span className="bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-bold uppercase px-2 py-0.5 flex items-center space-x-1">
                <Truck className="w-3 h-3 text-purple-700" />
                <span>Transporteur: {selectedCarrier}</span>
                <button onClick={() => setSelectedCarrier('')} className="hover:text-rose-600 font-black ml-1">
                  ✕
                </button>
              </span>
            )}
            {carrierSearch && (
              <span className="bg-purple-50 text-purple-900 border border-purple-200 text-[10px] font-bold px-2 py-0.5 flex items-center space-x-1">
                <span>Chauffeur/Camion: "{carrierSearch}"</span>
                <button onClick={() => setCarrierSearch('')} className="hover:text-rose-600 font-black ml-1">
                  ✕
                </button>
              </span>
            )}
            {selectedCategory && (
              <span className="bg-teal-100 text-teal-900 border border-teal-300 text-[10px] font-bold uppercase px-2 py-0.5 flex items-center space-x-1">
                <Car className="w-3 h-3 text-teal-700" />
                <span>Type: {selectedCategory}</span>
                <button onClick={() => setSelectedCategory('')} className="hover:text-rose-600 font-black ml-1">
                  ✕
                </button>
              </span>
            )}
            {selectedFuelType && (
              <span className="bg-cyan-100 text-cyan-900 border border-cyan-300 text-[10px] font-bold uppercase px-2 py-0.5 flex items-center space-x-1">
                <Fuel className="w-3 h-3 text-cyan-700" />
                <span>Énergie: {selectedFuelType}</span>
                <button onClick={() => setSelectedFuelType('')} className="hover:text-rose-600 font-black ml-1">
                  ✕
                </button>
              </span>
            )}
            {(datePreset !== 'all' || startDate || endDate) && (
              <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-bold uppercase px-2 py-0.5 flex items-center space-x-1">
                <Calendar className="w-3 h-3 text-emerald-700" />
                <span>
                  Date:{' '}
                  {startDate || endDate
                    ? `${startDate || '...'} → ${endDate || '...'}`
                    : datePreset === 'today'
                    ? "Aujourd'hui"
                    : datePreset === '7days'
                    ? '7 derniers jours'
                    : datePreset === '30days'
                    ? '30 derniers jours'
                    : datePreset === 'month'
                    ? 'Ce mois-ci'
                    : datePreset === 'year'
                    ? 'Cette année'
                    : datePreset}
                </span>
                <button
                  onClick={() => handleDatePresetChange('all')}
                  className="hover:text-rose-600 font-black ml-1"
                >
                  ✕
                </button>
              </span>
            )}
            {searchTerm && (
              <span className="bg-slate-200 text-slate-900 border border-slate-400 text-[10px] font-bold uppercase px-2 py-0.5 flex items-center space-x-1 font-mono">
                <span>Recherche: "{searchTerm}"</span>
                <button onClick={() => setSearchTerm('')} className="hover:text-rose-600 font-black ml-1">
                  ✕
                </button>
              </span>
            )}
            <button
              onClick={resetFilters}
              className="text-[10px] text-rose-600 hover:text-rose-800 font-bold uppercase underline ml-2"
            >
              Tout effacer
            </button>
          </div>
        )}
      </div>

      {/* Batch Movement Success Notification */}
      {batchSuccessMsg && (
        <div className="p-3 bg-emerald-50 border-l-4 border-emerald-600 text-emerald-950 text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{batchSuccessMsg}</span>
          </div>
          <button
            onClick={() => setBatchSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-950 font-black px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Multi-Selection Action Toolbar */}
      {selectedVehicleIds.length > 0 && (
        <div className="bg-slate-900 text-white p-3.5 px-5 flex flex-wrap items-center justify-between gap-3 border-b-2 border-amber-400">
          <div className="flex items-center space-x-3">
            <div className="bg-amber-400 text-slate-950 px-3 py-1 text-xs font-black font-mono flex items-center space-x-2 shadow-sm">
              <CheckSquare className="w-4 h-4 text-slate-950" />
              <span>{selectedVehicleIds.length} véhicule(s) sélectionné(s)</span>
            </div>
            <p className="text-xs text-slate-300 font-medium hidden sm:block">
              Sélection groupée pour opération de transfert de parc ou livraison
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSelectedVehicleIds(filteredVehicles.map((v) => v.id))}
              className="px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 uppercase tracking-wider"
            >
              Tout sélectionner ({filteredVehicles.length})
            </button>
            <button
              onClick={() => setSelectedVehicleIds([])}
              className="px-2.5 py-1 text-[11px] font-bold text-rose-300 hover:text-rose-200 border border-slate-700 hover:border-rose-500/50 uppercase tracking-wider"
            >
              Désélectionner tout
            </button>

            <button
              onClick={() => setShowBatchMovementModal(true)}
              className="ml-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider flex items-center space-x-2 shadow-md transition"
            >
              <Layers className="w-4 h-4 text-amber-300" />
              <span>Déclarer Mouvement Groupé ({selectedVehicleIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Inventory Table */}
      <div className="bg-white border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
            <p className="text-xs font-bold uppercase tracking-wider">Chargement de l inventaire...</p>
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <Car className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-sm font-bold uppercase text-slate-700">Aucun véhicule trouvé</p>
            <p className="text-xs max-w-sm mx-auto">
              Aucun résultat ne correspond à vos critères de recherche ou filtres.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white border-b border-slate-700">
                  <th className="px-3 py-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={filteredVehicles.length > 0 && selectedVehicleIds.length === filteredVehicles.length}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded-none border-slate-400 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      title={selectedVehicleIds.length === filteredVehicles.length ? 'Désélectionner tout' : 'Tout sélectionner'}
                    />
                  </th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest">VIN (N° Châssis)</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest">Marque</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest">Modèle</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest">Site de Départ</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest">Site d’Arrivée</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest">Statut &amp; Facturation</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest">Date d’ajout</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVehicles.map((v) => {
                  const currentSiteName = v.current_site_id ? siteMap.get(v.current_site_id) : null;
                  const departDisplay = v.site_depart || 'Port / Concessionnaire';
                  const arriveeDisplay = v.site_arrivee || currentSiteName || 'En Stock';
                  const dateAdded = v.created_at || v.arrival_date;

                  const soldedDetails = getVehicleSoldedDetails(v, invoices, movements);
                  const isDelivered = soldedDetails.isDelivered;
                  const isBilled = soldedDetails.isBilled;
                  const isPaid = soldedDetails.isPaid;

                  return (
                    <tr
                      key={v.id}
                      onClick={() => onSelectVehicle(v)}
                      className={`hover:bg-slate-50 cursor-pointer transition border-b border-slate-100 ${
                        selectedVehicleIds.includes(v.id) ? 'bg-blue-50/60' : ''
                      }`}
                    >
                      {/* Checkbox Column */}
                      <td className="px-3 py-3 text-center w-10" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedVehicleIds.includes(v.id)}
                          onChange={(e) => handleToggleSelectVehicle(e, v.id)}
                          className="w-4 h-4 rounded-none border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* 1. VIN */}
                      <td className="px-5 py-3 font-mono text-xs font-black text-slate-900 tracking-wider">
                        <div className="flex items-center space-x-1.5">
                          <span>{v.chassis_number || v.vin}</span>
                          <button
                            onClick={(e) => handleCopyChassis(e, v.chassis_number || v.vin || '')}
                            title="Copier le VIN"
                            className="text-slate-400 hover:text-blue-600 transition p-0.5"
                          >
                            {copiedChassis === (v.chassis_number || v.vin) ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* 2. Marque */}
                      <td className="px-5 py-3 font-bold uppercase text-slate-900 text-xs">
                        {v.brand}
                      </td>

                      {/* 3. Modèle */}
                      <td className="px-5 py-3 font-bold uppercase text-slate-800 text-xs">
                        {v.model}
                      </td>

                      {/* 4. Site de Départ */}
                      <td className="px-5 py-3 text-xs text-slate-700 font-medium">
                        <span className="inline-flex items-center space-x-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{departDisplay}</span>
                        </span>
                      </td>

                      {/* 5. Site d'Arrivée */}
                      <td className="px-5 py-3 text-xs font-bold text-slate-900">
                        <span className="inline-flex items-center space-x-1">
                          <Building2 className="w-3.5 h-3.5 text-blue-600" />
                          <span>{arriveeDisplay}</span>
                        </span>
                      </td>

                      {/* 6. Statut & Facturation */}
                      <td className="px-5 py-3 text-xs">
                        {isDelivered ? (
                          isBilled ? (
                            isPaid ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-950 text-white font-mono text-[10px] font-black uppercase tracking-wider">
                                <FileCheck className="w-3 h-3 text-emerald-400" />
                                <span>Soldé</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black uppercase tracking-wider">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Facturé {soldedDetails.invoiceNumber ? `(${soldedDetails.invoiceNumber})` : ''}</span>
                              </span>
                            )
                          ) : (
                            <div className="flex items-center space-x-1.5">
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black uppercase tracking-wider">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Livré - À Facturer</span>
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBillingVehicle(v);
                                }}
                                className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] uppercase tracking-wider transition flex items-center space-x-1 shadow-xs"
                                title="Facturer directement ce véhicule"
                              >
                                <Receipt className="w-3 h-3" />
                                <span>Facturer</span>
                              </button>
                            </div>
                          )
                        ) : (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                              v.status === 'en_stock'
                                ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                : v.status === 'en_transit'
                                ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                                : v.status === 'sortie_proprietaire'
                                ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                : 'bg-slate-100 text-slate-800 border border-slate-200'
                            }`}
                          >
                            {v.status === 'en_stock'
                              ? 'En Stock'
                              : v.status === 'en_transit'
                              ? 'En Transit'
                              : v.status === 'sortie_proprietaire'
                              ? 'Sortie Prop.'
                              : v.status}
                          </span>
                        )}
                      </td>

                      {/* 7. Date d'ajout */}
                      <td className="px-5 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {formatDateTime(dateAdded)}
                      </td>

                      {/* 8. Actions */}
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {isDelivered && !isBilled && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBillingVehicle(v);
                              }}
                              className="inline-flex items-center space-x-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] uppercase tracking-wider px-2 py-1 transition shadow-xs"
                              title="Facturer la livraison"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              <span>Facturer</span>
                            </button>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectVehicle(v);
                            }}
                            className="inline-flex items-center space-x-1 text-slate-900 hover:bg-slate-900 hover:text-white font-bold text-[10px] uppercase tracking-wider px-2 py-1 border border-slate-300 transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Fiche</span>
                          </button>
                          {userRole !== 'viewer' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingVehicle(v);
                              }}
                              title="Supprimer du stock"
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DELETE VEHICLE CONFIRMATION MODAL */}
      {deletingVehicle && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-rose-600 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider">
                Supprimer le Véhicule
              </h3>
            </div>
            <p className="text-xs text-slate-700 font-medium">
              Voulez-vous vraiment supprimer définitivement le véhicule <strong className="text-slate-900">{deletingVehicle.chassis_number}</strong> ({deletingVehicle.brand} {deletingVehicle.model}) de l'inventaire ?
            </p>
            <div className="flex justify-end space-x-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setDeletingVehicle(null)}
                className="px-4 py-2 text-xs text-slate-700 font-bold uppercase tracking-wider border border-slate-300 hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteVehicle}
                disabled={submittingDelete}
                className="px-5 py-2 text-xs bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-wider"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MANUAL VEHICLE CREATION MODAL */}
      {showManualModal && (
        <NewVehicleStockModal
          sites={sites}
          existingVehicles={vehicles}
          initialTab="manual"
          initialVin={initialVinForAddModal}
          onClose={() => {
            setShowManualModal(false);
            setInitialVinForAddModal(undefined);
          }}
          onSuccess={() => {
            setShowManualModal(false);
            setInitialVinForAddModal(undefined);
            onRefresh();
          }}
        />
      )}

      {/* CSV IMPORT WIZARD MODAL */}
      {showCsvModal && (
        <NewVehicleStockModal
          sites={sites}
          existingVehicles={vehicles}
          initialTab="csv"
          onClose={() => setShowCsvModal(false)}
          onSuccess={() => {
            setShowCsvModal(false);
            onRefresh();
          }}
        />
      )}

      {/* BARCODE / VIN CAMERA SCANNER MODAL */}
      <QrBarcodeScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onScanSuccess={handleScanSuccess}
        sampleChassisList={vehicles.map((v) => v.chassis_number || v.vin).filter(Boolean)}
      />

      {/* PURGE / RESET ALL STOCK MODAL */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-rose-600 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center space-x-2 text-rose-600">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider">
                  Vider & Réinitialiser Tout le Stock
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowPurgeModal(false);
                  setPurgeConfirmInput('');
                }}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm px-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-rose-50 border-l-4 border-rose-600 p-3.5 text-xs text-rose-950 leading-relaxed">
                <strong className="font-black uppercase text-rose-700 block mb-1">Attention : Action irréversible !</strong>
                <p>
                  Vous allez supprimer définitivement l'ensemble des <strong className="font-mono font-black">{vehicles.length} véhicules</strong> actuellement enregistrés, ainsi que tous leurs historiques de mouvements associés.
                </p>
                <p className="mt-2 text-rose-800 font-semibold">
                  Cette action vous permettra de réimporter ou enregistrer un <strong>nouveau stock</strong> entièrement propre.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                  Veuillez saisir <span className="text-rose-600 font-mono font-black select-all">SUPPRIMER</span> pour déverrouiller :
                </label>
                <input
                  type="text"
                  value={purgeConfirmInput}
                  onChange={(e) => setPurgeConfirmInput(e.target.value)}
                  placeholder="Tapez SUPPRIMER ici"
                  className="w-full text-xs font-mono font-bold px-3 py-2 border border-slate-300 rounded-none focus:outline-none focus:ring-2 focus:ring-rose-500 uppercase"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowPurgeModal(false);
                  setPurgeConfirmInput('');
                }}
                className="px-4 py-2 text-xs text-slate-700 font-bold uppercase tracking-wider border border-slate-300 hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handlePurgeStock}
                disabled={purgeConfirmInput.trim().toUpperCase() !== 'SUPPRIMER' || submittingPurge}
                className="flex items-center space-x-2 px-5 py-2 text-xs bg-rose-600 hover:bg-rose-500 disabled:bg-rose-300 text-white font-black uppercase tracking-wider transition shadow-sm"
              >
                {submittingPurge ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Suppression...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Confirmer Suppression Stock</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* QUICK BILL VEHICLE MODAL */}
      {billingVehicle && (
        <QuickBillVehicleModal
          vehicle={billingVehicle}
          onClose={() => setBillingVehicle(null)}
          onSuccess={() => {
            setBillingVehicle(null);
            onRefresh();
          }}
        />
      )}

      {/* BATCH MOVEMENT MODAL */}
      {showBatchMovementModal && (
        <BatchMovementModal
          selectedVehicles={vehicles.filter((v) => selectedVehicleIds.includes(v.id))}
          sites={sites}
          onClose={() => setShowBatchMovementModal(false)}
          onSuccess={(count, destName) => {
            setSelectedVehicleIds([]);
            setBatchSuccessMsg(`Mouvement groupé de ${count} véhicule(s) effectué avec succès vers "${destName}".`);
            onRefresh();
          }}
        />
      )}
    </div>
  );
};
