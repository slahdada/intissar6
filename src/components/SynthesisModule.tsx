import React, { useState, useMemo } from 'react';
import {
  ArrowLeftRight,
  PackageCheck,
  Building2,
  Car,
  Search,
  FileSpreadsheet,
  Download,
  AlertCircle,
  MapPin,
  Tag,
  FileText,
  Filter,
} from 'lucide-react';
import { Vehicle, Site } from '../types';

export type CategoryType = 'TRANSFERT' | 'SORTIE_DEFINITIVE' | 'ENTREE_STOCK';

interface SynthesisModuleProps {
  vehicles: Vehicle[];
  sites: Site[];
  onSelectVehicle?: (vehicle: Vehicle) => void;
  defaultCategory?: CategoryType;
}

export function isTransfertVehicle(v: Vehicle): boolean {
  if (!v) return false;
  const statusStr = (v.status || '').toLowerCase();
  const notesStr = (v.notes || '').toLowerCase();

  // Status check
  if (
    statusStr === 'en_transit' ||
    statusStr.includes('transit') ||
    statusStr.includes('transfert') ||
    statusStr.includes('mutation')
  ) {
    return true;
  }

  // Notes check for inter-site transfer / mutation / displacement
  const keywords = [
    'transfert',
    'transfer',
    'inter-site',
    'intersite',
    'inter site',
    'mutation',
    'déplacement',
    'deplacement',
    'entre parcs',
    'inter-parc',
    'interparc',
    'mouvement',
  ];
  return keywords.some((kw) => notesStr.includes(kw));
}

export function isSortieDefinitiveVehicle(v: Vehicle): boolean {
  if (!v) return false;
  const statusStr = (v.status || '').toLowerCase();
  const notesStr = (v.notes || '').toLowerCase();

  // Status check
  if (
    statusStr === 'livre' ||
    statusStr === 'vendu' ||
    statusStr.includes('livr') ||
    statusStr.includes('vendu') ||
    statusStr.includes('sortie')
  ) {
    return true;
  }

  // Notes check for delivery or definitive exit
  const keywords = [
    'livré',
    'livre',
    'livraison',
    'client',
    'concession',
    'concessionnaire',
    'sortie',
    'définitive',
    'definitive',
    'vendu',
    'vente',
  ];
  return keywords.some((kw) => notesStr.includes(kw));
}

export function isEntreeStockVehicle(v: Vehicle): boolean {
  if (!v) return false;
  const statusStr = (v.status || '').toLowerCase();
  const notesStr = (v.notes || '').toLowerCase();

  // Status check
  if (
    statusStr === 'en_stock' ||
    statusStr === 'reserve' ||
    statusStr.includes('stock') ||
    statusStr.includes('arrivage')
  ) {
    return true;
  }

  // Notes check for stock arrival / warehouse entry
  const keywords = [
    'stock',
    'arrivage',
    'port',
    'portuaire',
    'réception',
    'reception',
    'dépôt',
    'depot',
    'entrée',
    'entree',
    'magasin',
    'parc',
  ];
  return keywords.some((kw) => notesStr.includes(kw));
}

