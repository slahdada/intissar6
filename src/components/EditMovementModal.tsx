import React, { useState, useEffect } from 'react';
import {
  X,
  Pencil,
  Calendar,
  Building2,
  FileText,
  AlertCircle,
  Save,
  ArrowRight,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  CheckCircle2,
  Route as RouteIcon,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  MapPin,
} from 'lucide-react';
import { MovementWithDetails, Site, MovementType, User } from '../types';
import { api } from '../lib/api';
import { canEditBusinessDate } from '../lib/permissions';
import { logDateChange } from '../lib/auditLogger';

interface EditMovementModalProps {
  movement: MovementWithDetails | null;
  sites: Site[];
  currentUser?: User;
  onClose: () => void;
  onRefresh: () => void;
}

export const EditMovementModal: React.FC<EditMovementModalProps> = ({
  movement,
  sites,
  currentUser,
  onClose,
  onRefresh,
}) => {
  const [movementType, setMovementType] = useState<MovementType>('transfer');
  const [departureSiteId, setDepartureSiteId] = useState('');
  const [arrivalSiteId, setArrivalSiteId] = useState('');
  const [destinationText, setDestinationText] = useState('');
  const [waypoints, setWaypoints] = useState<string[]>([]);
  const [newWaypointSiteId, setNewWaypointSiteId] = useState('');
  const [movementDate, setMovementDate] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const siteMap = new Map<string, string>();
  sites.forEach((s) => siteMap.set(s.id, s.name));

  useEffect(() => {
    if (movement) {
      setMovementType(movement.movement_type);
      setDepartureSiteId(movement.departure_site_id || '');
      setArrivalSiteId(movement.arrival_site_id || '');
      setDestinationText(movement.destination_text || '');
      setWaypoints(movement.waypoints || []);
      setNotes(movement.notes || '');

      // Format ISO string for datetime-local (YYYY-MM-DDTHH:mm)
      try {
        const d = new Date(movement.movement_date);
        const tzOffset = d.getTimezoneOffset() * 60000;
        const localIso = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
        setMovementDate(localIso);
      } catch {
        setMovementDate('');
      }
      setError(null);
      setSuccess(false);
    }
  }, [movement]);

  if (!movement) return null;

  const handleAddWaypoint = () => {
    if (!newWaypointSiteId) return;
    setWaypoints((prev) => [...prev, newWaypointSiteId]);
    setNewWaypointSiteId('');
  };

  const handleRemoveWaypoint = (index: number) => {
    setWaypoints((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveWaypoint = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === waypoints.length - 1)
    ) {
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...waypoints];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setWaypoints(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validation
    if (movementType === 'transfer') {
      if (!departureSiteId) {
        setError('Veuillez sélectionner le site de départ pour un transfert.');
        return;
      }
      if (!arrivalSiteId) {
        setError('Veuillez sélectionner le site d arrivée pour un transfert.');
        return;
      }
      if (departureSiteId === arrivalSiteId) {
        setError('Le site de départ et le site d arrivée doivent être différents.');
        return;
      }
    } else if (movementType === 'entry') {
      if (!arrivalSiteId) {
        setError('Veuillez sélectionner le site de réception / arrivée.');
        return;
      }
    } else if (movementType === 'exit') {
      if (!departureSiteId) {
        setError('Veuillez sélectionner le site d expédition / départ.');
        return;
      }
    }

    if (!movementDate) {
      setError('Veuillez spécifier la date et l heure du mouvement.');
      return;
    }

    setLoading(true);

    const canEditDate = canEditBusinessDate(currentUser);

    try {
      const formattedDate = new Date(movementDate).toISOString();
      const oldDate = movement.movement_date;

      await api.updateMovement(movement.id, {
        movement_type: movementType,
        departure_site_id: movementType === 'entry' ? null : (departureSiteId || null),
        arrival_site_id: movementType === 'exit' ? null : (arrivalSiteId || null),
        destination_text: movementType === 'exit' ? destinationText : (movementType === 'entry' ? 'Entrée en stock' : ''),
        waypoints: waypoints,
        movement_date: formattedDate,
        notes: notes.trim(),
      });

      if (canEditDate && currentUser && oldDate !== formattedDate) {
        logDateChange({
          currentUser,
          module: 'Historique Mouvements',
          entity_id: movement.vehicle_chassis || movement.chassis_number || movement.id,
          entity_label: `${movement.vehicle_brand || ''} ${movement.vehicle_model || ''} (${movement.vehicle_chassis || movement.chassis_number || movement.id})`,
          field_name: "Date et heure du mouvement (movement_date)",
          old_value: oldDate,
          new_value: formattedDate,
        });
      }

      setSuccess(true);
      setTimeout(() => {
        onRefresh();
        onClose();
      }, 500);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la modification du mouvement.');
    } finally {
      setLoading(false);
    }
  };

  const chassis = movement.vehicle_chassis || movement.chassis_number || 'N/A';
  const depName = departureSiteId ? siteMap.get(departureSiteId) : (movementType === 'entry' ? 'Port / Navire' : 'Non spécifié');
  const arrName = arrivalSiteId ? siteMap.get(arrivalSiteId) : (movementType === 'exit' ? (destinationText || 'Destination Externe') : 'Non spécifié');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl border-t-4 border-blue-600 shadow-2xl overflow-hidden my-8 animate-in fade-in duration-200">
        {/* Header */}
        <div className="bg-slate-900 p-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Pencil className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider">
                Éditer Détails du Trajet & Mouvement
              </h2>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                Châssis : <strong className="text-white">{chassis}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-600 p-3 flex items-start space-x-2 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border-l-4 border-emerald-600 p-3 flex items-center space-x-2 text-xs text-emerald-800 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Mouvement & trajet modifiés avec succès ! Mise à jour...</span>
            </div>
          )}

          {/* Vehicle summary banner */}
          <div className="bg-slate-50 border border-slate-200 p-3 flex items-center justify-between text-xs font-mono text-slate-700">
            <div>
              <span className="text-[10px] text-slate-400 block font-sans font-black uppercase">Véhicule</span>
              <strong className="text-slate-900 font-bold">{movement.vehicle_brand} {movement.vehicle_model}</strong>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-sans font-black uppercase">Saisie Par</span>
              <span>{movement.created_by_user_name || 'Agent'}</span>
            </div>
          </div>

          {/* Type of Movement */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-2">
              Type de Mouvement <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMovementType('entry')}
                className={`py-2 px-3 text-xs font-bold uppercase tracking-wider border flex items-center justify-center space-x-1.5 transition ${
                  movementType === 'entry'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <ArrowDownRight className="w-4 h-4" />
                <span>Entrée Port</span>
              </button>

              <button
                type="button"
                onClick={() => setMovementType('transfer')}
                className={`py-2 px-3 text-xs font-bold uppercase tracking-wider border flex items-center justify-center space-x-1.5 transition ${
                  movementType === 'transfer'
                    ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>Transfert</span>
              </button>

              <button
                type="button"
                onClick={() => setMovementType('exit')}
                className={`py-2 px-3 text-xs font-bold uppercase tracking-wider border flex items-center justify-center space-x-1.5 transition ${
                  movementType === 'exit'
                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Sortie</span>
              </button>
            </div>
          </div>

          {/* Trajet & Itinéraire Card */}
          <div className="bg-slate-50 border border-slate-300 p-4 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center space-x-2 border-b border-slate-200 pb-2">
              <RouteIcon className="w-4 h-4 text-indigo-600" />
              <span>Détails du Trajet (Origine, Escales, Destination)</span>
            </h3>

            {/* Sites & Locations Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Departure Site */}
              {movementType !== 'entry' && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1">
                    Site de Départ (Origine) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select
                      value={departureSiteId}
                      onChange={(e) => setDepartureSiteId(e.target.value)}
                      className="w-full bg-white border border-slate-300 text-slate-800 text-xs pl-9 pr-3 py-2.5 focus:outline-none focus:border-blue-600 font-bold"
                    >
                      <option value="">-- Sélectionner le site de départ --</option>
                      {sites.map((site) => (
                        <option key={site.id} value={site.id}>
                          {site.name} ({site.type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Arrival Site */}
              {movementType !== 'exit' && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1">
                    Site d'Arrivée (Destination) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select
                      value={arrivalSiteId}
                      onChange={(e) => setArrivalSiteId(e.target.value)}
                      className="w-full bg-white border border-slate-300 text-slate-800 text-xs pl-9 pr-3 py-2.5 focus:outline-none focus:border-blue-600 font-bold"
                    >
                      <option value="">-- Sélectionner le site d arrivée --</option>
                      {sites.map((site) => (
                        <option key={site.id} value={site.id}>
                          {site.name} ({site.type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* External Destination for Exit */}
              {movementType === 'exit' && (
                <div className={movementType === 'exit' ? 'sm:col-span-1' : ''}>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1">
                    Destination Externe / Concessionnaire
                  </label>
                  <input
                    type="text"
                    value={destinationText}
                    onChange={(e) => setDestinationText(e.target.value)}
                    placeholder="Ex: Client Final, Concessionnaire Sfax..."
                    className="w-full bg-white border border-slate-300 text-slate-800 text-xs px-3 py-2.5 focus:outline-none focus:border-blue-600"
                  />
                </div>
              )}
            </div>

            {/* Escales Intermédiaires (Waypoints) */}
            <div className="pt-2 border-t border-slate-200">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1.5 flex items-center justify-between">
                <span>Escales Intermédiaires (Multi-Trajets)</span>
                <span className="text-indigo-600 font-mono text-[9px]">
                  {waypoints.length} escale{waypoints.length > 1 ? 's' : ''} définie{waypoints.length > 1 ? 's' : ''}
                </span>
              </label>

              {/* Add Escale control */}
              <div className="flex gap-2 mb-3">
                <select
                  value={newWaypointSiteId}
                  onChange={(e) => setNewWaypointSiteId(e.target.value)}
                  className="flex-1 bg-white border border-slate-300 text-xs font-bold text-slate-800 p-2 focus:outline-none focus:border-indigo-600"
                >
                  <option value="">-- Ajouter un site d'escale --</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.type})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddWaypoint}
                  disabled={!newWaypointSiteId}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider px-3 py-2 flex items-center space-x-1 disabled:opacity-50 transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ajouter Escale</span>
                </button>
              </div>

              {/* Waypoints list */}
              {waypoints.length > 0 ? (
                <div className="space-y-1.5 bg-white p-2 border border-slate-200">
                  {waypoints.map((wId, idx) => {
                    const wName = siteMap.get(wId) || wId;
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-indigo-50/70 border border-indigo-200 p-2 text-xs font-bold text-slate-800"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="bg-indigo-600 text-white text-[9px] font-mono px-1.5 py-0.5 rounded-xs">
                            #{idx + 1}
                          </span>
                          <span className="uppercase text-indigo-950">{wName}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleMoveWaypoint(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 hover:bg-indigo-200 text-indigo-700 disabled:opacity-30"
                            title="Monter"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveWaypoint(idx, 'down')}
                            disabled={idx === waypoints.length - 1}
                            className="p-1 hover:bg-indigo-200 text-indigo-700 disabled:opacity-30"
                            title="Descendre"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveWaypoint(idx)}
                            className="p-1 text-red-600 hover:bg-red-100"
                            title="Supprimer cette escale"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic">
                  Aucune escale intermédiaire ajoutée. Le trajet s'effectue directement de l'origine vers la destination.
                </p>
              )}
            </div>

            {/* Live Pipeline Preview */}
            <div className="p-3 bg-slate-900 text-white space-y-2 border border-slate-800">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 block">
                Aperçu de la Chaîne d'Acheminement :
              </span>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold uppercase">
                <div className="bg-slate-800 text-slate-100 px-2.5 py-1 border border-slate-700 flex items-center space-x-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>{depName}</span>
                </div>

                {waypoints.map((wId, i) => (
                  <React.Fragment key={i}>
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
                    <div className="bg-indigo-950 text-indigo-200 border border-indigo-700 px-2.5 py-1 flex items-center space-x-1">
                      <span className="text-[9px] font-mono text-indigo-400 font-bold">#{i + 1}</span>
                      <span>{siteMap.get(wId) || wId}</span>
                    </div>
                  </React.Fragment>
                ))}

                <ArrowRight className="w-3.5 h-3.5 text-blue-400" />

                <div className="bg-blue-600 text-white px-2.5 py-1 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3 text-blue-200" />
                  <span>{arrName}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Date & Time */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1">
              Date & Heure du Mouvement <span className="text-red-500">*</span>
            </label>
            {canEditBusinessDate(currentUser) ? (
              <div className="relative">
                <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-amber-600 pointer-events-none" />
                <input
                  type="datetime-local"
                  value={movementDate}
                  onChange={(e) => setMovementDate(e.target.value)}
                  className="w-full bg-white border-2 border-amber-400 text-slate-900 text-xs pl-9 pr-3 py-2.5 font-mono font-bold focus:outline-none focus:border-amber-600 shadow-xs"
                  required
                />
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="datetime-local"
                    value={movementDate}
                    disabled
                    readOnly
                    className="w-full bg-slate-100 border border-slate-300 text-slate-500 text-xs pl-9 pr-3 py-2.5 font-mono font-bold cursor-not-allowed opacity-80"
                  />
                </div>
                <span className="text-[9px] font-bold text-slate-500 block mt-0.5">
                  🔒 Modifiable uniquement par Ayari Intissar (Administrateur)
                </span>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1">
              Notes & Remarques (Optionnel)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Rectification de saisie, motif de changement, observations..."
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs p-3 focus:outline-none focus:border-blue-600"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold uppercase tracking-wider transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Enregistrement...' : 'Enregistrer le Trajet'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

