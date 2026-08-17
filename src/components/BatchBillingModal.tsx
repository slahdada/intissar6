import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  DollarSign,
  Calculator,
  Car,
  CheckSquare,
  Square,
  Layers,
  Sparkles,
  Info,
  Calendar,
  Building2,
  Tag,
  ArrowRight,
} from 'lucide-react';
import { Vehicle, BillingBatch, BatchBillingType, BatchStatus, BillingBatchItem, User } from '../types';
import { OFFICIAL_IMPORTERS } from '../data/importers';
import { createBatch, updateBatch, loadBatches } from '../lib/batchBillingStore';
import { formatDateTime } from '../lib/dateUtils';

// Helper function to highlight search matches inside table cells
const highlightText = (text: string | undefined | null, query: string) => {
  if (!text) return text || '';
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return text;

  const escapedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  const parts = text.split(regex);

  if (parts.length <= 1) return text;

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === trimmedQuery.toLowerCase() ? (
          <mark
            key={index}
            className="bg-amber-300 text-slate-950 font-black px-0.5 rounded-xs shadow-2xs"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

interface BatchBillingModalProps {
  existingBatch?: BillingBatch | null;
  vehicles: Vehicle[];
  currentUser?: User;
  onClose: () => void;
  onSuccess: () => void;
}

export const BatchBillingModal: React.FC<BatchBillingModalProps> = ({
  existingBatch,
  vehicles,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const isEdit = Boolean(existingBatch);

  // Form states
  const [importer, setImporter] = useState<string>(existingBatch?.importer || 'STAFIM SA');
  const [billingType, setBillingType] = useState<BatchBillingType>(existingBatch?.billingType || 'livres');
  const [batchDate, setBatchDate] = useState<string>(
    existingBatch?.batchDate || new Date().toISOString().split('T')[0]
  );
  const [batchNumber, setBatchNumber] = useState<string>(
    existingBatch?.batchNumber || `LOT-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`
  );
  const [invoiceReference, setInvoiceReference] = useState<string>(existingBatch?.invoiceReference || '');
  const [currency, setCurrency] = useState<string>(existingBatch?.currency || 'DT');
  const [vatRate, setVatRate] = useState<number>(existingBatch?.vatRate ?? 19);
  const [discount, setDiscount] = useState<number>(existingBatch?.discount ?? 0);
  const [notes, setNotes] = useState<string>(existingBatch?.notes || '');

  // Mass pricing tool state
  const [globalPrice, setGlobalPrice] = useState<string>('85.000');

  // Filter states for vehicle selection
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyUnbilled, setOnlyUnbilled] = useState<boolean>(true);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Per-vehicle unit price overrides map: { [vehicleId]: number }
  const [vehiclePrices, setVehiclePrices] = useState<{ [vehicleId: string]: number }>(() => {
    const initial: { [vehicleId: string]: number } = {};
    if (existingBatch) {
      existingBatch.items.forEach((item) => {
        initial[item.vehicleId] = item.unitPriceHT;
      });
    }
    return initial;
  });

  // Selected vehicle IDs map: Set of vehicleId
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<Set<string>>(() => {
    if (existingBatch) {
      return new Set(existingBatch.vehicleIds);
    }
    return new Set();
  });

  // Load existing batches to check for anti-double-billing across batches
  const activeBatches = useMemo(() => {
    return loadBatches().filter((b) => b.status !== 'annule' && b.id !== existingBatch?.id);
  }, [existingBatch?.id]);

  // Set of vehicle IDs that are ALREADY in an active non-cancelled batch or billed elsewhere
  const activeBilledVehicleIds = useMemo(() => {
    const billedSet = new Set<string>();

    // 1. Check vehicles from active batches
    activeBatches.forEach((batch) => {
      batch.items.forEach((item) => {
        billedSet.add(item.vehicleId);
      });
    });

    // 2. Check vehicles marked as is_billed or billingStatus === 'facture' in vehicles DB
    vehicles.forEach((v) => {
      if (
        (v.is_billed || v.billingStatus === 'facture') &&
        (!existingBatch || !existingBatch.vehicleIds.includes(v.id))
      ) {
        billedSet.add(v.id);
      }
    });

    return billedSet;
  }, [activeBatches, vehicles, existingBatch]);

  // Available brands & models based on vehicles
  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    vehicles.forEach((v) => {
      if (v.brand) brands.add(v.brand);
    });
    return Array.from(brands).sort();
  }, [vehicles]);

  const availableModels = useMemo(() => {
    const models = new Set<string>();
    vehicles.forEach((v) => {
      if (!brandFilter || brandFilter === 'all' || v.brand === brandFilter) {
        if (v.model) models.add(v.model);
      }
    });
    return Array.from(models).sort();
  }, [vehicles, brandFilter]);

  // Filtered list of vehicles eligible for display
  const eligibleVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      // 1. Filter by Importer / Arrival site matching
      const matchesImporter =
        !importer ||
        importer === 'TOUS' ||
        (v.site_arrivee && v.site_arrivee.toLowerCase().includes(importer.toLowerCase())) ||
        (v.brand && importer.toLowerCase().includes(v.brand.toLowerCase())) ||
        (v.notes && v.notes.toLowerCase().includes(importer.toLowerCase())) ||
        // Check if importer is STAFIM SA and brand is Peugeot/Citroen/Opel
        (importer === 'STAFIM SA' &&
          ['peugeot', 'citroën', 'citroen', 'opel'].some((b) => v.brand?.toLowerCase().includes(b)));

      // 2. Filter by Billing Type rule
      // 'livres': Status is 'livre' OR is_delivered === true OR contains LIVRÉ
      // 'a_livrer': Status is NOT 'livre' (e.g. en_stock, en_transit)
      let matchesType = true;
      const isLivreLogistics = v.status === 'livre' || v.is_delivered === true;
      if (billingType === 'livres') {
        matchesType = isLivreLogistics;
      } else if (billingType === 'a_livrer') {
        matchesType = !isLivreLogistics;
      }

      // 3. Filter by Logistics Status dropdown
      const matchesStatus = statusFilter === 'all' || v.status === statusFilter;

      // 4. Filter by Brand
      const matchesBrand = brandFilter === 'all' || v.brand === brandFilter;

      // 5. Filter by Model
      const matchesModel = modelFilter === 'all' || v.model === modelFilter;

      // 6. Text Search (Chassis/VIN, Brand, Model, Stock number, Color)
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        v.chassis_number?.toLowerCase().includes(q) ||
        v.vin?.toLowerCase().includes(q) ||
        v.brand?.toLowerCase().includes(q) ||
        v.model?.toLowerCase().includes(q) ||
        v.stock_number?.toLowerCase().includes(q) ||
        v.color?.toLowerCase().includes(q) ||
        v.site_depart?.toLowerCase().includes(q) ||
        v.site_arrivee?.toLowerCase().includes(q);

      // 7. Only unbilled filter
      const isAlreadyBilled = activeBilledVehicleIds.has(v.id);
      const matchesUnbilled = !onlyUnbilled || !isAlreadyBilled;

      // 8. Date filter
      let matchesDate = true;
      if (startDate && v.arrival_date) {
        matchesDate = matchesDate && v.arrival_date >= startDate;
      }
      if (endDate && v.arrival_date) {
        matchesDate = matchesDate && v.arrival_date <= endDate;
      }

      return (
        matchesImporter &&
        matchesType &&
        matchesStatus &&
        matchesBrand &&
        matchesModel &&
        matchesSearch &&
        matchesUnbilled &&
        matchesDate
      );
    });
  }, [
    vehicles,
    importer,
    billingType,
    statusFilter,
    brandFilter,
    modelFilter,
    searchQuery,
    onlyUnbilled,
    startDate,
    endDate,
    activeBilledVehicleIds,
  ]);

  // Default unit price fallback helper
  const getDefaultPriceForVehicle = (v: Vehicle): number => {
    if (vehiclePrices[v.id] !== undefined) return vehiclePrices[v.id];

    // Standard tariffs based on brand/model or type
    if (v.brand?.toLowerCase() === 'peugeot') {
      if (v.model?.includes('3008') || v.model?.includes('5008')) return 95.0;
      return 85.0;
    }
    if (v.brand?.toLowerCase().includes('citro')) {
      if (v.model?.includes('Berlingo')) return 100.0;
      return 80.0;
    }
    if (v.brand?.toLowerCase() === 'opel') return 90.0;
    return 85.0;
  };

  // Select / Deselect All visible eligible unbilled vehicles
  const selectableVehicles = useMemo(() => {
    return eligibleVehicles.filter((v) => !activeBilledVehicleIds.has(v.id));
  }, [eligibleVehicles, activeBilledVehicleIds]);

  const isAllSelectableChecked = useMemo(() => {
    if (selectableVehicles.length === 0) return false;
    return selectableVehicles.every((v) => selectedVehicleIds.has(v.id));
  }, [selectableVehicles, selectedVehicleIds]);

  const handleToggleSelectAll = () => {
    const next = new Set(selectedVehicleIds);
    if (isAllSelectableChecked) {
      selectableVehicles.forEach((v) => next.delete(v.id));
    } else {
      selectableVehicles.forEach((v) => {
        next.add(v.id);
        if (vehiclePrices[v.id] === undefined) {
          nextPriceForVehicle(v.id, getDefaultPriceForVehicle(v));
        }
      });
    }
    setSelectedVehicleIds(next);
  };

  const handleToggleVehicle = (v: Vehicle) => {
    if (activeBilledVehicleIds.has(v.id)) return; // Anti-double billing block

    const next = new Set(selectedVehicleIds);
    if (next.has(v.id)) {
      next.delete(v.id);
    } else {
      next.add(v.id);
      if (vehiclePrices[v.id] === undefined) {
        nextPriceForVehicle(v.id, getDefaultPriceForVehicle(v));
      }
    }
    setSelectedVehicleIds(next);
  };

  const nextPriceForVehicle = (vehId: string, price: number) => {
    setVehiclePrices((prev) => ({ ...prev, [vehId]: price }));
  };

  // Mass apply global unit price to all currently selected vehicles
  const handleApplyGlobalPrice = () => {
    const numericPrice = parseFloat(globalPrice.replace(',', '.'));
    if (isNaN(numericPrice) || numericPrice < 0) return;

    setVehiclePrices((prev) => {
      const next = { ...prev };
      selectedVehicleIds.forEach((id) => {
        next[id] = numericPrice;
      });
      return next;
    });
  };

  // Financial summary calculation
  const selectedVehiclesList = useMemo(() => {
    return vehicles.filter((v) => selectedVehicleIds.has(v.id));
  }, [vehicles, selectedVehicleIds]);

  const subtotalHT = useMemo(() => {
    return selectedVehiclesList.reduce((sum, v) => {
      const p = vehiclePrices[v.id] ?? getDefaultPriceForVehicle(v);
      return sum + p;
    }, 0);
  }, [selectedVehiclesList, vehiclePrices]);

  const baseHT = Math.max(0, subtotalHT - discount);
  const vatAmount = baseHT * (vatRate / 100);
  const timbreFiscal = selectedVehiclesList.length > 0 ? 1.0 : 0;
  const totalTTC = baseHT + vatAmount + timbreFiscal;

  // Form submit handler
  const handleSave = (targetStatus: BatchStatus) => {
    if (selectedVehicleIds.size === 0) {
      alert('Veuillez sélectionner au moins un véhicule à inclure dans ce lot de facturation.');
      return;
    }

    // Build batch items
    const items: BillingBatchItem[] = selectedVehiclesList.map((v) => {
      const uPrice = vehiclePrices[v.id] ?? getDefaultPriceForVehicle(v);
      return {
        vehicleId: v.id,
        chassisNumber: v.chassis_number || v.vin || v.id,
        brand: v.brand || 'Non spécifié',
        model: v.model || 'Véhicule',
        siteDepart: v.site_depart || 'Port La Goulette',
        siteArrivee: v.site_arrivee || 'Parc Megrine',
        logisticsStatus: v.status,
        billingStatus: targetStatus === 'valide' || targetStatus === 'facture' ? 'facture' : 'en_lot',
        unitPriceHT: uPrice,
        totalHT: uPrice,
        color: v.color,
        arrivalDate: v.arrival_date,
      };
    });

    const batchPayload = {
      batchNumber,
      invoiceReference: invoiceReference.trim() || undefined,
      importer,
      siteName: importer === 'STAFIM SA' ? 'Parc STAFIM Megrine' : 'Hub Distribution',
      billingType,
      batchDate,
      currency,
      vatRate,
      discount,
      subtotal: subtotalHT,
      vatAmount,
      timbreFiscal,
      total: totalTTC,
      status: targetStatus,
      notes: notes.trim() || undefined,
      vehicleIds: Array.from(selectedVehicleIds) as string[],
      vehicleCount: selectedVehicleIds.size,
      items,
      createdBy: currentUser?.full_name || 'Agent Facturation',
    };

    if (isEdit && existingBatch) {
      updateBatch(existingBatch.id, batchPayload);
    } else {
      createBatch(batchPayload);
    }

    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-slate-300 shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col rounded-none overflow-hidden my-auto text-slate-900">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500 text-slate-950">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black uppercase tracking-wider text-sm sm:text-base flex items-center space-x-2">
                <span>{isEdit ? 'Modification du Lot de Facturation' : 'Créer une Facturation en Lot'}</span>
                <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-none font-mono">
                  {batchNumber}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Sélection multi-véhicules, tarification globale ou ligne par ligne, et émission d un lot groupé
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50">
          {/* Section 1: Informative Parameters & Config */}
          <div className="bg-white p-5 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center space-x-2 border-b border-slate-100 pb-2">
              <Building2 className="w-4 h-4 text-amber-500" />
              <span>1. Paramètres du Lot de Facturation</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Importateur / Site */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Importateur / Client *
                </label>
                <select
                  value={importer}
                  onChange={(e) => setImporter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-3 py-2 font-bold focus:bg-white focus:border-amber-500 focus:outline-none"
                >
                  {OFFICIAL_IMPORTERS.map((imp) => (
                    <option key={imp.id} value={imp.name}>
                      {imp.name} ({imp.brands.join(', ')})
                    </option>
                  ))}
                  <option value="TOUS">-- Tous les Importateurs --</option>
                </select>
              </div>

              {/* Type de facturation */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Type de Facturation *
                </label>
                <select
                  value={billingType}
                  onChange={(e) => setBillingType(e.target.value as BatchBillingType)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-3 py-2 font-bold focus:bg-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="livres">Véhicules Livrés (Post-Livraison)</option>
                  <option value="a_livrer">Véhicules à Livrer (Prévisionnel / Proforma)</option>
                </select>
              </div>

              {/* Date du lot */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Date du Lot *
                </label>
                <input
                  type="date"
                  value={batchDate}
                  onChange={(e) => setBatchDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-3 py-2 font-mono font-bold focus:bg-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Référence N° Lot */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  N° de Lot *
                </label>
                <input
                  type="text"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-3 py-2 font-mono font-bold focus:bg-white focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              {/* Référence Facture Faculative */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Réf. Facture Officielle (Optionnel)
                </label>
                <input
                  type="text"
                  placeholder="ex: FAC-202608-088"
                  value={invoiceReference}
                  onChange={(e) => setInvoiceReference(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-3 py-2 font-mono focus:bg-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Devise */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Devise
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-3 py-2 font-bold focus:bg-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="DT">DT (Dinar Tunisien)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>

              {/* TVA % */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Taux TVA (%)
                </label>
                <input
                  type="number"
                  value={vatRate}
                  onChange={(e) => setVatRate(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-3 py-2 font-mono font-bold focus:bg-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Remise globale DT */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Remise Globale (DT)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-3 py-2 font-mono font-bold focus:bg-white focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Observations */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Observations & Notes du Lot
              </label>
              <input
                type="text"
                placeholder="Remarques logistiques, conditions de paiement ou contrat d'origine..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-3 py-2 focus:bg-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Section 2: Filters Bar for Vehicles */}
          <div className="bg-white p-5 border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center space-x-2">
                <Car className="w-4 h-4 text-blue-600" />
                <span>2. Filtre des Véhicules Facturables ({eligibleVehicles.length} disponibles)</span>
              </h3>

              <div className="flex items-center space-x-3">
                <label className="inline-flex items-center space-x-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyUnbilled}
                    onChange={(e) => setOnlyUnbilled(e.target.checked)}
                    className="accent-amber-500 w-4 h-4"
                  />
                  <span>Masquer les véhicules déjà facturés</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Recherche Texte VIN / Modèle */}
              <div className="lg:col-span-2 relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Recherche VIN, Châssis, Modèle, Couleur..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-300 text-xs focus:bg-white focus:border-blue-500 focus:outline-none font-mono"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    title="Effacer la recherche"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Statut logistique */}
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-xs px-2.5 py-1.5 font-bold focus:bg-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="all">Tous les Statuts Logistiques</option>
                  <option value="livre">Livré / Sorti</option>
                  <option value="en_stock">En Stock</option>
                  <option value="en_transit">En Transit</option>
                  <option value="en_panne">En Panne / Blocage</option>
                </select>
              </div>

              {/* Marque */}
              <div>
                <select
                  value={brandFilter}
                  onChange={(e) => {
                    setBrandFilter(e.target.value);
                    setModelFilter('all');
                  }}
                  className="w-full bg-slate-50 border border-slate-300 text-xs px-2.5 py-1.5 font-bold focus:bg-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="all">Toutes les Marques</option>
                  {availableBrands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Modèle */}
              <div>
                <select
                  value={modelFilter}
                  onChange={(e) => setModelFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-xs px-2.5 py-1.5 font-bold focus:bg-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="all">Tous les Modèles</option>
                  {availableModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Mass Action Tool & Selection Table */}
          <div className="bg-white p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50 p-3 border border-blue-200">
              <div className="flex items-center space-x-2">
                <Calculator className="w-4 h-4 text-blue-700" />
                <span className="text-xs font-bold text-blue-900">
                  Appliquer un prix unitaire fixe à tous les véhicules sélectionnés ({selectedVehicleIds.size}) :
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={globalPrice}
                  onChange={(e) => setGlobalPrice(e.target.value)}
                  placeholder="85.000"
                  className="w-28 px-3 py-1 bg-white border border-blue-300 text-xs font-mono font-bold text-blue-950 focus:outline-none"
                />
                <span className="text-xs font-bold text-blue-800">DT HT</span>
                <button
                  type="button"
                  onClick={handleApplyGlobalPrice}
                  className="px-3 py-1 bg-blue-700 hover:bg-blue-600 text-white text-xs font-black uppercase tracking-wider transition"
                >
                  Appliquer
                </button>
              </div>
            </div>

            {/* Active Search Banner Notice */}
            {searchQuery.trim() && (
              <div className="flex items-center justify-between text-xs bg-amber-50 border border-amber-300 text-amber-950 px-3 py-2">
                <div className="flex items-center space-x-2">
                  <Search className="w-4 h-4 text-amber-600" />
                  <span>
                    Filtre de recherche actif : <strong className="font-mono bg-amber-200 px-1 py-0.5 rounded-xs text-amber-950">"{searchQuery.trim()}"</strong> — <strong>{eligibleVehicles.length}</strong> véhicule(s) surligné(s)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                >
                  Effacer
                </button>
              </div>
            )}

            {/* Selection Counter & Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="inline-flex items-center space-x-2 text-xs font-bold text-slate-800 hover:text-amber-600 transition"
                >
                  {isAllSelectableChecked ? (
                    <CheckSquare className="w-4 h-4 text-amber-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Tout Sélectionner ({selectableVehicles.length} véhicules)</span>
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-black uppercase tracking-wider px-3 py-1 bg-amber-500 text-slate-950">
                  {selectedVehicleIds.size} Véhicule(s) Sélectionné(s)
                </span>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-200 max-h-[360px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-white sticky top-0 z-10 text-[11px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3 w-10 text-center">#</th>
                    <th className="p-3">Numéro Châssis (VIN)</th>
                    <th className="p-3">Marque & Modèle</th>
                    <th className="p-3">Site Départ & Arrivée</th>
                    <th className="p-3 text-center">Statut Logistique</th>
                    <th className="p-3 text-center">Statut Facturation</th>
                    <th className="p-3 text-right">Prix Unitaire HT (DT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-sans">
                  {eligibleVehicles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500 italic">
                        Aucun véhicule trouvé correspondant aux filtres.
                      </td>
                    </tr>
                  ) : (
                    eligibleVehicles.map((v) => {
                      const isSelected = selectedVehicleIds.has(v.id);
                      const isAlreadyBilled = activeBilledVehicleIds.has(v.id);
                      const currentPrice = vehiclePrices[v.id] ?? getDefaultPriceForVehicle(v);
                      const isSearchActive = Boolean(searchQuery.trim());

                      return (
                        <tr
                          key={v.id}
                          className={`transition ${
                            isAlreadyBilled
                              ? 'bg-slate-100 opacity-60'
                              : isSelected
                              ? isSearchActive
                                ? 'bg-amber-100/90 border-l-4 border-l-amber-600 shadow-2xs font-medium'
                                : 'bg-amber-50 hover:bg-amber-100/80'
                              : isSearchActive
                              ? 'bg-blue-50/70 border-l-4 border-l-blue-500 hover:bg-blue-100/80 font-medium'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isAlreadyBilled}
                              onChange={() => handleToggleVehicle(v)}
                              className="accent-amber-500 w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
                            />
                          </td>

                          {/* VIN */}
                          <td className="p-3">
                            <div className="font-mono font-bold text-slate-900">
                              {highlightText(v.chassis_number || v.vin, searchQuery)}
                            </div>
                            {v.stock_number && (
                              <div className="text-[10px] text-slate-500 font-mono">
                                Stock: {highlightText(v.stock_number, searchQuery)}
                              </div>
                            )}
                          </td>

                          {/* Brand & Model */}
                          <td className="p-3">
                            <div className="font-bold text-slate-900">
                              {highlightText(v.brand, searchQuery)} {highlightText(v.model, searchQuery)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {highlightText(v.color || 'Couleur N/A', searchQuery)}
                            </div>
                          </td>

                          {/* Sites */}
                          <td className="p-3 text-slate-700">
                            <div className="flex items-center space-x-1 text-[11px]">
                              <span>{highlightText(v.site_depart || 'Port La Goulette', searchQuery)}</span>
                              <ArrowRight className="w-3 h-3 text-slate-400" />
                              <span className="font-bold">{highlightText(v.site_arrivee || 'Parc Megrine', searchQuery)}</span>
                            </div>
                          </td>

                          {/* Logistics Status */}
                          <td className="p-3 text-center">
                            {v.status === 'livre' || v.is_delivered ? (
                              <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                LIVRÉ
                              </span>
                            ) : v.status === 'en_stock' ? (
                              <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                                EN STOCK
                              </span>
                            ) : v.status === 'en_transit' ? (
                              <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                EN TRANSIT
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700">
                                {v.status}
                              </span>
                            )}
                          </td>

                          {/* Billing Status */}
                          <td className="p-3 text-center">
                            {isAlreadyBilled ? (
                              <span className="inline-block px-2 py-0.5 text-[10px] font-black bg-red-100 text-red-700 border border-red-300" title="Protection anti-double facturation active">
                                DÉJÀ FACTURÉ
                              </span>
                            ) : isSelected ? (
                              <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                INCLUS AU LOT
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600">
                                Non facturé
                              </span>
                            )}
                          </td>

                          {/* Editable Unit Price */}
                          <td className="p-3 text-right">
                            <input
                              type="number"
                              step="0.001"
                              disabled={isAlreadyBilled || !isSelected}
                              value={currentPrice}
                              onChange={(e) => nextPriceForVehicle(v.id, parseFloat(e.target.value) || 0)}
                              className="w-24 text-right px-2 py-1 border border-slate-300 font-mono font-bold text-xs focus:border-amber-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Calculated Totals Summary Box */}
          <div className="bg-slate-900 text-white p-6 shadow-md border border-slate-800 flex flex-wrap items-center justify-between gap-6">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                RÉCAPITULATIF FINANCIER DU LOT ({selectedVehicleIds.size} VÉHICULES)
              </span>
              <div className="text-xs text-slate-300 flex items-center space-x-4 pt-1">
                <span>
                  Sous-total HT : <strong className="font-mono text-white">{subtotalHT.toFixed(3)} DT</strong>
                </span>
                <span>•</span>
                <span>
                  Remise : <strong className="font-mono text-amber-400">{discount.toFixed(3)} DT</strong>
                </span>
                <span>•</span>
                <span>
                  TVA (19%) : <strong className="font-mono text-white">{vatAmount.toFixed(3)} DT</strong>
                </span>
                <span>•</span>
                <span>
                  Timbre : <strong className="font-mono text-white">{timbreFiscal.toFixed(3)} DT</strong>
                </span>
              </div>
            </div>

            <div className="text-right border-l border-slate-800 pl-6">
              <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">NET À PAYER (TTC)</div>
              <div className="text-2xl font-black font-mono text-amber-300 tracking-tight">
                {totalTTC.toFixed(3)} DT
              </div>
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider"
          >
            Annuler
          </button>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => handleSave('brouillon')}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-wider flex items-center space-x-2"
            >
              <span>Enregistrer en Brouillon</span>
            </button>

            <button
              type="button"
              onClick={() => handleSave('valide')}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center space-x-2 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Valider & Générer le Lot</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
