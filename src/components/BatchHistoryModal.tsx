import React, { useState, useMemo } from 'react';
import {
  X,
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
  Plus,
  Layers,
  Car,
  Calendar,
  Check,
  Ban,
  DollarSign,
  ArrowRight,
} from 'lucide-react';
import { BillingBatch, BatchStatus, Vehicle, UserRole, User } from '../types';
import {
  loadBatches,
  updateBatch,
  deleteBatch,
  exportBatchToPDF,
  exportBatchesToCSV,
} from '../lib/batchBillingStore';
import { formatDateTime } from '../lib/dateUtils';
import { OFFICIAL_IMPORTERS } from '../data/importers';

interface BatchHistoryModalProps {
  vehicles: Vehicle[];
  userRole: UserRole;
  currentUser?: User;
  onClose: () => void;
  onCreateNewBatch: () => void;
  onEditBatch: (batch: BillingBatch) => void;
}

export const BatchHistoryModal: React.FC<BatchHistoryModalProps> = ({
  vehicles,
  userRole,
  currentUser,
  onClose,
  onCreateNewBatch,
  onEditBatch,
}) => {
  const [batches, setBatches] = useState<BillingBatch[]>(() => loadBatches());

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [importerFilter, setImporterFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [billingTypeFilter, setBillingTypeFilter] = useState<string>('all');

  // Viewing detail state
  const [viewingBatch, setViewingBatch] = useState<BillingBatch | null>(null);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);

  const refreshList = () => {
    setBatches(loadBatches());
  };

  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        b.batchNumber.toLowerCase().includes(q) ||
        (b.invoiceReference && b.invoiceReference.toLowerCase().includes(q)) ||
        b.importer.toLowerCase().includes(q) ||
        (b.notes && b.notes.toLowerCase().includes(q));

      const matchesImporter = !importerFilter || b.importer === importerFilter;
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
      const matchesType = billingTypeFilter === 'all' || b.billingType === billingTypeFilter;

      return matchesSearch && matchesImporter && matchesStatus && matchesType;
    });
  }, [batches, searchTerm, importerFilter, statusFilter, billingTypeFilter]);

  // Statistics
  const stats = useMemo(() => {
    const totalCount = filteredBatches.length;
    const validatedCount = filteredBatches.filter((b) => b.status === 'valide' || b.status === 'facture').length;
    const totalAmountTTC = filteredBatches
      .filter((b) => b.status !== 'annule')
      .reduce((sum, b) => sum + b.total, 0);
    const totalVehiclesCount = filteredBatches
      .filter((b) => b.status !== 'annule')
      .reduce((sum, b) => sum + b.vehicleCount, 0);

    return { totalCount, validatedCount, totalAmountTTC, totalVehiclesCount };
  }, [filteredBatches]);

  // Batch status update handlers
  const handleStatusChange = (batchId: string, newStatus: BatchStatus) => {
    updateBatch(batchId, { status: newStatus });
    refreshList();
    if (viewingBatch && viewingBatch.id === batchId) {
      const updated = loadBatches().find((b) => b.id === batchId);
      if (updated) setViewingBatch(updated);
    }
  };

  const handleDeleteConfirm = () => {
    if (deletingBatchId) {
      deleteBatch(deletingBatchId);
      setDeletingBatchId(null);
      refreshList();
    }
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
                <span>Historique des Lots de Facturation</span>
                <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 font-mono">
                  {filteredBatches.length} Lot(s)
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Suivi et gestion globale des factures groupées multi-véhicules
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onCreateNewBatch}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center space-x-1.5 shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau Lot</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top KPIs Banner */}
        <div className="bg-slate-100 border-b border-slate-200 p-4 grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
          <div className="bg-white p-3 border border-slate-200 shadow-xs">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Lots Enregistrés</div>
            <div className="text-xl font-black text-slate-900 font-mono mt-0.5">{stats.totalCount}</div>
          </div>
          <div className="bg-white p-3 border border-slate-200 shadow-xs">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Lots Validés / Facturés</div>
            <div className="text-xl font-black text-emerald-700 font-mono mt-0.5">{stats.validatedCount}</div>
          </div>
          <div className="bg-white p-3 border border-slate-200 shadow-xs">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Véhicules Inclus dans les Lots</div>
            <div className="text-xl font-black text-blue-700 font-mono mt-0.5">{stats.totalVehiclesCount}</div>
          </div>
          <div className="bg-white p-3 border border-slate-200 shadow-xs">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Montant Total des Lots TTC</div>
            <div className="text-xl font-black text-amber-600 font-mono mt-0.5">
              {stats.totalAmountTTC.toFixed(3)} DT
            </div>
          </div>
        </div>

        {/* Filters bar */}
        <div className="bg-white p-4 border-b border-slate-200 space-y-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1 min-w-[240px] relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Recherche par N° Lot, Réf Facture, Importateur, Notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none font-mono"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={importerFilter}
                onChange={(e) => setImporterFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-xs px-2.5 py-1.5 font-bold focus:bg-white focus:border-amber-500 focus:outline-none"
              >
                <option value="">Tous les Importateurs</option>
                {OFFICIAL_IMPORTERS.map((imp) => (
                  <option key={imp.id} value={imp.name}>
                    {imp.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-xs px-2.5 py-1.5 font-bold focus:bg-white focus:border-amber-500 focus:outline-none"
              >
                <option value="all">Tous les Statuts</option>
                <option value="brouillon">Brouillons</option>
                <option value="valide">Validés</option>
                <option value="facture">Facturés</option>
                <option value="annule">Annulés</option>
              </select>

              <select
                value={billingTypeFilter}
                onChange={(e) => setBillingTypeFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-xs px-2.5 py-1.5 font-bold focus:bg-white focus:border-amber-500 focus:outline-none"
              >
                <option value="all">Tous les Types</option>
                <option value="livres">Véhicules Livrés</option>
                <option value="a_livrer">Véhicules à Livrer</option>
              </select>

              <button
                onClick={() => exportBatchesToCSV(filteredBatches)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 transition"
                title="Exporter l historique au format CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Table */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
          <div className="bg-white border border-slate-200 overflow-x-auto shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">N° Lot / Facture</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Importateur</th>
                  <th className="p-3">Type Facturation</th>
                  <th className="p-3 text-center">Nb Véhicules</th>
                  <th className="p-3 text-right">Montant Total TTC</th>
                  <th className="p-3 text-center">Statut</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 italic">
                      Aucun lot de facturation ne correspond aux critères.
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50 transition">
                      {/* N° Lot */}
                      <td className="p-3">
                        <div className="font-mono font-bold text-slate-900">{b.batchNumber}</div>
                        {b.invoiceReference && (
                          <div className="text-[10px] text-blue-700 font-mono">Ref: {b.invoiceReference}</div>
                        )}
                      </td>

                      {/* Date */}
                      <td className="p-3 font-mono text-slate-700">{b.batchDate}</td>

                      {/* Importateur */}
                      <td className="p-3 font-bold text-slate-900">{b.importer}</td>

                      {/* Type */}
                      <td className="p-3">
                        {b.billingType === 'livres' ? (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Véhicules Livrés
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            Véhicules à Livrer
                          </span>
                        )}
                      </td>

                      {/* Nb Veh */}
                      <td className="p-3 text-center font-mono font-bold text-slate-800">
                        {b.vehicleCount}
                      </td>

                      {/* Total TTC */}
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {b.total.toFixed(3)} DT
                      </td>

                      {/* Status */}
                      <td className="p-3 text-center">
                        {b.status === 'facture' ? (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                            FACTURÉ
                          </span>
                        ) : b.status === 'valide' ? (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-300">
                            VALIDÉ
                          </span>
                        ) : b.status === 'brouillon' ? (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            BROUILLON
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-slate-200 text-slate-700">
                            ANNULÉ
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {/* Details */}
                          <button
                            onClick={() => setViewingBatch(b)}
                            className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 transition"
                            title="Voir détail du lot"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* PDF */}
                          <button
                            onClick={() => exportBatchToPDF(b, vehicles)}
                            className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 transition"
                            title="Générer PDF Officiel Facture Groupée & Annexe Technique"
                          >
                            <Printer className="w-3.5 h-3.5 text-amber-600" />
                          </button>

                          {/* Edit if Brouillon */}
                          {b.status === 'brouillon' && userRole !== 'viewer' && (
                            <button
                              onClick={() => {
                                onEditBatch(b);
                                onClose();
                              }}
                              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition"
                              title="Modifier le lot"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Status toggle actions */}
                          {b.status === 'brouillon' && userRole !== 'viewer' && (
                            <button
                              onClick={() => handleStatusChange(b.id, 'valide')}
                              className="p-1.5 text-emerald-700 hover:bg-emerald-50 transition"
                              title="Valider le lot"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {b.status === 'valide' && userRole !== 'viewer' && (
                            <button
                              onClick={() => handleStatusChange(b.id, 'facture')}
                              className="p-1.5 text-emerald-800 hover:bg-emerald-100 transition font-bold text-[10px]"
                              title="Marquer comme facturé"
                            >
                              Facturé
                            </button>
                          )}

                          {/* Cancel */}
                          {b.status !== 'annule' && userRole !== 'viewer' && (
                            <button
                              onClick={() => {
                                if (confirm(`Annuler le lot ${b.batchNumber} ? Les véhicules seront libérés.`)) {
                                  handleStatusChange(b.id, 'annule');
                                }
                              }}
                              className="p-1.5 text-red-600 hover:bg-red-50 transition"
                              title="Annuler le lot"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete if Draft or Annule */}
                          {(b.status === 'brouillon' || b.status === 'annule') && userRole === 'admin' && (
                            <button
                              onClick={() => setDeletingBatchId(b.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 transition"
                              title="Supprimer définitivement"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold uppercase tracking-wider"
          >
            Fermer
          </button>
          <span className="text-xs text-slate-500 font-mono">STAFIM SA - Division Logistique & Facturation Parc</span>
        </div>
      </div>

      {/* Detail Modal */}
      {viewingBatch && (
        <BatchDetailModal
          batch={viewingBatch}
          vehicles={vehicles}
          onClose={() => setViewingBatch(null)}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingBatchId && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-red-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-sm font-black uppercase tracking-wider">Confirmer la Suppression</h3>
            </div>
            <p className="text-xs text-slate-600">
              Êtes-vous sûr de vouloir supprimer définitivement ce lot de facturation ? Cette action est irréversible.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setDeletingBatchId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* Detail Modal for a single Billing Batch */
interface BatchDetailModalProps {
  batch: BillingBatch;
  vehicles: Vehicle[];
  onClose: () => void;
  onStatusChange: (batchId: string, newStatus: BatchStatus) => void;
}

const BatchDetailModal: React.FC<BatchDetailModalProps> = ({
  batch,
  vehicles,
  onClose,
  onStatusChange,
}) => {
  return (
    <div className="fixed inset-0 z-60 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-300 shadow-2xl w-full max-w-4xl flex flex-col rounded-none overflow-hidden my-auto text-slate-900">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500 text-slate-950">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black uppercase tracking-wider text-sm flex items-center space-x-2">
                <span>Lot N° {batch.batchNumber}</span>
                {batch.invoiceReference && (
                  <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 font-mono">
                    {batch.invoiceReference}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">Date : {batch.batchDate} | Client : {batch.importer}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 max-h-[75vh] bg-slate-50">
          {/* Header Metadata Box */}
          <div className="bg-white p-4 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Importateur</span>
              <span className="font-bold text-slate-900">{batch.importer}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Type Facturation</span>
              <span className="font-bold text-blue-700">
                {batch.billingType === 'livres' ? 'Véhicules Livrés' : 'Véhicules à Livrer'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Statut du Lot</span>
              <span className="font-black text-amber-600 uppercase">{batch.status}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Créé Par</span>
              <span className="font-mono text-slate-800">{batch.createdBy}</span>
            </div>
          </div>

          {/* Vehicles List */}
          <div className="bg-white border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-4 py-2 font-bold uppercase text-xs flex justify-between items-center">
              <span>Véhicules Inclus dans ce Lot ({batch.items.length})</span>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">Châssis (VIN)</th>
                  <th className="p-2.5">Marque & Modèle</th>
                  <th className="p-2.5">Site Départ & Arrivée</th>
                  <th className="p-2.5 text-right">Prix HT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {batch.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-2.5 text-slate-500">{idx + 1}</td>
                    <td className="p-2.5 font-bold text-slate-900">{item.chassisNumber}</td>
                    <td className="p-2.5 font-sans font-bold text-slate-800">
                      {item.brand} {item.model}
                    </td>
                    <td className="p-2.5 font-sans text-slate-600">
                      {item.siteDepart} &gt; {item.siteArrivee}
                    </td>
                    <td className="p-2.5 text-right font-bold text-slate-900">
                      {item.unitPriceHT.toFixed(3)} DT
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="bg-slate-900 text-white p-4 flex justify-between items-center text-xs font-mono">
            <div>
              <span className="text-slate-400">Sous-total HT : {batch.subtotal.toFixed(3)} DT</span>
              <span className="mx-2">•</span>
              <span className="text-amber-400">Remise : {batch.discount.toFixed(3)} DT</span>
              <span className="mx-2">•</span>
              <span className="text-slate-400">TVA ({batch.vatRate}%) : {batch.vatAmount.toFixed(3)} DT</span>
            </div>
            <div className="text-right">
              <span className="text-amber-400 font-black text-lg">{batch.total.toFixed(3)} DT TTC</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase">
            Fermer
          </button>
          <div className="flex space-x-2">
            <button
              onClick={() => exportBatchToPDF(batch, vehicles)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase flex items-center space-x-2"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer PDF Offciel</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
