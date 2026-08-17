import React, { useState } from 'react';
import {
  X,
  Truck,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Car,
  User as UserIcon,
  FileText,
  Building2,
  Layers,
  RefreshCw,
  Check,
} from 'lucide-react';
import { Vehicle, Site, MovementType, User as UserType } from '../types';
import { api } from '../lib/api';

interface BatchMovementModalProps {
  selectedVehicles: Vehicle[];
  sites: Site[];
  currentUser?: UserType;
  onClose: () => void;
  onSuccess: (count: number, destinationSiteName: string) => void;
}

export const BatchMovementModal: React.FC<BatchMovementModalProps> = ({
  selectedVehicles: initialSelectedVehicles,
  sites,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const [vehiclesList, setVehiclesList] = useState<Vehicle[]>(initialSelectedVehicles);
  const [movementType, setMovementType] = useState<MovementType>('transfer');
  const [targetSiteId, setTargetSiteId] = useState<string>('');
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 16));

  // Transport information
  const [transporterName, setTransporterName] = useState('Transporteur Interne');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [truckPlate, setTruckPlate] = useState('');
  const [deliveryNoteRef, setDeliveryNoteRef] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const targetSite = sites.find((s) => s.id === targetSiteId);

  const handleRemoveVehicleFromList = (vehicleId: string) => {
    const updated = vehiclesList.filter((v) => v.id !== vehicleId);
    setVehiclesList(updated);
    if (updated.length === 0) {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (vehiclesList.length === 0) {
      setError('Aucun véhicule n est sélectionné.');
      return;
    }

    if (movementType === 'transfer' && !targetSiteId) {
      setError('Veuillez choisir le nouveau site de destination pour le transfert groupé.');
      return;
    }

    if (movementType === 'entry' && !targetSiteId) {
      setError('Veuillez choisir le site d arrivée pour l entrée groupée.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setProgressIndex(0);

    let successCount = 0;

    try {
      for (let i = 0; i < vehiclesList.length; i++) {
        const vehicle = vehiclesList[i];
        setProgressIndex(i + 1);

        const departureSiteId = vehicle.current_site_id || null;
        const arrivalSiteId = movementType === 'exit' ? (vehicle.current_site_id || null) : (targetSiteId || null);

        // 1. Create movement record
        await api.createMovement({
          vehicle_id: vehicle.id,
          movement_type: movementType,
          movement_date: eventDate,
          departure_site_id: departureSiteId,
          arrival_site_id: arrivalSiteId,
          destination_text: targetSite ? `Mouvement groupé vers : ${targetSite.name}` : undefined,
          transporter_name: transporterName.trim(),
          driver_name: driverName.trim(),
          driver_phone: driverPhone.trim(),
          truck_plate: truckPlate.trim().toUpperCase(),
          delivery_note_ref: deliveryNoteRef.trim(),
          status_before: vehicle.status,
          status_after: movementType === 'transfer' ? 'en_stock' : movementType === 'exit' ? 'livre' : 'en_stock',
          action_label: `Transfert groupé (${vehiclesList.length} véhicules) ➔ ${targetSite?.name || 'Nouveau site'}`,
          notes: notes.trim()
            ? `[Mouvement Groupé - ${vehiclesList.length} véhi.] ${notes.trim()}`
            : `Mouvement groupé de ${vehiclesList.length} véhicules vers ${targetSite?.name || 'Nouveau site'}.`,
          created_by_user_id: currentUser?.id || 'usr_admin',
        });

        // 2. Update vehicle location & transport info
        if (movementType === 'transfer' && targetSiteId) {
          await api.updateVehicle(vehicle.id, {
            current_site_id: targetSiteId,
            status: 'en_stock',
            driver_name: driverName.trim() || undefined,
            driver_phone: driverPhone.trim() || undefined,
            truck_plate: truckPlate.trim().toUpperCase() || undefined,
            carrier_name: transporterName.trim() || undefined,
            delivery_note_ref: deliveryNoteRef.trim() || undefined,
          });
        } else if (movementType === 'exit') {
          await api.updateVehicle(vehicle.id, {
            status: 'livre',
            reception_date: eventDate,
            is_delivered: true,
            delivery_note_ref: deliveryNoteRef.trim() || undefined,
          });
        } else if (movementType === 'entry' && targetSiteId) {
          await api.updateVehicle(vehicle.id, {
            current_site_id: targetSiteId,
            status: 'en_stock',
          });
        }

        successCount++;
      }

      const destName = targetSite ? targetSite.name : 'Nouveau site';
      onSuccess(successCount, destName);
      onClose();
    } catch (err: any) {
      console.error('Error during batch movement:', err);
      setError(
        err?.message || `Erreur lors du traitement du véhicule ${progressIndex}/${vehiclesList.length}.`
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border-2 border-slate-900 shadow-2xl max-w-2xl w-full rounded-none overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-blue-600 flex items-center justify-center font-bold text-white shadow-sm">
              <Layers className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center space-x-2">
                <span>Déclaration de Mouvement Groupé</span>
                <span className="bg-amber-400 text-slate-950 text-[10px] px-2 py-0.5 font-mono font-black">
                  {vehiclesList.length} véhicules
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">
                Déplacement simultané vers un nouveau site / parc de destination
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 transition font-bold"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border-l-4 border-rose-600 text-rose-900 text-xs font-bold flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Selected Vehicles List Preview */}
          <div className="bg-slate-50 border border-slate-200 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <Car className="w-4 h-4 text-blue-600" />
                <span>Véhicules inclus dans le lot ({vehiclesList.length})</span>
              </label>
              <span className="text-[10px] text-slate-500 font-semibold">
                Cliquez sur ✕ pour retirer un véhicule
              </span>
            </div>

            <div className="max-h-36 overflow-y-auto space-y-1 pr-1 border border-slate-200 bg-white p-2">
              {vehiclesList.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between text-xs py-1 px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800"
                >
                  <div className="flex items-center space-x-2 font-mono font-bold text-slate-900">
                    <span className="bg-slate-800 text-white text-[10px] px-1.5 py-0.2">
                      {v.brand} {v.model}
                    </span>
                    <span className="text-blue-700">{v.chassis_number || v.vin}</span>
                    {v.color && <span className="text-slate-500 font-normal">({v.color})</span>}
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-[10px] font-medium text-slate-600 bg-slate-200 px-1.5 py-0.5">
                      Site actuel : {sites.find((s) => s.id === v.current_site_id)?.name || 'Stock / Inconnu'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveVehicleFromList(v.id)}
                      className="text-slate-400 hover:text-rose-600 font-black px-1"
                      title="Retirer du lot"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Movement Type & Destination Site */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Movement Type */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                Type de Mouvement <span className="text-rose-600">*</span>
              </label>
              <select
                value={movementType}
                onChange={(e) => setMovementType(e.target.value as MovementType)}
                className="w-full px-3 py-2 text-xs font-bold border border-slate-300 focus:ring-2 focus:ring-blue-600 bg-white text-slate-900"
              >
                <option value="transfer">Transfert Inter-Sites (Changement de Site)</option>
                <option value="exit">Sortie du Stock / Livraison Groupée</option>
                <option value="entry">Entrée en Stock Groupée</option>
              </select>
            </div>

            {/* Target Site */}
            {movementType !== 'exit' && (
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1 flex items-center space-x-1">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Nouveau Site de Destination <span className="text-rose-600">*</span></span>
                </label>
                <select
                  value={targetSiteId}
                  onChange={(e) => setTargetSiteId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold border-2 border-blue-600 focus:ring-2 focus:ring-blue-600 bg-blue-50 text-slate-900"
                >
                  <option value="">-- Sélectionner le nouveau site --</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.type.toUpperCase()}) - {s.address || 'Tunisie'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {movementType === 'exit' && (
              <div className="bg-amber-50 p-2.5 border border-amber-200 text-xs text-amber-900 font-medium flex items-center space-x-2">
                <Truck className="w-5 h-5 text-amber-600 shrink-0" />
                <span>
                  Les <strong>{vehiclesList.length} véhicules</strong> sélectionnés passeront en statut{' '}
                  <strong className="uppercase font-bold">Livré (Sorti du stock)</strong>.
                </span>
              </div>
            )}
          </div>

          {/* Date & Time of Movement */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1 flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>Date &amp; Heure du Transfert Groupé</span>
            </label>
            <input
              type="datetime-local"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold border border-slate-300 focus:ring-2 focus:ring-blue-600 text-slate-900"
            />
          </div>

          {/* Transport & Driver Details */}
          <div className="border-t border-slate-200 pt-3 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center space-x-1.5">
              <Truck className="w-4 h-4 text-blue-600" />
              <span>Informations Transporteur &amp; Chauffeur (Optionnel)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                  Société de Transport
                </label>
                <input
                  type="text"
                  value={transporterName}
                  onChange={(e) => setTransporterName(e.target.value)}
                  placeholder="ex: STAFIM Logistics / Trans-Auto"
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-300 focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                  Nom du Chauffeur Porte-Voitures
                </label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="ex: Mohamed Triki"
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-300 focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                  Matricule Camion / Remorque
                </label>
                <input
                  type="text"
                  value={truckPlate}
                  onChange={(e) => setTruckPlate(e.target.value)}
                  placeholder="ex: 210 TUN 5432"
                  className="w-full px-3 py-2 text-xs font-bold font-mono border border-slate-300 focus:ring-2 focus:ring-blue-600 uppercase"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                  N° Bon de Livraison (BDL) / Ordre
                </label>
                <input
                  type="text"
                  value={deliveryNoteRef}
                  onChange={(e) => setDeliveryNoteRef(e.target.value)}
                  placeholder="ex: BDL-2026-9901"
                  className="w-full px-3 py-2 text-xs font-bold font-mono border border-slate-300 focus:ring-2 focus:ring-blue-600 uppercase"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                Observations / Motif du Transfert
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Remarques complémentaires sur le convoyage groupé..."
                rows={2}
                className="w-full px-3 py-2 text-xs font-bold border border-slate-300 focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 shrink-0">
            <div className="text-xs text-slate-500 font-bold">
              {submitting ? (
                <span className="text-blue-600 flex items-center space-x-1.5">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Traitement : {progressIndex} / {vehiclesList.length}...</span>
                </span>
              ) : (
                <span>Prêt à traiter {vehiclesList.length} véhicule(s)</span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-xs font-bold border border-slate-300 hover:bg-slate-100 uppercase"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting || vehiclesList.length === 0}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider flex items-center space-x-2 shadow-md transition disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Enregistrement en cours...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-amber-300" />
                    <span>Valider le Mouvement Groupé ({vehiclesList.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
