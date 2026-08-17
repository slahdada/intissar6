import React, { useState, useEffect } from 'react';
import { X, History, Download, Filter, Search, Shield, Clock, Calendar, AlertCircle, RefreshCw } from 'lucide-react';
import { DateAuditLog, getAuditLogs, clearAuditLogs } from '../lib/auditLogger';
import { formatDateTime } from '../lib/dateUtils';

interface DateAuditLogModalProps {
  onClose: () => void;
}

export const DateAuditLogModal: React.FC<DateAuditLogModalProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<DateAuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');

  useEffect(() => {
    setLogs(getAuditLogs());
  }, []);

  const handleRefresh = () => {
    setLogs(getAuditLogs());
  };

  const filteredLogs = logs.filter((log) => {
    const matchesModule = moduleFilter === 'all' || log.module === moduleFilter;
    const query = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !query ||
      log.user_name.toLowerCase().includes(query) ||
      log.entity_id.toLowerCase().includes(query) ||
      log.entity_label.toLowerCase().includes(query) ||
      log.field_name.toLowerCase().includes(query) ||
      log.old_value.toLowerCase().includes(query) ||
      log.new_value.toLowerCase().includes(query);
    return matchesModule && matchesSearch;
  });

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = [
      'ID Log',
      'Date & Heure Système',
      'Utilisateur',
      'Rôle',
      'Module',
      'Entité (ID/VIN/Facture)',
      'Élément',
      'Champ Date Modifié',
      'Ancienne Valeur',
      'Nouvelle Valeur',
    ];

    const rows = filteredLogs.map((l) => [
      l.id,
      l.timestamp,
      `"${l.user_name}"`,
      `"${l.user_role}"`,
      `"${l.module}"`,
      `"${l.entity_id}"`,
      `"${l.entity_label.replace(/"/g, '""')}"`,
      `"${l.field_name}"`,
      `"${l.old_value}"`,
      `"${l.new_value}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Journal_Modifications_Dates_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white border-2 border-slate-900 shadow-2xl max-w-5xl w-full my-6 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500 text-slate-900 rounded-xs">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wider flex items-center space-x-2">
                <span>Journal d Audit & Traçabilité des Dates</span>
                <span className="bg-amber-400 text-slate-900 text-[10px] px-2 py-0.5 font-mono font-bold">
                  {filteredLogs.length} entrée{filteredLogs.length > 1 ? 's' : ''}
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Historique des modifications de dates métier effectuées par Ayari Intissar (Administrateur)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters bar */}
        <div className="p-4 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher utilisateur, VIN, facture..."
                className="w-full bg-white border border-slate-300 text-slate-900 text-xs pl-9 pr-3 py-1.5 focus:outline-none focus:border-amber-500 font-medium"
              />
            </div>

            {/* Module filter */}
            <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700">
              <Filter className="w-4 h-4 text-slate-500" />
              <span>Module :</span>
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="bg-white border border-slate-300 text-slate-900 text-xs px-2.5 py-1.5 font-bold focus:outline-none focus:border-amber-500"
              >
                <option value="all">Tous les modules</option>
                <option value="Stock Véhicules">Stock Véhicules</option>
                <option value="Saisie Mouvement">Saisie Mouvement</option>
                <option value="Historique Mouvements">Historique Mouvements</option>
                <option value="Facturation">Facturation</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center space-x-1 transition"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Actualiser</span>
            </button>
            <button
              onClick={handleExportCSV}
              disabled={filteredLogs.length === 0}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-xs flex items-center space-x-1.5 transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exporter CSV</span>
            </button>
          </div>
        </div>

        {/* Content Table */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
          {filteredLogs.length === 0 ? (
            <div className="bg-white p-12 border border-slate-200 text-center space-y-3">
              <Shield className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">Aucun journal de modification enregistré</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Les modifications de dates métier effectuées par Ayari Intissar dans les modules (Stock, Mouvements, Facturation) seront automatiquement enregistrées ici.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 shadow-xs overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                    <th className="px-4 py-3">Date & Heure</th>
                    <th className="px-4 py-3">Utilisateur / Rôle</th>
                    <th className="px-4 py-3">Module</th>
                    <th className="px-4 py-3">Élément / Entité</th>
                    <th className="px-4 py-3">Champ Date</th>
                    <th className="px-4 py-3">Ancienne Valeur</th>
                    <th className="px-4 py-3">Nouvelle Valeur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs font-medium text-slate-800">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-amber-50/50 transition">
                      <td className="px-4 py-3 font-mono text-[11px] font-bold text-slate-700 whitespace-nowrap">
                        {log.timestamp}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{log.user_name}</div>
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded-xs inline-block">
                          {log.user_role}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-indigo-900 whitespace-nowrap">
                        {log.module}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate" title={log.entity_label}>
                        <span className="font-mono text-[11px] font-bold text-slate-900 block">{log.entity_id}</span>
                        <span className="text-[10px] text-slate-500 block truncate">{log.entity_label}</span>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-700">
                        {log.field_name}
                      </td>
                      <td className="px-4 py-3 font-mono text-rose-700 bg-rose-50/80 border border-rose-200 px-2 py-1 rounded-xs">
                        {formatDateTime(log.old_value, { fallback: log.old_value })}
                      </td>
                      <td className="px-4 py-3 font-mono text-emerald-800 bg-emerald-50/80 border border-emerald-200 px-2 py-1 rounded-xs font-bold">
                        {formatDateTime(log.new_value, { fallback: log.new_value })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Horodatage système inviolable • Enregistrement conforme</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold uppercase tracking-wider text-xs"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
