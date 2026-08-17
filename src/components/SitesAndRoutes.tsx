import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Building2,
  Route as RouteIcon,
  Plus,
  CheckCircle2,
  ShieldAlert,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  Car,
  Truck,
  Phone,
  User as UserIcon,
} from 'lucide-react';
import { Site, Route, UserRole, Carrier } from '../types';
import { api } from '../lib/api';

interface SitesAndRoutesProps {
  sites: Site[];
  routes: Route[];
  userRole: UserRole;
  onRefresh: () => void;
  onNavigate?: (tab: string) => void;
}

export const SitesAndRoutes: React.FC<SitesAndRoutesProps> = ({
  sites,
  routes,
  userRole,
  onRefresh,
  onNavigate,
}) => {
  // Carrier State
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [showAddCarrier, setShowAddCarrier] = useState(false);
  const [carrierRaisonSociale, setCarrierRaisonSociale] = useState('');
  const [carrierNomChauffeur, setCarrierNomChauffeur] = useState('');
  const [carrierPhone, setCarrierPhone] = useState('');
  const [carrierMatricule, setCarrierMatricule] = useState('');

  const [editingCarrier, setEditingCarrier] = useState<Carrier | null>(null);
  const [editCarrierRaison, setEditCarrierRaison] = useState('');
  const [editCarrierChauffeur, setEditCarrierChauffeur] = useState('');
  const [editCarrierPhone, setEditCarrierPhone] = useState('');
  const [editCarrierMatricule, setEditCarrierMatricule] = useState('');

  const loadCarriersData = () => {
    api.getCarriers().then((data) => setCarriers(data)).catch(() => {});
  };

  useEffect(() => {
    loadCarriersData();
  }, []);

  const handleCreateCarrier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carrierRaisonSociale.trim()) {
      setError('La raison sociale est obligatoire.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.createCarrier({
        raisonSociale: carrierRaisonSociale.trim(),
        nomChauffeur: carrierNomChauffeur.trim(),
        telephone: carrierPhone.trim(),
        matriculeCamion: carrierMatricule.trim(),
      });
      setCarrierRaisonSociale('');
      setCarrierNomChauffeur('');
      setCarrierPhone('');
      setCarrierMatricule('');
      setShowAddCarrier(false);
      loadCarriersData();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du transporteur.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEditCarrier = (c: Carrier) => {
    setEditingCarrier(c);
    setEditCarrierRaison(c.raisonSociale);
    setEditCarrierChauffeur(c.nomChauffeur);
    setEditCarrierPhone(c.telephone);
    setEditCarrierMatricule(c.matriculeCamion);
  };

  const handleUpdateCarrier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCarrier) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.updateCarrier(editingCarrier.id, {
        raisonSociale: editCarrierRaison.trim(),
        nomChauffeur: editCarrierChauffeur.trim(),
        telephone: editCarrierPhone.trim(),
        matriculeCamion: editCarrierMatricule.trim(),
      });
      setEditingCarrier(null);
      loadCarriersData();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour du transporteur.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleCarrierActive = async (c: Carrier) => {
    try {
      await api.updateCarrier(c.id, { actif: !c.actif });
      loadCarriersData();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour.');
    }
  };

  const handleDeleteCarrier = async (id: string) => {
    if (!window.confirm('Voulez-vous supprimer ce transporteur ?')) return;
    try {
      await api.deleteCarrier(id);
      loadCarriersData();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression.');
    }
  };
  const [showAddSite, setShowAddSite] = useState(false);
  const [siteName, setSiteName] = useState('');
  const [siteType, setSiteType] = useState<'port' | 'park' | 'warehouse'>('park');
  const [siteAddress, setSiteAddress] = useState('');

  // Edit Site State
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [editSiteName, setEditSiteName] = useState('');
  const [editSiteType, setEditSiteType] = useState<'port' | 'park' | 'warehouse'>('park');
  const [editSiteAddress, setEditSiteAddress] = useState('');

  // Delete Site Confirmation State
  const [deletingSite, setDeletingSite] = useState<Site | null>(null);

  const [showAddRoute, setShowAddRoute] = useState(false);
  const [depSiteId, setDepSiteId] = useState('');
  const [arrSiteId, setArrSiteId] = useState('');
  const [waypoints, setWaypoints] = useState<string[]>([]);
  const [routeName, setRouteName] = useState('');

  // Edit Route State
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [editDepSiteId, setEditDepSiteId] = useState('');
  const [editArrSiteId, setEditArrSiteId] = useState('');
  const [editWaypoints, setEditWaypoints] = useState<string[]>([]);
  const [editRouteName, setEditRouteName] = useState('');

  // Delete Route Confirmation State
  const [deletingRoute, setDeletingRoute] = useState<Route | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const siteMap = new Map<string, string>();
  sites.forEach((s) => siteMap.set(s.id, s.name));

  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteName.trim()) {
      setError('Le nom du site est obligatoire.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.createSite({
        name: siteName.trim(),
        type: siteType,
        address: siteAddress.trim(),
      });
      setSiteName('');
      setSiteAddress('');
      setShowAddSite(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du site.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEditSite = (site: Site) => {
    setEditingSite(site);
    setEditSiteName(site.name);
    setEditSiteType(site.type);
    setEditSiteAddress(site.address || '');
  };

  const handleUpdateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSite) return;
    if (!editSiteName.trim()) {
      setError('Le nom du site est obligatoire.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.updateSite(editingSite.id, {
        name: editSiteName.trim(),
        type: editSiteType,
        address: editSiteAddress.trim(),
      });
      setEditingSite(null);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour du site.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSite = async () => {
    if (!deletingSite) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.deleteSite(deletingSite.id);
      setDeletingSite(null);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression du site.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depSiteId || !arrSiteId) {
      setError('Les sites de départ et d arrivée sont obligatoires.');
      return;
    }
    if (depSiteId === arrSiteId) {
      setError('Les sites de départ et d arrivée doivent être différents.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.createRoute({
        departure_site_id: depSiteId,
        arrival_site_id: arrSiteId,
        waypoints: waypoints.filter(Boolean),
        route_name: routeName.trim(),
      });
      setDepSiteId('');
      setArrSiteId('');
      setWaypoints([]);
      setRouteName('');
      setShowAddRoute(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du trajet.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEditRoute = (r: Route) => {
    setEditingRoute(r);
    setEditDepSiteId(r.departure_site_id);
    setEditArrSiteId(r.arrival_site_id);
    setEditWaypoints(r.waypoints || []);
    setEditRouteName(r.route_name);
  };

  const handleUpdateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoute) return;
    if (!editDepSiteId || !editArrSiteId) {
      setError('Les sites de départ et d arrivée sont obligatoires.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.updateRoute(editingRoute.id, {
        departure_site_id: editDepSiteId,
        arrival_site_id: editArrSiteId,
        waypoints: editWaypoints.filter(Boolean),
        route_name: editRouteName.trim(),
      });
      setEditingRoute(null);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour du trajet.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRoute = async () => {
    if (!deletingRoute) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.deleteRoute(deletingRoute.id);
      setDeletingRoute(null);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression du trajet.');
    } finally {
      setSubmitting(false);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'port':
        return (
          <span className="bg-cyan-100 text-cyan-900 text-[9px] font-black px-2 py-0.5 border border-cyan-300 uppercase tracking-widest">
            Port Maritime
          </span>
        );
      case 'park':
        return (
          <span className="bg-blue-100 text-blue-900 text-[9px] font-black px-2 py-0.5 border border-blue-300 uppercase tracking-widest">
            Parc Stockage
          </span>
        );
      case 'warehouse':
        return (
          <span className="bg-purple-100 text-purple-900 text-[9px] font-black px-2 py-0.5 border border-purple-300 uppercase tracking-widest">
            Entrepôt Couvert
          </span>
        );
      case 'importer':
        return (
          <span className="bg-amber-100 text-amber-900 text-[9px] font-black px-2 py-0.5 border border-amber-300 uppercase tracking-widest">
            Importateur Officiel
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header */}
      <div className="bg-slate-900 text-white p-6 border-b-4 border-blue-600 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black uppercase tracking-wider text-slate-100 flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-blue-400" />
            <span>Gestion des Sites & Trajets Prédéfinis</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configuration des ports de débarquement, parcs centraux, entrepôts et circuits d acheminement.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border-l-4 border-rose-600 border-y border-r border-rose-200 p-4 text-xs text-rose-900 flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-rose-600" />
          <span className="font-bold">{error}</span>
        </div>
      )}

      {/* Sites Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>Sites de Stockage & Emplacements ({sites.length})</span>
          </h2>
          {userRole !== 'viewer' && (
            <button
              onClick={() => setShowAddSite(!showAddSite)}
              className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 text-xs font-black uppercase tracking-wider transition"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau Site</span>
            </button>
          )}
        </div>

        {/* Modal / Form Add Site */}
        {showAddSite && (
          <form onSubmit={handleCreateSite} className="bg-slate-50 p-4 border border-blue-300 space-y-3">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Ajouter un nouveau site</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">Nom du Site*</label>
                <input
                  type="text"
                  required
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="ex: Parc Régional Bizerte"
                  className="w-full text-xs font-bold p-2 bg-white border border-slate-300 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">Type de Site*</label>
                <select
                  value={siteType}
                  onChange={(e: any) => setSiteType(e.target.value)}
                  className="w-full text-xs font-bold p-2 bg-white border border-slate-300 focus:outline-none focus:border-blue-600"
                >
                  <option value="port">Port Maritime</option>
                  <option value="park">Parc de Stockage</option>
                  <option value="warehouse">Entrepôt Couvert</option>
                  <option value="importer">Importateur / Concessionnaire</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">Adresse / Zone</label>
                <input
                  type="text"
                  value={siteAddress}
                  onChange={(e) => setSiteAddress(e.target.value)}
                  placeholder="ex: Z.I. Mghira, Ben Arous"
                  className="w-full text-xs font-bold p-2 bg-white border border-slate-300 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddSite(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 uppercase font-bold tracking-wider"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 text-xs bg-blue-600 text-white font-black uppercase tracking-wider hover:bg-blue-500"
              >
                Enregistrer le Site
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sites.map((site) => (
            <div
              key={site.id}
              className="bg-white p-5 border-l-4 border-blue-600 border-y border-r border-slate-200 shadow-sm space-y-3 hover:border-slate-400 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-slate-900 text-sm uppercase tracking-wider">{site.name}</span>
                  {getTypeBadge(site.type)}
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1">{site.address || 'Aucune adresse renseignée'}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                {onNavigate ? (
                  <button
                    onClick={() => onNavigate('vehicles')}
                    className="text-[10px] text-blue-700 hover:text-blue-900 font-black uppercase tracking-wider flex items-center space-x-1 hover:underline"
                    title="Voir les véhicules en stock"
                  >
                    <Car className="w-3.5 h-3.5" />
                    <span>Voir véhicules</span>
                  </button>
                ) : (
                  <div className="text-[10px] text-emerald-700 font-black uppercase tracking-wider flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Actif & Opérationnel</span>
                  </div>
                )}

                {userRole !== 'viewer' && (
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleStartEditSite(site)}
                      title="Modifier le site"
                      className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition rounded"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingSite(site)}
                      title="Supprimer le site"
                      className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-slate-100 transition rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Routes Section */}
      <div className="space-y-4 pt-6 border-t-2 border-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center space-x-2">
            <RouteIcon className="w-4 h-4 text-blue-600" />
            <span>Trajets Prédéfinis ({routes.length})</span>
          </h2>
          {userRole !== 'viewer' && (
            <button
              onClick={() => setShowAddRoute(!showAddRoute)}
              className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-1.5 text-xs font-black uppercase tracking-wider transition"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau Trajet</span>
            </button>
          )}
        </div>

        {/* Modal / Form Add Route */}
        {showAddRoute && (
          <form onSubmit={handleCreateRoute} className="bg-slate-50 p-4 border border-indigo-300 space-y-3">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Ajouter un nouveau trajet prédéfini (Simple ou Multi-Étapes)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                  Site de Départ*
                </label>
                <select
                  value={depSiteId}
                  onChange={(e) => setDepSiteId(e.target.value)}
                  className="w-full text-xs font-bold p-2 bg-white border border-slate-300 focus:outline-none focus:border-blue-600"
                >
                  <option value="">Sélectionner départ...</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                  Site d Arrivée*
                </label>
                <select
                  value={arrSiteId}
                  onChange={(e) => setArrSiteId(e.target.value)}
                  className="w-full text-xs font-bold p-2 bg-white border border-slate-300 focus:outline-none focus:border-blue-600"
                >
                  <option value="">Sélectionner arrivée...</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                  Nom du Trajet (Facultatif)
                </label>
                <input
                  type="text"
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="ex: Port Goulette > STAFIM > Charguia"
                  className="w-full text-xs font-bold p-2 bg-white border border-slate-300 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {/* Waypoints / Intermediate Stops */}
            <div className="bg-white p-3 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-900">
                  Étapes Intermédiaires (Multi-Trajet)
                </span>
                <button
                  type="button"
                  onClick={() => setWaypoints([...waypoints, ''])}
                  className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black uppercase px-2 py-1 border border-indigo-200"
                >
                  + Ajouter une Escale / Etape
                </button>
              </div>

              {waypoints.length > 0 && (
                <div className="space-y-2 pt-1">
                  {waypoints.map((wp, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <span className="text-[10px] font-bold text-slate-400 font-mono w-16">
                        Escale #{idx + 1}
                      </span>
                      <select
                        value={wp}
                        onChange={(e) => {
                          const updated = [...waypoints];
                          updated[idx] = e.target.value;
                          setWaypoints(updated);
                        }}
                        className="flex-1 text-xs font-bold p-1.5 bg-slate-50 border border-slate-300"
                      >
                        <option value="">Sélectionner site escale...</option>
                        {sites.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setWaypoints(waypoints.filter((_, i) => i !== idx))}
                        className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddRoute(false);
                  setWaypoints([]);
                }}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 uppercase font-bold tracking-wider"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 text-xs bg-indigo-600 text-white font-black uppercase tracking-wider hover:bg-indigo-500"
              >
                Enregistrer le Trajet
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {routes.map((r) => {
            const depName = siteMap.get(r.departure_site_id) || 'Départ';
            const arrName = siteMap.get(r.arrival_site_id) || 'Arrivée';
            const waypointNames = (r.waypoints || []).map((wId) => siteMap.get(wId) || wId);
            const isMulti = waypointNames.length > 0;

            return (
              <div
                key={r.id}
                className={`p-4 bg-white border shadow-sm flex items-center justify-between text-xs hover:border-slate-400 transition ${
                  isMulti ? 'border-l-4 border-l-indigo-600 border-slate-200' : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-black text-slate-900 uppercase tracking-wider block">
                      {r.route_name}
                    </span>
                    {isMulti && (
                      <span className="text-[8px] bg-indigo-100 text-indigo-900 font-black uppercase px-1.5 py-0.5 border border-indigo-200">
                        Multi-Trajet ({waypointNames.length + 2} stops)
                      </span>
                    )}
                  </div>
                  <div className="text-slate-500 mt-1 flex flex-wrap items-center gap-1.5 font-bold uppercase text-[11px]">
                    <span className="text-slate-900 bg-slate-100 px-1.5 py-0.5">{depName}</span>
                    {waypointNames.map((wp, i) => (
                      <React.Fragment key={i}>
                        <span className="text-indigo-600">➔</span>
                        <span className="text-indigo-900 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5">
                          {wp}
                        </span>
                      </React.Fragment>
                    ))}
                    <span className="text-blue-600">➔</span>
                    <span className="text-blue-900 bg-blue-50 border border-blue-200 px-1.5 py-0.5">
                      {arrName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-[9px] bg-slate-100 text-slate-800 font-black uppercase tracking-widest px-2 py-0.5 border border-slate-300">
                    Actif
                  </span>
                  {userRole !== 'viewer' && (
                    <div className="flex items-center space-x-1 border-l border-slate-200 pl-2">
                      <button
                        onClick={() => handleStartEditRoute(r)}
                        title="Modifier le trajet"
                        className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition rounded"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingRoute(r)}
                        title="Supprimer le trajet"
                        className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-slate-100 transition rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL EDIT SITE */}
      {editingSite && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-900 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center space-x-2">
                <Pencil className="w-4 h-4 text-blue-600" />
                <span>Modifier le Site : {editingSite.name}</span>
              </h3>
              <button onClick={() => setEditingSite(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateSite} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                  Nom du Site*
                </label>
                <input
                  type="text"
                  required
                  value={editSiteName}
                  onChange={(e) => setEditSiteName(e.target.value)}
                  className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-300 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                  Type de Site*
                </label>
                <select
                  value={editSiteType}
                  onChange={(e: any) => setEditSiteType(e.target.value)}
                  className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-300 focus:outline-none focus:border-blue-600"
                >
                  <option value="port">Port Maritime</option>
                  <option value="park">Parc de Stockage</option>
                  <option value="warehouse">Entrepôt Couvert</option>
                  <option value="importer">Importateur / Concessionnaire</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                  Adresse / Zone
                </label>
                <input
                  type="text"
                  value={editSiteAddress}
                  onChange={(e) => setEditSiteAddress(e.target.value)}
                  className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-300 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingSite(null)}
                  className="px-4 py-2 text-xs text-slate-700 font-bold uppercase tracking-wider border border-slate-300 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-wider"
                >
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DELETE SITE CONFIRMATION */}
      {deletingSite && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-rose-600 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider">
                Confirmer la suppression
              </h3>
            </div>
            <p className="text-xs text-slate-700 font-medium">
              Voulez-vous vraiment supprimer le site <strong className="text-slate-900">{deletingSite.name}</strong> ? Cette action est irréversible.
            </p>
            <div className="flex justify-end space-x-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setDeletingSite(null)}
                className="px-4 py-2 text-xs text-slate-700 font-bold uppercase tracking-wider border border-slate-300 hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteSite}
                disabled={submitting}
                className="px-5 py-2 text-xs bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-wider"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT ROUTE */}
      {editingRoute && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-900 shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center space-x-2">
                <Pencil className="w-4 h-4 text-indigo-600" />
                <span>Modifier le Trajet Prédéfini</span>
              </h3>
              <button onClick={() => setEditingRoute(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateRoute} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                  Nom du Trajet
                </label>
                <input
                  type="text"
                  value={editRouteName}
                  onChange={(e) => setEditRouteName(e.target.value)}
                  className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-300 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                    Site de Départ*
                  </label>
                  <select
                    value={editDepSiteId}
                    onChange={(e) => setEditDepSiteId(e.target.value)}
                    className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-300"
                  >
                    <option value="">Sélectionner départ...</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                    Site d Arrivée*
                  </label>
                  <select
                    value={editArrSiteId}
                    onChange={(e) => setEditArrSiteId(e.target.value)}
                    className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-300"
                  >
                    <option value="">Sélectionner arrivée...</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Waypoints */}
              <div className="bg-slate-50 p-3 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-900">
                    Étapes Intermédiaires
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditWaypoints([...editWaypoints, ''])}
                    className="text-[10px] bg-indigo-100 hover:bg-indigo-200 text-indigo-900 font-black uppercase px-2 py-1 border border-indigo-300"
                  >
                    + Ajouter une Escale
                  </button>
                </div>

                {editWaypoints.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {editWaypoints.map((wp, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold text-slate-400 font-mono w-16">
                          Escale #{idx + 1}
                        </span>
                        <select
                          value={wp}
                          onChange={(e) => {
                            const updated = [...editWaypoints];
                            updated[idx] = e.target.value;
                            setEditWaypoints(updated);
                          }}
                          className="flex-1 text-xs font-bold p-1.5 bg-white border border-slate-300"
                        >
                          <option value="">Sélectionner site escale...</option>
                          {sites.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setEditWaypoints(editWaypoints.filter((_, i) => i !== idx))}
                          className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingRoute(null)}
                  className="px-4 py-2 text-xs text-slate-700 font-bold uppercase tracking-wider border border-slate-300 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-wider"
                >
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DELETE ROUTE CONFIRMATION */}
      {deletingRoute && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-rose-600 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider">
                Confirmer la suppression
              </h3>
            </div>
            <p className="text-xs text-slate-700 font-medium">
              Voulez-vous vraiment supprimer le trajet <strong className="text-slate-900">{deletingRoute.route_name}</strong> ? Cette action est irréversible.
            </p>
            <div className="flex justify-end space-x-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setDeletingRoute(null)}
                className="px-4 py-2 text-xs text-slate-700 font-bold uppercase tracking-wider border border-slate-300 hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteRoute}
                disabled={submitting}
                className="px-5 py-2 text-xs bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-wider"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CARRIERS / TRANSPORTEURS SECTION */}
      <div className="space-y-4 pt-6 border-t-2 border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Truck className="w-5 h-5 text-blue-600" />
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
              Transporteurs & Prestataires Logistiques ({carriers.length})
            </h2>
          </div>
          {userRole === 'admin' && (
            <button
              onClick={() => setShowAddCarrier(!showAddCarrier)}
              className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 text-xs font-black uppercase tracking-wider transition"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau Transporteur</span>
            </button>
          )}
        </div>

        {/* Add Carrier Form */}
        {showAddCarrier && (
          <form onSubmit={handleCreateCarrier} className="bg-blue-50/70 p-4 border border-blue-300 space-y-3">
            <h3 className="text-xs font-black text-blue-900 uppercase tracking-wider flex items-center space-x-1.5">
              <Truck className="w-4 h-4 text-blue-600" />
              <span>Ajouter un nouveau transporteur</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                  Raison Sociale / Société*
                </label>
                <input
                  type="text"
                  required
                  value={carrierRaisonSociale}
                  onChange={(e) => setCarrierRaisonSociale(e.target.value)}
                  placeholder="ex: STLT Transport & Logistics"
                  className="w-full text-xs font-bold p-2 bg-white border border-slate-300 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                  Nom du Chauffeur
                </label>
                <input
                  type="text"
                  value={carrierNomChauffeur}
                  onChange={(e) => setCarrierNomChauffeur(e.target.value)}
                  placeholder="ex: Mohamed Ben Ali"
                  className="w-full text-xs font-bold p-2 bg-white border border-slate-300 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                  Téléphone Chauffeur
                </label>
                <input
                  type="text"
                  value={carrierPhone}
                  onChange={(e) => setCarrierPhone(e.target.value)}
                  placeholder="ex: +216 98 123 456"
                  className="w-full text-xs font-bold p-2 bg-white border border-slate-300 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                  Matricule Camion / Porte-Voiture
                </label>
                <input
                  type="text"
                  value={carrierMatricule}
                  onChange={(e) => setCarrierMatricule(e.target.value)}
                  placeholder="ex: 123 TUN 456"
                  className="w-full text-xs font-bold p-2 bg-white border border-slate-300 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddCarrier(false)}
                className="px-3 py-1.5 text-xs text-slate-600 font-bold uppercase hover:bg-slate-200"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider"
              >
                Enregistrer Transporteur
              </button>
            </div>
          </form>
        )}

        {/* Carriers Table */}
        <div className="bg-white border-2 border-slate-200 overflow-x-auto shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white uppercase text-[10px] tracking-wider font-black">
                <th className="p-3 border-b border-slate-800">Société / Raison Sociale</th>
                <th className="p-3 border-b border-slate-800">Chauffeur</th>
                <th className="p-3 border-b border-slate-800">Téléphone</th>
                <th className="p-3 border-b border-slate-800">Matricule Camion</th>
                <th className="p-3 border-b border-slate-800">Statut</th>
                {userRole === 'admin' && <th className="p-3 border-b border-slate-800 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
              {carriers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500 italic">
                    Aucun transporteur enregistré.
                  </td>
                </tr>
              ) : (
                carriers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-3 font-black text-slate-900 uppercase flex items-center space-x-2">
                      <Truck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span>{c.raisonSociale}</span>
                    </td>
                    <td className="p-3">{c.nomChauffeur || '-'}</td>
                    <td className="p-3 font-mono">{c.telephone || '-'}</td>
                    <td className="p-3 font-mono font-bold text-slate-700">{c.matriculeCamion || '-'}</td>
                    <td className="p-3">
                      <button
                        onClick={() => userRole === 'admin' && handleToggleCarrierActive(c)}
                        disabled={userRole !== 'admin'}
                        className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-none ${
                          c.actif
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-slate-100 text-slate-500 border border-slate-300'
                        }`}
                      >
                        {c.actif ? 'Actif' : 'Inactif'}
                      </button>
                    </td>
                    {userRole === 'admin' && (
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleStartEditCarrier(c)}
                            className="p-1 text-slate-600 hover:text-blue-600 hover:bg-slate-100"
                            title="Modifier"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCarrier(c.id)}
                            className="p-1 text-slate-600 hover:text-rose-600 hover:bg-slate-100"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Carrier Modal */}
      {editingCarrier && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-900 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center space-x-2">
                <Truck className="w-4 h-4 text-blue-600" />
                <span>Modifier le Transporteur</span>
              </h3>
              <button onClick={() => setEditingCarrier(null)} className="text-slate-400 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateCarrier} className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                  Raison Sociale / Société*
                </label>
                <input
                  type="text"
                  required
                  value={editCarrierRaison}
                  onChange={(e) => setEditCarrierRaison(e.target.value)}
                  className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-300 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                    Nom du Chauffeur
                  </label>
                  <input
                    type="text"
                    value={editCarrierChauffeur}
                    onChange={(e) => setEditCarrierChauffeur(e.target.value)}
                    className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-300 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                    Téléphone
                  </label>
                  <input
                    type="text"
                    value={editCarrierPhone}
                    onChange={(e) => setEditCarrierPhone(e.target.value)}
                    className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-300 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                  Matricule Camion
                </label>
                <input
                  type="text"
                  value={editCarrierMatricule}
                  onChange={(e) => setEditCarrierMatricule(e.target.value)}
                  className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-300 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingCarrier(null)}
                  className="px-4 py-2 text-xs text-slate-700 font-bold uppercase tracking-wider border border-slate-300 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-wider"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
