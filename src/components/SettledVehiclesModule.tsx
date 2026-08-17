import React, { useState, useMemo } from 'react';
import {
  Trash2,
  CheckCircle2,
  Receipt,
  Search,
  Filter,
  Download,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  Building2,
  Eye,
  ShieldAlert,
  X,
  FileCheck,
  Info,
  DollarSign,
} from 'lucide-react';
import { Vehicle, Site, Movement, UserRole, Invoice } from '../types';
import { getVehicleSoldedDetails, VehicleSoldedDetails } from '../lib/soldedUtils';
import { formatDateTime } from '../lib/dateUtils';
import { getImporterForBrand } from '../data/importers';
import { api } from '../lib/api';

interface SettledVehiclesModuleProps {
  vehicles: Vehicle[];
  sites: Site[];
  movements: Movement[];
  invoices: Invoice[];
  userRole: UserRole;
  onRefresh: () => void;
  onSelectVehicle?: (vehicle: Vehicle) => void;
  onNavigateToStock?: () => void;
}

export const SettledVehiclesModule: React.FC<SettledVehiclesModuleProps> = ({
  vehicles = [],
  sites = [],
  movements = [],
  invoices = [],
  userRole,
  onRefresh,
  onSelectVehicle,
  onNavigateToStock,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImporter, setSelectedImporter] = useState('');
  const [copiedChassis, setCopiedChassis] = useState<string | null>(null);

  // Deletion Modal State
  const [deletingVehicle, setDeletingVehicle] = useState<{
    vehicle: Vehicle;
    details: VehicleSoldedDetails;
  } | null>(null);
  const [deletingConfirmText, setDeletingConfirmText] = useState('');
  const [submittingDelete, setSubmittingDelete] = useState(false);
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState<string | null>(null);

  // Batch deletion state
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [submittingBatchDelete, setSubmittingBatchDelete] = useState(false);

  // Site ID map
  const siteMap = useMemo(() => {
    const map = new Map<string, string>();
    sites.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [sites]);

  // Compute solded vehicles (Livré + Facturé + Réglé)
  const soldedVehiclesWithDetails = useMemo(() => {
    return vehicles
      .map((v) => {
        const details = getVehicleSoldedDetails(v, invoices, movements);
        return { vehicle: v, details };
      })
      .filter((item) => item.details.isSolded);
  }, [vehicles, invoices, movements]);

  // Delivered but NOT yet settled vehicles (for quick context or toggle)
  const deliveredNotSettledCount = useMemo(() => {
    return vehicles.filter((v) => {
      const details = getVehicleSoldedDetails(v, invoices, movements);
      return details.isDelivered && !details.isSolded;
    }).length;
  }, [vehicles, invoices, movements]);

  // Filtered list
  const filteredSoldedVehicles = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return soldedVehiclesWithDetails.filter(({ vehicle, details }) => {
      const brand = vehicle.brand || '';
      const model = vehicle.model || '';
      const chassis = vehicle.chassis_number || vehicle.vin || '';
      const stockNo = vehicle.stock_number || '';
      const invNo = details.invoiceNumber || '';
      const imp = getImporterForBrand(brand);

      const matchesTerm =
        !term ||
        chassis.toLowerCase().includes(term) ||
        brand.toLowerCase().includes(term) ||
        model.toLowerCase().includes(term) ||
        stockNo.toLowerCase().includes(term) ||
        invNo.toLowerCase().includes(term);

      const matchesImporter = !selectedImporter || imp?.id === selectedImporter;

      return matchesTerm && matchesImporter;
    });
  }, [soldedVehiclesWithDetails, searchTerm, selectedImporter]);

  const handleCopyChassis = (e: React.MouseEvent, chassis: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(chassis);
    setCopiedChassis(chassis);
    setTimeout(() => setCopiedChassis(null), 2000);
  };

  const handleConfirmDeleteSingle = async () => {
    if (!deletingVehicle) return;
    setSubmittingDelete(true);
    try {
      await api.deleteVehicle(deletingVehicle.vehicle.id);
      setDeleteSuccessMsg(
        `Le véhicule ${deletingVehicle.vehicle.brand} ${deletingVehicle.vehicle.model} (${deletingVehicle.vehicle.chassis_number}) a été définitivement supprimé.`
      );
      setDeletingVehicle(null);
      setDeletingConfirmText('');
      onRefresh();
      setTimeout(() => setDeleteSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la suppression du véhicule.');
    } finally {
      setSubmittingDelete(false);
    }
  };

  const handleConfirmBatchDelete = async () => {
    if (selectedVehicleIds.length === 0) return;
    setSubmittingBatchDelete(true);
    try {
      for (const id of selectedVehicleIds) {
        await api.deleteVehicle(id);
      }
      setDeleteSuccessMsg(
        `${selectedVehicleIds.length} véhicule(s) soldé(s) ont été définitivement supprimés.`
      );
      setSelectedVehicleIds([]);
      setShowBatchDeleteModal(false);
      onRefresh();
      setTimeout(() => setDeleteSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la suppression des véhicules sélectionnés.');
    } finally {
      setSubmittingBatchDelete(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedVehicleIds.length === filteredSoldedVehicles.length) {
      setSelectedVehicleIds([]);
    } else {
      setSelectedVehicleIds(filteredSoldedVehicles.map((item) => item.vehicle.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedVehicleIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExportCSV = () => {
    const headers = [
      'Chassis_VIN',
      'Marque',
      'Modele',
      'Importateur',
      'Statut_Livraison',
      'Date_Livraison',
      'Statut_Facturation',
      'Numero_Facture',
      'Date_Facture',
      'Statut_Reglement',
      'Date_Reglement',
      'Montant_TTC',
    ];

    const rows = filteredSoldedVehicles.map(({ vehicle, details }) => {
      const imp = getImporterForBrand(vehicle.brand);
      return [
        vehicle.chassis_number,
        `"${vehicle.brand}"`,
        `"${vehicle.model}"`,
        `"${imp?.name || 'Inconnu'}"`,
        'Livré',
        details.deliveryDate ? formatDateTime(details.deliveryDate) : '',
        'Facturé',
        `"${details.invoiceNumber || 'Facturé'}"`,
        details.invoiceDate ? formatDateTime(details.invoiceDate) : '',
        'Réglé',
        details.paidDate ? formatDateTime(details.paidDate) : '',
        details.totalAmountTTC ? details.totalAmountTTC.toFixed(3) : '0.000',
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `vehicules_soldes_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate totals
  const totalAmountSolded = useMemo(() => {
    return soldedVehiclesWithDetails.reduce((sum, item) => {
      return sum + (item.details.totalAmountTTC || 0);
    }, 0);
  }, [soldedVehiclesWithDetails]);

  return (
    <div className="space-y-6">
      {/* Toast notification */}
      {deleteSuccessMsg && (
        <div className="bg-emerald-500/10 border-2 border-emerald-500/40 p-4 text-emerald-900 flex items-center justify-between animate-fade-in shadow-md">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold">{deleteSuccessMsg}</span>
          </div>
          <button
            onClick={() => setDeleteSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold text-xs"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 border-b-4 border-emerald-500 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                Module Purge & Archivage
              </span>
              <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 text-[10px] font-mono">
                Livré + Facturé + Réglé
              </span>
            </div>
            <h1 className="text-xl font-black uppercase tracking-wide flex items-center space-x-2">
              <FileCheck className="w-6 h-6 text-emerald-400" />
              <span>Véhicules Soldés / Prêts à Suppression</span>
            </h1>
            <p className="text-xs text-slate-300 max-w-3xl">
              Ces véhicules ont complété l'intégralité du cycle logistique et financier (livraison effectuée, facture émise, règlement perçu).
              Ils sont automatiquement isolés du stock actif et peuvent être supprimés définitivement du système.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={onRefresh}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wider border border-slate-700 transition flex items-center space-x-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Actualiser</span>
            </button>
            <button
              onClick={handleExportCSV}
              disabled={filteredSoldedVehicles.length === 0}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider transition flex items-center space-x-1.5 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exporter CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500" />
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Véhicules Soldés en Attente
          </p>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-black font-mono text-slate-900">
              {soldedVehiclesWithDetails.length}
            </span>
            <span className="text-xs font-bold text-emerald-600">
              prêts pour suppression
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            Automatiquement retirés du stock actif
          </p>
        </div>

        <div className="bg-white p-4 border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-blue-500" />
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Montant Total Réglé
          </p>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-black font-mono text-blue-900">
              {totalAmountSolded > 0 ? `${totalAmountSolded.toFixed(3)}` : 'N/A'}
            </span>
            {totalAmountSolded > 0 && (
              <span className="text-xs font-bold text-blue-700">TND</span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            Valeur des factures totalement acquittées
          </p>
        </div>

        <div className="bg-white p-4 border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-amber-500" />
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Livrés Non Encoire Soldés
          </p>
          <div className="flex items-baseline space-x-2 mt-1">
            <span className="text-2xl font-black font-mono text-amber-900">
              {deliveredNotSettledCount}
            </span>
            <span className="text-xs text-amber-700 font-bold">
              en attente de fact./règlement
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            Véhicules livrés mais non encore réglés
          </p>
        </div>

        <div className="bg-white p-4 border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-slate-800" />
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Action Sécurisée
          </p>
          <div className="mt-1">
            <span className="text-xs font-bold text-slate-800 flex items-center space-x-1">
              <ShieldAlert className="w-4 h-4 text-rose-500 inline mr-1" />
              Suppression Définitive
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            Purge irréversible avec audit de confirmation
          </p>
        </div>
      </div>

      {/* Filter & Action Controls */}
      <div className="bg-white p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex-1 flex flex-col sm:flex-row items-center gap-2">
            {/* Search Bar */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par Châssis VIN, Marque, Modèle, N° Facture..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 text-xs focus:outline-none focus:border-slate-900 transition"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Importer Filter */}
            <select
              value={selectedImporter}
              onChange={(e) => setSelectedImporter(e.target.value)}
              className="w-full sm:w-56 px-3 py-2 bg-slate-50 border border-slate-300 text-xs text-slate-800 font-medium focus:outline-none focus:border-slate-900 transition"
            >
              <option value="">Tous les Importateurs</option>
              <option value="stafim">STAFIM SA (Peugeot, Citroën, Opel)</option>
              <option value="ennakl">ENNAKL (VW, Audi, SEAT, Škoda)</option>
              <option value="artes">ARTES (Renault, Dacia, Nissan)</option>
              <option value="citycars">City Cars (KIA)</option>
              <option value="hyundai">Hyundai Tunisie</option>
              <option value="toyota">BSB Toyota</option>
            </select>
          </div>

          {/* Batch Actions */}
          {selectedVehicleIds.length > 0 && userRole === 'admin' && (
            <button
              onClick={() => setShowBatchDeleteModal(true)}
              className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold uppercase tracking-wider transition flex items-center space-x-1.5 shadow-xs shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Supprimer la sélection ({selectedVehicleIds.length})</span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
          <span>
            Affichage de <strong className="text-slate-900 font-mono">{filteredSoldedVehicles.length}</strong> véhicule(s) soldé(s)
          </span>
          {onNavigateToStock && (
            <button
              onClick={onNavigateToStock}
              className="text-blue-600 hover:underline font-bold text-[11px] flex items-center space-x-1"
            >
              <span>Consulter le Stock Actif non soldé &rarr;</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Vehicles Table / List */}
      <div className="bg-white border border-slate-200 shadow-xs overflow-hidden">
        {filteredSoldedVehicles.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto border border-slate-200">
              <FileCheck className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                Aucun véhicule soldé trouvé
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {searchTerm || selectedImporter
                  ? "Aucun véhicule soldé ne correspond à vos filtres de recherche."
                  : "Aucun véhicule ne cumule actuellement les trois conditions (Livré + Facturé + Réglé). Un véhicule apparaît ici dès que sa livraison est enregistrée et que sa facture est marquée comme payée."}
              </p>
            </div>
            {(searchTerm || selectedImporter) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedImporter('');
                }}
                className="px-3 py-1.5 bg-slate-800 text-white text-xs font-bold uppercase tracking-wider hover:bg-slate-700"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider border-b border-slate-800">
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        selectedVehicleIds.length > 0 &&
                        selectedVehicleIds.length === filteredSoldedVehicles.length
                      }
                      onChange={handleSelectAll}
                      className="accent-slate-900 cursor-pointer"
                    />
                  </th>
                  <th className="p-3">Véhicule & Châssis VIN</th>
                  <th className="p-3">Importateur</th>
                  <th className="p-3">Statut Tri-Valide</th>
                  <th className="p-3">Facture & Règlement</th>
                  <th className="p-3 text-right">Montant TTC</th>
                  <th className="p-3 text-center">Action Sécurisée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredSoldedVehicles.map(({ vehicle, details }) => {
                  const imp = getImporterForBrand(vehicle.brand);
                  const isSelected = selectedVehicleIds.includes(vehicle.id);

                  return (
                    <tr
                      key={vehicle.id}
                      className={`hover:bg-slate-50 transition ${
                        isSelected ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(vehicle.id)}
                          className="accent-slate-900 cursor-pointer"
                        />
                      </td>

                      {/* Vehicle & Chassis */}
                      <td className="p-3">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {vehicle.brand} {vehicle.model}
                            </span>
                            {vehicle.color && (
                              <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 border border-slate-200">
                                {vehicle.color}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-1.5 py-0.5 border border-blue-200">
                              {vehicle.chassis_number}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleCopyChassis(e, vehicle.chassis_number)}
                              className="text-slate-400 hover:text-slate-700"
                              title="Copier le châssis"
                            >
                              {copiedChassis === vehicle.chassis_number ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          {vehicle.stock_number && (
                            <p className="text-[10px] text-slate-500 font-mono">
                              N° Stock: {vehicle.stock_number}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Importer */}
                      <td className="p-3">
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-800 text-xs">
                            {imp ? imp.name : vehicle.brand}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Arrivée : {formatDateTime(vehicle.arrival_date)}
                          </p>
                        </div>
                      </td>

                      {/* Tri-Status Badges */}
                      <td className="p-3">
                        <div className="flex flex-col space-y-1">
                          <span className="inline-flex items-center space-x-1 text-[10px] font-bold uppercase bg-emerald-100 text-emerald-900 px-2 py-0.5 border border-emerald-300 w-fit">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>1. Livré</span>
                          </span>
                          <span className="inline-flex items-center space-x-1 text-[10px] font-bold uppercase bg-blue-100 text-blue-900 px-2 py-0.5 border border-blue-300 w-fit">
                            <Receipt className="w-3 h-3 text-blue-600 shrink-0" />
                            <span>2. Facturé</span>
                          </span>
                          <span className="inline-flex items-center space-x-1 text-[10px] font-bold uppercase bg-amber-100 text-amber-900 px-2 py-0.5 border border-amber-300 w-fit">
                            <DollarSign className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>3. Réglé</span>
                          </span>
                        </div>
                      </td>

                      {/* Invoice & Payment Details */}
                      <td className="p-3">
                        <div className="space-y-1 font-mono text-[11px]">
                          <p className="text-slate-900 font-bold">
                            Facture: {details.invoiceNumber || 'Aquittée'}
                          </p>
                          {details.paidDate && (
                            <p className="text-emerald-700 font-medium text-[10px]">
                              Payé le: {formatDateTime(details.paidDate)}
                            </p>
                          )}
                          {details.deliveryDate && (
                            <p className="text-slate-500 text-[10px]">
                              Livré le: {formatDateTime(details.deliveryDate)}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Total TTC */}
                      <td className="p-3 text-right">
                        <div className="font-mono text-sm font-black text-slate-900">
                          {details.totalAmountTTC
                            ? `${details.totalAmountTTC.toFixed(3)} DT`
                            : 'Réglé'}
                        </div>
                        <span className="text-[10px] text-emerald-600 font-bold uppercase">
                          Solde complet
                        </span>
                      </td>

                      {/* Permanent Delete Action */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          {onSelectVehicle && (
                            <button
                              type="button"
                              onClick={() => onSelectVehicle(vehicle)}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-300 transition"
                              title="Voir les détails complets du véhicule"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              setDeletingVehicle({ vehicle, details })
                            }
                            disabled={userRole !== 'admin' && userRole !== 'agent'}
                            className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] uppercase tracking-wider transition flex items-center space-x-1 shadow-xs disabled:opacity-50"
                            title="Supprimer définitivement ce véhicule soldé"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Supprimer</span>
                          </button>
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

      {/* Confirmation Modal for Single Permanent Delete */}
      {deletingVehicle && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full border-2 border-rose-500 shadow-2xl overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="bg-rose-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <AlertTriangle className="w-6 h-6 text-amber-300 shrink-0" />
                <h3 className="font-black text-sm uppercase tracking-wider">
                  Confirmation de Suppression Définitive
                </h3>
              </div>
              <button
                onClick={() => {
                  setDeletingVehicle(null);
                  setDeletingConfirmText('');
                }}
                className="text-rose-100 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed">
                Vous êtes sur le point de <strong className="text-rose-600">supprimer définitivement</strong> ce véhicule soldé de la base de données du parc.
              </p>

              {/* Vehicle Card Summary */}
              <div className="bg-slate-50 border border-slate-300 p-4 space-y-2 text-xs">
                <div className="flex justify-between items-start border-b border-slate-200 pb-2">
                  <div>
                    <strong className="text-slate-900 font-black text-sm block">
                      {deletingVehicle.vehicle.brand} {deletingVehicle.vehicle.model}
                    </strong>
                    <span className="font-mono text-blue-900 font-bold bg-blue-100 px-1.5 py-0.5 text-[11px] border border-blue-200">
                      {deletingVehicle.vehicle.chassis_number}
                    </span>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold uppercase">
                    Soldé / Acquisition réglée
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 font-mono">
                  <div>
                    Facture: <strong className="text-slate-900">{deletingVehicle.details.invoiceNumber || 'Aquittée'}</strong>
                  </div>
                  <div>
                    Montant: <strong className="text-slate-900">{deletingVehicle.details.totalAmountTTC ? `${deletingVehicle.details.totalAmountTTC.toFixed(3)} DT` : 'Payé'}</strong>
                  </div>
                  <div>
                    Paiement: <strong className="text-emerald-700">{deletingVehicle.details.paidDate ? formatDateTime(deletingVehicle.details.paidDate) : 'Effectué'}</strong>
                  </div>
                  <div>
                    Livraison: <strong className="text-slate-900">{deletingVehicle.details.deliveryDate ? formatDateTime(deletingVehicle.details.deliveryDate) : 'Effectuée'}</strong>
                  </div>
                </div>
              </div>

              <div className="bg-rose-50 border-l-4 border-rose-500 p-3 text-[11px] text-rose-900 space-y-1">
                <p className="font-bold flex items-center space-x-1">
                  <ShieldAlert className="w-4 h-4 text-rose-600 mr-1 inline" />
                  Attention : Action Irréversible !
                </p>
                <p className="text-rose-800">
                  Cette suppression retirera définitivement ce véhicule ainsi que l'ensemble de ses mouvements logistiques. Les données financières de facturation resteront quant à elles sauvegardées dans le module Facturation.
                </p>
              </div>

              {/* Text Confirmation Input */}
              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-bold text-slate-700 block">
                  Saisissez <span className="font-mono font-black text-rose-600">SUPPRIMER</span> pour valider la purge :
                </label>
                <input
                  type="text"
                  value={deletingConfirmText}
                  onChange={(e) => setDeletingConfirmText(e.target.value)}
                  placeholder="Tapez SUPPRIMER"
                  className="w-full px-3 py-2 border border-slate-300 text-xs font-mono font-bold uppercase focus:outline-none focus:border-rose-600"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setDeletingVehicle(null);
                  setDeletingConfirmText('');
                }}
                disabled={submittingDelete}
                className="px-4 py-2 bg-slate-200 text-slate-700 hover:bg-slate-300 font-bold text-xs uppercase tracking-wider"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={handleConfirmDeleteSingle}
                disabled={
                  deletingConfirmText.trim().toUpperCase() !== 'SUPPRIMER' ||
                  submittingDelete
                }
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider disabled:opacity-50 flex items-center space-x-1.5 shadow-md"
              >
                {submittingDelete ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Confirmer la suppression définitive</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Modal */}
      {showBatchDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full border-2 border-rose-500 shadow-2xl overflow-hidden animate-scale-in">
            <div className="bg-rose-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <AlertTriangle className="w-6 h-6 text-amber-300 shrink-0" />
                <h3 className="font-black text-sm uppercase tracking-wider">
                  Suppression par Lot ({selectedVehicleIds.length} véhicules)
                </h3>
              </div>
              <button
                onClick={() => setShowBatchDeleteModal(false)}
                className="text-rose-100 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              <p>
                Vous vous apprêtez à supprimer définitivement{' '}
                <strong className="text-rose-600 font-bold">{selectedVehicleIds.length} véhicule(s) soldé(s)</strong>.
              </p>
              <div className="bg-rose-50 p-3 border-l-4 border-rose-500 text-rose-900 font-medium">
                Cette opération va purger irréversiblement ces véhicules du stock actif.
              </div>
            </div>

            <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowBatchDeleteModal(false)}
                disabled={submittingBatchDelete}
                className="px-4 py-2 bg-slate-200 text-slate-700 hover:bg-slate-300 font-bold text-xs uppercase"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={handleConfirmBatchDelete}
                disabled={submittingBatchDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase flex items-center space-x-2"
              >
                {submittingBatchDelete ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Supprimer la sélection</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
