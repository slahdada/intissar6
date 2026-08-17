import React, { useState, useMemo, useEffect } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  Edit,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Building2,
  X,
  DollarSign,
  Calculator,
  RefreshCw,
  Tag,
  Car,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  CheckSquare,
  Square,
  ListFilter,
  Check,
} from 'lucide-react';
import { Invoice, PaymentStatus, InvoiceItem, MovementWithDetails, Site, UserRole, User, Vehicle, BillingBatch } from '../types';
import { OFFICIAL_IMPORTERS, getImporterForBrand } from '../data/importers';
import { loadInvoices, createInvoice, updateInvoice, deleteInvoice, deleteInvoices } from '../lib/invoiceStore';
import { generateSingleInvoicePDF, generateGroupedInvoicePDF, exportInvoicesToCSV, getStatusLabel } from '../lib/pdfInvoice';
import { canEditBusinessDate } from '../lib/permissions';
import { logDateChange } from '../lib/auditLogger';
import { formatDateTime } from '../lib/dateUtils';
import { getVehicleSoldedDetails } from '../lib/soldedUtils';
import { api } from '../lib/api';
import { BatchBillingModal } from './BatchBillingModal';
import { BatchHistoryModal } from './BatchHistoryModal';

interface BillingModuleProps {
  movements: MovementWithDetails[];
  sites: Site[];
  vehicles?: Vehicle[];
  userRole: UserRole;
  currentUser?: User;
  onNavigateToMovements?: () => void;
  onRefresh?: () => void;
}

