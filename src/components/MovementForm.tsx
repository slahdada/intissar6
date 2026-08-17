import React, { useState, useEffect } from 'react';
import {
  ArrowLeftRight,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  AlertOctagon,
  Car,
  MapPin,
  Calendar,
  Search,
  PlusCircle,
  FileText,
  User,
  Route as RouteIcon,
  Camera,
  QrCode,
  RefreshCw,
  Printer,
} from 'lucide-react';
import {
  Vehicle,
  Site,
  Route,
  MovementType,
  User as UserType,
  CreateMovementPayload,
  CreateVehiclePayload,
  MovementWithDetails,
} from '../types';
import { api } from '../lib/api';
import { canEditBusinessDate } from '../lib/permissions';
import { logDateChange } from '../lib/auditLogger';
import { QrBarcodeScannerModal } from './QrBarcodeScannerModal';
import { VinCameraOcrModal } from './VinCameraOcrModal';
import {
  ALL_CATALOG_BRANDS,
  getAllCatalogBrands,
  getModelsForBrand,
  saveStoredModel,
  getProbableImporterForBrand,
} from '../data/carCatalog';
import { OFFICIAL_IMPORTERS } from '../data/importers';
import {
  getStoredColors,
  saveStoredColor,
  normalizeColorName,
} from '../data/carColors';
import { generateMovementVoucherPDF } from '../lib/pdfVoucher';

interface MovementFormProps {
  vehicles: Vehicle[];
  sites: Site[];
  routes: Route[];
  currentUser: UserType;
  preselectedVehicle?: Vehicle | null;
  onSuccess: () => void;
  onNavigate: (tab: string) => void;
}

