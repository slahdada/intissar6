import React, { useState, useEffect } from 'react';
import {
  X,
  Car,
  Copy,
  Check,
  Building2,
  Calendar,
  History,
  ArrowRight,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownRight,
  Edit2,
  Save,
  PlusCircle,
  Clock,
  UserCheck,
  FileText,
  Route as RouteIcon,
  LogOut,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Receipt,
  DollarSign,
  FileCheck,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import { Vehicle, Movement, Site, VehicleStatus, UserRole, User } from '../types';
import { formatDateTime } from '../lib/dateUtils';
import { api } from '../lib/api';
import { saveStoredModel } from '../data/carCatalog';
import { canEditBusinessDate } from '../lib/permissions';
import { logDateChange } from '../lib/auditLogger';
import { getVehicleSoldedDetails } from '../lib/soldedUtils';

interface VehicleDetailModalProps {
  vehicleId: string;
  onClose: () => void;
  onDeclareMovementForVehicle: (vehicle: Vehicle) => void;
  sites: Site[];
  userRole: UserRole;
  currentUser?: User;
  onVehicleUpdated: () => void;
}

export const VehicleDetailModal: React.FC<VehicleDetailModalProps> = ({
  vehicleId,
  onClose,
  onDeclareMovementForVehicle,
  sites,
  userRole,
  currentUser,
  onVehicleUpdated,
}) => {
  const [vehicle, setVehicle] = useState<
    (Vehicle & { current_site_name: string; movements: Movement[] }) | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Full Vehicle Edit State
  const [isEditingVehicle, setIsEditingVehicle] = useState(false);
  const [editedChassis, setEditedChassis] = useState('');
  const [editedBrand, setEditedBrand] = useState('');
  const [editedModel, setEditedModel] = useState('');
  const [editedColor, setEditedColor] = useState('');
  const [editedSiteId, setEditedSiteId] = useState<string>('');
  const [editedStatus, setEditedStatus] = useState<VehicleStatus>('en_stock');
  const [editedArrivalDate, setEditedArrivalDate] = useState('');
  const [editedIsBilled, setEditedIsBilled] = useState(false);
  const [editedInvoiceNumber, setEditedInvoiceNumber] = useState('');
  const [editedIsPaid, setEditedIsPaid] = useState(false);
  const [editedPaidDate, setEditedPaidDate] = useState('');
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Permanent Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [submittingDelete, setSubmittingDelete] = useState(false);

  // Quick Site Edit State
  const [isEditingQuickSite, setIsEditingQuickSite] = useState(false);
  const [quickSiteId, setQuickSiteId] = useState<string>('');
  const [quickSiteSaving, setQuickSiteSaving] = useState(false);

  // Quick Date Edit State
  const [isEditingQuickDate, setIsEditingQuickDate] = useState(false);
  const [quickArrivalDate, setQuickArrivalDate] = useState('');
  const [quickDateSaving, setQuickDateSaving] = useState(false);

  const canEditDate = canEditBusinessDate(currentUser);

  // Sortie Définitive Vers Propriétaire State
  const [showExitProprietaire, setShowExitProprietaire] = useState(false);
  const [exitDestination, setExitDestination] = useState('Propriétaire / Client final');
  const [exitDate, setExitDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [exitNotes, setExitNotes] = useState('');
  const [submittingExit, setSubmittingExit] = useState(false);
  const [exitError, setExitError] = useState<string | null>(null);
  const [exitSuccess, setExitSuccess] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    api
      .getVehicleById(vehicleId)
      .then((data) => {
        if (isMounted) {
          setVehicle(data);
          setEditedNotes(data.notes || '');
          setEditedChassis(data.chassis_number);
          setEditedBrand(data.brand);
          setEditedModel(data.model);
          setEditedColor(data.color || '');
          setEditedSiteId(data.current_site_id || '');
          setEditedStatus(data.status);
          setEditedArrivalDate(data.arrival_date || '');
          setEditedIsBilled(Boolean(data.is_billed));
          setEditedInvoiceNumber(data.invoice_number || '');
          setEditedIsPaid(Boolean(data.is_paid));
          setEditedPaidDate(data.paid_date || '');
          setQuickArrivalDate(data.arrival_date || '');
          setQuickSiteId(data.current_site_id || '');
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [vehicleId]);

  const handleStartEdit = () => {
    if (!vehicle) return;
    setEditedChassis(vehicle.chassis_number);
    setEditedBrand(vehicle.brand);
    setEditedModel(vehicle.model);
    setEditedColor(vehicle.color || '');
    setEditedNotes(vehicle.notes || '');
    setEditedSiteId(vehicle.current_site_id || '');
    setEditedStatus(vehicle.status);
    setEditedArrivalDate(vehicle.arrival_date || '');
    setEditedIsBilled(Boolean(vehicle.is_billed || vehicle.invoice_number));
    setEditedInvoiceNumber(vehicle.invoice_number || '');
    setEditedIsPaid(Boolean(vehicle.is_paid));
    setEditedPaidDate(vehicle.paid_date || '');
    setEditError(null);
    setIsEditingVehicle(true);
  };

  const handleQuickSaveDate = async () => {
    if (!vehicle || !quickArrivalDate) return;
    setQuickDateSaving(true);
    try {
      const oldVal = vehicle.arrival_date;
      await api.updateVehicle(vehicle.id, {
        arrival_date: quickArrivalDate,
      });

      if (currentUser && oldVal !== quickArrivalDate) {
        logDateChange({
          currentUser,
          module: 'Stock Véhicules',
          entity_id: vehicle.chassis_number,
          entity_label: `${vehicle.brand} ${vehicle.model} (${vehicle.chassis_number})`,
          field_name: "Date d'entrée en parc (arrival_date)",
          old_value: oldVal || '(vide)',
          new_value: quickArrivalDate,
        });
      }

      const refreshed = await api.getVehicleById(vehicle.id);
      setVehicle(refreshed);
      setIsEditingQuickDate(false);
      onVehicleUpdated();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la modification de la date d arrivée');
    } finally {
      setQuickDateSaving(false);
    }
  };

  const handleQuickSaveSite = async () => {
    if (!vehicle) return;
    setQuickSiteSaving(true);
    try {
      await api.updateVehicle(vehicle.id, {
        current_site_id: quickSiteId || null,
      });
      const refreshed = await api.getVehicleById(vehicle.id);
      setVehicle(refreshed);
      setIsEditingQuickSite(false);
      onVehicleUpdated();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la modification du site actuel');
    } finally {
      setQuickSiteSaving(false);
    }
  };

  const handleSaveVehicle = async () => {
    if (!vehicle) return;
    if (!editedChassis.trim()) {
      setEditError('Le numéro de châssis (VIN) est obligatoire.');
      return;
    }
    if (!editedBrand.trim() || !editedModel.trim()) {
      setEditError('La marque et le modèle sont obligatoires.');
      return;
    }

    setSavingVehicle(true);
    setEditError(null);

    try {
      const oldArrivalDate = vehicle.arrival_date;

      const updated = await api.updateVehicle(vehicle.id, {
        chassis_number: editedChassis.trim().toUpperCase(),
        brand: editedBrand.trim(),
        model: editedModel.trim(),
        color: editedColor.trim(),
        notes: editedNotes.trim(),
        current_site_id: editedSiteId || null,
        status: editedStatus,
        is_billed: editedIsBilled,
        invoice_number: editedInvoiceNumber.trim() || undefined,
        is_paid: editedIsPaid,
        paid_date: editedPaidDate || undefined,
        ...(canEditDate && editedArrivalDate ? { arrival_date: editedArrivalDate } : {}),
      });

      if (canEditDate && currentUser && editedArrivalDate && oldArrivalDate !== editedArrivalDate) {
        logDateChange({
          currentUser,
          module: 'Stock Véhicules',
          entity_id: vehicle.chassis_number,
          entity_label: `${vehicle.brand} ${vehicle.model} (${vehicle.chassis_number})`,
          field_name: "Date d'entrée en parc (arrival_date)",
          old_value: oldArrivalDate || '(vide)',
          new_value: editedArrivalDate,
        });
      }

      if (updated.brand && updated.model) {
        saveStoredModel(updated.brand, updated.model);
      }

      const refreshed = await api.getVehicleById(vehicle.id);
      setVehicle(refreshed);
      setIsEditingVehicle(false);
      onVehicleUpdated();
    } catch (err: any) {
      setEditError(err.message || 'Erreur lors de la modification du véhicule');
    } finally {
      setSavingVehicle(false);
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (!vehicle) return;
    setSubmittingDelete(true);
    try {
      await api.deleteVehicle(vehicle.id);
      setShowDeleteModal(false);
      onVehicleUpdated();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la suppression définitive du véhicule.');
    } finally {
      setSubmittingDelete(false);
    }
  };

  const soldedInfo = vehicle ? getVehicleSoldedDetails(vehicle, [], vehicle.movements || []) : null;

  const handleConfirmExitProprietaire = async () => {
    if (!vehicle) return;
    setSubmittingExit(true);
    setExitError(null);
    setExitSuccess(null);

    try {
      const departureSite = vehicle.current_site_id || (sites.length > 0 ? sites[0].id : '');
      if (!departureSite) {
        setExitError('Aucun site de départ disponible pour enregistrer la sortie.');
        setSubmittingExit(false);
        return;
      }

      let formattedDate = new Date().toISOString();
      if (exitDate) {
        const parsed = new Date(exitDate);
        if (!isNaN(parsed.getTime())) {
          formattedDate = parsed.toISOString();
        }
      }

      const dest = exitDestination.trim() || 'Propriétaire / Client final';
      const noteStr = exitNotes.trim()
        ? `[Sortie Définitive Propriétaire] ${exitNotes.trim()}`
        : '[Sortie Définitive] Livraison au propriétaire final.';

      await api.createMovement({
        vehicle_id: vehicle.id,
        movement_type: 'exit',
        departure_site_id: departureSite,
        destination_text: dest,
        movement_date: formattedDate,
        notes: noteStr,
        created_by_user_id: userRole === 'admin' ? 'usr_admin' : 'usr_agent',
      });

      // Refresh local vehicle data
      const updatedVehicleData = await api.getVehicleById(vehicle.id);
      setVehicle(updatedVehicleData);
      setShowExitProprietaire(false);
      setExitSuccess(`Sortie définitive vers le propriétaire (${dest}) enregistrée avec succès !`);
      onVehicleUpdated();
    } catch (err: any) {
      setExitError(err.message || 'Erreur lors de l enregistrement de la sortie définitive.');
    } finally {
      setSubmittingExit(false);
    }
  };

  const handleCopyChassis = () => {
    if (vehicle) {
      navigator.clipboard.writeText(vehicle.chassis_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveNotes = async () => {
    if (!vehicle) return;
    setSavingNotes(true);
    try {
      await api.updateVehicle(vehicle.id, { notes: editedNotes });
      setVehicle({ ...vehicle, notes: editedNotes });
      setIsEditingNotes(false);
      onVehicleUpdated();
    } catch (err) {
      alert('Erreur lors de la mise à jour des notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const getStatusBadge = (status: VehicleStatus) => {
    switch (status) {
      case 'en_stock':
        return (
          <span className="px-3 py-1 text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300">
            En Stock
          </span>
        );
      case 'en_transit':
        return (
          <span className="px-3 py-1 text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
            En Transit
          </span>
        );
      case 'livre':
        return (
          <span className="px-3 py-1 text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-300">
            Livré / Sorti
          </span>
        );
      case 'en_panne':
        return (
          <span className="px-3 py-1 text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-900 border border-rose-300">
            En Panne
          </span>
        );
    }
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'entry':
        return <ArrowDownRight className="w-4 h-4 text-emerald-600" />;
      case 'transfer':
        return <ArrowLeftRight className="w-4 h-4 text-blue-600" />;
      case 'exit':
        return <ArrowUpRight className="w-4 h-4 text-amber-600" />;
      default:
        return <History className="w-4 h-4 text-slate-400" />;
    }
  };

  const getMovementTypeLabel = (type: string) => {
    switch (type) {
      case 'entry':
        return 'Entrée Initiale';
      case 'transfer':
        return 'Transfert Inter-Sites';
      case 'exit':
        return 'Sortie / Livraison';
      default:
        return type;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-none overflow-y-auto">
      <div className="bg-white shadow-2xl max-w-3xl w-full border-2 border-slate-900 overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 flex items-center justify-between border-b-4 border-blue-600">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600 text-white">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-mono font-bold tracking-wider text-white">
                  {vehicle ? vehicle.chassis_number : 'Chargement...'}
                </span>
                {vehicle && (
                  <button
                    onClick={handleCopyChassis}
                    className="p-1 text-slate-400 hover:text-white transition"
                    title="Copier le VIN"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-bold uppercase tracking-wider">Fiche technique & Audit de traçabilité</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white transition hover:bg-slate-800"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {loading || !vehicle ? (
          <div className="p-12 text-center text-slate-500">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent animate-spin mx-auto mb-3" />
            <p className="text-xs font-bold uppercase tracking-wider">Chargement de la fiche véhicule...</p>
          </div>
        ) : (
          <div className="p-6 space-y-6 overflow-y-auto flex-1">
            {/* Soldé Banner if Livré + Facturé + Réglé */}
            {soldedInfo?.isSolded && (
              <div className="bg-emerald-950 text-white p-4 border-2 border-emerald-500 shadow-md space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <FileCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                    <div>
                      <h4 className="font-black text-xs uppercase tracking-wider text-emerald-400 flex items-center space-x-2">
                        <span>Véhicule Soldé &amp; Prêt à la Suppression</span>
                        <span className="bg-emerald-500 text-slate-950 text-[10px] px-2 py-0.5 font-mono font-black">
                          LIVRÉ + FACTURÉ + RÉGLÉ
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Ce véhicule a complété son cycle logistique et financier. Il est automatiquement sorti du stock actif.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    disabled={userRole !== 'admin' && userRole !== 'agent'}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider transition flex items-center space-x-1.5 shrink-0 shadow-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Supprimer définitivement</span>
                  </button>
                </div>
              </div>
            )}

            {/* Delivered but Unbilled Banner */}
            {soldedInfo?.isDelivered && !soldedInfo?.isBilled && (
              <div className="bg-amber-950 text-white p-4 border-2 border-amber-500 shadow-md space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <Receipt className="w-6 h-6 text-amber-400 shrink-0" />
                    <div>
                      <h4 className="font-black text-xs uppercase tracking-wider text-amber-400 flex items-center space-x-2">
                        <span>Véhicule Livré — Facturation En Attente</span>
                        <span className="bg-amber-500 text-slate-950 text-[10px] px-2 py-0.5 font-mono font-black">
                          À FACTURER
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Ce véhicule a été livré. Veuillez renseigner son numéro de facture pour compléter le dossier.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      handleStartEdit();
                      setEditedIsBilled(true);
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition flex items-center space-x-1.5 shrink-0 shadow-sm"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Facturer ce véhicule</span>
                  </button>
                </div>
              </div>
            )}

            {/* Header edit banner */}
            {userRole !== 'viewer' && (
              <div className="flex items-center justify-between bg-slate-100 p-3 border border-slate-300">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center space-x-1.5">
                  <Edit2 className="w-4 h-4 text-blue-600" />
                  <span>Informations Fiche (Châssis, Marque, Modèle, Couleur, Site, Statut)</span>
                </span>
                {!isEditingVehicle ? (
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider flex items-center space-x-1 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Modifier La Fiche (Châssis / Site / Statut)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingVehicle(false)}
                    className="px-3 py-1 bg-slate-300 hover:bg-slate-400 text-slate-800 font-bold text-xs uppercase tracking-wider transition"
                  >
                    Fermer Édition
                  </button>
                )}
              </div>
            )}

            {/* Editing Form OR Specs Grid */}
            {isEditingVehicle ? (
              <div className="bg-amber-50 border-2 border-amber-400 p-5 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-amber-300 pb-2">
                  <h3 className="font-black text-amber-950 uppercase tracking-wider flex items-center space-x-2">
                    <Edit2 className="w-4 h-4 text-amber-600" />
                    <span>Modification Fiche Véhicule</span>
                  </h3>
                  <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 uppercase tracking-wider">
                    Mode Édition
                  </span>
                </div>

                {editError && (
                  <div className="bg-rose-100 border border-rose-300 text-rose-900 p-2.5 font-bold text-xs">
                    {editError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">
                      Numéro Châssis (VIN) *
                    </label>
                    <input
                      type="text"
                      value={editedChassis}
                      onChange={(e) => setEditedChassis(e.target.value)}
                      className="w-full bg-white border border-slate-300 p-2 font-mono font-bold uppercase text-xs focus:border-blue-600 focus:outline-none shadow-xs"
                      placeholder="Ex: W0LMOKKA..."
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">
                      Marque *
                    </label>
                    <input
                      type="text"
                      value={editedBrand}
                      onChange={(e) => setEditedBrand(e.target.value)}
                      className="w-full bg-white border border-slate-300 p-2 font-bold uppercase text-xs focus:border-blue-600 focus:outline-none shadow-xs"
                      placeholder="Ex: PEUGEOT..."
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">
                      Modèle *
                    </label>
                    <input
                      type="text"
                      value={editedModel}
                      onChange={(e) => setEditedModel(e.target.value)}
                      className="w-full bg-white border border-slate-300 p-2 font-bold uppercase text-xs focus:border-blue-600 focus:outline-none shadow-xs"
                      placeholder="Ex: 208, K2500..."
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">
                      Couleur
                    </label>
                    <input
                      type="text"
                      value={editedColor}
                      onChange={(e) => setEditedColor(e.target.value)}
                      className="w-full bg-white border border-slate-300 p-2 font-bold uppercase text-xs focus:border-blue-600 focus:outline-none shadow-xs"
                      placeholder="Ex: Blanc Banquise, Noir..."
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-blue-900 block mb-1">
                      Site Actuel *
                    </label>
                    <select
                      value={editedSiteId}
                      onChange={(e) => setEditedSiteId(e.target.value)}
                      className="w-full bg-white border-2 border-blue-400 p-2 font-bold uppercase text-xs focus:border-blue-600 focus:outline-none shadow-xs text-blue-900"
                    >
                      <option value="">-- Aucun / Non assigné --</option>
                      {sites.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">
                      Statut Actuel
                    </label>
                    <select
                      value={editedStatus}
                      onChange={(e) => setEditedStatus(e.target.value as VehicleStatus)}
                      className="w-full bg-white border border-slate-300 p-2 font-bold uppercase text-xs focus:border-blue-600 focus:outline-none shadow-xs"
                    >
                      <option value="en_stock">En Stock</option>
                      <option value="en_transit">En Transit</option>
                      <option value="en_panne">En Panne</option>
                      <option value="livre">Livré / Sorti</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-amber-900 block mb-1">
                      Date d'entrée en parc (arrival_date)
                    </label>
                    {canEditDate ? (
                      <input
                        type="date"
                        value={editedArrivalDate}
                        onChange={(e) => setEditedArrivalDate(e.target.value)}
                        className="w-full bg-white border-2 border-amber-400 p-2 font-mono text-xs font-bold text-slate-900 focus:border-amber-600 focus:outline-none shadow-xs"
                      />
                    ) : (
                      <div>
                        <input
                          type="date"
                          value={editedArrivalDate}
                          disabled
                          readOnly
                          className="w-full bg-slate-100 border border-slate-300 p-2 font-mono text-xs font-bold text-slate-500 cursor-not-allowed opacity-80"
                        />
                        <span className="text-[9px] font-bold text-slate-500 block mt-0.5">
                          🔒 Modifiable uniquement par Ayari Intissar (Administrateur)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-700 block mb-1">
                    Notes & Remarques
                  </label>
                  <textarea
                    value={editedNotes}
                    onChange={(e) => setEditedNotes(e.target.value)}
                    rows={2}
                    className="w-full bg-white border border-slate-300 p-2 text-xs focus:border-blue-600 focus:outline-none font-medium shadow-xs"
                    placeholder="Notes de contrôle qualité, état..."
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-amber-300">
                  <button
                    type="button"
                    onClick={() => setIsEditingVehicle(false)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold uppercase tracking-wider"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveVehicle}
                    disabled={savingVehicle}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingVehicle ? 'Enregistrement...' : 'Enregistrer les Modifications'}</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Specs Grid */
              <div className="bg-slate-50 p-5 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Marque & Modèle</span>
                  <span className="text-xs font-black text-slate-900 uppercase block mt-0.5">
                    {vehicle.brand} {vehicle.model}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Couleur</span>
                  <span className="text-xs font-bold text-slate-800 uppercase block mt-0.5">{vehicle.color || 'N/A'}</span>
                </div>

                {vehicle.truck_load_number && (
                  <div>
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block">N° Chargement Camion Lié</span>
                    <span className="text-xs font-mono font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded inline-block mt-0.5">
                      {vehicle.truck_load_number}
                    </span>
                  </div>
                )}

                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Statut Actuel</span>
                  <div className="mt-1">{getStatusBadge(vehicle.status)}</div>
                </div>

                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Site Actuel</span>
                  {!isEditingQuickSite ? (
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className="text-xs font-black text-blue-700 uppercase">
                        {vehicle.current_site_name || 'Non assigné'}
                      </span>
                      {userRole !== 'viewer' && (
                        <button
                          type="button"
                          onClick={() => {
                            setQuickSiteId(vehicle.current_site_id || '');
                            setIsEditingQuickSite(true);
                          }}
                          className="px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-800 text-[10px] font-black uppercase tracking-wider border border-blue-300 flex items-center space-x-1 transition"
                          title="Modifier directement le site actuel"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Changer Site</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1 space-y-1.5 bg-blue-50 border-2 border-blue-400 p-2">
                      <select
                        value={quickSiteId}
                        onChange={(e) => setQuickSiteId(e.target.value)}
                        className="w-full bg-white border border-slate-300 text-xs font-bold p-1 uppercase focus:outline-none"
                      >
                        <option value="">-- Aucun / Non assigné --</option>
                        {sites.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.type})
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          type="button"
                          onClick={() => setIsEditingQuickSite(false)}
                          className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] uppercase"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={handleQuickSaveSite}
                          disabled={quickSiteSaving}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-wider flex items-center space-x-1 shadow-xs"
                        >
                          <Save className="w-3 h-3" />
                          <span>{quickSiteSaving ? '...' : 'Valider'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Date d'entrée en parc</span>
                  {!isEditingQuickDate ? (
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className="text-xs font-mono font-bold text-slate-900">
                        {formatDateTime(vehicle.arrival_date, { fallback: 'Non renseignée' })}
                      </span>
                      {canEditDate && (
                        <button
                          type="button"
                          onClick={() => {
                            setQuickArrivalDate(vehicle.arrival_date || '');
                            setIsEditingQuickDate(true);
                          }}
                          className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-black uppercase tracking-wider border border-amber-300 flex items-center space-x-1 transition"
                          title="Modifier la date d entrée en parc"
                        >
                          <Edit2 className="w-3 h-3 text-amber-700" />
                          <span>Modifier Date</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1 space-y-1.5 bg-amber-50 border-2 border-amber-400 p-2">
                      <input
                        type="date"
                        value={quickArrivalDate}
                        onChange={(e) => setQuickArrivalDate(e.target.value)}
                        className="w-full bg-white border border-slate-300 text-xs font-mono font-bold p-1 focus:outline-none"
                      />
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          type="button"
                          onClick={() => setIsEditingQuickDate(false)}
                          className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] uppercase"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={handleQuickSaveDate}
                          disabled={quickDateSaving}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-black text-[10px] uppercase tracking-wider flex items-center space-x-1 shadow-xs"
                        >
                          <Save className="w-3 h-3" />
                          <span>{quickDateSaving ? '...' : 'Valider'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Success notification if exit just completed */}
            {exitSuccess && (
              <div className="bg-emerald-100 border-2 border-emerald-500 text-emerald-950 p-4 flex items-center justify-between font-bold text-xs">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <span>{exitSuccess}</span>
                </div>
                <button
                  onClick={() => setExitSuccess(null)}
                  className="text-emerald-700 hover:text-emerald-900 text-[10px] uppercase font-black"
                >
                  OK
                </button>
              </div>
            )}

            {/* Sortie Définitive Vers Le Propriétaire Action Block */}
            {vehicle.status !== 'livre' && userRole !== 'viewer' && (
              <div className="bg-amber-500/10 border-2 border-amber-500 p-5 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start space-x-3">
                    <div className="p-2.5 bg-amber-600 text-white font-bold flex-shrink-0 shadow-xs">
                      <LogOut className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-amber-950 flex items-center space-x-2">
                        <span>Sortie Définitive Vers Le Propriétaire</span>
                        <span className="text-[9px] bg-amber-200 text-amber-900 px-2 py-0.5 uppercase font-bold tracking-widest">
                          Livraison Client
                        </span>
                      </h3>
                      <p className="text-xs text-amber-900 font-medium mt-0.5">
                        Enregistre la sortie finale du stock, libère l'emplacement et passe le véhicule en statut "Livré".
                      </p>
                    </div>
                  </div>

                  {!showExitProprietaire && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowExitProprietaire(true);
                        setExitError(null);
                        setExitSuccess(null);
                      }}
                      className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 shadow-md transition flex-shrink-0"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Confirmer Sortie Propriétaire</span>
                    </button>
                  )}
                </div>

                {showExitProprietaire && (
                  <div className="bg-white border border-amber-300 p-4 space-y-4 mt-3 text-xs shadow-xs">
                    <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                      <span className="font-black text-amber-950 uppercase tracking-wider flex items-center space-x-1.5">
                        <LogOut className="w-4 h-4 text-amber-600" />
                        <span>Formulaire de Sortie Définitive</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold uppercase">
                        Site actuel : {vehicle.current_site_name || 'Stock'}
                      </span>
                    </div>

                    {exitError && (
                      <div className="bg-rose-100 border border-rose-300 text-rose-900 p-3 font-bold text-xs">
                        {exitError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                          Nom du Propriétaire / Destinataire *
                        </label>
                        <input
                          type="text"
                          value={exitDestination}
                          onChange={(e) => setExitDestination(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 p-2.5 font-bold text-xs focus:border-amber-600 focus:bg-white focus:outline-none"
                          placeholder="Ex: Client M. Trabelsi / Concessionnaire..."
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                          Date et Heure de Sortie *
                        </label>
                        <input
                          type="datetime-local"
                          value={exitDate}
                          onChange={(e) => setExitDate(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 p-2.5 font-bold text-xs focus:border-amber-600 focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                        Remarques & Mentions de livraison
                      </label>
                      <input
                        type="text"
                        value={exitNotes}
                        onChange={(e) => setExitNotes(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 p-2.5 text-xs focus:border-amber-600 focus:bg-white focus:outline-none font-medium"
                        placeholder="Ex: Procès-verbal de livraison signé, double des clés remis..."
                      />
                    </div>

                    <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setShowExitProprietaire(false)}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs uppercase tracking-wider"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmExitProprietaire}
                        disabled={submittingExit}
                        className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider flex items-center space-x-2 shadow-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{submittingExit ? 'Enregistrement...' : 'Valider la Sortie Propriétaire'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Multi-Trajet Complete Journey Visual Banner */}
            {(() => {
              const siteMap = new Map<string, string>();
              sites.forEach((s) => siteMap.set(s.id, s.name));
              const sortedMovs = [...vehicle.movements].sort(
                (a, b) => new Date(a.movement_date).getTime() - new Date(b.movement_date).getTime()
              );

              const stops: string[] = [];
              sortedMovs.forEach((m) => {
                const depName = m.departure_site_id ? siteMap.get(m.departure_site_id) : null;
                const arrName = m.arrival_site_id
                  ? siteMap.get(m.arrival_site_id)
                  : m.destination_text || null;

                if (depName && (stops.length === 0 || stops[stops.length - 1] !== depName)) {
                  stops.push(depName);
                }
                if (m.waypoints && Array.isArray(m.waypoints)) {
                  m.waypoints.forEach((wId) => {
                    const wName = siteMap.get(wId) || wId;
                    if (stops.length === 0 || stops[stops.length - 1] !== wName) {
                      stops.push(wName);
                    }
                  });
                }
                if (arrName && (stops.length === 0 || stops[stops.length - 1] !== arrName)) {
                  stops.push(arrName);
                }
              });

              if (stops.length === 0) return null;

              return (
                <div className="bg-slate-900 text-white p-4 border-l-4 border-indigo-500 space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-widest text-indigo-300 flex items-center space-x-2">
                      <RouteIcon className="w-4 h-4 text-indigo-400" />
                      <span>Parcours Multi-Trajet Complet du Véhicule</span>
                    </span>
                    <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-700 font-mono font-bold px-2 py-0.5">
                      {stops.length} étapes
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {stops.map((stop, index) => {
                      const isCurrentLocation =
                        index === stops.length - 1 && vehicle.status === 'en_stock';
                      return (
                        <React.Fragment key={index}>
                          <div
                            className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition ${
                              isCurrentLocation
                                ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400'
                                : index === 0
                                ? 'bg-slate-800 text-slate-200 border border-slate-700'
                                : 'bg-indigo-950 text-indigo-100 border border-indigo-800'
                            }`}
                          >
                            <span className="text-[9px] font-mono text-indigo-400 font-bold">
                              #{index + 1}
                            </span>
                            <span>{stop}</span>
                            {isCurrentLocation && (
                              <span className="text-[8px] bg-white text-blue-900 font-black px-1 rounded-xs">
                                ACTUEL
                              </span>
                            )}
                          </div>
                          {index < stops.length - 1 && (
                            <ArrowRight className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Quick Movement Action Button */}
            {userRole !== 'viewer' && vehicle.status !== 'livre' && (
              <div className="bg-blue-50 border-l-4 border-blue-600 border-y border-r border-blue-200 p-4 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-blue-950">Saisir un nouveau mouvement</h4>
                  <p className="text-[11px] text-blue-800 font-medium">
                    Transférer vers un autre parc ou enregistrer la livraison finale.
                  </p>
                </div>
                <button
                  onClick={() => {
                    onDeclareMovementForVehicle(vehicle);
                    onClose();
                  }}
                  className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 text-xs font-black uppercase tracking-wider transition"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Nouveau Mouvement</span>
                </button>
              </div>
            )}

            {/* Notes Section */}
            <div className="bg-white p-4 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span>Notes & Remarques</span>
                </span>
                {userRole !== 'viewer' && !isEditingNotes && (
                  <button
                    onClick={() => setIsEditingNotes(true)}
                    className="text-xs text-blue-600 hover:underline flex items-center space-x-1 font-bold uppercase text-[10px]"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Modifier</span>
                  </button>
                )}
              </div>

              {isEditingNotes ? (
                <div className="space-y-2">
                  <textarea
                    value={editedNotes}
                    onChange={(e) => setEditedNotes(e.target.value)}
                    rows={3}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 focus:outline-none focus:border-blue-600 font-medium"
                    placeholder="Notes de contrôle qualité, état des lieux..."
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setIsEditingNotes(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 uppercase font-bold tracking-wider hover:bg-slate-100"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleSaveNotes}
                      disabled={savingNotes}
                      className="px-3 py-1.5 text-xs bg-blue-600 text-white hover:bg-blue-500 flex items-center space-x-1 font-black uppercase tracking-wider"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingNotes ? 'Enregistrement...' : 'Enregistrer'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-600 italic bg-slate-50 p-3 border border-slate-200">
                  {vehicle.notes || 'Aucune note spécifique.'}
                </p>
              )}
            </div>

            {/* Complete Audit Trail Timeline */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center space-x-2">
                <History className="w-4 h-4 text-blue-600" />
                <span>Journal d Audit Inaltérable ({vehicle.movements.length})</span>
              </h3>

              <div className="relative border-l-2 border-slate-300 ml-3 space-y-4 pt-1 pb-2">
                {vehicle.movements.map((m) => (
                  <div key={m.id} className="relative pl-6">
                    {/* Timeline Dot */}
                    <div className="absolute -left-[9px] top-1 p-1 bg-white border-2 border-slate-900">
                      {getMovementIcon(m.movement_type)}
                    </div>

                    <div className="bg-slate-50 p-4 border border-slate-200 text-xs space-y-2 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-slate-900 text-xs uppercase tracking-wider">
                          {getMovementTypeLabel(m.movement_type)}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono font-bold flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {formatDateTime(m.movement_date)}
                          </span>
                        </span>
                      </div>

                      <div className="text-slate-800 font-bold uppercase text-[11px]">
                        {m.movement_type === 'entry' && (
                          <span>Réception au site : <strong className="text-emerald-700">{m.arrival_site_name}</strong></span>
                        )}
                        {m.movement_type === 'transfer' && (
                          <div className="flex items-center space-x-2">
                            <span className="bg-slate-200 text-slate-900 px-2 py-0.5 border border-slate-300 font-bold">
                              {m.departure_site_name}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                            <span className="bg-blue-100 text-blue-900 px-2 py-0.5 border border-blue-300 font-bold">
                              {m.arrival_site_name}
                            </span>
                          </div>
                        )}
                        {m.movement_type === 'exit' && (
                          <span>
                            Sorti du site <strong className="text-amber-800">{m.departure_site_name}</strong> vers :{' '}
                            <strong>{m.destination_text || 'Destination finale'}</strong>
                          </span>
                        )}
                      </div>

                      {m.notes && (
                        <p className="text-slate-600 italic bg-white p-2 border border-slate-200 text-[11px]">
                          "{m.notes}"
                        </p>
                      )}

                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center space-x-1 pt-1 border-t border-slate-200">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                        <span>Agent : {m.created_by_user_name || 'Agent'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="bg-slate-100 p-4 border-t border-slate-300 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider transition"
          >
            Fermer la Fiche
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Permanent Delete */}
      {showDeleteModal && vehicle && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full border-2 border-rose-500 shadow-2xl overflow-hidden animate-scale-in">
            <div className="bg-rose-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-6 h-6 text-amber-300 shrink-0" />
                <h3 className="font-black text-sm uppercase tracking-wider">
                  Confirmation de Suppression Définitive
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                }}
                className="text-rose-100 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              <p>
                Êtes-vous sûr de vouloir supprimer définitivement le véhicule{' '}
                <strong className="text-slate-900">
                  {vehicle.brand} {vehicle.model} ({vehicle.chassis_number})
                </strong>{' '}
                ?
              </p>

              <div className="bg-rose-50 border-l-4 border-rose-500 p-3 text-rose-900 text-[11px] space-y-1">
                <p className="font-bold flex items-center space-x-1">
                  <ShieldAlert className="w-4 h-4 text-rose-600 mr-1 inline" />
                  Action Irréversible
                </p>
                <p>
                  Ce véhicule sera définitivement effacé du parc actif et de l'historique local.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 block">
                  Tapez <span className="font-mono font-black text-rose-600">SUPPRIMER</span> pour confirmer :
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="SUPPRIMER"
                  className="w-full px-3 py-2 border border-slate-300 font-mono text-xs font-bold uppercase focus:outline-none focus:border-rose-600"
                />
              </div>
            </div>

            <div className="bg-slate-100 p-4 border-t border-slate-200 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                }}
                disabled={submittingDelete}
                className="px-4 py-2 bg-slate-200 text-slate-700 font-bold text-xs uppercase"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={handleConfirmPermanentDelete}
                disabled={
                  deleteConfirmText.trim().toUpperCase() !== 'SUPPRIMER' ||
                  submittingDelete
                }
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase disabled:opacity-50 flex items-center space-x-2"
              >
                {submittingDelete ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Supprimer définitivement</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