export const BillingModule: React.FC<BillingModuleProps> = ({
  movements,
  sites,
  vehicles = [],
  userRole,
  currentUser,
  onNavigateToMovements,
  onRefresh,
}) => {
  // Master state
  const [invoices, setInvoices] = useState<Invoice[]>(() => loadInvoices());

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [importerFilter, setImporterFilter] = useState<string>('');
  const [siteFilter, setSiteFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Modals state
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null);

  // Multi-selection state for invoices
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // Batch Billing Module states
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showBatchHistoryModal, setShowBatchHistoryModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<BillingBatch | null>(null);

  // Auto-generator modal from movements
  const [showAutoGeneratorModal, setShowAutoGeneratorModal] = useState(false);
  const [autoGenImporterId, setAutoGenImporterId] = useState('stafim');
  const [autoGenRateEntry, setAutoGenRateEntry] = useState<number>(50);
  const [autoGenRateTransfer, setAutoGenRateTransfer] = useState<number>(85);
  const [autoGenRateExit, setAutoGenRateExit] = useState<number>(60);

  // Reload handler
  const refreshInvoiceList = () => {
    setInvoices(loadInvoices());
  };

  // Filtered Invoices calculation
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Search term (invoice number, client, tax ID, notes)
      const query = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !query ||
        inv.invoice_number.toLowerCase().includes(query) ||
        inv.client_name.toLowerCase().includes(query) ||
        inv.client_mf.toLowerCase().includes(query) ||
        (inv.notes && inv.notes.toLowerCase().includes(query));

      // Status
      const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;

      // Importer
      const matchesImporter = !importerFilter || inv.importer_id === importerFilter;

      // Site
      const matchesSite = !siteFilter || inv.site_id === siteFilter;

      // Date range
      let matchesDate = true;
      if (startDate) {
        matchesDate = matchesDate && inv.invoice_date >= startDate;
      }
      if (endDate) {
        matchesDate = matchesDate && inv.invoice_date <= endDate;
      }

      return matchesSearch && matchesStatus && matchesImporter && matchesSite && matchesDate;
    });
  }, [invoices, searchTerm, statusFilter, importerFilter, siteFilter, startDate, endDate]);

  // Dashboard Stats Calculations
  const stats = useMemo(() => {
    const totalTTC = filteredInvoices.reduce((sum, i) => sum + i.total_ttc, 0);
    const totalHT = filteredInvoices.reduce((sum, i) => sum + i.subtotal_ht, 0);

    const paidInvoices = filteredInvoices.filter((i) => i.status === 'payee');
    const paidTTC = paidInvoices.reduce((sum, i) => sum + i.total_ttc, 0);

    const pendingInvoices = filteredInvoices.filter((i) => i.status === 'en_attente');
    const pendingTTC = pendingInvoices.reduce((sum, i) => sum + i.total_ttc, 0);

    const overdueInvoices = filteredInvoices.filter((i) => i.status === 'en_retard');
    const overdueTTC = overdueInvoices.reduce((sum, i) => sum + i.total_ttc, 0);

    const draftInvoices = filteredInvoices.filter((i) => i.status === 'brouillon');

    return {
      totalTTC,
      totalHT,
      paidTTC,
      paidCount: paidInvoices.length,
      pendingTTC,
      pendingCount: pendingInvoices.length,
      overdueTTC,
      overdueCount: overdueInvoices.length,
      draftCount: draftInvoices.length,
      count: filteredInvoices.length,
    };
  }, [filteredInvoices]);

  // Handlers
  const handleStatusChange = (invoiceId: string, newStatus: PaymentStatus) => {
    const updated = updateInvoice(invoiceId, {
      status: newStatus,
      paid_date: newStatus === 'payee' ? new Date().toISOString().split('T')[0] : undefined,
    });
    if (updated) {
      refreshInvoiceList();
      if (viewingInvoice && viewingInvoice.id === invoiceId) {
        setViewingInvoice(updated);
      }
    }
  };

  const handleDeleteConfirm = () => {
    if (deletingInvoiceId) {
      deleteInvoice(deletingInvoiceId);
      setSelectedInvoiceIds((prev) => prev.filter((id) => id !== deletingInvoiceId));
      setDeletingInvoiceId(null);
      refreshInvoiceList();
    }
  };

  // Multi-selection helper functions
  const isAllSelected = useMemo(() => {
    return (
      filteredInvoices.length > 0 &&
      filteredInvoices.every((inv) => selectedInvoiceIds.includes(inv.id))
    );
  }, [filteredInvoices, selectedInvoiceIds]);

  const handleSelectAllToggle = () => {
    if (isAllSelected) {
      const filteredIds = new Set(filteredInvoices.map((inv) => inv.id));
      setSelectedInvoiceIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      const filteredIds = filteredInvoices.map((inv) => inv.id);
      setSelectedInvoiceIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleToggleSelectInvoice = (id: string) => {
    setSelectedInvoiceIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkDeleteConfirm = () => {
    if (selectedInvoiceIds.length > 0) {
      deleteInvoices(selectedInvoiceIds);
      setSelectedInvoiceIds([]);
      setShowBulkDeleteModal(false);
      refreshInvoiceList();
    }
  };

  const handleExportSelectedCSV = () => {
    const selectedInvoices = invoices.filter((inv) => selectedInvoiceIds.includes(inv.id));
    if (selectedInvoices.length > 0) {
      exportInvoicesToCSV(selectedInvoices);
    }
  };

  // Generate invoice auto from movements for an importer
  const handleGenerateInvoiceFromMovements = (overrideImporterId?: string | React.MouseEvent | unknown) => {
    const targetImpId = typeof overrideImporterId === 'string' && overrideImporterId.trim() ? overrideImporterId.trim() : autoGenImporterId;
    const imp = OFFICIAL_IMPORTERS.find((i) => i.id === targetImpId);
    if (!imp) {
      alert("Veuillez sélectionner un importateur officiel valide.");
      return;
    }

    // Build vehicle map for fast lookup
    const vehicleMap = new Map<string, Vehicle>();
    vehicles.forEach((v) => {
      if (v.id) vehicleMap.set(v.id, v);
    });

    const isVehicleForImporter = (v?: Vehicle) => {
      if (!v) return false;
      if (v.importer_id && v.importer_id === imp.id) return true;
      if (v.importer_name && (v.importer_name.toLowerCase().includes(imp.name.toLowerCase()) || imp.name.toLowerCase().includes(v.importer_name.toLowerCase()))) return true;
      if (v.brand) {
        const impMatch = getImporterForBrand(v.brand);
        if (impMatch?.id === imp.id) return true;
      }
      return false;
    };

    // Billed movements for this importer
    const billedMovs = movements.filter((m) => {
      const v = vehicleMap.get(m.vehicle_id);
      if (v && isVehicleForImporter(v)) return true;
      if (m.vehicle_brand) {
        const impMatch = getImporterForBrand(m.vehicle_brand);
        if (impMatch?.id === imp.id) return true;
      }
      return false;
    });

    const entriesCount = billedMovs.filter((m) => m.movement_type === 'entry').length;
    const transfersCount = billedMovs.filter((m) => m.movement_type === 'transfer').length;
    const exitsCount = billedMovs.filter((m) => m.movement_type === 'exit' || m.movement_type === 'reception').length;

    const items: InvoiceItem[] = [];

    if (entriesCount > 0) {
      items.push({
        id: `item_entry_${Date.now()}_1`,
        description: `Prestation Déchargement & Réception Portuaire (${entriesCount} véhicule${entriesCount > 1 ? 's' : ''} - ${imp.code})`,
        quantity: entriesCount,
        unitPriceHT: autoGenRateEntry,
        totalHT: entriesCount * autoGenRateEntry,
        tvaRate: 19,
      });
    }

    if (transfersCount > 0) {
      items.push({
        id: `item_trans_${Date.now()}_2`,
        description: `Transferts Convoyage Inter-Sites (${transfersCount} véhicule${transfersCount > 1 ? 's' : ''} - ${imp.code})`,
        quantity: transfersCount,
        unitPriceHT: autoGenRateTransfer,
        totalHT: transfersCount * autoGenRateTransfer,
        tvaRate: 19,
      });
    }

    if (exitsCount > 0) {
      items.push({
        id: `item_exit_${Date.now()}_3`,
        description: `Prestation Enlèvement Concession & Sortie Stock (${exitsCount} véhicule${exitsCount > 1 ? 's' : ''} - ${imp.code})`,
        quantity: exitsCount,
        unitPriceHT: autoGenRateExit,
        totalHT: exitsCount * autoGenRateExit,
        tvaRate: 19,
      });
    }

    // Fallback if no specific movement type match or zero movements
    if (items.length === 0) {
      const importerVehicles = vehicles.filter(isVehicleForImporter);
      const vehicleCount = importerVehicles.length || 1;
      const rate = autoGenRateEntry || 50;
      items.push({
        id: `item_gen_${Date.now()}`,
        description: `Forfait Prestation Logistique Globale (${vehicleCount} véhicule${vehicleCount > 1 ? 's' : ''} - ${imp.name})`,
        quantity: vehicleCount,
        unitPriceHT: rate,
        totalHT: vehicleCount * rate,
        tvaRate: 19,
      });
    }

    const subtotalHT = items.reduce((sum, item) => sum + item.totalHT, 0);
    const tvaAmount = (subtotalHT * 19) / 100;
    const timbreFiscal = 1.0;
    const totalTTC = subtotalHT + tvaAmount + timbreFiscal;

    const now = new Date();
    const invNumber = `FAC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;

    const newInv = createInvoice({
      invoice_number: invNumber,
      invoice_date: now.toISOString().split('T')[0],
      due_date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      client_name: imp.name,
      client_address: imp.address,
      client_mf: imp.mf,
      importer_id: imp.id,
      status: 'en_attente',
      payment_method: 'Virement bancaire',
      items,
      subtotal_ht: subtotalHT,
      tva_rate: 19,
      tva_amount: tvaAmount,
      timbre_fiscal: timbreFiscal,
      total_ttc: totalTTC,
      notes: `Facture générée automatiquement d'après les mouvements réels des véhicules pour ${imp.name} (${imp.code}). Total ${billedMovs.length} mouvement(s) identifié(s).`,
    });

    setShowAutoGeneratorModal(false);
    refreshInvoiceList();
    setViewingInvoice(newInv);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Header */}
      <div className="bg-slate-900 text-white p-6 border-b-4 border-amber-500 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500 text-slate-950 font-black rounded-xs">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-wider text-slate-100">
                Module Facturation & Gestion Financière
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Factures par concessionnaire, facturation groupée multi-véhicules, calculs HT/TVA/TTC, suivis de paiements et récapitulatifs.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Facturation en Lot Main Action */}
          <button
            onClick={() => {
              setEditingBatch(null);
              setShowBatchModal(true);
            }}
            className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2.5 text-xs font-black uppercase tracking-wider transition shadow-sm"
            title="Créer un lot de facturation multi-véhicules pour un importateur"
          >
            <Layers className="w-4 h-4" />
            <span>Créer une facturation en lot</span>
          </button>

          {userRole !== 'viewer' && (
            <button
              onClick={() => {
                setEditingInvoice(null);
                setIsCreatingNew(true);
              }}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 text-xs font-black uppercase tracking-wider transition shadow-sm"
              title="Créer une facture pour un véhicule unique"
            >
              <Plus className="w-4 h-4" />
              <span>Facture individuelle</span>
            </button>
          )}

          {/* Historique des lots */}
          <button
            onClick={() => setShowBatchHistoryModal(true)}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider transition"
            title="Voir l'historique des lots de facturation"
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>Historique des lots</span>
          </button>

          <button
            onClick={() => setShowAutoGeneratorModal(true)}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider transition"
            title="Créer rapidement une facture d'après les mouvements réels des véhicules"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Facturer Mouvements</span>
          </button>

          <button
            onClick={() => exportInvoicesToCSV(filteredInvoices)}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider transition"
            title="Exporter la liste actuelle des factures au format CSV / Excel"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Financial Dashboard Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total TTC */}
        <div className="bg-white p-5 border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-slate-900"></div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Total Facturé (TTC)
            </span>
            <Calculator className="w-5 h-5 text-slate-700" />
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {stats.totalTTC.toFixed(3)}{' '}
            <span className="text-xs font-bold text-slate-600">DT</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Hors Taxes : {stats.totalHT.toFixed(3)} DT</span>
            <span className="font-bold text-slate-700">{stats.count} factures</span>
          </div>
        </div>

        {/* Metric 2: Payé / Encaissé */}
        <div className="bg-white p-5 border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-emerald-600"></div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
              Règlements Encaissés
            </span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-800 tracking-tight">
            {stats.paidTTC.toFixed(3)}{' '}
            <span className="text-xs font-bold text-emerald-600">DT</span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-700 font-bold flex items-center justify-between">
            <span>{stats.paidCount} Factures Payées</span>
            <span>
              {stats.totalTTC > 0 ? ((stats.paidTTC / stats.totalTTC) * 100).toFixed(0) : 0}% du CA
            </span>
          </div>
        </div>

        {/* Metric 3: En attente */}
        <div className="bg-white p-5 border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-amber-500"></div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">
              En Attente de Paiement
            </span>
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-800 tracking-tight">
            {stats.pendingTTC.toFixed(3)}{' '}
            <span className="text-xs font-bold text-amber-600">DT</span>
          </div>
          <div className="mt-2 text-[11px] text-amber-700 font-bold flex items-center justify-between">
            <span>{stats.pendingCount} Factures Émises</span>
            <span>Échéance ≤ 30j</span>
          </div>
        </div>

        {/* Metric 4: En retard */}
        <div className="bg-white p-5 border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-rose-600"></div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-700">
              Créances En Retard
            </span>
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-800 tracking-tight">
            {stats.overdueTTC.toFixed(3)}{' '}
            <span className="text-xs font-bold text-rose-600">DT</span>
          </div>
          <div className="mt-2 text-[11px] text-rose-700 font-bold flex items-center justify-between">
            <span>{stats.overdueCount} Factures à relancer</span>
            <span className="underline cursor-pointer" onClick={() => setStatusFilter('en_retard')}>
              Filtrer retards
            </span>
          </div>
        </div>
      </div>

      {/* Advanced Filters Bar */}
      <div className="bg-white p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center space-x-2 text-slate-900">
            <Filter className="w-4 h-4 text-amber-500" />
            <h2 className="text-xs font-black uppercase tracking-wider">
              Filtres & Recherche Avancée de Factures
            </h2>
          </div>
          {(searchTerm || statusFilter !== 'all' || importerFilter || siteFilter || startDate || endDate) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setImporterFilter('');
                setSiteFilter('');
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center space-x-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Réinitialiser filtres</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search box */}
          <div className="relative">
            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
              Recherche Texte
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="N° Facture, Client, MF..."
                className="w-full pl-9 pr-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Status filter */}
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
              Statut Règlement
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 focus:outline-none focus:border-blue-600"
            >
              <option value="all">Tous les Statuts</option>
              <option value="payee">Payée (Encaissée)</option>
              <option value="en_attente">En Attente</option>
              <option value="en_retard">En Retard</option>
              <option value="brouillon">Brouillon</option>
              <option value="annulee">Annulée</option>
            </select>
          </div>

          {/* Importer filter */}
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
              Importateur / Concession
            </label>
            <select
              value={importerFilter}
              onChange={(e) => setImporterFilter(e.target.value)}
              className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 focus:outline-none focus:border-blue-600"
            >
              <option value="">Tous les Importateurs</option>
              {OFFICIAL_IMPORTERS.map((imp) => (
                <option key={imp.id} value={imp.id}>
                  {imp.code} - {imp.name}
                </option>
              ))}
            </select>
          </div>

          {/* Site filter */}
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
              Site / Parc Rattaché
            </label>
            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 focus:outline-none focus:border-blue-600"
            >
              <option value="">Tous les Sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date range filter */}
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">
              Période (Du / Au)
            </label>
            <div className="flex space-x-1">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-1/2 p-1.5 text-[11px] font-mono bg-slate-50 border border-slate-300"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-1/2 p-1.5 text-[11px] font-mono bg-slate-50 border border-slate-300"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Invoices Table */}
      <div className="bg-white border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <FileText className="w-5 h-5 text-amber-500" />
            <h3 className="text-xs font-black uppercase tracking-wider">
              Registre Officiel des Factures de Prestation ({filteredInvoices.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Mis à jour le {formatDateTime(new Date())}
          </span>
        </div>

        {/* Multi-selection Action Toolbar */}
        {selectedInvoiceIds.length > 0 && (
          <div className="bg-amber-500 text-slate-950 px-4 py-3 flex flex-wrap items-center justify-between gap-3 font-bold text-xs border-b border-amber-600">
            <div className="flex items-center space-x-3">
              <CheckSquare className="w-5 h-5 text-slate-950" />
              <span className="uppercase font-black text-slate-950 tracking-wider">
                {selectedInvoiceIds.length} facture(s) sélectionnée(s) sur {filteredInvoices.length}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  const filteredIds = filteredInvoices.map((inv) => inv.id);
                  setSelectedInvoiceIds(Array.from(new Set([...selectedInvoiceIds, ...filteredIds])));
                }}
                className="px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 text-[11px] font-black uppercase tracking-wider transition"
              >
                Tout Sélectionner ({filteredInvoices.length})
              </button>

              <button
                onClick={() => setSelectedInvoiceIds([])}
                className="px-3 py-1.5 bg-slate-200 text-slate-900 hover:bg-slate-300 text-[11px] font-bold uppercase tracking-wider transition"
              >
                Tout Décocher
              </button>

              <button
                onClick={handleExportSelectedCSV}
                className="px-3 py-1.5 bg-slate-900 text-amber-300 hover:bg-slate-800 text-[11px] font-black uppercase tracking-wider flex items-center space-x-1 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV ({selectedInvoiceIds.length})</span>
              </button>

              {userRole !== 'viewer' && (
                <button
                  onClick={() => setShowBulkDeleteModal(true)}
                  className="px-4 py-1.5 bg-rose-600 text-white hover:bg-rose-700 text-[11px] font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-sm transition"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Supprimer la sélection ({selectedInvoiceIds.length})</span>
                </button>
              )}
            </div>
          </div>
        )}

        {filteredInvoices.length === 0 ? (
          <div className="p-12 text-center text-slate-500 bg-slate-50 space-y-3">
            <Receipt className="w-12 h-12 mx-auto text-slate-300 stroke-1" />
            <p className="text-sm font-bold">Aucune facture ne correspond à votre recherche.</p>
            <p className="text-xs text-slate-400">
              Modifiez vos critères de filtrage ou créez une nouvelle facture.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-[10px] font-black uppercase text-slate-700 border-b border-slate-200 tracking-wider">
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleSelectAllToggle}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                      title={isAllSelected ? 'Tout décocher' : 'Tout sélectionner'}
                    />
                  </th>
                  <th className="p-3">N° Facture</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Client / Importateur</th>
                  <th className="p-3 text-center">Véhicules / Prestations</th>
                  <th className="p-3 text-right">Montant HT</th>
                  <th className="p-3 text-right">Total TTC</th>
                  <th className="p-3 text-center">Statut</th>
                  <th className="p-3 text-center">Mode Paiement</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredInvoices.map((inv) => {
                  const statusInfo = getStatusLabel(inv.status);
                  const isMultiVehicle = inv.items && inv.items.some(it => it.vehicleId || it.chassisNumber || it.description.includes('VIN:'));
                  const vehicleCount = inv.items ? inv.items.filter(it => it.vehicleId || it.chassisNumber || it.description.includes('VIN:')).length : 0;
                  const isSelected = selectedInvoiceIds.includes(inv.id);

                  return (
                    <tr
                      key={inv.id}
                      className={`transition ${isSelected ? 'bg-amber-50/90 border-l-4 border-l-amber-500' : 'hover:bg-slate-50/80'}`}
                    >
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectInvoice(inv.id)}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      <td className="p-3 font-mono font-black text-slate-900 flex items-center space-x-1.5">
                        <Tag className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        <span>{inv.invoice_number}</span>
                      </td>

                      <td className="p-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {inv.invoice_date ? formatDateTime(inv.invoice_date) : '-'}
                      </td>

                      <td className="p-3 font-bold text-slate-900">
                        <div>{inv.client_name}</div>
                        <div className="text-[10px] font-normal text-slate-500 font-mono">
                          MF: {inv.client_mf}
                        </div>
                      </td>

                      <td className="p-3 text-center">
                        {isMultiVehicle && vehicleCount > 0 ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-blue-100 text-blue-900 font-black text-[10px] rounded-xs border border-blue-200">
                            <Car className="w-3 h-3 text-blue-700" />
                            <span>Facture Groupée ({vehicleCount} véh.)</span>
                          </span>
                        ) : (
                          <span className="text-slate-600 font-medium text-[11px]">
                            {inv.items ? inv.items.length : 0} prestation(s)
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                        {inv.subtotal_ht.toFixed(3)} DT
                      </td>

                      <td className="p-3 text-right font-mono font-black text-blue-900 text-sm whitespace-nowrap">
                        {inv.total_ttc.toFixed(3)} DT
                      </td>

                      <td className="p-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-xs border ${
                            inv.status === 'payee'
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : inv.status === 'en_attente'
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : inv.status === 'en_retard'
                              ? 'bg-rose-100 text-rose-900 border-rose-300'
                              : inv.status === 'annulee'
                              ? 'bg-slate-200 text-slate-600 border-slate-300 line-through'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>

                      <td className="p-3 text-center text-[11px] text-slate-600 whitespace-nowrap">
                        {inv.payment_method || '-'}
                      </td>

                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => setViewingInvoice(inv)}
                            className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 transition"
                            title="Consulter le détail complet de la facture"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => generateSingleInvoicePDF(inv, vehicles)}
                            className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 border border-slate-200 transition"
                            title="Générer & Télécharger le PDF officiel (Inclus détails véhicules)"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {isMultiVehicle && (
                            <button
                              onClick={() => generateGroupedInvoicePDF(inv, vehicles)}
                              className="p-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-300 transition"
                              title="Export PDF Facture Groupée (Détails & Annexe Technique Véhicules)"
                            >
                              <FileText className="w-3.5 h-3.5 text-blue-700" />
                            </button>
                          )}

                          {userRole !== 'viewer' && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingInvoice(inv);
                                  setIsCreatingNew(false);
                                }}
                                className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 transition"
                                title="Modifier la facture"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => setDeletingInvoiceId(inv.id)}
                                className="p-1.5 text-slate-600 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 transition"
                                title="Supprimer la facture"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
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

      {/* MODAL 1: Viewing Invoice Detail Modal */}
      {viewingInvoice && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border-2 border-slate-900 shadow-2xl max-w-3xl w-full my-6 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 bg-slate-900 text-white border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-500 text-slate-950 font-black">
                  <Receipt className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-black uppercase tracking-wider">
                      Facture #{viewingInvoice.invoice_number}
                    </h3>
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 border ${
                        viewingInvoice.status === 'payee'
                          ? 'bg-emerald-500 text-white border-emerald-600'
                          : 'bg-amber-500 text-slate-950 border-amber-600'
                      }`}
                    >
                      {getStatusLabel(viewingInvoice.status).label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Émise le {viewingInvoice.invoice_date ? formatDateTime(viewingInvoice.invoice_date) : '-'} | Échéance :{' '}
                    {viewingInvoice.due_date ? formatDateTime(viewingInvoice.due_date) : '-'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingInvoice(null)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50">
              {/* Header Box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 border border-slate-200">
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                    Émetteur (Prestataire)
                  </h4>
                  <p className="text-xs font-bold text-slate-900">STAFIM SA - Division Logistique</p>
                  <p className="text-xs text-slate-600">Route de Sousse Km 6, Mégrine, Tunis</p>
                  <p className="text-xs text-slate-600 font-mono">MF: 0012845/A/P/M/000</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                    Client / Bénéficiaire
                  </h4>
                  <p className="text-xs font-bold text-blue-900">{viewingInvoice.client_name}</p>
                  <p className="text-xs text-slate-600">{viewingInvoice.client_address}</p>
                  <p className="text-xs text-slate-600 font-mono">MF: {viewingInvoice.client_mf}</p>
                </div>
              </div>

              {/* Multi-vehicle detail box if applicable */}
              {viewingInvoice.items && viewingInvoice.items.some((it) => it.vehicleId || it.chassisNumber || it.description.includes('VIN:')) && (
                <div className="bg-blue-50 border-2 border-blue-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase text-blue-900 flex items-center space-x-2">
                      <Car className="w-4 h-4 text-blue-600" />
                      <span>
                        Détail des Véhicules Facturés ({viewingInvoice.items.filter((it) => it.vehicleId || it.chassisNumber || it.description.includes('VIN:')).length} véhicules)
                      </span>
                    </h4>
                    <span className="bg-blue-600 text-white font-mono text-[10px] font-black uppercase px-2 py-0.5">
                      Facture Groupée Multi-Véhicules
                    </span>
                  </div>
                  <div className="overflow-x-auto bg-white border border-blue-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-blue-100 text-[10px] font-black uppercase text-blue-900 border-b border-blue-200">
                        <tr>
                          <th className="p-2">#</th>
                          <th className="p-2">VIN / Châssis</th>
                          <th className="p-2">Désignation & Modèle</th>
                          <th className="p-2 text-right">Montant HT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-blue-100">
                        {viewingInvoice.items.map((it, idx) => {
                          const vinMatch = it.chassisNumber || it.description.match(/VIN:\s*([A-Za-z0-9]+)/i)?.[1] || '-';
                          return (
                            <tr key={it.id || idx}>
                              <td className="p-2 font-bold text-blue-800">{idx + 1}</td>
                              <td className="p-2 font-mono font-bold text-blue-950 bg-blue-50/60">{vinMatch}</td>
                              <td className="p-2 text-slate-800 font-bold">{it.description}</td>
                              <td className="p-2 text-right font-mono font-bold text-slate-900">
                                {it.unitPriceHT.toFixed(3)} DT
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div className="bg-white border border-slate-200">
                <div className="p-3 bg-slate-100 font-black text-xs uppercase tracking-wider text-slate-800 border-b border-slate-200">
                  Lignes de Prestations Facturées
                </div>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-600 border-b border-slate-200">
                      <th className="p-3">#</th>
                      <th className="p-3">Désignation</th>
                      <th className="p-3 text-center">Qté</th>
                      <th className="p-3 text-right">Prix HT</th>
                      <th className="p-3 text-center">TVA %</th>
                      <th className="p-3 text-right">Total HT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingInvoice.items.map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td className="p-3 font-bold text-slate-500">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900">{it.description}</td>
                        <td className="p-3 text-center font-bold">{it.quantity}</td>
                        <td className="p-3 text-right font-mono">{it.unitPriceHT.toFixed(3)} DT</td>
                        <td className="p-3 text-center font-bold">{it.tvaRate}%</td>
                        <td className="p-3 text-right font-bold text-slate-900 font-mono">
                          {it.totalHT.toFixed(3)} DT
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Breakdown */}
              <div className="flex justify-end">
                <div className="bg-white p-4 border border-slate-200 w-full md:w-80 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Total Hors Taxes (HT) :</span>
                    <strong className="font-mono text-slate-900">{viewingInvoice.subtotal_ht.toFixed(3)} DT</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>TVA ({viewingInvoice.tva_rate}%) :</span>
                    <strong className="font-mono text-slate-900">{viewingInvoice.tva_amount.toFixed(3)} DT</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Timbre Fiscal :</span>
                    <strong className="font-mono text-slate-900">{viewingInvoice.timbre_fiscal.toFixed(3)} DT</strong>
                  </div>
                  <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-black text-slate-900">
                    <span>Total Net TTC :</span>
                    <span className="text-blue-600 font-mono">{viewingInvoice.total_ttc.toFixed(3)} DT</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => setViewingInvoice(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold uppercase tracking-wider"
              >
                Fermer
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => generateGroupedInvoicePDF(viewingInvoice, vehicles)}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white text-xs font-black uppercase tracking-wider flex items-center space-x-2 shadow-xs"
                  title="Exporter le PDF officiel de la facture groupée avec tous les détails techniques des véhicules"
                >
                  <FileText className="w-4 h-4 text-amber-300" />
                  <span>Export PDF Facture Groupée (Détails Techniques)</span>
                </button>

                <button
                  onClick={() => generateSingleInvoicePDF(viewingInvoice, vehicles)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center space-x-2"
                >
                  <Printer className="w-4 h-4 text-slate-950" />
                  <span>Imprimer PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Create / Edit Form Modal */}
      {(isCreatingNew || editingInvoice) && (
        <InvoiceFormModal
          invoice={editingInvoice}
          sites={sites}
          movements={movements}
          vehicles={vehicles}
          invoices={invoices}
          currentUser={currentUser}
          onClose={() => {
            setIsCreatingNew(false);
            setEditingInvoice(null);
          }}
          onSave={() => {
            setIsCreatingNew(false);
            setEditingInvoice(null);
            refreshInvoiceList();
            if (onRefresh) onRefresh();
          }}
          onRefreshData={onRefresh}
        />
      )}

      {/* MODAL 3: Auto-Generator from Movements Modal */}
      {showAutoGeneratorModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border-2 border-slate-900 shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2 text-slate-900">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-black uppercase tracking-wider">
                  Générateur Automatique de Facture
                </h3>
              </div>
              <button onClick={() => setShowAutoGeneratorModal(false)} className="text-slate-400 hover:text-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Sélectionnez un importateur officiel pour comptabiliser automatiquement tous ses mouvements de véhicules et générer la facture avec TVA.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                  Importateur Client
                </label>
                <select
                  value={autoGenImporterId}
                  onChange={(e) => setAutoGenImporterId(e.target.value)}
                  className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-300 focus:outline-none focus:border-blue-600"
                >
                  {OFFICIAL_IMPORTERS.map((imp) => (
                    <option key={imp.id} value={imp.id}>
                      {imp.code} - {imp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2">
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">
                    Tarif Entrée HT
                  </label>
                  <input
                    type="number"
                    value={autoGenRateEntry}
                    onChange={(e) => setAutoGenRateEntry(Number(e.target.value))}
                    className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-300"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">
                    Tarif Transfert HT
                  </label>
                  <input
                    type="number"
                    value={autoGenRateTransfer}
                    onChange={(e) => setAutoGenRateTransfer(Number(e.target.value))}
                    className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-300"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">
                    Tarif Sortie HT
                  </label>
                  <input
                    type="number"
                    value={autoGenRateExit}
                    onChange={(e) => setAutoGenRateExit(Number(e.target.value))}
                    className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-300"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200">
              <button
                onClick={() => setShowAutoGeneratorModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider"
              >
                Annuler
              </button>
              <button
                onClick={() => handleGenerateInvoiceFromMovements()}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider flex items-center space-x-2"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Générer Facture</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Delete Confirmation */}
      {deletingInvoiceId && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border-2 border-rose-600 p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-rose-700 uppercase tracking-wider flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <span>Confirmer la suppression</span>
            </h3>
            <p className="text-xs text-slate-600">
              Voulez-vous vraiment supprimer cette facture définitivement ? Cette action est irréversible.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setDeletingInvoiceId(null)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold text-xs uppercase"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-1.5 bg-rose-600 text-white font-black text-xs uppercase hover:bg-rose-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4B: Bulk Delete Confirmation */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border-2 border-rose-600 max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-rose-700 uppercase tracking-wider flex items-center space-x-2">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
                <span>Suppression Multi-Factures</span>
              </h3>
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-700 font-medium">
              Êtes-vous sûr de vouloir supprimer définitivement les{' '}
              <strong className="text-rose-700 font-black">{selectedInvoiceIds.length} facture(s)</strong>{' '}
              sélectionnée(s) ? Cette action supprime les enregistrements du registre et est irréversible.
            </p>

            {/* List preview of selected invoices */}
            <div className="max-h-52 overflow-y-auto bg-slate-50 border border-slate-200 divide-y divide-slate-200">
              {invoices
                .filter((inv) => selectedInvoiceIds.includes(inv.id))
                .map((inv) => (
                  <div key={inv.id} className="p-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold text-slate-900">{inv.invoice_number}</span>
                      <span className="mx-2 text-slate-400">|</span>
                      <span className="font-semibold text-slate-700">{inv.client_name}</span>
                    </div>
                    <span className="font-mono font-black text-slate-900">
                      {inv.total_ttc.toFixed(3)} DT
                    </span>
                  </div>
                ))}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider"
              >
                Annuler
              </button>
              <button
                onClick={handleBulkDeleteConfirm}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-wider flex items-center space-x-2 shadow-md transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirmer la suppression ({selectedInvoiceIds.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Batch Billing Creation & Editing Modal */}
      {showBatchModal && (
        <BatchBillingModal
          existingBatch={editingBatch}
          vehicles={vehicles}
          currentUser={currentUser}
          onClose={() => {
            setShowBatchModal(false);
            setEditingBatch(null);
          }}
          onSuccess={() => {
            setShowBatchModal(false);
            setEditingBatch(null);
            refreshInvoiceList();
            alert('Lot de facturation enregistré avec succès !');
          }}
        />
      )}

      {/* MODAL 6: Batch Billing History Modal */}
      {showBatchHistoryModal && (
        <BatchHistoryModal
          vehicles={vehicles}
          userRole={userRole}
          currentUser={currentUser}
          onClose={() => setShowBatchHistoryModal(false)}
          onCreateNewBatch={() => {
            setShowBatchHistoryModal(false);
            setEditingBatch(null);
            setShowBatchModal(true);
          }}
          onEditBatch={(batch) => {
            setShowBatchHistoryModal(false);
            setEditingBatch(batch);
            setShowBatchModal(true);
          }}
        />
      )}
    </div>
  );
};

// Sub-component Form Modal for Create & Edit
interface InvoiceFormModalProps {
  invoice: Invoice | null;
  sites: Site[];
  movements: MovementWithDetails[];
  vehicles?: Vehicle[];
  invoices: Invoice[];
  currentUser?: User;
  onClose: () => void;
  onSave: () => void;
  onRefreshData?: () => void;
}

const InvoiceFormModal: React.FC<InvoiceFormModalProps> = ({
  invoice,
  sites,
  movements,
  vehicles = [],
  invoices = [],
  currentUser,
  onClose,
  onSave,
  onRefreshData,
}) => {
  const isEdit = !!invoice;
  const canEditDate = canEditBusinessDate(currentUser);

  // Creation Type: Individual vs Grouped Multi-Vehicle
  const [creationType, setCreationType] = useState<'individual' | 'grouped'>('individual');

  const [invoiceNumber, setInvoiceNumber] = useState(
    invoice?.invoice_number ||
      `FAC-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(
        1000 + Math.random() * 9000
      )}`
  );
  const [invoiceDate, setInvoiceDate] = useState(
    invoice?.invoice_date || new Date().toISOString().split('T')[0]
  );
  const [dueDate, setDueDate] = useState(
    invoice?.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [clientName, setClientName] = useState(invoice?.client_name || 'STAFIM SA');
  const [clientAddress, setClientAddress] = useState(
    invoice?.client_address || 'Route de Sousse Km 6, Mégrine, Tunis'
  );
  const [clientMF, setClientMF] = useState(invoice?.client_mf || '0012845/A/P/M/000');
  const [selectedImporterId, setSelectedImporterId] = useState<string>(invoice?.importer_id || 'stafim');
  const [selectedSiteId, setSelectedSiteId] = useState<string>(invoice?.site_id || '');
  const [status, setStatus] = useState<PaymentStatus>(invoice?.status || 'en_attente');
  const [paymentMethod, setPaymentMethod] = useState<string>(invoice?.payment_method || 'Virement bancaire');
  const [notes, setNotes] = useState<string>(invoice?.notes || '');
  const [tvaRate, setTvaRate] = useState<number>(invoice?.tva_rate || 19);
  const [timbreFiscal, setTimbreFiscal] = useState<number>(invoice?.timbre_fiscal || 1.0);

  // Grouped billing state
  const [unitPricePerVehicle, setUnitPricePerVehicle] = useState<number>(120);
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState<string>('');
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Items State (for individual or auto-filled for grouped)
  const [items, setItems] = useState<InvoiceItem[]>(
    invoice?.items && invoice.items.length > 0
      ? invoice.items
      : [
          {
            id: 'item_1',
            description: 'Prestation Déchargement & Entrée en Stock Portuaire',
            quantity: 10,
            unitPriceHT: 50.0,
            totalHT: 500.0,
            tvaRate: 19,
          },
        ]
  );

  // Individual item form inputs
  const [newDesc, setNewDesc] = useState('');
  const [newQty, setNewQty] = useState(1);
  const [newPrice, setNewPrice] = useState(50);

  // Importer select autofill
  const handleImporterChange = (impId: string) => {
    setSelectedImporterId(impId);
    setSelectedVehicleIds([]);
    const imp = OFFICIAL_IMPORTERS.find((i) => i.id === impId);
    if (imp) {
      setClientName(imp.name);
      setClientAddress(imp.address);
      setClientMF(imp.mf);
    }
  };

  // Eligible vehicles for grouped billing (delivered, unbilled, belonging to chosen importer)
  const eligibleVehicles = useMemo(() => {
    if (!vehicles || !selectedImporterId) return [];
    const imp = OFFICIAL_IMPORTERS.find((i) => i.id === selectedImporterId);

    return vehicles.filter((v) => {
      // 1. Must be delivered
      const solded = getVehicleSoldedDetails(v, invoices, movements);
      if (!solded.isDelivered) return false;

      // 2. Must NOT be billed yet and NOT present in any active non-cancelled invoice
      if (v.is_billed || solded.isBilled) return false;
      const inActiveInvoice = invoices.some((inv) => {
        if (inv.status === 'annulee') return false;
        if (v.invoice_number && inv.invoice_number === v.invoice_number) return true;
        return (inv.items || []).some(
          (it) =>
            it.vehicleId === v.id ||
            (it.chassisNumber && it.chassisNumber === (v.chassis_number || v.vin)) ||
            (v.chassis_number && it.description.includes(v.chassis_number))
        );
      });
      if (inActiveInvoice) return false;

      // 3. Must match selected importer
      const brandMatch = getImporterForBrand(v.brand);
      if (brandMatch?.id === selectedImporterId) return true;
      if (imp?.brands.some((b) => b.toLowerCase() === (v.brand || '').toLowerCase())) return true;

      return false;
    });
  }, [vehicles, selectedImporterId, invoices, movements]);

  // Filtered eligible vehicles by search
  const filteredEligibleVehicles = useMemo(() => {
    if (!vehicleSearchQuery.trim()) return eligibleVehicles;
    const q = vehicleSearchQuery.toLowerCase().trim();
    return eligibleVehicles.filter(
      (v) =>
        (v.chassis_number && v.chassis_number.toLowerCase().includes(q)) ||
        (v.vin && v.vin.toLowerCase().includes(q)) ||
        (v.brand && v.brand.toLowerCase().includes(q)) ||
        (v.model && v.model.toLowerCase().includes(q))
    );
  }, [eligibleVehicles, vehicleSearchQuery]);

  // Sync items when grouped billing vehicle selections change
  useEffect(() => {
    if (creationType !== 'grouped' || !vehicles) return;
    const newItems: InvoiceItem[] = selectedVehicleIds
      .map((id) => {
        const v = vehicles.find((item) => item.id === id);
        if (!v) return null;
        const chassis = v.chassis_number || v.vin || v.id;
        return {
          id: `item_veh_${v.id}`,
          description: `Prestation logistique & livraison - ${v.brand} ${v.model} (VIN: ${chassis})`,
          quantity: 1,
          unitPriceHT: unitPricePerVehicle,
          totalHT: unitPricePerVehicle,
          tvaRate: tvaRate,
          vehicleId: v.id,
          chassisNumber: chassis,
        };
      })
      .filter((it): it is InvoiceItem => it !== null);

    setItems(newItems);
  }, [creationType, selectedVehicleIds, unitPricePerVehicle, tvaRate, vehicles]);

  const handleSelectAllVehicles = () => {
    if (selectedVehicleIds.length === filteredEligibleVehicles.length) {
      setSelectedVehicleIds([]);
    } else {
      setSelectedVehicleIds(filteredEligibleVehicles.map((v) => v.id));
    }
  };

  const handleToggleVehicle = (id: string) => {
    setSelectedVehicleIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const addItem = () => {
    if (!newDesc.trim()) return;
    const qty = Math.max(1, newQty);
    const price = Math.max(0, newPrice);
    const newItem: InvoiceItem = {
      id: `item_${Date.now()}`,
      description: newDesc.trim(),
      quantity: qty,
      unitPriceHT: price,
      totalHT: qty * price,
      tvaRate: tvaRate,
    };
    setItems([...items, newItem]);
    setNewDesc('');
    setNewQty(1);
    setNewPrice(50);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((it) => it.id !== id));
    setSelectedVehicleIds(selectedVehicleIds.filter((vId) => `item_veh_${vId}` !== id));
  };

  // Subtotal calculations
  const subtotalHT = items.reduce((sum, item) => sum + item.totalHT, 0);
  const tvaAmount = (subtotalHT * tvaRate) / 100;
  const totalTTC = subtotalHT + tvaAmount + timbreFiscal;

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!invoiceNumber.trim() || !clientName.trim()) {
      setErrorMsg('Veuillez renseigner le numéro de facture et le nom du client.');
      return;
    }

    if (creationType === 'grouped') {
      if (selectedVehicleIds.length === 0) {
        setErrorMsg('Veuillez sélectionner au moins un véhicule pour la facture groupée.');
        return;
      }

      // Check double-billing
      const alreadyBilled: string[] = [];
      for (const vId of selectedVehicleIds) {
        const targetVeh = vehicles?.find((v) => v.id === vId);
        if (targetVeh) {
          const isDouble =
            targetVeh.is_billed ||
            invoices.some(
              (inv) =>
                inv.status !== 'annulee' &&
                (inv.items || []).some(
                  (it) =>
                    it.vehicleId === vId ||
                    (targetVeh.chassis_number && it.description.includes(targetVeh.chassis_number))
                )
            );
          if (isDouble) {
            alreadyBilled.push(targetVeh.chassis_number || targetVeh.model);
          }
        }
      }
      if (alreadyBilled.length > 0) {
        setErrorMsg(
          `Impossibilité d enregistrer : Les véhicules suivants ont déjà été facturés : ${alreadyBilled.join(
            ', '
          )}`
        );
        return;
      }
    } else {
      if (items.length === 0) {
        setErrorMsg('Veuillez ajouter au moins une ligne de prestation à la facture.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const siteObj = sites.find((s) => s.id === selectedSiteId);

      const payload = {
        invoice_number: invoiceNumber.trim().toUpperCase(),
        invoice_date: invoiceDate,
        due_date: dueDate,
        client_name: clientName.trim(),
        client_address: clientAddress.trim(),
        client_mf: clientMF.trim(),
        importer_id: selectedImporterId,
        site_id: selectedSiteId,
        site_name: siteObj?.name,
        status: status,
        payment_method: paymentMethod,
        items: items,
        subtotal_ht: subtotalHT,
        tva_rate: tvaRate,
        tva_amount: tvaAmount,
        timbre_fiscal: timbreFiscal,
        total_ttc: totalTTC,
        notes:
          notes.trim() ||
          (creationType === 'grouped'
            ? `Facture groupée multi-véhicules (${selectedVehicleIds.length} véhicules inclus)`
            : undefined),
      };

      if (isEdit && invoice) {
        if (canEditDate && currentUser) {
          if (invoice.invoice_date !== invoiceDate) {
            logDateChange({
              currentUser,
              module: 'Facturation',
              entity_id: payload.invoice_number,
              entity_label: `Facture ${payload.invoice_number} (${clientName})`,
              field_name: 'Date de Facture (invoice_date)',
              old_value: invoice.invoice_date,
              new_value: invoiceDate,
            });
          }
          if (invoice.due_date !== dueDate) {
            logDateChange({
              currentUser,
              module: 'Facturation',
              entity_id: payload.invoice_number,
              entity_label: `Facture ${payload.invoice_number} (${clientName})`,
              field_name: "Date d'échéance (due_date)",
              old_value: invoice.due_date || 'N/A',
              new_value: dueDate,
            });
          }
        }
        updateInvoice(invoice.id, payload);
      } else {
        createInvoice(payload);
      }

      // Update selected vehicles to Billed
      if (creationType === 'grouped' && selectedVehicleIds.length > 0) {
        for (const vId of selectedVehicleIds) {
          try {
            await api.updateVehicle(vId, {
              is_billed: true,
              invoice_number: invoiceNumber.trim().toUpperCase(),
            });
          } catch (err) {
            console.error(`Error updating vehicle ${vId} as billed:`, err);
          }
        }
      }

      if (onRefreshData) {
        onRefreshData();
      }
      onSave();
    } catch (err) {
      console.error('Error saving invoice:', err);
      setErrorMsg('Erreur lors de l enregistrement de la facture.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white border-2 border-slate-900 shadow-2xl max-w-4xl w-full my-6 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500 text-slate-950 font-black">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wider">
                {isEdit
                  ? `Édition Facture #${invoice.invoice_number}`
                  : creationType === 'grouped'
                  ? 'Nouvelle Facture Groupée Multi-Véhicules'
                  : 'Nouvelle Facture Individuelle'}
              </h2>
              <p className="text-xs text-slate-300">
                {creationType === 'grouped'
                  ? 'Sélectionnez un importateur et cochez plusieurs véhicules livrés pour les regrouper sur une seule facture.'
                  : 'Saisissez les coordonnées du client et détaillez les prestations logistiques HT/TVA.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleFormSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50">
          {errorMsg && (
            <div className="bg-rose-100 border-2 border-rose-600 text-rose-900 p-3 text-xs font-bold flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Type Choice Toggle (When creating a new invoice) */}
          {!isEdit && (
            <div className="bg-white p-3.5 border-2 border-slate-900 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs font-black uppercase text-slate-900 flex items-center space-x-2">
                <Layers className="w-4.5 h-4.5 text-amber-500" />
                <span>Choix du Mode de Facturation :</span>
              </span>
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setCreationType('individual');
                    setErrorMsg(null);
                  }}
                  className={`flex-1 sm:flex-none px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                    creationType === 'individual'
                      ? 'bg-slate-900 text-amber-400 border-2 border-slate-900 shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                  }`}
                >
                  Facture Individuelle
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreationType('grouped');
                    setErrorMsg(null);
                  }}
                  className={`flex-1 sm:flex-none px-4 py-2 text-xs font-black uppercase tracking-wider transition flex items-center justify-center space-x-1.5 ${
                    creationType === 'grouped'
                      ? 'bg-amber-500 text-slate-950 border-2 border-amber-600 font-black shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                  }`}
                >
                  <Car className="w-4 h-4 text-slate-950" />
                  <span>Facture Groupée Multi-Véhicules</span>
                </button>
              </div>
            </div>
          )}

          {/* Metadata Section */}
          <div className="bg-white p-4 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                N° Facture*
              </label>
              <input
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-300 focus:outline-none focus:border-blue-600 font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                Date Facture*
              </label>
              {canEditDate ? (
                <input
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full text-xs font-mono font-bold p-2 bg-white border-2 border-amber-400 focus:outline-none focus:border-amber-600 shadow-xs"
                />
              ) : (
                <div>
                  <input
                    type="date"
                    value={invoiceDate}
                    disabled
                    readOnly
                    className="w-full text-xs font-mono font-bold p-2 bg-slate-100 border border-slate-300 text-slate-500 cursor-not-allowed opacity-80"
                  />
                  <span className="text-[9px] font-bold text-slate-500 block mt-0.5">
                    🔒 Réservé à Ayari Intissar
                  </span>
                </div>
              )}
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                Date d Échéance*
              </label>
              {canEditDate ? (
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full text-xs font-mono font-bold p-2 bg-white border-2 border-amber-400 focus:outline-none focus:border-amber-600 shadow-xs"
                />
              ) : (
                <div>
                  <input
                    type="date"
                    value={dueDate}
                    disabled
                    readOnly
                    className="w-full text-xs font-mono font-bold p-2 bg-slate-100 border border-slate-300 text-slate-500 cursor-not-allowed opacity-80"
                  />
                  <span className="text-[9px] font-bold text-slate-500 block mt-0.5">
                    🔒 Réservé à Ayari Intissar
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Client Details */}
          <div className="bg-white p-4 border border-slate-200 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2 flex items-center justify-between">
              <span>Informations du Client & Importateur</span>
              {creationType === 'grouped' && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 border border-amber-300">
                  Étape 1 : Sélectionner l Importateur
                </span>
              )}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                  Sélectionner Importateur*
                </label>
                <select
                  value={selectedImporterId}
                  onChange={(e) => handleImporterChange(e.target.value)}
                  className="w-full text-xs font-bold p-2 bg-amber-50/50 border-2 border-amber-400 focus:outline-none focus:border-amber-600"
                >
                  <option value="">-- Sélectionner l Importateur --</option>
                  {OFFICIAL_IMPORTERS.map((imp) => (
                    <option key={imp.id} value={imp.id}>
                      {imp.code} - {imp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                  Nom du Client / Raison Sociale*
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-300 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                  Matricule Fiscal (MF)*
                </label>
                <input
                  type="text"
                  required
                  value={clientMF}
                  onChange={(e) => setClientMF(e.target.value)}
                  className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-300 focus:outline-none focus:border-blue-600 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                Adresse du Client
              </label>
              <input
                type="text"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-300 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Grouped Multi-Vehicle Selector Section */}
          {creationType === 'grouped' && (
            <div className="bg-white p-4 border-2 border-blue-600 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 pb-3 gap-2">
                <div className="flex items-center space-x-2">
                  <Car className="w-5 h-5 text-blue-600" />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-blue-900">
                      Étape 2 : Véhicules Livrés Non Facturés pour cet Importateur
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Cochez les véhicules à regrouper. Seuls les véhicules livrés et non facturés sont affichés.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 bg-blue-50 px-3 py-1.5 border border-blue-200">
                  <label className="text-[10px] font-black uppercase text-blue-900">
                    Tarif HT / Véhicule :
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={unitPricePerVehicle}
                    onChange={(e) => setUnitPricePerVehicle(Number(e.target.value))}
                    className="w-20 p-1 text-xs font-mono font-bold bg-white border border-blue-400 text-right"
                  />
                  <span className="text-xs font-bold text-blue-900">DT</span>
                </div>
              </div>

              {/* Search Box & Select All Control Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 border border-slate-200">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={vehicleSearchQuery}
                    onChange={(e) => setVehicleSearchQuery(e.target.value)}
                    placeholder="Recherche rapide par VIN, Marque ou Modèle..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs font-bold bg-white border border-slate-300 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
                  <span className="text-[11px] font-bold text-slate-600">
                    {selectedVehicleIds.length} / {filteredEligibleVehicles.length} sélectionné(s)
                  </span>
                  <button
                    type="button"
                    onClick={handleSelectAllVehicles}
                    disabled={filteredEligibleVehicles.length === 0}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>
                      {selectedVehicleIds.length === filteredEligibleVehicles.length && filteredEligibleVehicles.length > 0
                        ? 'Tout désélectionner'
                        : 'Tout sélectionner'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Eligible Vehicles Selection Table */}
              <div className="border border-slate-200 max-h-60 overflow-y-auto bg-white">
                {filteredEligibleVehicles.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 space-y-2">
                    <Car className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
                    <p className="text-xs font-bold">
                      {!selectedImporterId
                        ? 'Veuillez sélectionner un importateur ci-dessus.'
                        : 'Aucun véhicule livré non facturé disponible pour cet importateur.'}
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-700 sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5 text-center w-10">Sélect.</th>
                        <th className="p-2.5">N° VIN / Châssis</th>
                        <th className="p-2.5">Marque & Modèle</th>
                        <th className="p-2.5">Date de Livraison</th>
                        <th className="p-2.5">Site / Emplacement</th>
                        <th className="p-2.5 text-right">Montant HT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredEligibleVehicles.map((v) => {
                        const isChecked = selectedVehicleIds.includes(v.id);
                        const soldedDetails = getVehicleSoldedDetails(v, invoices, movements);
                        const chassis = v.chassis_number || v.vin || v.id;

                        return (
                          <tr
                            key={v.id}
                            onClick={() => handleToggleVehicle(v.id)}
                            className={`cursor-pointer transition ${
                              isChecked ? 'bg-blue-50/80 font-bold' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleVehicle(v.id)}
                                className="w-4 h-4 accent-blue-600 cursor-pointer"
                              />
                            </td>
                            <td className="p-2.5 font-mono font-bold text-blue-900">
                              <span className="bg-slate-100 px-1.5 py-0.5 border border-slate-200">
                                {chassis}
                              </span>
                            </td>
                            <td className="p-2.5 font-bold text-slate-900">
                              {v.brand} {v.model}
                            </td>
                            <td className="p-2.5 text-slate-600 font-mono text-[11px]">
                              {soldedDetails.deliveryDate
                                ? formatDateTime(soldedDetails.deliveryDate)
                                : v.arrival_date || '-'}
                            </td>
                            <td className="p-2.5 text-slate-600">
                              {v.site_arrivee || v.current_site_id || 'Parc'}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                              {unitPricePerVehicle.toFixed(3)} DT
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Dynamic Grouped Summary Box */}
              <div className="bg-amber-50 border-2 border-amber-400 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2 text-slate-900">
                  <Calculator className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-black uppercase text-slate-900">
                      Récapitulatif Dynamique Facture Groupée
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {selectedVehicleIds.length} véhicule(s) sélectionné(s) = {subtotalHT.toFixed(3)} DT HT
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4 text-xs font-bold">
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase block">Total HT</span>
                    <span className="font-mono text-slate-900">{subtotalHT.toFixed(3)} DT</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase block">TVA ({tvaRate}%)</span>
                    <span className="font-mono text-slate-900">{tvaAmount.toFixed(3)} DT</span>
                  </div>
                  <div className="pl-3 border-l border-amber-300">
                    <span className="text-amber-900 text-[10px] uppercase font-black block">Total TTC</span>
                    <span className="font-mono text-sm font-black text-blue-900">{totalTTC.toFixed(3)} DT</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Individual Line Items Editor */}
          {creationType === 'individual' && (
            <div className="bg-white p-4 border border-slate-200 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2">
                Lignes de Prestations (Calcul HT/TVA/TTC)
              </h4>

              {/* Existing items list */}
              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-700">
                  <tr>
                    <th className="p-2">Désignation</th>
                    <th className="p-2 text-center">Qté</th>
                    <th className="p-2 text-right">Prix Unitaire HT</th>
                    <th className="p-2 text-right">Total HT</th>
                    <th className="p-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td className="p-2 font-bold text-slate-900">{it.description}</td>
                      <td className="p-2 text-center font-bold">{it.quantity}</td>
                      <td className="p-2 text-right font-mono">{it.unitPriceHT.toFixed(3)} DT</td>
                      <td className="p-2 text-right font-bold text-slate-900 font-mono">
                        {it.totalHT.toFixed(3)} DT
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(it.id)}
                          className="text-rose-600 hover:text-rose-800 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Add new item input inline */}
              <div className="flex flex-col sm:flex-row items-end gap-2 pt-2 bg-slate-50 p-3 border border-slate-200">
                <div className="flex-1">
                  <label className="text-[9px] font-black uppercase text-slate-600 block mb-1">
                    Ajouter Prestation / Service
                  </label>
                  <input
                    type="text"
                    placeholder="ex: Transfert inter-sites Peugeot 208..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full text-xs font-bold p-2 bg-white border border-slate-300"
                  />
                </div>

                <div className="w-20">
                  <label className="text-[9px] font-black uppercase text-slate-600 block mb-1">
                    Quantité
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newQty}
                    onChange={(e) => setNewQty(Number(e.target.value))}
                    className="w-full text-xs font-bold p-2 bg-white border border-slate-300 text-center"
                  />
                </div>

                <div className="w-28">
                  <label className="text-[9px] font-black uppercase text-slate-600 block mb-1">
                    Prix HT (DT)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    className="w-full text-xs font-bold p-2 bg-white border border-slate-300 text-right"
                  />
                </div>

                <button
                  type="button"
                  onClick={addItem}
                  className="px-3 py-2 bg-slate-900 text-white font-bold text-xs uppercase hover:bg-slate-800"
                >
                  + Ajouter Ligne
                </button>
              </div>
            </div>
          )}

          {/* Payment & Totals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payment & Status */}
            <div className="bg-white p-4 border border-slate-200 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2">
                Statut & Règlement
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                    Statut Facture
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as PaymentStatus)}
                    className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-300"
                  >
                    <option value="en_attente">En attente</option>
                    <option value="payee">Payée</option>
                    <option value="en_retard">En retard</option>
                    <option value="brouillon">Brouillon</option>
                    <option value="annulee">Annulée</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                    Mode Règlement
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-300"
                  >
                    <option value="Virement bancaire">Virement bancaire</option>
                    <option value="Chèque">Chèque bancaire</option>
                    <option value="Espèces">Espèces</option>
                    <option value="Traite">Traite commerciale</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-600 block mb-1">
                  Observations & Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes internes ou conditions spécifiques..."
                  className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-300"
                ></textarea>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-white p-4 border border-slate-200 space-y-2 text-xs">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2">
                Calculs Financiers Facture
              </h4>

              <div className="flex justify-between text-slate-700">
                <span>Total Hors Taxes (HT) :</span>
                <strong className="font-mono">{subtotalHT.toFixed(3)} DT</strong>
              </div>

              <div className="flex items-center justify-between text-slate-700">
                <span>Taux TVA (%) :</span>
                <input
                  type="number"
                  value={tvaRate}
                  onChange={(e) => setTvaRate(Number(e.target.value))}
                  className="w-16 p-1 text-xs text-right font-bold border border-slate-300 bg-slate-50"
                />
              </div>

              <div className="flex justify-between text-slate-700">
                <span>Montant TVA ({tvaRate}%) :</span>
                <strong className="font-mono">{tvaAmount.toFixed(3)} DT</strong>
              </div>

              <div className="flex items-center justify-between text-slate-700">
                <span>Timbre Fiscal (DT) :</span>
                <input
                  type="number"
                  step="0.1"
                  value={timbreFiscal}
                  onChange={(e) => setTimbreFiscal(Number(e.target.value))}
                  className="w-16 p-1 text-xs text-right font-bold border border-slate-300 bg-slate-50"
                />
              </div>

              <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-black text-slate-900">
                <span>TOTAL TTC À PAYER :</span>
                <span className="text-blue-600 font-mono">{totalTTC.toFixed(3)} DT</span>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
            <div>
              {isEdit && invoice && (
                <button
                  type="button"
                  onClick={() => generateGroupedInvoicePDF(invoice, vehicles)}
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-xs"
                  title="Exporter le PDF de la facture groupée avec tous les détails techniques"
                >
                  <Printer className="w-4 h-4 text-amber-300" />
                  <span>Aperçu PDF Facture Groupée</span>
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center space-x-2 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isSaving
                    ? 'Enregistrement en cours...'
                    : isEdit
                    ? 'Mettre à jour'
                    : creationType === 'grouped'
                    ? `Valider Facture Groupée (${selectedVehicleIds.length} véh.)`
                    : 'Enregistrer la Facture'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