export const MovementForm: React.FC<MovementFormProps> = ({
  vehicles,
  sites,
  routes,
  currentUser,
  preselectedVehicle,
  onSuccess,
  onNavigate,
}) => {
  const [movementType, setMovementType] = useState<MovementType>('transfer');
  const [mode, setMode] = useState<'existing' | 'new'>('existing');

  // Existing Vehicle Selection
  const [searchChassis, setSearchChassis] = useState(preselectedVehicle?.chassis_number || '');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(preselectedVehicle || null);

  // New Vehicle Fields
  const [newChassis, setNewChassis] = useState('');
  const [catalogBrands, setCatalogBrands] = useState<string[]>(() => getAllCatalogBrands());
  const [newBrand, setNewBrand] = useState('Peugeot');
  const [customBrand, setCustomBrand] = useState('');
  const [newModelSelect, setNewModelSelect] = useState('208');
  const [customModel, setCustomModel] = useState('');
  const [availableColors, setAvailableColors] = useState<string[]>(() => getStoredColors());
  const [newColorSelect, setNewColorSelect] = useState<string>('Blanc');
  const [customColorInput, setCustomColorInput] = useState<string>('');
  const [selectedImporterId, setSelectedImporterId] = useState('stafim');

  // Computed brand, model & probable importer
  const effectiveBrand = newBrand === 'Autre' ? customBrand.trim() : newBrand;
  const availableModels = getModelsForBrand(effectiveBrand || newBrand);
  const effectiveModel =
    newBrand === 'Autre' || newModelSelect === 'Autre'
      ? customModel.trim()
      : newModelSelect;

  const effectiveColor =
    newColorSelect === 'Autre'
      ? normalizeColorName(customColorInput)
      : newColorSelect;

  const probableImporter = getProbableImporterForBrand(effectiveBrand);

  // Auto-link importer whenever effectiveBrand changes
  useEffect(() => {
    if (mode === 'new' && effectiveBrand) {
      const imp = getProbableImporterForBrand(effectiveBrand);
      if (imp) {
        setSelectedImporterId(imp.id);
      } else {
        setSelectedImporterId('');
      }
    }
  }, [effectiveBrand, mode]);

  const handleBrandSelectChange = (brandVal: string) => {
    setNewBrand(brandVal);
    if (brandVal !== 'Autre') {
      const models = getModelsForBrand(brandVal);
      setNewModelSelect(models[0] || 'Autre');
      setCustomModel('');
      setCustomBrand('');
      const imp = getProbableImporterForBrand(brandVal);
      if (imp) {
        setSelectedImporterId(imp.id);
      }
    } else {
      setNewModelSelect('Autre');
      setSelectedImporterId('');
    }
  };

  // Movement Fields
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [departureSiteId, setDepartureSiteId] = useState('');
  const [arrivalSiteId, setArrivalSiteId] = useState('');
  const [waypoints, setWaypoints] = useState<string[]>([]);
  const [destinationText, setDestinationText] = useState('');
  const [initialDefaultDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [movementDate, setMovementDate] = useState(initialDefaultDate);
  const [notes, setNotes] = useState('');

  const canEditDate = canEditBusinessDate(currentUser);

  // Validation & Error Handling
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastCreatedMovement, setLastCreatedMovement] = useState<MovementWithDetails | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // QR / Barcode Scanner Modal State
  const [showScanner, setShowScanner] = useState(false);
  const [showCameraOcrModal, setShowCameraOcrModal] = useState(false);

  const siteMap = new Map<string, string>();
  sites.forEach((s) => siteMap.set(s.id, s.name));

  const sampleChassisList = vehicles.map((v) => v.chassis_number);

  const handleScanSuccess = (scannedChassis: string) => {
    const norm = scannedChassis.trim().toUpperCase();
    if (mode === 'existing') {
      setSearchChassis(norm);
      const matched = vehicles.find((v) => v.chassis_number.toUpperCase() === norm);
      if (matched) {
        setSelectedVehicle(matched);
      } else {
        setSelectedVehicle(null);
      }
    } else {
      setNewChassis(norm);
    }
  };

  const handleCameraOcrSuccess = (confirmedVin: string) => {
    const norm = confirmedVin.trim().toUpperCase();
    if (mode === 'existing') {
      setSearchChassis(norm);
      const matched = vehicles.find((v) => v.chassis_number.toUpperCase() === norm);
      if (matched) {
        setSelectedVehicle(matched);
        setSuccessMessage(`Véhicule identifié par la caméra OCR : ${matched.brand} ${matched.model} (${matched.chassis_number}).`);
      } else {
        setSelectedVehicle(null);
        setErrorMessage(`Aucun véhicule en stock trouvé avec le VIN ${norm}. Vous pouvez l'enregistrer via "+ Arrivée Nouveau Véhicule".`);
      }
    } else {
      setNewChassis(norm);
      const matched = vehicles.find((v) => v.chassis_number.toUpperCase() === norm && v.status !== 'livre');
      if (matched) {
        setErrorMessage(`⚠️ Le VIN ${norm} existe déjà dans le parc (${matched.brand} ${matched.model} - Site: ${matched.current_site_id ? siteMap.get(matched.current_site_id) : 'Inconnu'}).`);
      } else {
        setSuccessMessage(`VIN ${norm} scanné par caméra appliqué au formulaire.`);
      }
    }
  };

  // Auto set departure site when vehicle changes
  useEffect(() => {
    if (selectedVehicle) {
      if (selectedVehicle.current_site_id) {
        setDepartureSiteId(selectedVehicle.current_site_id);
      } else {
        setDepartureSiteId('');
      }
    }
  }, [selectedVehicle]);

  // Route selector auto-fill
  const handleRouteSelect = (routeId: string) => {
    setSelectedRouteId(routeId);
    const r = routes.find((rt) => rt.id === routeId);
    if (r) {
      setDepartureSiteId(r.departure_site_id);
      setArrivalSiteId(r.arrival_site_id);
      setWaypoints(r.waypoints || []);
    }
  };

  // Chassis search filter
  const matchingVehicles = vehicles
    .filter((v) =>
      searchChassis
        ? v.chassis_number.toLowerCase().includes(searchChassis.toLowerCase()) ||
          v.brand.toLowerCase().includes(searchChassis.toLowerCase()) ||
          v.model.toLowerCase().includes(searchChassis.toLowerCase())
        : true
    )
    .slice(0, 8);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Date validation
    if (!movementDate) {
      setErrorMessage('Veuillez spécifier une date et une heure valides pour le mouvement.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    let parsedDateIso = '';
    try {
      const d = new Date(movementDate);
      if (isNaN(d.getTime())) {
        throw new Error('Date invalide');
      }
      parsedDateIso = d.toISOString();
    } catch {
      setErrorMessage('La date et l heure saisies ne sont pas valides.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Business rule validations
    if (mode === 'existing') {
      if (!selectedVehicle) {
        setErrorMessage('Veuillez sélectionner un véhicule existant par numéro de châssis (VIN).');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      if (selectedVehicle.status === 'livre' && movementType !== 'entry') {
        setErrorMessage(
          'Ce véhicule a fait l objet d une sortie définitive (statut Livré). Pour enregistrer un retour du client ou propriétaire, sélectionnez le type de mouvement "Entrée / Réception".'
        );
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      if (movementType === 'transfer' || movementType === 'exit') {
        if (!departureSiteId) {
          setErrorMessage('Veuillez sélectionner le site de départ (origine).');
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }

        if (selectedVehicle.current_site_id && departureSiteId !== selectedVehicle.current_site_id) {
          const actualSiteName = siteMap.get(selectedVehicle.current_site_id) || 'Inconnu';
          const selectedDepName = siteMap.get(departureSiteId) || 'Sélectionné';
          setErrorMessage(
            `Le véhicule (châssis : ${selectedVehicle.chassis_number}) ne se trouve pas sur le site de départ sélectionné ("${selectedDepName}"). Son emplacement actuel est : "${actualSiteName}".`
          );
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }

      if (movementType === 'transfer') {
        if (!arrivalSiteId) {
          setErrorMessage('Veuillez sélectionner le site d arrivée (destination).');
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        if (departureSiteId === arrivalSiteId) {
          setErrorMessage('Le site de départ et le site d arrivée doivent être différents.');
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }

      if (movementType === 'entry') {
        if (!arrivalSiteId) {
          setErrorMessage('Veuillez sélectionner le site d arrivée (destination) pour l entrée en stock.');
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }
    } else {
      // New Vehicle Mode
      if (!newChassis.trim()) {
        setErrorMessage('Le numéro de châssis (VIN) est obligatoire.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const normChassis = newChassis.trim().toUpperCase();
      const existingVehicle = vehicles.find((v) => v.chassis_number.toUpperCase() === normChassis);
      if (existingVehicle && existingVehicle.status !== 'livre') {
        setErrorMessage(
          `Ce numéro de châssis (${normChassis}) est déjà présent en stock sur le site "${existingVehicle.current_site_name || 'Inconnu'}".`
        );
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (!effectiveBrand || !effectiveModel) {
        setErrorMessage('La marque et le modèle sont obligatoires.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (!arrivalSiteId) {
        setErrorMessage('Le site de réception initiale est obligatoire.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    setSubmitting(true);

    try {
      if (mode === 'new') {
        let finalColor = newColorSelect;
        if (newColorSelect === 'Autre') {
          const res = saveStoredColor(customColorInput);
          finalColor = res.normalized || 'Blanc';
          setAvailableColors(res.updatedList);
          setNewColorSelect(finalColor);
        } else {
          // Normalize existing selection just in case
          const res = saveStoredColor(newColorSelect);
          finalColor = res.normalized || newColorSelect;
        }

        // Save model directly to persistent catalog list
        if (effectiveBrand && effectiveModel) {
          saveStoredModel(effectiveBrand, effectiveModel);
          setCatalogBrands(getAllCatalogBrands());
        }

        const payload: CreateVehiclePayload = {
          chassis_number: newChassis.trim().toUpperCase(),
          brand: effectiveBrand,
          model: effectiveModel,
          color: finalColor,
          arrival_date: parsedDateIso,
          initial_site_id: arrivalSiteId,
          importer_id: selectedImporterId || undefined,
          importer_name: OFFICIAL_IMPORTERS.find((i) => i.id === selectedImporterId)?.name || undefined,
          notes: notes,
        };
        const resVeh = await api.createVehicle(payload);
        if (resVeh && (resVeh as any).isReturn) {
          setSuccessMessage(
            `Fiche véhicule (${payload.chassis_number}) réactivée et ré-enregistrée à l entrée en stock avec succès (Retour du client / propriétaire).`
          );
        } else {
          setSuccessMessage(`Nouveau véhicule (${payload.chassis_number}) [${effectiveBrand} ${effectiveModel}] créé et enregistré à l entrée avec succès.`);
        }
      } else if (selectedVehicle) {
        const payload: CreateMovementPayload = {
          vehicle_id: selectedVehicle.id,
          movement_type: movementType,
          movement_date: parsedDateIso,
          departure_site_id: departureSiteId || null,
          arrival_site_id: arrivalSiteId || null,
          destination_text: destinationText,
          waypoints: waypoints.filter(Boolean),
          notes: notes,
          created_by_user_id: currentUser.id,
        };
        const res = await api.createMovement(payload);
        const typeLabel =
          movementType === 'entry' ? 'Entrée' : movementType === 'transfer' ? 'Transfert' : 'Sortie';
        setSuccessMessage(`Mouvement (${typeLabel}) enregistré avec succès pour le châssis ${selectedVehicle.chassis_number}.`);

        if (canEditDate && movementDate !== initialDefaultDate) {
          logDateChange({
            currentUser,
            module: 'Saisie Mouvement',
            entity_id: selectedVehicle.chassis_number,
            entity_label: `${selectedVehicle.brand} ${selectedVehicle.model} (${selectedVehicle.chassis_number})`,
            field_name: "Date et heure du mouvement (movement_date)",
            old_value: initialDefaultDate,
            new_value: movementDate,
          });
        }

        if (res && res.movement) {
          const movWithDetails: MovementWithDetails = {
            ...res.movement,
            vehicle_chassis: selectedVehicle.chassis_number,
            vehicle_brand: selectedVehicle.brand,
            vehicle_model: selectedVehicle.model,
            departure_site_name: siteMap.get(departureSiteId || ''),
            arrival_site_name: siteMap.get(arrivalSiteId || '') || destinationText,
            created_by_user_name: currentUser.full_name,
          };
          setLastCreatedMovement(movWithDetails);
        }
      }

      // Reset form state
      setNotes('');
      setNewChassis('');
      setNewModelSelect('');
      setCustomModel('');
      setCustomBrand('');
      setCustomColorInput('');
      setNewColorSelect(availableColors[0] || 'Blanc');
      setDestinationText('');
      setWaypoints([]);
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de l enregistrement du mouvement.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Page Title */}
      <div className="bg-slate-900 text-white p-6 border-b-4 border-blue-600 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black uppercase tracking-wider text-slate-100 flex items-center space-x-2">
            <ArrowLeftRight className="w-5 h-5 text-blue-400" />
            <span>Mission de Transport Automobile</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Enlèvement, transfert porte-voitures, affectation chauffeur &amp; déclaration de livraison client.
          </p>
        </div>
        <div className="hidden sm:flex items-center space-x-2 text-[10px] text-slate-300 bg-slate-800 px-3 py-1.5 border border-slate-700 uppercase font-black tracking-widest">
          <User className="w-3.5 h-3.5 text-blue-400" />
          <span>Agent : {currentUser.full_name}</span>
        </div>
      </div>

      {/* Error & Success Alerts */}
      {errorMessage && (
        <div className="bg-rose-50 border-l-4 border-rose-600 border-y border-r border-rose-200 p-4 text-xs text-rose-900 flex items-start space-x-3">
          <AlertOctagon className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-black uppercase tracking-wider text-rose-900 block">Erreur de validation :</strong>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border-l-4 border-emerald-600 border-y border-r border-emerald-200 p-4 text-xs text-emerald-900 flex items-start justify-between gap-4">
          <div className="flex items-start space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="font-black uppercase tracking-wider text-emerald-900 block">Succès !</strong>
              <p className="mt-0.5">{successMessage}</p>
            </div>
          </div>
          {lastCreatedMovement && (
            <button
              type="button"
              onClick={() => generateMovementVoucherPDF(lastCreatedMovement, sites)}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs uppercase tracking-wider flex items-center space-x-1.5 shadow-sm shrink-0 transition"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer Bon (PDF)</span>
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 shadow-sm divide-y divide-slate-200">
        {/* Section 1: Mode & Movement Type */}
        <div className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="text-xs font-black uppercase tracking-widest text-slate-900">
              1. Type d opération
            </label>
            <div className="flex items-center space-x-1 bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setMode('existing')}
                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition ${
                  mode === 'existing'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Véhicule en Stock
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('new');
                  setMovementType('entry');
                }}
                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition ${
                  mode === 'new'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                + Arrivée Nouveau Véhicule
              </button>
            </div>
          </div>

          {mode === 'existing' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMovementType('transfer')}
                className={`p-4 border text-left transition flex flex-col justify-between ${
                  movementType === 'transfer'
                    ? 'border-blue-600 bg-blue-50/50 border-b-4'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <ArrowLeftRight
                    className={`w-5 h-5 ${movementType === 'transfer' ? 'text-blue-600' : 'text-slate-400'}`}
                  />
                  <span className="text-[9px] bg-blue-100 text-blue-900 font-black uppercase px-2 py-0.5">
                    Inter-Sites
                  </span>
                </div>
                <div className="mt-3">
                  <span className="font-black text-xs text-slate-900 uppercase tracking-wider block">Transfert</span>
                  <span className="text-[11px] text-slate-500 font-medium">Déplacer d un parc à un autre</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMovementType('exit')}
                className={`p-4 border text-left transition flex flex-col justify-between ${
                  movementType === 'exit'
                    ? 'border-amber-600 bg-amber-50/50 border-b-4'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <ArrowUpRight
                    className={`w-5 h-5 ${movementType === 'exit' ? 'text-amber-600' : 'text-slate-400'}`}
                  />
                  <span className="text-[9px] bg-amber-100 text-amber-900 font-black uppercase px-2 py-0.5">
                    Livraison
                  </span>
                </div>
                <div className="mt-3">
                  <span className="font-black text-xs text-slate-900 uppercase tracking-wider block">Sortie Définitive</span>
                  <span className="text-[11px] text-slate-500 font-medium">Livraison client ou concession</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMovementType('entry')}
                className={`p-4 border text-left transition flex flex-col justify-between ${
                  movementType === 'entry'
                    ? 'border-emerald-600 bg-emerald-50/50 border-b-4'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <ArrowDownRight
                    className={`w-5 h-5 ${movementType === 'entry' ? 'text-emerald-600' : 'text-slate-400'}`}
                  />
                  <span className="text-[9px] bg-emerald-100 text-emerald-900 font-black uppercase px-2 py-0.5">
                    Réception
                  </span>
                </div>
                <div className="mt-3">
                  <span className="font-black text-xs text-slate-900 uppercase tracking-wider block">Entrée Stock</span>
                  <span className="text-[11px] text-slate-500 font-medium">Arrivée au port ou dépôt</span>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Section 2: Vehicle Selection / Identification */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-900 block">
              2. Identification du Véhicule
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition border border-slate-800 shadow-sm"
              >
                <QrCode className="w-4 h-4 text-blue-400" />
                <span>Scanner Code-Barres / VIN</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCameraOcrModal(true)}
                className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition border border-blue-500 shadow-sm"
              >
                <Camera className="w-4 h-4 text-white" />
                <span>📷 Scanner VIN par caméra</span>
              </button>
            </div>
          </div>

          {mode === 'existing' ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchChassis}
                    onChange={(e) => {
                      setSearchChassis(e.target.value);
                      setSelectedVehicle(null);
                    }}
                    placeholder="Rechercher par numéro de châssis VIN (ex: VF3P208...)"
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs pl-9 pr-4 py-2.5 focus:outline-none focus:border-blue-600 font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2.5 text-xs font-black uppercase tracking-wider flex items-center space-x-1 transition flex-shrink-0"
                  title="Scanner code-barres / QR Code"
                >
                  <QrCode className="w-4 h-4 text-blue-400" />
                  <span className="hidden sm:inline">Code-barres</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCameraOcrModal(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2.5 text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition flex-shrink-0"
                  title="Ouvrir la caméra pour lire l'étiquette VIN avec Gemini Vision"
                >
                  <Camera className="w-4 h-4" />
                  <span className="hidden sm:inline">📷 Caméra OCR</span>
                </button>
              </div>

              {!selectedVehicle && matchingVehicles.length > 0 && (
                <div className="bg-slate-50 border border-slate-300 p-2 max-h-48 overflow-y-auto divide-y divide-slate-200">
                  {matchingVehicles.map((v) => {
                    const siteName = v.current_site_id ? siteMap.get(v.current_site_id) : 'Sorti';
                    return (
                      <div
                        key={v.id}
                        onClick={() => {
                          setSelectedVehicle(v);
                          setSearchChassis(v.chassis_number);
                        }}
                        className="p-2.5 hover:bg-slate-200 cursor-pointer transition flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-mono font-bold text-slate-900 block">
                            {v.chassis_number}
                          </span>
                          <span className="text-slate-600 uppercase font-bold text-[10px]">
                            {v.brand} {v.model} - {v.color}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-black uppercase text-blue-700 block">{siteName}</span>
                          <span className="text-[9px] uppercase font-bold text-slate-400">{v.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedVehicle && (
                <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-l-4 border-blue-600">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-600 text-white">
                      <Car className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-mono font-bold text-blue-400 text-sm tracking-wider block">
                        {selectedVehicle.chassis_number}
                      </span>
                      <span className="text-xs text-slate-300 font-bold uppercase">
                        {selectedVehicle.brand} {selectedVehicle.model} ({selectedVehicle.color})
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black uppercase text-slate-300 block">
                      Emplacement : {selectedVehicle.current_site_id ? siteMap.get(selectedVehicle.current_site_id) : 'Aucun (Sorti)'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVehicle(null);
                        setSearchChassis('');
                      }}
                      className="text-[10px] text-blue-400 hover:underline uppercase font-bold tracking-wider mt-0.5"
                    >
                      Changer de véhicule
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* New Vehicle Inputs */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 border border-slate-200">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                  Numéro de Châssis (VIN unique)*
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={newChassis}
                    onChange={(e) => setNewChassis(e.target.value.toUpperCase())}
                    placeholder="ex: VF3P208AX10029381"
                    className="w-full font-mono text-xs uppercase p-2 bg-white border border-slate-300 focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-2.5 py-2 text-xs font-black uppercase tracking-wider flex items-center space-x-1 transition flex-shrink-0"
                    title="Scanner code-barres"
                  >
                    <QrCode className="w-4 h-4 text-blue-400" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCameraOcrModal(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-2 text-xs font-black uppercase tracking-wider flex items-center space-x-1 transition flex-shrink-0"
                    title="📷 Scanner VIN par caméra avec Gemini"
                  >
                    <Camera className="w-4 h-4" />
                    <span className="hidden sm:inline">📷 Caméra</span>
                  </button>
                </div>
              </div>

              {/* Brand Selection */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                  Marque*
                </label>
                <select
                  value={newBrand}
                  onChange={(e) => handleBrandSelectChange(e.target.value)}
                  className="w-full text-xs font-bold p-2 bg-white border border-slate-300 focus:outline-none focus:border-blue-600"
                >
                  {catalogBrands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                  <option value="Autre">Autre (Saisie libre)...</option>
                </select>
                {newBrand === 'Autre' && (
                  <input
                    type="text"
                    required
                    value={customBrand}
                    onChange={(e) => {
                      setCustomBrand(e.target.value);
                      const imp = getProbableImporterForBrand(e.target.value);
                      if (imp) setSelectedImporterId(imp.id);
                    }}
                    placeholder="Saisir le nom de la marque..."
                    className="w-full text-xs font-bold p-2 mt-1.5 bg-amber-50 border border-amber-300 focus:outline-none focus:border-amber-600"
                  />
                )}
              </div>

              {/* Model Selection */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                  Modèle*
                </label>
                {newBrand !== 'Autre' ? (
                  <select
                    value={newModelSelect}
                    onChange={(e) => setNewModelSelect(e.target.value)}
                    className="w-full text-xs font-bold p-2 bg-white border border-slate-300 focus:outline-none focus:border-blue-600"
                  >
                    {availableModels.map((m) => (
                      <option key={m} value={m}>
                        {m === 'Autre' ? 'Autre (Saisie libre)...' : m}
                      </option>
                    ))}
                  </select>
                ) : null}

                {(newBrand === 'Autre' || newModelSelect === 'Autre') && (
                  <div>
                    <input
                      type="text"
                      required
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      placeholder="Saisir le modèle (ex: 208, 3008, EV6...)"
                      className="w-full text-xs font-bold p-2 mt-1.5 bg-amber-50 border border-amber-300 focus:outline-none focus:border-amber-600"
                    />
                    <p className="text-[10px] text-emerald-700 font-bold mt-1 flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                      <span>S'enregistre directement dans la liste des modèles pour {effectiveBrand || 'la marque'}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Color Selection */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                  Couleur*
                </label>
                <select
                  value={newColorSelect}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewColorSelect(val);
                    if (val !== 'Autre') {
                      setCustomColorInput('');
                    }
                  }}
                  className="w-full text-xs font-bold p-2 bg-white border border-slate-300 focus:outline-none focus:border-blue-600"
                >
                  {availableColors.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="Autre">Autre (Saisie libre)...</option>
                </select>

                {newColorSelect === 'Autre' && (
                  <input
                    type="text"
                    required
                    value={customColorInput}
                    onChange={(e) => setCustomColorInput(e.target.value)}
                    placeholder="Saisir la nouvelle couleur (ex: Gris Métallisé...)"
                    className="w-full text-xs font-bold p-2 mt-1.5 bg-amber-50 border border-amber-300 focus:outline-none focus:border-amber-600"
                  />
                )}
              </div>

              {/* Automatic Importer Link Box */}
              <div className="sm:col-span-4 bg-amber-50/70 border border-amber-200 p-3 space-y-2 mt-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="bg-amber-800 text-white font-black text-[9px] uppercase px-1.5 py-0.5 tracking-wider">
                      Liaison Automatique
                    </span>
                    <span className="text-xs font-black text-amber-950 uppercase tracking-wide">
                      Importateur Officiel Probable :
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-amber-900 font-bold uppercase">Importateur Sélectionné :</span>
                    <select
                      value={selectedImporterId}
                      onChange={(e) => setSelectedImporterId(e.target.value)}
                      className="text-xs font-bold p-1 bg-white border border-amber-300 text-amber-950 focus:outline-none"
                    >
                      <option value="">Aucun / Importation directe</option>
                      {OFFICIAL_IMPORTERS.map((imp) => (
                        <option key={imp.id} value={imp.id}>
                          {imp.code} - {imp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <p className="text-[11px] text-amber-900 leading-snug font-medium">
                  {probableImporter ? (
                    <>
                      Marque <strong>{effectiveBrand}</strong> associée automatiquement à l importateur <strong>{probableImporter.name} ({probableImporter.code})</strong>.
                    </>
                  ) : (
                    <>
                      Si une marque correspond à un importateur officiel existant, l importateur est pré-sélectionné automatiquement tout en laissant la possibilité de modification manuelle.
                    </>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Sites & Trajets */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black uppercase tracking-widest text-slate-900">
              3. Origine & Destination (Simple ou Multi-Trajet)
            </label>

            {routes.length > 0 && (
              <div className="flex items-center space-x-2 text-xs">
                <RouteIcon className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-slate-500 font-bold uppercase text-[10px]">Trajet type :</span>
                <select
                  value={selectedRouteId}
                  onChange={(e) => handleRouteSelect(e.target.value)}
                  className="bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold p-1 focus:outline-none"
                >
                  <option value="">Sélectionner un trajet prédéfini...</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.route_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Departure Site */}
            {(movementType === 'transfer' || movementType === 'exit') && (
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 block mb-1">
                  Site de Départ (Origine)*
                </label>
                <select
                  value={departureSiteId}
                  onChange={(e) => setDepartureSiteId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold p-2.5 focus:outline-none focus:border-blue-600"
                >
                  <option value="">Sélectionnez le site de départ...</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.type})
                    </option>
                  ))}
                </select>
                {selectedVehicle?.current_site_id && (
                  <span className="text-[10px] text-blue-600 font-bold uppercase block mt-1">
                    Actuel : {siteMap.get(selectedVehicle.current_site_id)}
                  </span>
                )}
              </div>
            )}

            {/* Arrival Site */}
            {(movementType === 'transfer' || movementType === 'entry') && (
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 block mb-1">
                  Site d Arrivée (Destination)*
                </label>
                <select
                  value={arrivalSiteId}
                  onChange={(e) => setArrivalSiteId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold p-2.5 focus:outline-none focus:border-blue-600"
                >
                  <option value="">Sélectionnez le site d arrivée...</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.type})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Destination Text for Exit */}
            {movementType === 'exit' && (
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 block mb-1">
                  Détails Destination / Client
                </label>
                <input
                  type="text"
                  value={destinationText}
                  onChange={(e) => setDestinationText(e.target.value)}
                  placeholder="ex: Concessionnaire STAFIM Tunis Sud, Client Flotte XYZ"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold p-2.5 focus:outline-none focus:border-blue-600"
                />
              </div>
            )}
          </div>

          {/* Waypoints / Escales intermediate steps */}
          {movementType === 'transfer' && (
            <div className="bg-slate-50 p-3.5 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-900">
                  Escales / Étapes Intermédiaires (Option Multi-Trajet)
                </span>
                <button
                  type="button"
                  onClick={() => setWaypoints([...waypoints, ''])}
                  className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase px-2 py-1 border border-indigo-700 transition"
                >
                  + Ajouter Escale
                </button>
              </div>

              {waypoints.length > 0 && (
                <div className="space-y-2 pt-1">
                  {waypoints.map((wp, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <span className="text-[10px] font-bold text-slate-500 font-mono w-20">
                        Escale #{idx + 1}
                      </span>
                      <select
                        value={wp}
                        onChange={(e) => {
                          const updated = [...waypoints];
                          updated[idx] = e.target.value;
                          setWaypoints(updated);
                        }}
                        className="flex-1 text-xs font-bold p-2 bg-white border border-slate-300"
                      >
                        <option value="">Sélectionner le site d escale...</option>
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

              {/* Multi-Trajet Pipeline Visual Preview */}
              {(departureSiteId || arrivalSiteId || waypoints.length > 0) && (
                <div className="mt-3 p-3 bg-slate-900 text-white border-l-4 border-indigo-500 flex flex-wrap items-center gap-2 text-xs font-bold uppercase">
                  <span className="text-[10px] text-indigo-300 font-black tracking-widest mr-1">
                    APERCU TRAJET :
                  </span>
                  <span className="bg-slate-800 text-slate-100 px-2 py-0.5 border border-slate-700">
                    {departureSiteId ? siteMap.get(departureSiteId) : 'Départ'}
                  </span>
                  {waypoints.map((wpId, idx) => (
                    <React.Fragment key={idx}>
                      <span className="text-indigo-400">➔</span>
                      <span className="bg-indigo-950 text-indigo-200 border border-indigo-700 px-2 py-0.5">
                        {siteMap.get(wpId) || wpId || 'Escale'}
                      </span>
                    </React.Fragment>
                  ))}
                  <span className="text-blue-400">➔</span>
                  <span className="bg-blue-600 text-white px-2 py-0.5">
                    {arrivalSiteId ? siteMap.get(arrivalSiteId) : 'Arrivée'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 4: Date, Notes & Submit */}
        <div className="p-6 space-y-4">
          <label className="text-xs font-black uppercase tracking-widest text-slate-900 block">
            4. Horodatage & Observations
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 block mb-1">
                Date et Heure du Mouvement*
              </label>
              {canEditDate ? (
                <input
                  type="datetime-local"
                  value={movementDate}
                  onChange={(e) => setMovementDate(e.target.value)}
                  className="w-full bg-white border-2 border-amber-400 text-slate-900 text-xs font-mono font-bold p-2.5 focus:outline-none focus:border-amber-600 shadow-xs"
                />
              ) : (
                <div>
                  <input
                    type="datetime-local"
                    value={movementDate}
                    disabled
                    readOnly
                    className="w-full bg-slate-100 border border-slate-300 text-slate-500 text-xs font-mono font-bold p-2.5 cursor-not-allowed opacity-80"
                  />
                  <span className="text-[9px] font-bold text-slate-500 block mt-0.5">
                    🔒 Date modifiable uniquement par Ayari Intissar (Administrateur)
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-700 block mb-1">
                Notes & Références (Camion, Chauffeur, Bon)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ex: Transporteur plateau #04, Bon de livraison BL-9082"
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs font-medium p-2.5 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Inline Error/Success Banner near Submit Button */}
          {errorMessage && (
            <div className="bg-rose-50 border-l-4 border-rose-600 border-y border-r border-rose-200 p-3 text-xs text-rose-900 flex items-center space-x-2.5">
              <AlertOctagon className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span className="font-bold">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="bg-emerald-50 border-l-4 border-emerald-600 border-y border-r border-emerald-200 p-3 text-xs text-emerald-900 flex items-center space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="font-bold">{successMessage}</span>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[11px] text-slate-500 font-medium">
              * Tous les champs obligatoires doivent être renseignés avant validation.
            </div>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => onNavigate('vehicles')}
                className="px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 font-bold uppercase tracking-wider border border-slate-300 transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-black uppercase tracking-wider transition shadow-md disabled:opacity-50 flex items-center space-x-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <span>Valider & Enregistrer le Mouvement</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* QR Code / Barcode Scanner Modal */}
      <QrBarcodeScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={handleScanSuccess}
        sampleChassisList={sampleChassisList}
      />

      {/* Gemini Camera VIN OCR Scanner Modal */}
      <VinCameraOcrModal
        isOpen={showCameraOcrModal}
        onClose={() => setShowCameraOcrModal(false)}
        onVinConfirmed={handleCameraOcrSuccess}
        existingVehicles={vehicles}
      />
    </div>
  );
};