export const SynthesisModule: React.FC<SynthesisModuleProps> = ({
  vehicles = [],
  sites = [],
  onSelectVehicle,
  defaultCategory = 'ENTREE_STOCK',
}) => {
  const [activeCategory, setActiveCategory] = useState<CategoryType>(defaultCategory);
  const [searchTerm, setSearchTerm] = useState('');

  const safeVehicles = useMemo(
    () => (Array.isArray(vehicles) ? vehicles.filter(Boolean) : []),
    [vehicles]
  );
  const safeSites = useMemo(
    () => (Array.isArray(sites) ? sites.filter(Boolean) : []),
    [sites]
  );

  // Compute vehicles for each category
  const transfertVehicles = useMemo(
    () => safeVehicles.filter(isTransfertVehicle),
    [safeVehicles]
  );
  const sortieVehicles = useMemo(
    () => safeVehicles.filter(isSortieDefinitiveVehicle),
    [safeVehicles]
  );
  const entreeVehicles = useMemo(
    () => safeVehicles.filter(isEntreeStockVehicle),
    [safeVehicles]
  );

  // Active category vehicles
  const currentCategoryVehicles = useMemo(() => {
    switch (activeCategory) {
      case 'TRANSFERT':
        return transfertVehicles;
      case 'SORTIE_DEFINITIVE':
        return sortieVehicles;
      case 'ENTREE_STOCK':
        return entreeVehicles;
      default:
        return [];
    }
  }, [activeCategory, transfertVehicles, sortieVehicles, entreeVehicles]);

  // Filtered by search term
  const filteredVehicles = useMemo(() => {
    if (!searchTerm.trim()) return currentCategoryVehicles;
    const term = searchTerm.toLowerCase().trim();
    return currentCategoryVehicles.filter((v) => {
      if (!v) return false;
      const siteObj = safeSites.find((s) => s && s.id === v.current_site_id);
      const siteName = siteObj ? siteObj.name : (v.current_site_id || '');
      return (
        (v.stock_number || '').toLowerCase().includes(term) ||
        (v.brand || '').toLowerCase().includes(term) ||
        (v.model || '').toLowerCase().includes(term) ||
        (v.chassis_number || v.vin || '').toLowerCase().includes(term) ||
        (v.color || '').toLowerCase().includes(term) ||
        (v.status || '').toLowerCase().includes(term) ||
        (v.notes || '').toLowerCase().includes(term) ||
        siteName.toLowerCase().includes(term)
      );
    });
  }, [currentCategoryVehicles, searchTerm, safeSites]);

  const getSiteName = (siteId: string | null) => {
    if (!siteId) return 'Non affecté';
    const s = safeSites.find((site) => site && site.id === siteId);
    return s ? s.name : siteId;
  };


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'en_stock':
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            En Stock
          </span>
        );
      case 'en_transit':
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            En Transit
          </span>
        );
      case 'livre':
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Livré
          </span>
        );
      case 'reserve':
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
            Réservé
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  // CSV export helper for the active category list
  const exportCategoryCSV = () => {
    if (filteredVehicles.length === 0) return;
    const headers = [
      'Stock Number',
      'Marque',
      'Modèle',
      'Année',
      'Couleur',
      'Site ID / Nom',
      'Statut',
      'Notes',
      'N° Châssis (VIN)',
    ];

    const csvRows = filteredVehicles.map((v) => [
      `"${v.stock_number || ''}"`,
      `"${v.brand || ''}"`,
      `"${v.model || ''}"`,
      `"${v.year || ''}"`,
      `"${v.color || ''}"`,
      `"${getSiteName(v.current_site_id)}"`,
      `"${v.status || ''}"`,
      `"${(v.notes || '').replace(/"/g, '""')}"`,
      `"${v.chassis_number || ''}"`,
    ]);

    const content = [headers.join(';'), ...csvRows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Synthese_${activeCategory}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border border-slate-200 p-6 shadow-sm space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 bg-blue-600"></span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
              Synthèse Générale du Parc
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide mt-1">
            Indicateurs & Flux de Véhicules
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Sélectionnez une catégorie ci-dessous pour filtrer et consulter le détail des véhicules.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 border border-slate-200">
            Flotte totale : <strong className="text-slate-900 font-mono">{vehicles.length}</strong> véhicules
          </span>
        </div>
      </div>

      {/* 3 Synthesis Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* BUTTON 1: TRANSFERT */}
        <button
          type="button"
          onClick={() => setActiveCategory('TRANSFERT')}
          className={`p-5 text-left border-2 transition-all flex flex-col justify-between group cursor-pointer ${
            activeCategory === 'TRANSFERT'
              ? 'border-amber-500 bg-amber-50/80 shadow-md ring-2 ring-amber-400/20'
              : 'border-slate-200 bg-slate-50/80 hover:border-amber-400 hover:bg-amber-50/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div
                className={`p-2 rounded ${
                  activeCategory === 'TRANSFERT'
                    ? 'bg-amber-500 text-white'
                    : 'bg-amber-100 text-amber-800 group-hover:bg-amber-500 group-hover:text-white transition'
                }`}
              >
                <ArrowLeftRight className="w-5 h-5" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                1. TRANSFERT
              </span>
            </div>
            {transfertVehicles.length === 0 && (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-slate-200 text-slate-600">
                0 véhicule
              </span>
            )}
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <div className="text-3xl font-black font-mono text-slate-900">
              {transfertVehicles.length === 0 ? '0' : transfertVehicles.length}
            </div>
            <div className="text-xs font-bold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded uppercase tracking-wide">
              {transfertVehicles.length === 0
                ? '0 véhicule'
                : `${transfertVehicles.length} véhicule${transfertVehicles.length > 1 ? 's' : ''}`}
            </div>
          </div>

          <p className="text-[11px] text-slate-600 mt-2 line-clamp-2">
            Transferts inter-sites, mutations & déplacements entre parcs.
          </p>
        </button>

        {/* BUTTON 2: SORTIE DÉFINITIVE */}
        <button
          type="button"
          onClick={() => setActiveCategory('SORTIE_DEFINITIVE')}
          className={`p-5 text-left border-2 transition-all flex flex-col justify-between group cursor-pointer ${
            activeCategory === 'SORTIE_DEFINITIVE'
              ? 'border-emerald-500 bg-emerald-50/80 shadow-md ring-2 ring-emerald-400/20'
              : 'border-slate-200 bg-slate-50/80 hover:border-emerald-400 hover:bg-emerald-50/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div
                className={`p-2 rounded ${
                  activeCategory === 'SORTIE_DEFINITIVE'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-100 text-emerald-800 group-hover:bg-emerald-600 group-hover:text-white transition'
                }`}
              >
                <PackageCheck className="w-5 h-5" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                2. SORTIE DÉFINITIVE
              </span>
            </div>
            {sortieVehicles.length === 0 && (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-slate-200 text-slate-600">
                0 véhicule
              </span>
            )}
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <div className="text-3xl font-black font-mono text-slate-900">
              {sortieVehicles.length === 0 ? '0' : sortieVehicles.length}
            </div>
            <div className="text-xs font-bold text-emerald-900 bg-emerald-200/80 px-2 py-0.5 rounded uppercase tracking-wide">
              {sortieVehicles.length === 0
                ? '0 véhicule'
                : `${sortieVehicles.length} véhicule${sortieVehicles.length > 1 ? 's' : ''}`}
            </div>
          </div>

          <p className="text-[11px] text-slate-600 mt-2 line-clamp-2">
            Véhicules livrés au client, en concession ou sortie définitive.
          </p>
        </button>

        {/* BUTTON 3: ENTRÉE STOCK */}
        <button
          type="button"
          onClick={() => setActiveCategory('ENTREE_STOCK')}
          className={`p-5 text-left border-2 transition-all flex flex-col justify-between group cursor-pointer ${
            activeCategory === 'ENTREE_STOCK'
              ? 'border-blue-600 bg-blue-50/80 shadow-md ring-2 ring-blue-400/20'
              : 'border-slate-200 bg-slate-50/80 hover:border-blue-400 hover:bg-blue-50/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div
                className={`p-2 rounded ${
                  activeCategory === 'ENTREE_STOCK'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-100 text-blue-800 group-hover:bg-blue-600 group-hover:text-white transition'
                }`}
              >
                <Building2 className="w-5 h-5" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                3. ENTRÉE STOCK
              </span>
            </div>
            {entreeVehicles.length === 0 && (
              <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-slate-200 text-slate-600">
                0 véhicule
              </span>
            )}
          </div>

          <div className="mt-4 flex items-baseline justify-between">
            <div className="text-3xl font-black font-mono text-slate-900">
              {entreeVehicles.length === 0 ? '0' : entreeVehicles.length}
            </div>
            <div className="text-xs font-bold text-blue-900 bg-blue-200/80 px-2 py-0.5 rounded uppercase tracking-wide">
              {entreeVehicles.length === 0
                ? '0 véhicule'
                : `${entreeVehicles.length} véhicule${entreeVehicles.length > 1 ? 's' : ''}`}
            </div>
          </div>

          <p className="text-[11px] text-slate-600 mt-2 line-clamp-2">
            Véhicules en stock, arrivage portuaire, réception ou dépôt.
          </p>
        </button>
      </div>

      {/* Details Header and Total Display */}
      <div className="border border-slate-200 rounded overflow-hidden">
        <div className="bg-slate-900 text-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-slate-800 border border-slate-700 text-blue-400">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center space-x-2">
                <span>Catégorie Sélectionnée :</span>
                <span className="text-blue-400 font-extrabold">
                  {activeCategory === 'TRANSFERT' && 'TRANSFERT INTER-SITES'}
                  {activeCategory === 'SORTIE_DEFINITIVE' && 'SORTIE DÉFINITIVE'}
                  {activeCategory === 'ENTREE_STOCK' && 'ENTRÉE STOCK / INVENTAIRE'}
                </span>
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">
                Affichage filtré des éléments correspondants aux règles de gestion.
              </p>
            </div>
          </div>

          {/* Top Total Count Display */}
          <div className="flex items-center space-x-3">
            <div className="bg-slate-800 px-4 py-2 border border-slate-700 flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-300 uppercase">Total :</span>
              <span className="text-lg font-black font-mono text-emerald-400">
                {currentCategoryVehicles.length === 0
                  ? '0 véhicule'
                  : `${currentCategoryVehicles.length} véhicule${
                      currentCategoryVehicles.length > 1 ? 's' : ''
                    }`}
              </span>
            </div>

            {currentCategoryVehicles.length > 0 && (
              <button
                type="button"
                onClick={exportCategoryCSV}
                className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 text-xs font-bold uppercase tracking-wider border border-slate-700 flex items-center space-x-1.5 transition"
                title="Exporter cette liste en CSV"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div className="bg-slate-50 p-3 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par N° stock, marque, modèle, VIN..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 text-xs focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Affichage de <strong className="text-slate-900">{filteredVehicles.length}</strong> sur{' '}
            <strong className="text-slate-900">{currentCategoryVehicles.length}</strong> véhicules
          </div>
        </div>

        {/* Vehicle List Table */}
        {filteredVehicles.length === 0 ? (
          <div className="p-12 text-center bg-white space-y-3">
            <div className="w-12 h-12 mx-auto bg-slate-100 text-slate-400 flex items-center justify-center rounded-full">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">
              0 véhicule
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {currentCategoryVehicles.length === 0
                ? `Aucun véhicule ne correspond aux critères de la catégorie "${activeCategory}".`
                : 'Aucun résultat ne correspond à votre filtre de recherche.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-black uppercase text-slate-700 tracking-wider">
                  <th className="py-3 px-4">stocknumber</th>
                  <th className="py-3 px-4">brand</th>
                  <th className="py-3 px-4">model</th>
                  <th className="py-3 px-4">year</th>
                  <th className="py-3 px-4">color</th>
                  <th className="py-3 px-4">siteidounom</th>
                  <th className="py-3 px-4">status</th>
                  <th className="py-3 px-4">notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredVehicles.map((vehicle) => (
                  <tr
                    key={vehicle.id}
                    onClick={() => onSelectVehicle && onSelectVehicle(vehicle)}
                    className="hover:bg-blue-50/50 cursor-pointer transition group"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {vehicle.stock_number || 'N/A'}
                    </td>
                    <td className="py-3 px-4 font-black uppercase text-slate-900">
                      {vehicle.brand}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {vehicle.model}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {vehicle.year || '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {vehicle.color || '-'}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      <span className="flex items-center space-x-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{getSiteName(vehicle.current_site_id)}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(vehicle.status)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={vehicle.notes || ''}>
                      {vehicle.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
