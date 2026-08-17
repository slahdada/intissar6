import React, { useState, useMemo } from 'react';
import {
  History,
  Search,
  Download,
  FileText,
  Calendar,
  Building2,
  Filter,
  ArrowRight,
  UserCheck,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  RefreshCw,
  Eye,
  Info,
  Receipt,
  Printer,
  Pencil,
  Route,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  LayoutList,
  Clock,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Car,
  Truck,
  SlidersHorizontal,
  Fuel,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MovementWithDetails, Site, MovementType, UserRole, User, Vehicle } from '../types';
import { formatDateTime } from '../lib/dateUtils';
import { MovementDetailModal } from './MovementDetailModal';
import { EditMovementModal } from './EditMovementModal';
import { BillingModal } from './BillingModal';
import { VinTraceabilityModal } from './VinTraceabilityModal';
import { OFFICIAL_IMPORTERS, getImporterForBrand } from '../data/importers';
import { generateMovementVoucherPDF } from '../lib/pdfVoucher';

interface MovementsHistoryProps {
  movements: MovementWithDetails[];
  sites: Site[];
  vehicles?: Vehicle[];
  loading: boolean;
  onSelectVehicle: (chassis: string) => void;
  onRefresh: () => void;
  userRole?: UserRole;
  currentUser?: User;
}

