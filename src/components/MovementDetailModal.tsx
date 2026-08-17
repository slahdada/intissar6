import React, { useState } from 'react';
import {
  X,
  Calendar,
  User,
  MapPin,
  Car,
  FileText,
  Printer,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Route as RouteIcon,
  Pencil,
  Trash2,
  AlertTriangle,
  Building2,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Plus,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { MovementWithDetails, Site, UserRole, MovementType } from '../types';
import { formatDateTime } from '../lib/dateUtils';
import { api } from '../lib/api';
import { generateMovementVoucherPDF } from '../lib/pdfVoucher';

interface MovementDetailModalProps {
  movement: MovementWithDetails | null;
  onClose: () => void;
  sites: Site[];
  onSelectVehicle?: (chassis: string) => void;
  userRole?: UserRole;
  onRefresh?: () => void;
}

export const MovementDetailModal: React.FC<MovementDetailModalProps> = ({
  movement,
  onClose,
  sites,
  onSelectVehicle,
  userRole,
  onRefresh,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedType, setEditedType] = useState<MovementType>('transfer');
  const [editedDepSite, setEditedDepSite] = useState('');
  const [editedArrSite, setEditedArrSite] = useState('');
  const [editedDestText, setEditedDestText] = useState('');
  const [editedWaypoints, setEditedWaypoints] = useState<string[]>([]);
  const [newWaypointId, setNewWaypointId] = useState('');
  const [editedNotes, setEditedNotes] = useState('');
  const [editedDate, setEditedDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!movement) return null;

  const handleStartEdit = () => {
    setEditedType(movement.movement_type);
    setEditedDepSite(movement.departure_site_id || '');
    setEditedArrSite(movement.arrival_site_id || '');
    setEditedDestText(movement.destination_text || '');
    setEditedWaypoints(movement.waypoints || []);
    setEditedNotes(movement.notes || '');
    const d = new Date(movement.movement_date);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localIso = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    setEditedDate(localIso);
    setIsEditing(true);
  };

  const handleAddWaypoint = () => {
    if (!newWaypointId) return;
    setEditedWaypoints((prev) => [...prev, newWaypointId]);
    setNewWaypointId('');
  };

  const handleRemoveWaypoint = (index: number) => {
    setEditedWaypoints((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveWaypoint = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === editedWaypoints.length - 1)
    ) {
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...editedWaypoints];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setEditedWaypoints(updated);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (editedType === 'transfer') {
      if (!editedDepSite) {
        setError('Veuillez sélectionner le site de départ pour un transfert.');
        return;
      }
      if (!editedArrSite) {
        setError('Veuillez sélectionner le site d arrivée pour un transfert.');
        return;
      }
      if (editedDepSite === editedArrSite) {
        setError('Le site de départ et le site d arrivée doivent être différents.');
        return;
      }
    } else if (editedType === 'entry' && !editedArrSite) {
      setError('Veuillez sélectionner le site de réception.');
      return;
    } else if (editedType === 'exit' && !editedDepSite) {
      setError('Veuillez sélectionner le site d expédition.');
      return;
    }

    setSubmitting(true);
    try {
      await api.updateMovement(movement.id, {
        movement_type: editedType,
        departure_site_id: editedType === 'entry' ? null : (editedDepSite || null),
        arrival_site_id: editedType === 'exit' ? null : (editedArrSite || null),
        destination_text: editedType === 'exit' ? editedDestText : (editedType === 'entry' ? 'Entrée en stock' : ''),
        waypoints: editedWaypoints,
        movement_date: new Date(editedDate).toISOString(),
        notes: editedNotes.trim(),
      });
      setIsEditing(false);
      if (onRefresh) onRefresh();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour du mouvement.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await api.deleteMovement(movement.id);
      setShowDeleteConfirm(false);
      if (onRefresh) onRefresh();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression du mouvement.');
    } finally {
      setSubmitting(false);
    }
  };

  const siteMap = new Map<string, string>();
  sites.forEach((s) => siteMap.set(s.id, s.name));

  const chassis = movement.vehicle_chassis || movement.chassis_number || 'N/A';
  const depName = movement.departure_site_id
    ? siteMap.get(movement.departure_site_id) || movement.departure_site_name
    : null;
  const arrName = movement.arrival_site_id
    ? siteMap.get(movement.arrival_site_id) || movement.arrival_site_name
    : movement.destination_text || null;

  const waypoints = movement.waypoints || [];
  const waypointNames = waypoints.map((wId) => siteMap.get(wId) || wId);

  const getMovementBadge = (type: string) => {
    switch (type) {
      case 'entry':
        return (
          <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black uppercase tracking-wider px-3 py-1 inline-flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span>Entrée en parc</span>
          </span>
        );
      case 'transfer':
        return (
          <span className="bg-blue-100 text-blue-900 border border-blue-300 text-xs font-black uppercase tracking-wider px-3 py-1 inline-flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <span>Transfert Inter-Sites</span>
          </span>
        );
      case 'exit':
        return (
          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black uppercase tracking-wider px-3 py-1 inline-flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-600" />
            <span>Sortie / Livraison Client</span>
          </span>
        );
      default:
        return (
          <span className="bg-slate-100 text-slate-800 border border-slate-300 text-xs font-black uppercase tracking-wider px-3 py-1">
            {type}
          </span>
        );
    }
  };

  const handlePrintSlip = () => {
    if (movement) {
      generateMovementVoucherPDF(movement, sites);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl border border-slate-300 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600 text-white shadow-inner">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-black uppercase tracking-widest text-white">
                  Fiche Détaillée du Mouvement
                </h2>
                <span className="text-[10px] font-mono font-bold bg-slate-800 text-slate-300 px-2 py-0.5 border border-slate-700">
                  #{movement.id}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                Logistique & Traçabilité des mouvements STAFIM
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Status & Date Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 border border-slate-200">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                Type d'Opération
              </span>
              {getMovementBadge(movement.movement_type)}
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                Horodatage Officiel
              </span>
              <div className="flex items-center space-x-1.5 text-xs font-mono font-bold text-slate-900 bg-white px-3 py-1 border border-slate-300">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  {formatDateTime(movement.movement_date)}
                </span>
              </div>
            </div>
          </div>

          {/* Vehicle Information Box */}
          <div className="bg-white border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center space-x-2">
                <Car className="w-4 h-4 text-blue-600" />
                <span>Véhicule Concerné</span>
              </h3>
              {onSelectVehicle && chassis !== 'N/A' && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectVehicle(chassis);
                  }}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-black uppercase tracking-wider hover:underline flex items-center space-x-1"
                >
                  <span>Consulter Fiche Stock</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  Numéro Châssis (VIN)
                </span>
                <span className="text-sm font-mono font-black text-slate-900 tracking-wider">
                  {chassis}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  Marque & Modèle
                </span>
                <span className="text-xs font-black text-slate-900 uppercase">
                  {movement.vehicle_brand || '-'} {movement.vehicle_model || ''}
                </span>
              </div>
            </div>
          </div>

          {/* Route & Trajet Visual Breakdown */}
          <div className="bg-white border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center space-x-2">
                <RouteIcon className="w-4 h-4 text-indigo-600" />
                <span>Détails du Trajet & Itinéraire</span>
              </h3>
              <div className="flex items-center space-x-2">
                {waypointNames.length > 0 && (
                  <span className="text-[9px] bg-indigo-100 text-indigo-900 font-black uppercase px-2 py-0.5 border border-indigo-200">
                    Multi-Trajet ({waypointNames.length} escale{waypointNames.length > 1 ? 's' : ''})
                  </span>
                )}
                {userRole !== 'viewer' && (
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    className="flex items-center space-x-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold text-[10px] uppercase tracking-wider border border-indigo-300 transition"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Éditer Trajet & Itinéraire</span>
                  </button>
                )}
              </div>
            </div>

            {/* Pipeline Visual */}
            <div className="p-4 bg-slate-900 text-white space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 block">
                Chaîne d'Acheminement :
              </span>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase">
                <div className="bg-slate-800 text-slate-100 px-3 py-1.5 border border-slate-700 flex items-center space-x-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{depName || 'Origine Non Spécifiée'}</span>
                </div>

                {waypointNames.map((wp, i) => (
                  <React.Fragment key={i}>
                    <ArrowRight className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <div className="bg-indigo-950 text-indigo-200 border border-indigo-700 px-3 py-1.5 flex items-center space-x-1.5">
                      <span className="text-[9px] font-mono text-indigo-400 font-bold">#{i + 1}</span>
                      <span>{wp}</span>
                    </div>
                  </React.Fragment>
                ))}

                <ArrowRight className="w-4 h-4 text-blue-400 flex-shrink-0" />

                <div className="bg-blue-600 text-white px-3 py-1.5 shadow-sm flex items-center space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-200" />
                  <span>{arrName || 'Destination Non Spécifiée'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Operator & System Log */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-3.5 border border-slate-200">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                Opérateur Saisisseur
              </span>
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-900">
                <User className="w-4 h-4 text-slate-500" />
                <span>{movement.created_by_user_name || 'Opérateur Système'}</span>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 border border-slate-200">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
                Certificat de Traçabilité
              </span>
              <div className="flex items-center space-x-2 text-xs font-bold text-emerald-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Mouvement Confirmé & Enregistré</span>
              </div>
            </div>
          </div>

          {/* Notes & Observations */}
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-1">
              Notes & Remarques Logistiques
            </span>
            <div className="p-3.5 bg-slate-50 border border-slate-200 text-xs text-slate-800 italic font-mono min-h-[60px]">
              {movement.notes || 'Aucune remarque saisie pour ce mouvement.'}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-100 p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrintSlip}
              className="flex items-center space-x-1.5 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-black text-xs uppercase tracking-wider border border-slate-400 transition"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer Bon</span>
            </button>

            {userRole !== 'viewer' && (
              <>
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="flex items-center space-x-1 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold text-xs uppercase tracking-wider border border-blue-300 transition"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Modifier</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center space-x-1 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-900 font-bold text-xs uppercase tracking-wider border border-rose-300 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer</span>
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider shadow-sm transition"
          >
            Fermer
          </button>
        </div>
      </div>

      {/* EDIT MOVEMENT MODAL */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-900 shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center space-x-2">
                <Pencil className="w-4 h-4 text-blue-600" />
                <span>Modifier le Mouvement #{movement.id}</span>
              </h3>
              <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Type of Movement */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1">
                  Type de Mouvement *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditedType('entry')}
                    className={`py-2 px-2 text-xs font-bold uppercase border flex items-center justify-center space-x-1 ${
                      editedType === 'entry' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-slate-50 text-slate-700 border-slate-300'
                    }`}
                  >
                    <ArrowDownRight className="w-3.5 h-3.5" />
                    <span>Entrée</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditedType('transfer')}
                    className={`py-2 px-2 text-xs font-bold uppercase border flex items-center justify-center space-x-1 ${
                      editedType === 'transfer' ? 'bg-blue-600 text-white border-blue-700' : 'bg-slate-50 text-slate-700 border-slate-300'
                    }`}
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>Transfert</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditedType('exit')}
                    className={`py-2 px-2 text-xs font-bold uppercase border flex items-center justify-center space-x-1 ${
                      editedType === 'exit' ? 'bg-amber-600 text-white border-amber-700' : 'bg-slate-50 text-slate-700 border-slate-300'
                    }`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Sortie</span>
                  </button>
                </div>
              </div>

              {/* Sites */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {editedType !== 'entry' && (
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                      Site de Départ *
                    </label>
                    <select
                      value={editedDepSite}
                      onChange={(e) => setEditedDepSite(e.target.value)}
                      className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-300 focus:outline-none focus:border-blue-600"
                    >
                      <option value="">-- Sélectionner --</option>
                      {sites.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {editedType !== 'exit' && (
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                      Site d'Arrivée *
                    </label>
                    <select
                      value={editedArrSite}
                      onChange={(e) => setEditedArrSite(e.target.value)}
                      className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-300 focus:outline-none focus:border-blue-600"
                    >
                      <option value="">-- Sélectionner --</option>
                      {sites.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {editedType === 'exit' && (
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                      Destination Externe
                    </label>
                    <input
                      type="text"
                      value={editedDestText}
                      onChange={(e) => setEditedDestText(e.target.value)}
                      placeholder="Concessionnaire, Client..."
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                )}
              </div>

              {/* Escales & Waypoints */}
              <div className="border border-indigo-200 bg-indigo-50/50 p-3 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-indigo-900 block flex items-center justify-between">
                  <span>Escales Intermédiaires (Itinéraire)</span>
                  <span className="font-mono text-indigo-700">{editedWaypoints.length} escale(s)</span>
                </label>

                <div className="flex gap-2">
                  <select
                    value={newWaypointId}
                    onChange={(e) => setNewWaypointId(e.target.value)}
                    className="flex-1 text-xs font-bold p-2 bg-white border border-slate-300 focus:outline-none focus:border-indigo-600"
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
                    disabled={!newWaypointId}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider px-3 py-2 flex items-center space-x-1 disabled:opacity-50 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajouter</span>
                  </button>
                </div>

                {editedWaypoints.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {editedWaypoints.map((wId, idx) => {
                      const wName = siteMap.get(wId) || wId;
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-white border border-indigo-200 p-2 text-xs font-bold text-slate-800 shadow-2xs"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="bg-indigo-600 text-white text-[9px] font-mono px-1.5 py-0.5">
                              #{idx + 1}
                            </span>
                            <span className="uppercase text-slate-900">{wName}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => handleMoveWaypoint(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 hover:bg-indigo-100 text-indigo-700 disabled:opacity-30"
                              title="Monter"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveWaypoint(idx, 'down')}
                              disabled={idx === editedWaypoints.length - 1}
                              className="p-1 hover:bg-indigo-100 text-indigo-700 disabled:opacity-30"
                              title="Descendre"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveWaypoint(idx)}
                              className="p-1 text-rose-600 hover:bg-rose-100"
                              title="Supprimer cette escale"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                  Date et Heure du Mouvement *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={editedDate}
                  onChange={(e) => setEditedDate(e.target.value)}
                  className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-300 focus:outline-none focus:border-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                  Notes & Remarques Logistiques
                </label>
                <textarea
                  rows={2}
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  placeholder="Ex: Rectification de saisie..."
                  className="w-full text-xs font-medium p-2.5 bg-slate-50 border border-slate-300 focus:outline-none focus:border-blue-600"
                />
              </div>

              {error && (
                <div className="bg-rose-50 text-rose-800 p-2.5 text-xs font-bold border border-rose-200">
                  {error}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-xs text-slate-700 font-bold uppercase tracking-wider border border-slate-300 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-wider"
                >
                  {submitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MOVEMENT CONFIRMATION MODAL */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-rose-600 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider">
                Supprimer le Mouvement #{movement.id}
              </h3>
            </div>
            <p className="text-xs text-slate-700 font-medium">
              Voulez-vous vraiment supprimer cet enregistrement de mouvement d'historique ? Cette action est irréversible.
            </p>
            {error && (
              <div className="bg-rose-50 text-rose-800 p-2.5 text-xs font-bold border border-rose-200">
                {error}
              </div>
            )}
            <div className="flex justify-end space-x-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-xs text-slate-700 font-bold uppercase tracking-wider border border-slate-300 hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="px-5 py-2 text-xs bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-wider"
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
