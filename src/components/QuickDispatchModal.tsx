import React, { useState } from 'react';
import {
  X,
  Truck,
  User,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Send,
  FileText,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { Vehicle, Site, User as UserType } from '../types';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/dateUtils';

interface QuickDispatchModalProps {
  actionType: 'assign' | 'pickup' | 'deliver';
  vehicle?: Vehicle | null;
  vehicles: Vehicle[];
  sites: Site[];
  currentUser: UserType;
  onClose: () => void;
  onSuccess: () => void;
}

export const QuickDispatchModal: React.FC<QuickDispatchModalProps> = ({
  actionType,
  vehicle: initialVehicle,
  vehicles,
  sites,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(initialVehicle?.id || '');
  const [driverName, setDriverName] = useState(initialVehicle?.driver_name || '');
  const [driverPhone, setDriverPhone] = useState(initialVehicle?.driver_phone || '');
  const [truckPlate, setTruckPlate] = useState(initialVehicle?.truck_plate || '');
  const [transporterName, setTransporterName] = useState(initialVehicle?.carrier_name || 'Transporteur interne');
  const [deliveryNoteRef, setDeliveryNoteRef] = useState(initialVehicle?.delivery_note_ref || '');
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState(initialVehicle?.notes || '');
  const [hasReserves, setHasReserves] = useState(false);
  const [reserveNotes, setReserveNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetVehicle = vehicles.find((v) => v.id === selectedVehicleId) || initialVehicle;

  const handleVehicleSelect = (id: string) => {
    setSelectedVehicleId(id);
    const v = vehicles.find((veh) => veh.id === id);
    if (v) {
      setDriverName(v.driver_name || '');
      setDriverPhone(v.driver_phone || '');
      setTruckPlate(v.truck_plate || '');
      setTransporterName(v.carrier_name || 'Transporteur interne');
      setDeliveryNoteRef(v.delivery_note_ref || '');
    }
  };

  const getModalTitle = () => {
    switch (actionType) {
      case 'assign':
        return 'Affectation Chauffeur & Camion Porte-Voitures';
      case 'pickup':
        return 'Déclarer Enlèvement (Départ Transport)';
      case 'deliver':
        return 'Déclarer Arrivée / Livraison Véhicule';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetVehicle) {
      setError('Veuillez sélectionner un véhicule.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (actionType === 'assign') {
        if (!truckPlate.trim() && !driverName.trim()) {
          setError('Veuillez renseigner au moins le nom du chauffeur ou l immatriculation du camion.');
          setSubmitting(false);
          return;
        }

        // Update vehicle driver & truck
        await api.updateVehicle(targetVehicle.id, {
          driver_name: driverName.trim(),
          driver_phone: driverPhone.trim(),
          truck_plate: truckPlate.trim().toUpperCase(),
          carrier_name: transporterName.trim(),
          transport_notes: notes.trim(),
        });
      } else if (actionType === 'pickup') {
        if (!truckPlate.trim() || !driverName.trim()) {
          setError('Chauffeur et immatriculation camion obligatoires pour déclarer un enlèvement.');
          setSubmitting(false);
          return;
        }

        // Create movement record for pickup
        await api.createMovement({
          vehicle_id: targetVehicle.id,
          movement_type: 'transfer',
          movement_date: eventDate,
          departure_site_id: targetVehicle.current_site_id,
          arrival_site_id: targetVehicle.site_arrivee || null,
          destination_text: targetVehicle.site_arrivee ? `Dest: ${targetVehicle.site_arrivee}` : undefined,
          transporter_name: transporterName.trim(),
          driver_name: driverName.trim(),
          driver_phone: driverPhone.trim(),
          truck_plate: truckPlate.trim().toUpperCase(),
          delivery_note_ref: deliveryNoteRef.trim(),
          status_before: targetVehicle.status,
          status_after: 'en_transit',
          action_label: `Enlèvement effectué par ${driverName.trim()} (${truckPlate.trim().toUpperCase()})`,
          notes: notes.trim(),
          created_by_user_id: currentUser.id,
        });

        // Update vehicle status to en_transit
        await api.updateVehicle(targetVehicle.id, {
          status: 'en_transit',
          actual_pickup_date: eventDate,
          driver_name: driverName.trim(),
          driver_phone: driverPhone.trim(),
          truck_plate: truckPlate.trim().toUpperCase(),
          carrier_name: transporterName.trim(),
          delivery_note_ref: deliveryNoteRef.trim(),
        });
      } else if (actionType === 'deliver') {
        const finalNotes = hasReserves
          ? `[RÉSERVES À LA LIVRAISON: ${reserveNotes.trim()}] ${notes.trim()}`
          : notes.trim();

        // Create movement record for delivery
        await api.createMovement({
          vehicle_id: targetVehicle.id,
          movement_type: 'exit',
          movement_date: eventDate,
          departure_site_id: targetVehicle.current_site_id,
          arrival_site_id: targetVehicle.site_arrivee || null,
          transporter_name: transporterName.trim(),
          driver_name: driverName.trim(),
          driver_phone: driverPhone.trim(),
          truck_plate: truckPlate.trim().toUpperCase(),
          delivery_note_ref: deliveryNoteRef.trim(),
          status_before: targetVehicle.status,
          status_after: 'livre',
          action_label: `Livraison effectuée avec succès${hasReserves ? ' (avec réserves)' : ''}`,
          notes: finalNotes,
          created_by_user_id: currentUser.id,
        });

        // Update vehicle status to livre
        await api.updateVehicle(targetVehicle.id, {
          status: 'livre',
          reception_date: eventDate,
          is_delivered: true,
          delivery_note_ref: deliveryNoteRef.trim(),
          notes: finalNotes,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Une erreur est survenue lors de la mise à jour.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-300 shadow-2xl max-w-lg w-full rounded-none overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 bg-blue-600 flex items-center justify-center font-bold">
              <Truck className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-100">
                {getModalTitle()}
              </h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Agent Exploitation Transport
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Vehicle Selector */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
              Sélectionner le Véhicule (Châssis / VIN) <span className="text-rose-600">*</span>
            </label>
            <select
              value={selectedVehicleId}
              onChange={(e) => handleVehicleSelect(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold border border-slate-300 focus:ring-2 focus:ring-blue-600 bg-white"
            >
              <option value="">-- Choisir un véhicule en mission --</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.chassis_number} - {v.brand} {v.model} ({v.status.toUpperCase()}) - {v.site_depart || 'N/C'} ➔ {v.site_arrivee || 'N/C'}
                </option>
              ))}
            </select>
          </div>

          {targetVehicle && (
            <div className="p-3 bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between font-bold text-slate-900">
                <span>{targetVehicle.brand} {targetVehicle.model} ({targetVehicle.color || 'N/C'})</span>
                <span className="font-mono text-blue-700">{targetVehicle.chassis_number}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>Origine: {targetVehicle.site_depart || 'Port La Goulette'}</span>
                <span>Destination: {targetVehicle.site_arrivee || 'Dépôt / Client'}</span>
              </div>
            </div>
          )}

          {/* Transport Details */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                Chauffeur <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="ex: Ali Ben Mabrouk"
                className="w-full px-3 py-2 text-xs font-bold border border-slate-300 focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                Matricule Camion Porte-Voitures <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={truckPlate}
                onChange={(e) => setTruckPlate(e.target.value)}
                placeholder="ex: 185 TUN 9876"
                className="w-full px-3 py-2 text-xs font-bold font-mono border border-slate-300 focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                Téléphone Chauffeur
              </label>
              <input
                type="text"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                placeholder="ex: 98 123 456"
                className="w-full px-3 py-2 text-xs font-bold border border-slate-300 focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                Ref BL / Ordre de Transport
              </label>
              <input
                type="text"
                value={deliveryNoteRef}
                onChange={(e) => setDeliveryNoteRef(e.target.value)}
                placeholder="ex: OT-2026-889"
                className="w-full px-3 py-2 text-xs font-bold font-mono border border-slate-300 focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {actionType !== 'assign' && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                Date &amp; Heure de l'opération
              </label>
              <input
                type="datetime-local"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold border border-slate-300 focus:ring-2 focus:ring-blue-600"
              />
            </div>
          )}

          {actionType === 'deliver' && (
            <div className="p-3 bg-amber-50/60 border border-amber-200 space-y-2">
              <label className="flex items-center space-x-2 text-xs font-bold text-amber-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasReserves}
                  onChange={(e) => setHasReserves(e.target.checked)}
                  className="rounded-none border-amber-400 text-amber-600 focus:ring-amber-500"
                />
                <span>Déclarer des réserves / dommages à la livraison</span>
              </label>

              {hasReserves && (
                <textarea
                  value={reserveNotes}
                  onChange={(e) => setReserveNotes(e.target.value)}
                  placeholder="Décrire les réserves (rayures, impact pare-brise, manque clé...)"
                  rows={2}
                  className="w-full px-3 py-2 text-xs font-bold border border-amber-300 focus:ring-2 focus:ring-amber-500 bg-white"
                />
              )}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
              Observations / Notes Terrain
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instructions ou détails spécifiques transport..."
              className="w-full px-3 py-2 text-xs font-bold border border-slate-300 focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold border border-slate-300 hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider flex items-center space-x-2 shadow-sm disabled:opacity-50"
            >
              {submitting ? (
                <span>Enregistrement...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmer la Mission</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