export const MovementsHistory: React.FC<MovementsHistoryProps> = ({
  movements,
  sites,
  vehicles = [],
  loading,
  onSelectVehicle,
  onRefresh,
  userRole,
  currentUser,
}) => {
  const [searchChassis, setSearchChassis] = useState('');
  const [selectedSite, setSelectedSite] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedImporter, setSelectedImporter] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedCarrier, setSelectedCarrier] = useState('');
  const [carrierSearch, setCarrierSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedFuelType, setSelectedFuelType] = useState('');
  const [datePreset, setDatePreset] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [selectedMovement, setSelectedMovement] = useState<MovementWithDetails | null>(null);
  const [editingMovement, setEditingMovement] = useState<MovementWithDetails | null>(null);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [traceabilityVin, setTraceabilityVin] = useState<string | null>(null);

  // Calendar View State
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [calendarSubView, setCalendarSubView] = useState<'grid' | 'agenda'>('grid');

  // Month navigation helpers
  const handlePrevMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
    setSelectedDateStr(null);
  };

  const handleNextMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
    setSelectedDateStr(null);
  };

  const handleTodayMonth = () => {
    const today = new Date();
    setCalendarDate(today);
    setSelectedDateStr(today.toISOString().split('T')[0]);
  };

  // Auto pre-select importer when brand filter is chosen
  const handleBrandFilterChange = (brandVal: string) => {
    setSelectedBrand(brandVal);
    setSelectedModel('');
    if (brandVal) {
      const imp = getImporterForBrand(brandVal);
      if (imp) {
        setSelectedImporter(imp.id);
      }
    }
  };

  // Available brands in system
  const availableBrands = Array.from(
    new Set(movements.map((m) => m.vehicle_brand).filter(Boolean))
  ).sort() as string[];

  // Available models in system (filtered by selected brand if any)
  const availableModels = Array.from(
    new Set(
      movements
        .filter((m) => !selectedBrand || (m.vehicle_brand && m.vehicle_brand.toLowerCase() === selectedBrand.toLowerCase()))
        .map((m) => m.vehicle_model)
        .filter(Boolean)
    )
  ).sort() as string[];

  // Fast Vehicle Map to lookup vehicle attributes by ID / Chassis
  const vehicleMap = useMemo(() => {
    const map = new Map<string, Vehicle>();
    if (vehicles && vehicles.length > 0) {
      vehicles.forEach((v) => {
        if (v.id) map.set(v.id, v);
        if (v.chassis_number) map.set(v.chassis_number.toLowerCase(), v);
        if (v.vin) map.set(v.vin.toLowerCase(), v);
      });
    }
    return map;
  }, [vehicles]);

  // Extract distinct carriers from movements and vehicles
  const availableCarriers = useMemo(() => {
    const set = new Set<string>();
    movements.forEach((m) => {
      if (m.transporter_name && m.transporter_name.trim()) set.add(m.transporter_name.trim());
      if (m.carrier_id && m.carrier_id.trim()) set.add(m.carrier_id.trim());
    });
    if (vehicles) {
      vehicles.forEach((v) => {
        if (v.carrier_name && v.carrier_name.trim()) set.add(v.carrier_name.trim());
      });
    }
    return Array.from(set).sort();
  }, [movements, vehicles]);

  // Extract distinct categories / body types
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    if (vehicles) {
      vehicles.forEach((v) => {
        if (v.category && v.category.trim()) set.add(v.category.trim());
        if (v.body_style && v.body_style.trim()) set.add(v.body_style.trim());
      });
    }
    const standardCategories = ['Citadine', 'Berline', 'SUV / 4x4', 'Utilitaire / VU', 'Pick-up', 'Compacte', 'Monospace'];
    standardCategories.forEach((c) => set.add(c));
    return Array.from(set).sort();
  }, [vehicles]);

  // Extract distinct fuel types
  const availableFuelTypes = useMemo(() => {
    const set = new Set<string>();
    if (vehicles) {
      vehicles.forEach((v) => {
        if (v.fuel_type && v.fuel_type.trim()) set.add(v.fuel_type.trim());
      });
    }
    const standardFuels = ['Essence', 'Diesel', 'Hybride', 'Électrique'];
    standardFuels.forEach((f) => set.add(f));
    return Array.from(set).sort();
  }, [vehicles]);

  // Smart Category Matcher
  const matchCategoryHelper = (catOrBody: string | undefined, model: string | undefined, catFilter: string): boolean => {
    if (!catFilter) return true;
    const target = catFilter.toLowerCase().trim();
    if (catOrBody && catOrBody.toLowerCase().includes(target)) return true;

    const m = (model || '').toLowerCase();
    if (target.includes('suv') || target.includes('4x4')) {
      const suvKeywords = [
        '2008', '3008', '5008', 'c3 aircross', 'c5 aircross', 'duster', 'tucson', 'sportage',
        'rav4', 't-roc', 'tiguan', 'crossland', 'grandland', 'mokka', 'captur', 'austral',
        'qashqai', 'kona', 'bayon', 'stonic', 'sorento', 'renegade', 'compass', 'wrangler',
        'tonale', 'stelvio', 'puma', 'kuga', 'cx-30', 'cx-5', 'tiggo', 'coolray', 'azkarra',
        'jolion', 'h6', 'atto 3', 'cs35', 'cs55', 'cs75', 'stepway'
      ];
      if (suvKeywords.some((k) => m.includes(k))) return true;
    }
    if (target.includes('citadine') || target.includes('compacte')) {
      const smallKeywords = [
        '108', '208', 'c1', 'c3', 'clio', 'sandero', 'polo', 'golf', 'yaris', 'i10', 'i20',
        'picanto', 'rio', 'swift', 'dzire', 'baleno', '500', 'panda', 'corsa', 'fiesta',
        'fabia', 'ibiza', 'mg3', 'dolphin', 'spring', 'ami', 'zoe', 'twingo'
      ];
      if (smallKeywords.some((k) => m.includes(k))) return true;
    }
    if (target.includes('utilitaire') || target.includes('vu') || target.includes('fourgon')) {
      const vanKeywords = [
        'partner', 'expert', 'boxer', 'rifter', 'berlingo', 'jumpy', 'jumper', 'express',
        'kangoo', 'trafic', 'master', 'fiorino', 'doblo', 'ducato', 'scudo', 'combo', 'vivaro',
        'movano', 'caddy', 'crafter', 'transporter', 'proace', 'sprinter', 'vito', 'transit',
        'townstar', 'k2500', 'h100', 'staria'
      ];
      if (vanKeywords.some((k) => m.includes(k))) return true;
    }
    if (target.includes('pick-up') || target.includes('pickup')) {
      const pickupKeywords = ['landtrek', 'hilux', 'navara', 'ranger', 'amarok', 'titano', 'wingle', 'poer', 'hunter'];
      if (pickupKeywords.some((k) => m.includes(k))) return true;
    }
    if (target.includes('berline')) {
      const sedanKeywords = [
        '301', '308', '408', '508', 'c-elysee', 'c4', 'c4 x', 'tipo', 'logan', 'megane',
        'passat', 'corolla', 'i30', 'ceed', 'civic', 'alsvin', 'arrizo', 'emgrand', 'seal',
        'han', 'octavia', 'superb', 'classe c', 'classe e', 'serie 3', 'serie 5'
      ];
      if (sedanKeywords.some((k) => m.includes(k))) return true;
    }
    if (target.includes('monospace')) {
      const monoKeywords = ['rifter', 'berlingo', 'combo', 'caddy', 'jogger', 'scenic', 'espace', 'staria'];
      if (monoKeywords.some((k) => m.includes(k))) return true;
    }
    return false;
  };

  // Date Preset Switcher
  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
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

  const setPresetDate = (days: number) => {
    if (days === 0) {
      handleDatePresetChange('today');
    } else if (days === 7) {
      handleDatePresetChange('7days');
    } else if (days === 30) {
      handleDatePresetChange('30days');
    }
  };

  const resetAllFilters = () => {
    setSearchChassis('');
    setSelectedSite('');
    setSelectedType('');
    setSelectedImporter('');
    setSelectedBrand('');
    setSelectedModel('');
    setSelectedCarrier('');
    setCarrierSearch('');
    setSelectedCategory('');
    setSelectedFuelType('');
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
  };

  const activeAdvancedCount = useMemo(() => {
    let count = 0;
    if (selectedCarrier) count++;
    if (carrierSearch) count++;
    if (selectedCategory) count++;
    if (selectedFuelType) count++;
    if (startDate || endDate || (datePreset !== 'all' && datePreset !== '')) count++;
    return count;
  }, [selectedCarrier, carrierSearch, selectedCategory, selectedFuelType, startDate, endDate, datePreset]);

  const siteMap = new Map<string, string>();
  sites.forEach((s) => siteMap.set(s.id, s.name));

  // Base movements matching all active filters EXCEPT selectedType
  const baseFilteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const chassis = m.vehicle_chassis || m.chassis_number || '';
      const brand = m.vehicle_brand || '';
      const model = m.vehicle_model || '';
      const query = searchChassis.toLowerCase().trim();

      const linkedVehicle =
        (m.vehicle_id ? vehicleMap.get(m.vehicle_id) : undefined) ||
        (chassis ? vehicleMap.get(chassis.toLowerCase()) : undefined);

      const imp = getImporterForBrand(brand);

      const matchesSearch =
        !query ||
        chassis.toLowerCase().includes(query) ||
        brand.toLowerCase().includes(query) ||
        model.toLowerCase().includes(query) ||
        (m.destination_reference && m.destination_reference.toLowerCase().includes(query)) ||
        (m.delivery_note_ref && m.delivery_note_ref.toLowerCase().includes(query));

      const matchesSite =
        !selectedSite || m.departure_site_id === selectedSite || m.arrival_site_id === selectedSite;
      const matchesImporter = !selectedImporter || imp?.id === selectedImporter;
      const matchesBrand = !selectedBrand || brand.toLowerCase() === selectedBrand.toLowerCase();
      const matchesModel = !selectedModel || model.toLowerCase() === selectedModel.toLowerCase();

      // Carrier filtering
      let matchesCarrier = true;
      if (selectedCarrier) {
        const cTarget = selectedCarrier.toLowerCase().trim();
        const mCarrier = (m.transporter_name || m.carrier_id || '').toLowerCase();
        const vCarrier = (linkedVehicle?.carrier_name || '').toLowerCase();
        matchesCarrier = mCarrier.includes(cTarget) || vCarrier.includes(cTarget);
      }

      // Carrier search string (driver name, truck plate, note ref, transporter)
      let matchesCarrierSearch = true;
      if (carrierSearch) {
        const csTarget = carrierSearch.toLowerCase().trim();
        const mDriver = (m.driver_name || '').toLowerCase();
        const mPhone = (m.driver_phone || '').toLowerCase();
        const mPlate = (m.truck_plate || '').toLowerCase();
        const mCarrier = (m.transporter_name || m.carrier_id || '').toLowerCase();
        const mDoc = (m.delivery_note_ref || '').toLowerCase();
        const vDriver = (linkedVehicle?.driver_name || '').toLowerCase();
        const vPlate = (linkedVehicle?.truck_plate || '').toLowerCase();

        matchesCarrierSearch =
          mDriver.includes(csTarget) ||
          mPhone.includes(csTarget) ||
          mPlate.includes(csTarget) ||
          mCarrier.includes(csTarget) ||
          mDoc.includes(csTarget) ||
          vDriver.includes(csTarget) ||
          vPlate.includes(csTarget);
      }

      // Vehicle category / silhouette filtering
      let matchesCategory = true;
      if (selectedCategory) {
        const catOrBody = linkedVehicle?.category || linkedVehicle?.body_style || '';
        matchesCategory = matchCategoryHelper(catOrBody, model, selectedCategory);
      }

      // Vehicle fuel type / engine
      let matchesFuelType = true;
      if (selectedFuelType) {
        const vFuel = (linkedVehicle?.fuel_type || '').toLowerCase();
        matchesFuelType = vFuel === selectedFuelType.toLowerCase() || vFuel.includes(selectedFuelType.toLowerCase());
      }

      // Date range filtering
      let matchesDate = true;
      if (startDate) {
        matchesDate = matchesDate && new Date(m.movement_date) >= new Date(startDate);
      }
      if (endDate) {
        matchesDate = matchesDate && new Date(m.movement_date) <= new Date(`${endDate}T23:59:59.999Z`);
      }

      return (
        matchesSearch &&
        matchesSite &&
        matchesImporter &&
        matchesBrand &&
        matchesModel &&
        matchesCarrier &&
        matchesCarrierSearch &&
        matchesCategory &&
        matchesFuelType &&
        matchesDate
      );
    });
  }, [
    movements,
    searchChassis,
    selectedSite,
    selectedImporter,
    selectedBrand,
    selectedModel,
    selectedCarrier,
    carrierSearch,
    selectedCategory,
    selectedFuelType,
    startDate,
    endDate,
    vehicleMap,
  ]);

  // Dynamic counts for each operation type based on active search/site/brand/model/date filters
  const typeCounts = useMemo(() => {
    let entry = 0;
    let transfer = 0;
    let exit = 0;

    for (const m of baseFilteredMovements) {
      if (m.movement_type === 'entry') entry++;
      else if (m.movement_type === 'transfer') transfer++;
      else if (m.movement_type === 'exit') exit++;
    }

    return {
      all: baseFilteredMovements.length,
      entry,
      transfer,
      exit,
    };
  }, [baseFilteredMovements]);

  // Final filtered list including selectedType
  const filteredMovements = useMemo(() => {
    if (!selectedType) return baseFilteredMovements;
    return baseFilteredMovements.filter((m) => m.movement_type === selectedType);
  }, [baseFilteredMovements, selectedType]);

  // Group movements by YYYY-MM-DD date key
  const movementsByDate = useMemo(() => {
    const map = new Map<string, MovementWithDetails[]>();
    for (const m of filteredMovements) {
      if (!m.movement_date) continue;
      const dateKey = m.movement_date.split('T')[0].split(' ')[0];
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(m);
    }
    // Sort movements inside each day by time
    map.forEach((movs) => {
      movs.sort((a, b) => new Date(b.movement_date).getTime() - new Date(a.movement_date).getTime());
    });
    return map;
  }, [filteredMovements]);

  // Movements for current selected calendar month
  const calendarMonthMovements = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    return filteredMovements.filter((m) => {
      if (!m.movement_date) return false;
      const d = new Date(m.movement_date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }, [filteredMovements, calendarDate]);

  // Monthly stats
  const calendarMonthStats = useMemo(() => {
    let entries = 0;
    let transfers = 0;
    let exits = 0;
    for (const m of calendarMonthMovements) {
      if (m.movement_type === 'entry') entries++;
      else if (m.movement_type === 'transfer') transfers++;
      else if (m.movement_type === 'exit') exits++;
    }
    return {
      total: calendarMonthMovements.length,
      entries,
      transfers,
      exits,
    };
  }, [calendarMonthMovements]);

  // Calendar monthly grid calculation (Monday through Sunday)
  const calendarGrid = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Monday-based offset (0=Mon, 6=Sun)
    let startDayOffset = firstDayOfMonth.getDay() - 1;
    if (startDayOffset < 0) startDayOffset = 6;

    const daysInMonth = lastDayOfMonth.getDate();

    const gridCells: {
      dateKey: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      movements: MovementWithDetails[];
    }[] = [];

    const todayStr = new Date().toISOString().split('T')[0];

    // Padding from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOffset - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      const pDate = new Date(year, month - 1, day);
      const yearP = pDate.getFullYear();
      const monthP = String(pDate.getMonth() + 1).padStart(2, '0');
      const dayP = String(day).padStart(2, '0');
      const dateKey = `${yearP}-${monthP}-${dayP}`;
      gridCells.push({
        dateKey,
        dayNum: day,
        isCurrentMonth: false,
        isToday: dateKey === todayStr,
        movements: movementsByDate.get(dateKey) || [],
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const dateKey = `${year}-${monthStr}-${dayStr}`;
      gridCells.push({
        dateKey,
        dayNum: day,
        isCurrentMonth: true,
        isToday: dateKey === todayStr,
        movements: movementsByDate.get(dateKey) || [],
      });
    }

    // Padding for next month
    const totalCells = gridCells.length <= 35 ? 35 : 42;
    const remaining = totalCells - gridCells.length;
    for (let day = 1; day <= remaining; day++) {
      const nDate = new Date(year, month + 1, day);
      const yearN = nDate.getFullYear();
      const monthN = String(nDate.getMonth() + 1).padStart(2, '0');
      const dayN = String(day).padStart(2, '0');
      const dateKey = `${yearN}-${monthN}-${dayN}`;
      gridCells.push({
        dateKey,
        dayNum: day,
        isCurrentMonth: false,
        isToday: dateKey === todayStr,
        movements: movementsByDate.get(dateKey) || [],
      });
    }

    return gridCells;
  }, [calendarDate, movementsByDate]);

  // Movements to display in Agenda section
  const agendaListMovements = useMemo(() => {
    if (selectedDateStr) {
      return movementsByDate.get(selectedDateStr) || [];
    }
    return calendarMonthMovements;
  }, [selectedDateStr, movementsByDate, calendarMonthMovements]);

  const getTimeFromDate = (dateStr: string) => {
    if (!dateStr) return '--:--';
    try {
      const parts = dateStr.split('T');
      if (parts.length > 1) {
        return parts[1].substring(0, 5);
      }
      const spaceParts = dateStr.split(' ');
      if (spaceParts.length > 1) {
        return spaceParts[1].substring(0, 5);
      }
      return '--:--';
    } catch {
      return '--:--';
    }
  };

  const getMovementTimingBadge = (movementDateStr: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const movDateStr = movementDateStr.split('T')[0].split(' ')[0];
    const movDate = new Date(movementDateStr);
    const now = new Date();

    if (movDateStr === todayStr) {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 text-[9px] font-black uppercase bg-emerald-100 text-emerald-900 border border-emerald-300">
          <Clock className="w-3 h-3 text-emerald-700" />
          <span>Aujourd'hui</span>
        </span>
      );
    } else if (movDate > now) {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 text-[9px] font-black uppercase bg-indigo-100 text-indigo-900 border border-indigo-300">
          <Calendar className="w-3 h-3 text-indigo-700" />
          <span>Programmé</span>
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 text-[9px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-300">
          <CheckCircle2 className="w-3 h-3 text-slate-500" />
          <span>Réalisé</span>
        </span>
      );
    }
  };

  const handleExportCSV = (exportAll = false) => {
    const listToExport = exportAll ? movements : filteredMovements;
    const headers = [
      'ID_Mouvement',
      'Chassis_VIN',
      'Marque',
      'Modele',
      'Type_Mouvement',
      'Date_Heure',
      'Site_Depart',
      'Site_Arrivee_Destination',
      'Operateur_Responsable',
      'Notes_Remarques',
    ];

    const rows = listToExport.map((m) => {
      const typeLabel =
        m.movement_type === 'entry'
          ? 'ENTREE'
          : m.movement_type === 'transfer'
          ? 'TRANSFERT'
          : 'SORTIE / LIVRAISON';

      return [
        m.id,
        `"${m.vehicle_chassis || m.chassis_number || ''}"`,
        `"${m.vehicle_brand || ''}"`,
        `"${m.vehicle_model || ''}"`,
        `"${typeLabel}"`,
        `"${formatDateTime(m.movement_date)}"`,
        `"${m.departure_site_name || ''}"`,
        `"${m.arrival_site_name || m.destination_text || ''}"`,
        `"${m.created_by_user_name || ''}"`,
        `"${(m.notes || '').replace(/"/g, '""')}"`,
      ];
    });

    const bom = '\uFEFF';
    const csvData = bom + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = exportAll
      ? `historique_COMPLET_mouvements_${new Date().toISOString().split('T')[0]}.csv`
      : `historique_filtre_mouvements_${new Date().toISOString().split('T')[0]}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = (exportAll = false) => {
    const listToExport = exportAll ? movements : filteredMovements;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    // Dark banner header
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 297, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(
      exportAll
        ? 'REGISTRE COMPLET DES MOUVEMENTS DE STOCK - PARC STAFIM'
        : 'REGISTRE DES MOUVEMENTS DE STOCK - FILTRÉ - PARC STAFIM',
      14,
      13
    );

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225); // slate-300
    const generationDate = formatDateTime(new Date());
    doc.text(
      `Document officiel édité le : ${generationDate} | ${listToExport.length} opé. totale(s)`,
      14,
      19
    );

    // Active filters summary line
    const filterSummary: string[] = [];
    if (!exportAll) {
      if (searchChassis) filterSummary.push(`Recherche: ${searchChassis}`);
      if (selectedSite) filterSummary.push(`Site: ${siteMap.get(selectedSite) || selectedSite}`);
      if (selectedType) {
        const typeLabel =
          selectedType === 'entry' ? 'Entrée' : selectedType === 'transfer' ? 'Transfert' : 'Sortie';
        filterSummary.push(`Type: ${typeLabel}`);
      }
      if (startDate) filterSummary.push(`Du: ${startDate}`);
      if (endDate) filterSummary.push(`Au: ${endDate}`);
    } else {
      filterSummary.push('Exportation Intégrale (Aucun filtre appliqué)');
    }

    let startY = 28;
    if (filterSummary.length > 0) {
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85); // slate-700
      doc.setFont('helvetica', 'bold');
      doc.text(`Critères d'exportation : ${filterSummary.join(' | ')}`, 14, startY);
      startY += 6;
    }

    // Table Data
    const tableColumns = [
      'Date & Heure',
      'Châssis / VIN',
      'Marque & Modèle',
      'Type d Opération',
      'Site de Départ',
      'Destination / Arrivée',
      'Agent Responsable',
      'Notes & Remarques',
    ];

    const tableRows = listToExport.map((m) => {
      const formattedDate = formatDateTime(m.movement_date);
      const typeLabel =
        m.movement_type === 'entry'
          ? 'ENTREE'
          : m.movement_type === 'transfer'
          ? 'TRANSFERT'
          : 'SORTIE / LIVRAISON';

      const brandModel = `${m.vehicle_brand || ''} ${m.vehicle_model || ''}`.trim() || '-';

      return [
        formattedDate,
        m.vehicle_chassis || m.chassis_number || 'N/A',
        brandModel,
        typeLabel,
        m.departure_site_name || '-',
        m.arrival_site_name || m.destination_text || '-',
        m.created_by_user_name || 'Agent',
        m.notes || '-',
      ];
    });

    autoTable(doc, {
      startY: startY,
      head: [tableColumns],
      body: tableRows,
      theme: 'striped',
      headStyles: {
        fillColor: [30, 41, 59], // slate-800
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        halign: 'left',
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [30, 41, 59],
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 26 },
        1: { fontStyle: 'bold', cellWidth: 40 },
        2: { fontStyle: 'bold', cellWidth: 34 },
        3: { cellWidth: 28 },
        4: { cellWidth: 36 },
        5: { cellWidth: 42 },
        6: { cellWidth: 28 },
        7: { cellWidth: 'auto' },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { left: 14, right: 14, bottom: 18 },
      didDrawPage: (data) => {
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text(`Page ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 8);
        doc.text(
          'STAFIM - Système de Gestion Logistique & Parc Véhicules | Confidentiel',
          doc.internal.pageSize.width - 125,
          doc.internal.pageSize.height - 8
        );
      },
    });

    const pdfFilename = exportAll
      ? `registre_COMPLET_mouvements_${new Date().toISOString().split('T')[0]}.pdf`
      : `registre_mouvements_${new Date().toISOString().split('T')[0]}.pdf`;

    doc.save(pdfFilename);
  };

  const getMovementBadge = (type: MovementType) => {
    switch (type) {
      case 'entry':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 text-[10px] font-bold uppercase bg-emerald-100 text-emerald-900 border border-emerald-300">
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>Entrée</span>
          </span>
        );
      case 'transfer':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 text-[10px] font-bold uppercase bg-blue-100 text-blue-900 border border-blue-300">
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Transfert</span>
          </span>
        );
      case 'exit':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 text-[10px] font-bold uppercase bg-amber-100 text-amber-900 border border-amber-300">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Sortie</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 border-b-4 border-slate-900 border-x border-t border-slate-200 shadow-sm">
        <div>
          <h1 className="text-lg font-black uppercase tracking-wider text-slate-900 flex items-center space-x-2">
            <History className="w-5 h-5 text-blue-600" />
            <span>Historique des Missions de Transport</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Journal inaltérable des mouvements. Opérations affichées :{' '}
            <strong className="text-slate-900 font-mono">{filteredMovements.length}</strong> / {movements.length}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Download Complete History Dropdown/Buttons */}
          <div className="flex items-center space-x-1 border border-slate-300 bg-slate-50 p-1">
            <span className="text-[10px] font-black uppercase text-slate-500 px-2 flex items-center space-x-1">
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Historique Complet ({movements.length}) :</span>
            </span>
            <button
              onClick={() => handleExportCSV(true)}
              className="flex items-center space-x-1 bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider transition shadow-xs"
              title="Télécharger l historique complet au format Excel (.csv)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel (.csv)</span>
            </button>
            <button
              onClick={() => handleExportPDF(true)}
              className="flex items-center space-x-1 bg-red-700 hover:bg-red-800 text-white px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider transition shadow-xs"
              title="Télécharger l historique complet au format PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF Complet</span>
            </button>
          </div>

          {/* Download Filtered View Buttons & Facturation */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => handleExportCSV(false)}
              className="flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-2 text-xs font-bold uppercase tracking-wider transition border border-slate-300"
              title="Exporter les résultats filtrés au format Excel"
            >
              <span>Excel Filtré</span>
            </button>
            <button
              onClick={() => handleExportPDF(false)}
              className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-2 text-xs font-bold uppercase tracking-wider transition border border-blue-700 shadow-xs"
              title="Exporter les résultats filtrés au format PDF"
            >
              <span>PDF Filtré</span>
            </button>
            <button
              onClick={() => setShowBillingModal(true)}
              className="flex items-center space-x-1.5 bg-amber-600 hover:bg-amber-500 text-white px-3 py-2 text-xs font-black uppercase tracking-wider transition border border-amber-700 shadow-sm"
              title="Générer une facture pour les mouvements filtrés"
            >
              <Receipt className="w-4 h-4 text-white" />
              <span>Facturation ({filteredMovements.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">
              Recherche & Filtres Avancés Mouvements
            </h3>
            <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 border border-slate-200">
              {filteredMovements.length} / {movements.length} opérations
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

            {(searchChassis ||
              selectedSite ||
              selectedType ||
              selectedImporter ||
              selectedBrand ||
              selectedModel ||
              selectedCarrier ||
              carrierSearch ||
              selectedCategory ||
              selectedFuelType ||
              datePreset !== 'all' ||
              startDate ||
              endDate) && (
              <button
                onClick={resetAllFilters}
                className="text-xs text-rose-600 hover:text-rose-800 font-bold uppercase tracking-wider flex items-center space-x-1 hover:underline px-2 py-1"
                title="Effacer tous les filtres"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Réinitialiser</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {/* Search Chassis */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1">
              Recherche Châssis VIN / Réf
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchChassis}
                onChange={(e) => setSearchChassis(e.target.value)}
                placeholder="ex: VF3..., Bon 450..."
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-mono pl-9 pr-3 py-2 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Filter Importer */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1">
              Importateur Officiel
            </label>
            <select
              value={selectedImporter}
              onChange={(e) => {
                setSelectedImporter(e.target.value);
                setSelectedBrand('');
              }}
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold px-2.5 py-2 focus:outline-none focus:border-blue-600"
            >
              <option value="">Tous les importateurs</option>
              {OFFICIAL_IMPORTERS.map((imp) => (
                <option key={imp.id} value={imp.id}>
                  {imp.code} - {imp.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Brand */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1">
              Marque Véhicule
            </label>
            <select
              value={selectedBrand}
              onChange={(e) => handleBrandFilterChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold px-2.5 py-2 focus:outline-none focus:border-blue-600"
            >
              <option value="">Toutes les marques</option>
              {availableBrands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Model */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1">
              Modèle Véhicule
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold px-2.5 py-2 focus:outline-none focus:border-blue-600"
            >
              <option value="">Tous les modèles</option>
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Site */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1">
              Site Concerné
            </label>
            <div className="relative">
              <Building2 className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={selectedSite}
                onChange={(e) => setSelectedSite(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold pl-8 pr-2.5 py-2 focus:outline-none focus:border-blue-600 appearance-none"
              >
                <option value="">Tous les sites</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Filter Type */}
          <div className="sm:col-span-2 md:col-span-1">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                Type d'Opération
              </label>
              <span className="text-[10px] font-mono font-bold text-slate-500">
                {typeCounts.all} opé.
              </span>
            </div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold px-2.5 py-2 focus:outline-none focus:border-blue-600"
            >
              <option value="">Tous types ({typeCounts.all})</option>
              <option value="entry">Entrée / Port ({typeCounts.entry})</option>
              <option value="transfer">Transfert ({typeCounts.transfer})</option>
              <option value="exit">Sortie / Livraison ({typeCounts.exit})</option>
            </select>

            {/* Dynamic Badges / Quick Filter Buttons */}
            <div className="flex flex-wrap items-center gap-1 mt-1.5">
              <button
                type="button"
                onClick={() => setSelectedType('')}
                className={`px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider border transition ${
                  selectedType === ''
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                }`}
                title="Afficher tous les types de mouvements"
              >
                Tous ({typeCounts.all})
              </button>
              <button
                type="button"
                onClick={() => setSelectedType('entry')}
                className={`px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider border transition ${
                  selectedType === 'entry'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                }`}
                title="Filtrer uniquement les Entrées"
              >
                Entrée ({typeCounts.entry})
              </button>
              <button
                type="button"
                onClick={() => setSelectedType('transfer')}
                className={`px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider border transition ${
                  selectedType === 'transfer'
                    ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                    : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                }`}
                title="Filtrer uniquement les Transferts"
              >
                Transf. ({typeCounts.transfer})
              </button>
              <button
                type="button"
                onClick={() => setSelectedType('exit')}
                className={`px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider border transition ${
                  selectedType === 'exit'
                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                    : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                }`}
                title="Filtrer uniquement les Sorties"
              >
                Sortie ({typeCounts.exit})
              </button>
            </div>
          </div>

          {/* Quick Date Presets Dropdown */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1 flex items-center space-x-1">
              <Calendar className="w-3 h-3 text-blue-600" />
              <span>Période / Date</span>
            </label>
            <select
              value={datePreset}
              onChange={(e) => handleDatePresetChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold px-2.5 py-2 focus:outline-none focus:border-blue-600"
            >
              <option value="all">Toutes les dates</option>
              <option value="today">Aujourd'hui</option>
              <option value="7days">7 derniers jours</option>
              <option value="30days">30 derniers jours</option>
              <option value="month">Mois en cours</option>
              <option value="year">Année en cours</option>
              <option value="custom">Plage personnalisée...</option>
            </select>
          </div>
        </div>

        {/* Collapsible Advanced Filters Section */}
        {showAdvancedFilters && (
          <div className="bg-slate-50 p-4 border border-slate-200 space-y-4 animate-in fade-in duration-200">
            <div className="text-[11px] font-black uppercase tracking-widest text-blue-900 border-b border-slate-200 pb-2 flex items-center space-x-2">
              <SlidersHorizontal className="w-4 h-4 text-blue-600" />
              <span>Filtres Avancés d'Audit (Date Précise, Transporteur / Chauffeur, Type de Véhicule)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Section 1: Filtre par Date Avancé */}
              <div className="bg-white p-3.5 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Filtre par Date d'Opération</span>
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
                    <span>Filtre par Transporteur & Chauffeur</span>
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
                  <label className="text-[9px] font-black uppercase text-slate-500 block mb-0.5">Chauffeur / Camion / N° BDL</label>
                  <input
                    type="text"
                    value={carrierSearch}
                    onChange={(e) => setCarrierSearch(e.target.value)}
                    placeholder="Nom chauffeur, plaque, bon de livraison..."
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 text-xs p-1.5 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Section 3: Filtre par Type & Silhouette de Véhicule */}
              <div className="bg-white p-3.5 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center space-x-1.5">
                    <Car className="w-3.5 h-3.5 text-blue-600" />
                    <span>Filtre Type & Silhouette Véhicule</span>
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
                  <label className="text-[9px] font-black uppercase text-slate-500 block mb-0.5">Énergie / Motorisation</label>
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
        {(searchChassis ||
          selectedSite ||
          selectedType ||
          selectedImporter ||
          selectedBrand ||
          selectedModel ||
          selectedCarrier ||
          carrierSearch ||
          selectedCategory ||
          selectedFuelType ||
          datePreset !== 'all' ||
          startDate ||
          endDate) && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-3 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-500 font-bold uppercase text-[10px] mr-1">Filtres actifs :</span>
              {searchChassis && (
                <span className="bg-blue-50 text-blue-900 border border-blue-200 px-2 py-0.5 text-[10px] font-mono font-bold flex items-center space-x-1">
                  <span>VIN/Réf: {searchChassis}</span>
                  <button onClick={() => setSearchChassis('')} className="hover:text-rose-600 font-black ml-1">✕</button>
                </span>
              )}
              {selectedImporter && (
                <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 text-[10px] font-bold flex items-center space-x-1">
                  <span>Importateur: {OFFICIAL_IMPORTERS.find((i) => i.id === selectedImporter)?.code || selectedImporter}</span>
                  <button onClick={() => setSelectedImporter('')} className="hover:text-rose-600 font-black ml-1">✕</button>
                </span>
              )}
              {selectedBrand && (
                <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 text-[10px] font-bold flex items-center space-x-1">
                  <span>Marque: {selectedBrand}</span>
                  <button onClick={() => setSelectedBrand('')} className="hover:text-rose-600 font-black ml-1">✕</button>
                </span>
              )}
              {selectedModel && (
                <span className="bg-indigo-100 text-indigo-900 border border-indigo-300 px-2 py-0.5 text-[10px] font-bold flex items-center space-x-1">
                  <span>Modèle: {selectedModel}</span>
                  <button onClick={() => setSelectedModel('')} className="hover:text-rose-600 font-black ml-1">✕</button>
                </span>
              )}
              {selectedSite && (
                <span className="bg-blue-50 text-blue-900 border border-blue-200 px-2 py-0.5 text-[10px] font-bold flex items-center space-x-1">
                  <span>Site: {siteMap.get(selectedSite) || selectedSite}</span>
                  <button onClick={() => setSelectedSite('')} className="hover:text-rose-600 font-black ml-1">✕</button>
                </span>
              )}
              {selectedType && (
                <span className="bg-blue-50 text-blue-900 border border-blue-200 px-2 py-0.5 text-[10px] font-bold uppercase flex items-center space-x-1">
                  <span>
                    Type:{' '}
                    {selectedType === 'entry'
                      ? `Entrée (${typeCounts.entry})`
                      : selectedType === 'transfer'
                      ? `Transfert (${typeCounts.transfer})`
                      : `Sortie (${typeCounts.exit})`}
                  </span>
                  <button onClick={() => setSelectedType('')} className="hover:text-rose-600 font-black ml-1">✕</button>
                </span>
              )}
              {selectedCarrier && (
                <span className="bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-bold uppercase px-2 py-0.5 flex items-center space-x-1">
                  <Truck className="w-3 h-3 text-purple-700" />
                  <span>Transporteur: {selectedCarrier}</span>
                  <button onClick={() => setSelectedCarrier('')} className="hover:text-rose-600 font-black ml-1">✕</button>
                </span>
              )}
              {carrierSearch && (
                <span className="bg-purple-50 text-purple-900 border border-purple-200 text-[10px] font-bold px-2 py-0.5 flex items-center space-x-1">
                  <span>Chauffeur/Camion: "{carrierSearch}"</span>
                  <button onClick={() => setCarrierSearch('')} className="hover:text-rose-600 font-black ml-1">✕</button>
                </span>
              )}
              {selectedCategory && (
                <span className="bg-teal-100 text-teal-900 border border-teal-300 text-[10px] font-bold uppercase px-2 py-0.5 flex items-center space-x-1">
                  <Car className="w-3 h-3 text-teal-700" />
                  <span>Type: {selectedCategory}</span>
                  <button onClick={() => setSelectedCategory('')} className="hover:text-rose-600 font-black ml-1">✕</button>
                </span>
              )}
              {selectedFuelType && (
                <span className="bg-cyan-100 text-cyan-900 border border-cyan-300 text-[10px] font-bold uppercase px-2 py-0.5 flex items-center space-x-1">
                  <Fuel className="w-3 h-3 text-cyan-700" />
                  <span>Énergie: {selectedFuelType}</span>
                  <button onClick={() => setSelectedFuelType('')} className="hover:text-rose-600 font-black ml-1">✕</button>
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
                  <button onClick={() => handleDatePresetChange('all')} className="hover:text-rose-600 font-black ml-1">✕</button>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={resetAllFilters}
              className="text-rose-600 hover:text-rose-800 hover:underline font-bold uppercase text-[10px] flex items-center space-x-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Tout effacer</span>
            </button>
          </div>
        )}
      </div>

      {/* View Mode Switching Header Tabs */}
      <div className="bg-slate-900 text-white p-2.5 px-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b-2 border-amber-500">
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
              viewMode === 'table'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <LayoutList className="w-4 h-4" />
            <span>Vue Tableau (Liste)</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
              viewMode === 'calendar'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Vue Calendrier (Agenda)</span>
            <span className="ml-1 bg-slate-900 text-amber-300 font-mono text-[10px] px-1.5 py-0.5 font-bold border border-amber-400/40">
              {filteredMovements.length}
            </span>
          </button>
        </div>

        {viewMode === 'calendar' && (
          <div className="flex items-center space-x-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 hidden sm:inline">Mode d'affichage :</span>
            <button
              type="button"
              onClick={() => setCalendarSubView('grid')}
              className={`px-3 py-1 text-xs font-black uppercase tracking-wider transition border ${
                calendarSubView === 'grid'
                  ? 'bg-white text-slate-900 border-white'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
              }`}
            >
              Grille Mensuelle
            </button>
            <button
              type="button"
              onClick={() => setCalendarSubView('agenda')}
              className={`px-3 py-1 text-xs font-black uppercase tracking-wider transition border ${
                calendarSubView === 'agenda'
                  ? 'bg-white text-slate-900 border-white'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
              }`}
            >
              Agenda Chronologique
            </button>
          </div>
        )}
      </div>

      {/* Help Banner */}
      <div className="bg-blue-50 border-l-4 border-blue-600 border-y border-r border-blue-200 p-3.5 flex items-center justify-between text-xs font-bold text-blue-900">
        <div className="flex items-center space-x-2">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span>
            💡 <strong>Astuce :</strong>{' '}
            {viewMode === 'table'
              ? "Effectuez un simple clic sur n'importe quelle ligne pour ouvrir la fiche détaillée du mouvement avec son itinéraire."
              : "Cliquez sur une journée dans le calendrier pour filtrer l'agenda ou cliquez sur un mouvement pour afficher sa fiche complète."}
          </span>
        </div>
        <span className="text-[10px] bg-blue-100 text-blue-800 font-black uppercase px-2 py-0.5 border border-blue-300">
          {viewMode === 'table' ? 'Vue Tableau' : 'Vue Agenda Activée'}
        </span>
      </div>

      {viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
              <p className="text-xs font-bold uppercase tracking-wider">Chargement de l'historique...</p>
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <History className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs font-bold uppercase text-slate-700">Aucun mouvement enregistré</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Horodatage</th>
                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Numéro Châssis (VIN)</th>
                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Marque & Modèle</th>
                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Départ</th>
                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Destination</th>
                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Opérateur</th>
                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes</th>
                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMovements.map((m) => {
                    const chassis = m.vehicle_chassis || m.chassis_number || 'N/A';
                    const imp = getImporterForBrand(m.vehicle_brand);
                    return (
                      <tr
                        key={m.id}
                        onClick={() => setSelectedMovement(m)}
                        className="hover:bg-blue-50/60 cursor-pointer transition border-b border-slate-100 group"
                        title="Cliquez pour voir les détails de ce mouvement"
                      >
                        <td className="px-6 py-4 font-mono font-medium text-slate-600 whitespace-nowrap text-[11px] group-hover:text-blue-900">
                          {formatDateTime(m.movement_date)}
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-slate-900 tracking-wider">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTraceabilityVin(chassis);
                            }}
                            className="inline-flex items-center space-x-1.5 font-mono font-black text-blue-700 hover:text-white bg-blue-50 hover:bg-blue-600 px-2 py-1 border border-blue-200 hover:border-blue-600 transition group/vin"
                            title="Cliquer pour afficher la traçabilité complète de ce VIN"
                          >
                            <span>{chassis}</span>
                            <Route className="w-3.5 h-3.5 text-blue-600 group-hover/vin:text-white" />
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-black text-slate-900 uppercase text-xs flex items-center space-x-1.5">
                            <span>{m.vehicle_brand || <span className="text-slate-400 font-normal italic">-</span>}</span>
                            {imp && (
                              <span className="bg-amber-100 text-amber-900 border border-amber-300 font-black text-[9px] px-1.5 py-0.2">
                                {imp.code}
                              </span>
                            )}
                          </div>
                          {m.vehicle_model && (
                            <div className="text-[11px] text-slate-500 font-bold uppercase tracking-tight">
                              {m.vehicle_model}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">{getMovementBadge(m.movement_type)}</td>
                        <td className="px-6 py-4 text-slate-800 font-bold uppercase text-xs">
                          {m.departure_site_name || <span className="text-slate-400 italic font-normal">-</span>}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-slate-900 font-black uppercase text-xs">
                            {m.arrival_site_name || m.destination_text || (
                              <span className="text-slate-400 italic font-normal">-</span>
                            )}
                          </div>
                          {m.multi_route_summary && (
                            <div className="mt-1 text-[9px] bg-indigo-50 text-indigo-900 border border-indigo-200 px-1.5 py-0.5 font-bold uppercase tracking-tight inline-block">
                              Multi-Trajet : {m.multi_route_summary}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-bold uppercase text-[11px]">
                          {m.created_by_user_name || 'Système'}
                        </td>
                        <td className="px-6 py-4 text-slate-500 italic max-w-xs truncate text-xs">
                          {m.notes || '-'}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap space-x-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingMovement(m);
                            }}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-300 hover:border-blue-600 text-[10px] font-black uppercase tracking-wider inline-flex items-center space-x-1 transition"
                            title="Modifier les informations de ce mouvement"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Éditer</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              generateMovementVoucherPDF(m, sites);
                            }}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-500 text-amber-900 hover:text-white border border-amber-300 hover:border-amber-500 text-[10px] font-black uppercase tracking-wider inline-flex items-center space-x-1 transition"
                            title="Générer & Télécharger le Bon de Mouvement au format PDF"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Bon</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMovement(m);
                            }}
                            className="px-2.5 py-1 bg-slate-100 group-hover:bg-blue-600 text-slate-700 group-hover:text-white border border-slate-300 group-hover:border-blue-600 text-[10px] font-black uppercase tracking-wider inline-flex items-center space-x-1.5 transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Détails</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* CALENDAR / AGENDA VIEW */
        <div className="space-y-6">
          {/* Calendar Header & Month Navigation Bar */}
          <div className="bg-white p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-amber-500 text-slate-950 font-black rounded-xs shadow-xs">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-black uppercase tracking-wider text-slate-900">
                    {calendarDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </h2>
                  <span className="bg-blue-100 text-blue-900 font-mono text-xs font-bold px-2 py-0.5 border border-blue-200">
                    {calendarMonthStats.total} mouvements
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Planification & Historique quotidien des opérations logistiques du parc.
                </p>
              </div>
            </div>

            {/* Controls Month Prev / Next / Today */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold border border-slate-300 transition flex items-center space-x-1"
                title="Mois Précédent"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="text-xs uppercase font-bold hidden sm:inline">Mois Préc.</span>
              </button>

              <button
                type="button"
                onClick={handleTodayMonth}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider transition border border-blue-700 shadow-xs"
              >
                Aujourd'hui
              </button>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold border border-slate-300 transition flex items-center space-x-1"
                title="Mois Suivant"
              >
                <span className="text-xs uppercase font-bold hidden sm:inline">Mois Suiv.</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Month Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-500 block">Total Mois</span>
                <span className="text-xl font-black text-slate-900 font-mono">{calendarMonthStats.total}</span>
              </div>
              <Calendar className="w-5 h-5 text-slate-400" />
            </div>

            <div className="bg-emerald-50/60 p-3.5 border border-emerald-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-800 block">Entrées Port</span>
                <span className="text-xl font-black text-emerald-950 font-mono">{calendarMonthStats.entries}</span>
              </div>
              <ArrowDownRight className="w-5 h-5 text-emerald-600" />
            </div>

            <div className="bg-blue-50/60 p-3.5 border border-blue-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-blue-800 block">Transferts Sites</span>
                <span className="text-xl font-black text-blue-950 font-mono">{calendarMonthStats.transfers}</span>
              </div>
              <ArrowLeftRight className="w-5 h-5 text-blue-600" />
            </div>

            <div className="bg-amber-50/60 p-3.5 border border-amber-200 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-amber-800 block">Sorties / Livraisons</span>
                <span className="text-xl font-black text-amber-950 font-mono">{calendarMonthStats.exits}</span>
              </div>
              <ArrowUpRight className="w-5 h-5 text-amber-600" />
            </div>
          </div>

          {/* Selected Date Filter Banner if active */}
          {selectedDateStr && (
            <div className="bg-amber-100 border-2 border-amber-400 p-3.5 flex items-center justify-between text-xs font-bold text-amber-950">
              <div className="flex items-center space-x-2">
                <CalendarDays className="w-5 h-5 text-amber-700" />
                <span>
                  Affichage des mouvements pour le :{' '}
                  <strong className="font-mono text-slate-900 font-black text-sm">
                    {new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </strong>{' '}
                  ({agendaListMovements.length} opé.)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDateStr(null)}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-3 py-1 font-black uppercase text-[10px] tracking-wider transition"
              >
                Voir tout le mois
              </button>
            </div>
          )}

          {/* MONTHLY GRID VIEW */}
          {calendarSubView === 'grid' && (
            <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider text-center border-b border-slate-800">
                <div className="p-2.5">Lun</div>
                <div className="p-2.5">Mar</div>
                <div className="p-2.5">Mer</div>
                <div className="p-2.5">Jeu</div>
                <div className="p-2.5">Ven</div>
                <div className="p-2.5 bg-slate-800">Sam</div>
                <div className="p-2.5 bg-slate-800">Dim</div>
              </div>

              {/* Grid Cells */}
              <div className="grid grid-cols-7 border-collapse divide-x divide-y divide-slate-200 bg-slate-100">
                {calendarGrid.map((cell) => {
                  const isSelected = selectedDateStr === cell.dateKey;
                  const hasMovements = cell.movements.length > 0;

                  return (
                    <div
                      key={cell.dateKey}
                      onClick={() => {
                        setSelectedDateStr(cell.dateKey);
                      }}
                      className={`min-h-[110px] p-2 transition cursor-pointer flex flex-col justify-between relative ${
                        !cell.isCurrentMonth
                          ? 'bg-slate-100/60 text-slate-400 opacity-60'
                          : cell.isToday
                          ? 'bg-amber-50/90 border-2 border-amber-500 z-10'
                          : isSelected
                          ? 'bg-blue-50 border-2 border-blue-600 z-10'
                          : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      {/* Top Header inside day cell */}
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-mono font-black ${
                            cell.isToday
                              ? 'bg-amber-500 text-slate-950 w-6 h-6 rounded-full flex items-center justify-center shadow-xs'
                              : isSelected
                              ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center'
                              : cell.isCurrentMonth
                              ? 'text-slate-900'
                              : 'text-slate-400'
                          }`}
                        >
                          {cell.dayNum}
                        </span>

                        {hasMovements && (
                          <span
                            className={`text-[9px] font-mono font-black px-1.5 py-0.2 border ${
                              cell.isToday
                                ? 'bg-amber-200 text-amber-950 border-amber-400'
                                : 'bg-slate-900 text-white border-slate-900'
                            }`}
                          >
                            {cell.movements.length} opé.
                          </span>
                        )}
                      </div>

                      {/* Day Cell Movements list preview (Up to 3 items) */}
                      <div className="space-y-1 my-1 flex-1 overflow-hidden">
                        {cell.movements.slice(0, 3).map((m) => {
                          const badgeColor =
                            m.movement_type === 'entry'
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : m.movement_type === 'transfer'
                              ? 'bg-blue-100 text-blue-900 border-blue-300'
                              : 'bg-amber-100 text-amber-900 border-amber-300';

                          const vinShort = (m.vehicle_chassis || m.chassis_number || 'N/A').slice(-6);

                          return (
                            <div
                              key={m.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMovement(m);
                              }}
                              className={`p-1 text-[10px] border rounded-2xs font-bold leading-tight truncate hover:opacity-80 transition ${badgeColor}`}
                              title={`${m.movement_type.toUpperCase()} - VIN: ${m.vehicle_chassis || m.chassis_number} (${m.vehicle_brand || ''} ${m.vehicle_model || ''})`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-black">
                                  {getTimeFromDate(m.movement_date)}
                                </span>
                                <span className="uppercase text-[8px] font-black">
                                  {m.movement_type === 'entry' ? 'ENTR' : m.movement_type === 'transfer' ? 'TRSF' : 'SORT'}
                                </span>
                              </div>
                              <div className="font-mono font-black tracking-wider text-[9px] truncate">
                                ...{vinShort}
                              </div>
                            </div>
                          );
                        })}

                        {cell.movements.length > 3 && (
                          <div className="text-[9px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-1 py-0.5 text-center uppercase tracking-tight">
                            + {cell.movements.length - 3} autres
                          </div>
                        )}
                      </div>

                      {cell.isToday && (
                        <div className="text-[8px] font-black uppercase text-amber-700 tracking-widest text-center">
                          Aujourd'hui
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AGENDA CHRONOLOGICAL TIMELINE LIST */}
          <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <Clock className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider">
                    {selectedDateStr
                      ? `Agenda Détaillé du ${new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}`
                      : `Agenda Chronologique du Mois (${agendaListMovements.length} opérations)`}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Mouvements réalisés et programmés classés par ordre chronologique.
                  </p>
                </div>
              </div>

              {selectedDateStr && (
                <button
                  type="button"
                  onClick={() => setSelectedDateStr(null)}
                  className="text-xs text-amber-300 hover:text-white font-bold underline"
                >
                  Afficher tout le mois
                </button>
              )}
            </div>

            {agendaListMovements.length === 0 ? (
              <div className="p-12 text-center text-slate-500 space-y-2">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs font-bold uppercase text-slate-700">
                  Aucun mouvement enregistré pour cette sélection
                </p>
                <p className="text-xs text-slate-400">
                  Sélectionnez un autre jour dans la grille ou réinitialisez les filtres.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {agendaListMovements.map((m) => {
                  const chassis = m.vehicle_chassis || m.chassis_number || 'N/A';
                  const imp = getImporterForBrand(m.vehicle_brand);
                  const timeDisplay = getTimeFromDate(m.movement_date);

                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedMovement(m)}
                      className="p-4 hover:bg-blue-50/60 cursor-pointer transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group"
                    >
                      {/* Left: Time & Badges */}
                      <div className="flex items-start space-x-3 min-w-[200px]">
                        <div className="text-center bg-slate-100 p-2 border border-slate-300 min-w-[65px]">
                          <span className="text-xs font-mono font-black text-slate-900 block">
                            {timeDisplay}
                          </span>
                          <span className="text-[9px] font-mono text-slate-500 block uppercase">
                            {m.movement_date ? m.movement_date.split('T')[0] : ''}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div>{getMovementBadge(m.movement_type)}</div>
                          <div>{getMovementTimingBadge(m.movement_date)}</div>
                        </div>
                      </div>

                      {/* Middle: Vehicle details & Journey */}
                      <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTraceabilityVin(chassis);
                            }}
                            className="font-mono font-black text-xs text-blue-700 hover:text-white bg-blue-50 hover:bg-blue-600 px-2 py-0.5 border border-blue-200 transition inline-flex items-center space-x-1"
                            title="Voir traçabilité complète de ce VIN"
                          >
                            <span>{chassis}</span>
                            <Route className="w-3.5 h-3.5" />
                          </button>

                          <span className="font-black text-xs text-slate-900 uppercase">
                            {m.vehicle_brand || '-'} {m.vehicle_model || ''}
                          </span>

                          {imp && (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 font-black text-[9px] px-1.5 py-0.2">
                              {imp.code}
                            </span>
                          )}
                        </div>

                        {/* Departure -> Arrival */}
                        <div className="text-xs text-slate-700 flex items-center space-x-2 font-medium">
                          <span className="text-slate-500">Départ:</span>
                          <strong className="text-slate-900 uppercase">
                            {m.departure_site_name || '-'}
                          </strong>
                          <ArrowRight className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                          <span className="text-slate-500">Arrivée/Dest:</span>
                          <strong className="text-blue-900 uppercase">
                            {m.arrival_site_name || m.destination_text || '-'}
                          </strong>
                        </div>

                        {m.notes && (
                          <p className="text-[11px] text-slate-500 italic truncate max-w-xl">
                            "{m.notes}"
                          </p>
                        )}
                      </div>

                      {/* Right: Operator & Actions */}
                      <div className="flex items-center space-x-3 self-end md:self-center">
                        <div className="text-right text-[11px] text-slate-500 hidden sm:block">
                          <span className="block font-bold text-slate-700">
                            {m.created_by_user_name || 'Agent'}
                          </span>
                          <span className="text-[9px] uppercase">Opérateur Logistique</span>
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingMovement(m);
                            }}
                            className="p-1.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-300 transition"
                            title="Modifier ce mouvement"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              generateMovementVoucherPDF(m, sites);
                            }}
                            className="p-1.5 bg-amber-50 hover:bg-amber-500 text-amber-900 hover:text-white border border-amber-300 transition"
                            title="Télécharger Bon PDF"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMovement(m);
                            }}
                            className="p-1.5 bg-slate-800 text-white hover:bg-blue-600 transition"
                            title="Consulter Fiche"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Movement Details Modal */}
      <MovementDetailModal
        movement={selectedMovement}
        onClose={() => setSelectedMovement(null)}
        sites={sites}
        onSelectVehicle={onSelectVehicle}
        userRole={userRole}
        onRefresh={onRefresh}
      />

      {/* Edit Movement Modal */}
      {editingMovement && (
        <EditMovementModal
          movement={editingMovement}
          sites={sites}
          currentUser={currentUser}
          onClose={() => setEditingMovement(null)}
          onRefresh={onRefresh}
        />
      )}

      {/* Billing Modal for Filtered Movements */}
      {showBillingModal && (
        <BillingModal
          movements={filteredMovements}
          sites={sites}
          startDate={startDate}
          endDate={endDate}
          selectedSiteId={selectedSite}
          initialImporterId={selectedImporter}
          initialBrand={selectedBrand}
          onClose={() => setShowBillingModal(false)}
        />
      )}

      {/* VIN Complete Traceability Timeline Modal */}
      {traceabilityVin && (
        <VinTraceabilityModal
          vin={traceabilityVin}
          movements={movements}
          sites={sites}
          onClose={() => setTraceabilityVin(null)}
          onSelectVehicle={onSelectVehicle}
        />
      )}
    </div>
  );
};
