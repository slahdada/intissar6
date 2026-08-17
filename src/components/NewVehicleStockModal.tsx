import React, { useState, useRef, useEffect } from 'react';
import {
  Car,
  X,
  CheckCircle2,
  AlertTriangle,
  Plus,
  FileSpreadsheet,
  Upload,
  Download,
  Check,
  RefreshCw,
  ChevronRight,
  FileText,
  AlertCircle,
  Sparkles,
  Camera,
  Truck,
  User as UserIcon,
  Phone,
  Calendar,
  ClipboardList,
  Pencil,
  Edit2,
  Trash2,
} from 'lucide-react';
import { Vehicle, Site, Carrier, CreateVehiclePayload } from '../types';
import { api } from '../lib/api';
import { ALL_CATALOG_BRANDS, getModelsForBrand, saveStoredModel } from '../data/carCatalog';
import { OFFICIAL_IMPORTERS, getImporterForBrand } from '../data/importers';
import {
  getAvailableBrands,
  getAvailableModels,
  addCustomBrand,
  addCustomModel,
  editBrand,
  deleteBrand,
  editModel,
  deleteModel,
} from '../lib/vehicleCatalog';
import { VinCameraOcrModal } from './VinCameraOcrModal';
import { QrBarcodeScannerModal } from './QrBarcodeScannerModal';
import { SearchableSelect, SelectOption } from './SearchableSelect';

interface NewVehicleStockModalProps {
  sites: Site[];
  existingVehicles: Vehicle[];
  onClose: () => void;
  onSuccess: () => void;
  initialTab?: 'manual' | 'csv';
  initialVin?: string;
}

interface CsvRowPreview {
  rowIndex: number;
  vin: string;
  marque: string;
  modele: string;
  site_depart: string;
  site_arrivee: string;
  isValid: boolean;
  errors: string[];
}

export const NewVehicleStockModal: React.FC<NewVehicleStockModalProps> = ({
  sites,
  existingVehicles,
  onClose,
  onSuccess,
  initialTab = 'manual',
  initialVin = '',
}) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'csv'>(initialTab);

  // Physical sites list (never include TRANSPORTEUR)
  const physicalSites = sites.filter(
    (s) => !s.name.toUpperCase().includes('TRANSPORTEUR') && s.id !== 'site_transporter' && s.id !== 'transporter'
  );

  // Carriers state
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  useEffect(() => {
    api.getCarriers().then((data) => setCarriers(data)).catch(() => {});
  }, []);

  // ==========================================
  // TAB 1: SAISIE MANUELLE STATE
  // ==========================================
  const [vin, setVin] = useState(initialVin || '');
  const [marque, setMarque] = useState('');
  const [modele, setModele] = useState('');
  const [siteDepart, setSiteDepart] = useState('');
  const [siteArrivee, setSiteArrivee] = useState('');
  const [selectedImporterId, setSelectedImporterId] = useState('');

  // Computed probable importer for current marque
  const probableImporter = getImporterForBrand(marque);

  useEffect(() => {
    if (marque) {
      const imp = getImporterForBrand(marque);
      if (imp) {
        setSelectedImporterId(imp.id);
      } else {
        setSelectedImporterId('');
      }
    } else {
      setSelectedImporterId('');
    }
  }, [marque]);

  // Catalog manipulation state
  const [catalogVersion, setCatalogVersion] = useState(0);

  const [editCatalogModal, setEditCatalogModal] = useState<{
    isOpen: boolean;
    type: 'brand' | 'model';
    oldValue: string;
    newValue: string;
    error?: string | null;
  }>({
    isOpen: false,
    type: 'brand',
    oldValue: '',
    newValue: '',
    error: null,
  });

  const [deleteCatalogModal, setDeleteCatalogModal] = useState<{
    isOpen: boolean;
    type: 'brand' | 'model';
    targetValue: string;
  }>({
    isOpen: false,
    type: 'brand',
    targetValue: '',
  });

  // Transport details
  const [carrierId, setCarrierId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [truckPlate, setTruckPlate] = useState('');
  const [plannedPickupDate, setPlannedPickupDate] = useState('');
  const [deliveryNoteRef, setDeliveryNoteRef] = useState('');
  const [transportNotes, setTransportNotes] = useState('');

  const [fieldErrors, setFieldErrors] = useState<{
    vin?: string;
    marque?: string;
    modele?: string;
    siteDepart?: string;
    siteArrivee?: string;
    carrier?: string;
  }>({});

  const [submittingManual, setSubmittingManual] = useState(false);
  const [manualSuccessMsg, setManualSuccessMsg] = useState<string | null>(null);
  const [showCameraOcrModal, setShowCameraOcrModal] = useState(false);
  const [showBarcodeScannerModal, setShowBarcodeScannerModal] = useState(false);

  // Auto fill driver & truck when carrier is chosen
  const handleCarrierSelect = (cId: string) => {
    setCarrierId(cId);
    const selected = carriers.find((c) => c.id === cId);
    if (selected) {
      if (!driverName) setDriverName(selected.nomChauffeur);
      if (!driverPhone) setDriverPhone(selected.telephone);
      if (!truckPlate) setTruckPlate(selected.matriculeCamion);
    }
  };

  // Options for site dropdowns
  const siteOptions: SelectOption[] = physicalSites.map((s) => ({
    value: s.name,
    label: s.name,
    sublabel: s.address,
  }));

  // Options for carriers dropdown
  const carrierOptions: SelectOption[] = carriers
    .filter((c) => c.actif)
    .map((c) => ({
      value: c.id,
      label: c.raisonSociale,
      sublabel: `Chauffeur: ${c.nomChauffeur} (${c.telephone}) - Camion: ${c.matriculeCamion}`,
    }));

  // Computed Brand and Model Options
  const brandOptions = React.useMemo(() => {
    return getAvailableBrands(existingVehicles);
  }, [existingVehicles, catalogVersion]);

  const modelOptions = React.useMemo(() => {
    return getAvailableModels(marque, existingVehicles);
  }, [marque, existingVehicles, catalogVersion]);

  // Handlers for Add Custom Brand & Model
  const handleTriggerAddBrand = (searchTerm: string) => {
    const res = addCustomBrand(searchTerm);
    if (!res.success) {
      alert(res.error || "Erreur lors de l'ajout de la marque.");
      return;
    }
    setCatalogVersion((v) => v + 1);
    setMarque(res.normalized);
    setModele('');
    if (fieldErrors.marque) setFieldErrors((p) => ({ ...p, marque: undefined }));
  };

  const handleTriggerAddModel = (searchTerm: string) => {
    if (!marque) {
      alert('Veuillez d\'abord sélectionner une marque.');
      return;
    }
    const res = addCustomModel(marque, searchTerm);
    if (!res.success) {
      alert(res.error || "Erreur lors de l'ajout du modèle.");
      return;
    }
    setCatalogVersion((v) => v + 1);
    setModele(res.normalized);
    if (fieldErrors.modele) setFieldErrors((p) => ({ ...p, modele: undefined }));
  };

  // Handlers for Edit Brand & Model
  const handleTriggerEditBrand = (opt: SelectOption) => {
    setEditCatalogModal({
      isOpen: true,
      type: 'brand',
      oldValue: opt.value,
      newValue: opt.label,
      error: null,
    });
  };

  const handleTriggerEditModel = (opt: SelectOption) => {
    setEditCatalogModal({
      isOpen: true,
      type: 'model',
      oldValue: opt.value,
      newValue: opt.label,
      error: null,
    });
  };

  const handleConfirmEditCatalog = async () => {
    const { type, oldValue, newValue } = editCatalogModal;
    if (!newValue || !newValue.trim()) {
      setEditCatalogModal((prev) => ({ ...prev, error: 'Veuillez saisir un nom valide.' }));
      return;
    }

    if (type === 'brand') {
      const res = editBrand(oldValue, newValue);
      if (!res.success) {
        setEditCatalogModal((prev) => ({ ...prev, error: res.error }));
        return;
      }
      setCatalogVersion((v) => v + 1);
      if (marque.toLowerCase() === oldValue.toLowerCase()) {
        setMarque(res.normalized);
      }
      await api.renameBrandInVehicles(oldValue, res.normalized);
      setEditCatalogModal({ isOpen: false, type: 'brand', oldValue: '', newValue: '', error: null });
      onSuccess();
    } else if (type === 'model') {
      const res = editModel(marque, oldValue, newValue);
      if (!res.success) {
        setEditCatalogModal((prev) => ({ ...prev, error: res.error }));
        return;
      }
      setCatalogVersion((v) => v + 1);
      if (modele.toLowerCase() === oldValue.toLowerCase()) {
        setModele(res.normalized);
      }
      await api.renameModelInVehicles(marque, oldValue, res.normalized);
      setEditCatalogModal({ isOpen: false, type: 'brand', oldValue: '', newValue: '', error: null });
      onSuccess();
    }
  };

  // Handlers for Delete Brand & Model
  const handleTriggerDeleteBrand = (opt: SelectOption) => {
    setDeleteCatalogModal({
      isOpen: true,
      type: 'brand',
      targetValue: opt.value,
    });
  };

  const handleTriggerDeleteModel = (opt: SelectOption) => {
    setDeleteCatalogModal({
      isOpen: true,
      type: 'model',
      targetValue: opt.value,
    });
  };

  const handleConfirmDeleteCatalog = async () => {
    const { type, targetValue } = deleteCatalogModal;

    if (type === 'brand') {
      deleteBrand(targetValue);
      setCatalogVersion((v) => v + 1);
      if (marque.toLowerCase() === targetValue.toLowerCase()) {
        setMarque('');
        setModele('');
      }
      await api.deleteBrandInVehicles(targetValue);
    } else if (type === 'model') {
      deleteModel(marque, targetValue);
      setCatalogVersion((v) => v + 1);
      if (modele.toLowerCase() === targetValue.toLowerCase()) {
        setModele('');
      }
      await api.deleteModelInVehicles(marque, targetValue);
    }

    setDeleteCatalogModal({ isOpen: false, type: 'brand', targetValue: '' });
    onSuccess();
  };

  // Validate Manual Form
  const validateManualForm = () => {
    const errors: {
      vin?: string;
      marque?: string;
      modele?: string;
      siteDepart?: string;
      siteArrivee?: string;
      carrier?: string;
    } = {};

    const cleanVin = vin.trim().toUpperCase();

    if (!cleanVin) {
      errors.vin = 'Le N° Châssis / VIN est obligatoire.';
    } else if (cleanVin.length !== 17) {
      errors.vin = `Le VIN doit comporter exactement 17 caractères (actuellement ${cleanVin.length}).`;
    } else if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(cleanVin)) {
      errors.vin = 'Le VIN doit contenir uniquement des caractères alphanumériques (sans I, O, Q).';
    } else {
      const exists = existingVehicles.some(
        (v) =>
          (v.chassis_number || v.vin || '').toUpperCase() === cleanVin && v.status !== 'livre'
      );
      if (exists) {
        errors.vin = `Le VIN ${cleanVin} existe déjà dans le stock actif.`;
      }
    }

    if (!marque.trim()) {
      errors.marque = 'La marque est obligatoire.';
    }

    if (!marque.trim()) {
      errors.modele = 'Sélectionnez d’abord une marque.';
    } else if (!modele.trim()) {
      errors.modele = 'Le modèle est obligatoire.';
    }

    if (!siteDepart.trim()) {
      errors.siteDepart = 'Le site physique de départ est obligatoire.';
    } else if (siteDepart.toUpperCase().includes('TRANSPORTEUR')) {
      errors.siteDepart = 'Le transporteur n’est pas un site physique de départ.';
    }

    if (!siteArrivee.trim()) {
      errors.siteArrivee = "Le site physique d'arrivée est obligatoire.";
    } else if (siteArrivee.toUpperCase().includes('TRANSPORTEUR')) {
      errors.siteArrivee = 'Le transporteur n’est pas un site physique d’arrivée.';
    } else if (siteDepart.trim().toLowerCase() === siteArrivee.trim().toLowerCase()) {
      errors.siteArrivee = 'Le site d’arrivée doit être différent du site de départ.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateManualForm()) return;

    setSubmittingManual(true);
    setManualSuccessMsg(null);

    try {
      const cleanVin = vin.trim().toUpperCase();
      const cleanMarque = marque.trim();
      const cleanModele = modele.trim();
      const cleanDepart = siteDepart.trim();
      const cleanArrivee = siteArrivee.trim();

      saveStoredModel(cleanMarque, cleanModele);
      addCustomBrand(cleanMarque);
      addCustomModel(cleanMarque, cleanModele);

      const matchedArrivalSite = physicalSites.find(
        (s) => s.name.toLowerCase() === cleanArrivee.toLowerCase() || s.id === cleanArrivee
      );

      const selectedCarrierObj = carriers.find((c) => c.id === carrierId);
      const selectedImporterObj = OFFICIAL_IMPORTERS.find((i) => i.id === selectedImporterId);

      const payload: CreateVehiclePayload = {
        chassis_number: cleanVin,
        vin: cleanVin,
        brand: cleanMarque,
        model: cleanModele,
        site_depart: cleanDepart,
        site_arrivee: cleanArrivee,
        initial_site_id: matchedArrivalSite ? matchedArrivalSite.id : physicalSites[0]?.id || null,
        status: 'a_ramasser',

        importer_id: selectedImporterId || undefined,
        importer_name: selectedImporterObj ? selectedImporterObj.name : undefined,
        
        carrier_id: carrierId || undefined,
        carrier_name: selectedCarrierObj ? selectedCarrierObj.raisonSociale : undefined,
        driver_name: driverName.trim() || undefined,
        driver_phone: driverPhone.trim() || undefined,
        truck_plate: truckPlate.trim() || undefined,
        planned_pickup_date: plannedPickupDate || undefined,
        delivery_note_ref: deliveryNoteRef.trim() || undefined,
        transport_notes: transportNotes.trim() || undefined,

        notes: `Départ: ${cleanDepart} | Arrivée: ${cleanArrivee} | Transporteur: ${selectedCarrierObj?.raisonSociale || 'Non assigné'}`,
        arrival_date: new Date().toISOString().split('T')[0],
      };

      await api.createVehicle(payload);

      setManualSuccessMsg('Véhicule créé avec succès (Statut : À ramasser)');
      setVin('');
      setMarque('');
      setModele('');
      setSiteDepart('');
      setSiteArrivee('');
      setCarrierId('');
      setDriverName('');
      setDriverPhone('');
      setTruckPlate('');
      setPlannedPickupDate('');
      setDeliveryNoteRef('');
      setTransportNotes('');
      setFieldErrors({});

      onSuccess();
    } catch (err: any) {
      setFieldErrors((prev) => ({
        ...prev,
        vin: err.message || "Erreur lors de l'enregistrement du véhicule.",
      }));
    } finally {
      setSubmittingManual(false);
    }
  };

  // ==========================================
  // TAB 2: IMPORT CSV WIZARD STATE (5 STEPS)
  // ==========================================
  const [csvStep, setCsvStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvRawText, setCsvRawText] = useState<string>('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [isHeaderValid, setIsHeaderValid] = useState<boolean | null>(null);
  const [csvHeaderError, setCsvHeaderError] = useState<string | null>(null);

  const [parsedRows, setParsedRows] = useState<CsvRowPreview[]>([]);
  const [importingCsv, setImportingCsv] = useState(false);
  const [importResult, setImportResult] = useState<{
    totalRows: number;
    validCount: number;
    rejectedCount: number;
    addedCount: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Download Sample CSV
  const handleDownloadSampleCsv = () => {
    const csvContent =
      'VIN,marque,modele,site_depart,site_arrivee\n' +
      'VF1AAAAA123456789,Renault,Clio,Tunis,Sfax\n' +
      'VF3P208AX99999001,Peugeot,208,Port Megrine,Entrepôt Central\n' +
      'VF7C300B99999002,Citroen,C3,Port de La Goulette,Parc Megrine\n';

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modele_import_vehicules.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Step 1: Parse CSV File
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processCsvFile(file);
    }
  };

  const processCsvFile = (file: File) => {
    setCsvFile(file);
    setCsvHeaderError(null);
    setIsHeaderValid(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvRawText(text || '');
      validateAndParseCsv(text || '');
    };
    reader.readAsText(file);
  };

  // Step 2 & 3: Validate Header & Rows
  const validateAndParseCsv = (text: string) => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      setCsvHeaderError('Le fichier CSV est vide.');
      setIsHeaderValid(false);
      setCsvStep(2);
      return;
    }

    // Determine delimiter (comma or semicolon)
    const firstLine = lines[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';

    const headers = firstLine.split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, ''));
    setCsvHeaders(headers);

    // Required columns expected: VIN, marque, modele, site_depart, site_arrivee
    const normHeaders = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));

    const requiredCols = ['vin', 'marque', 'modele', 'sitedepart', 'sitearrivee'];
    const altRequiredCols = ['vin', 'marque', 'modele', 'site_depart', 'site_arrivee'];

    const hasVin = normHeaders.includes('vin');
    const hasMarque = normHeaders.includes('marque') || normHeaders.includes('brand');
    const hasModele = normHeaders.includes('modele') || normHeaders.includes('model');
    const hasDepart = normHeaders.includes('sitedepart') || normHeaders.includes('site_depart');
    const hasArrivee = normHeaders.includes('sitearrivee') || normHeaders.includes('site_arrivee');

    if (!hasVin || !hasMarque || !hasModele || !hasDepart || !hasArrivee) {
      setCsvHeaderError(
        'Les colonnes du fichier CSV ne correspondent pas au format attendu.\nFormat requis : VIN, marque, modele, site_depart, site_arrivee'
      );
      setIsHeaderValid(false);
      setCsvStep(2);
      return;
    }

    setIsHeaderValid(true);

    // Find column indexes
    const vinIdx = normHeaders.findIndex((h) => h === 'vin');
    const marqueIdx = normHeaders.findIndex((h) => h === 'marque' || h === 'brand');
    const modeleIdx = normHeaders.findIndex((h) => h === 'modele' || h === 'model');
    const departIdx = normHeaders.findIndex((h) => h === 'sitedepart' || h === 'site_depart');
    const arriveeIdx = normHeaders.findIndex((h) => h === 'sitearrivee' || h === 'site_arrivee');

    const dataLines = lines.slice(1);
    const seenVinsInFile = new Set<string>();
    const previews: CsvRowPreview[] = [];

    dataLines.forEach((line, index) => {
      const cols = line.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
      const rowVin = (cols[vinIdx] || '').toUpperCase();
      const rowMarque = cols[marqueIdx] || '';
      const rowModele = cols[modeleIdx] || '';
      const rowDepart = cols[departIdx] || '';
      const rowArrivee = cols[arriveeIdx] || '';

      const errors: string[] = [];

      // Check VIN
      if (!rowVin) {
        errors.push('VIN manquant');
      } else if (rowVin.length !== 17) {
        errors.push(`VIN doit contenir 17 caractères (actuellement ${rowVin.length})`);
      } else if (seenVinsInFile.has(rowVin)) {
        errors.push('VIN en doublon dans le fichier CSV');
      } else {
        seenVinsInFile.add(rowVin);

        // Check if VIN exists in current stock DB
        const existsInDb = existingVehicles.some(
          (v) =>
            (v.chassis_number || v.vin || '').toUpperCase() === rowVin && v.status !== 'livre'
        );
        if (existsInDb) {
          errors.push('VIN existe déjà dans le stock');
        }
      }

      // Check required text fields
      if (!rowMarque) errors.push('Marque manquante');
      if (!rowModele) errors.push('Modèle manquant');
      if (!rowDepart) errors.push('Site de départ manquant');
      if (!rowArrivee) errors.push("Site d'arrivée manquant");

      previews.push({
        rowIndex: index + 2, // line number in CSV (1-indexed, header is line 1)
        vin: rowVin,
        marque: rowMarque,
        modele: rowModele,
        site_depart: rowDepart,
        site_arrivee: rowArrivee,
        isValid: errors.length === 0,
        errors,
      });
    });

    setParsedRows(previews);
    setCsvStep(2); // Auto navigate to Step 2 overview, user can click to proceed to step 3/4
  };

  // Step 5: Execute Import
  const handleConfirmImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) return;

    setImportingCsv(true);

    try {
      const payloads: CreateVehiclePayload[] = validRows.map((r) => {
        const matchedArrivalSite = sites.find(
          (s) => s.name.toLowerCase() === r.site_arrivee.toLowerCase() || s.id === r.site_arrivee
        );

        const imp = getImporterForBrand(r.marque);
        return {
          chassis_number: r.vin,
          vin: r.vin,
          brand: r.marque,
          model: r.modele,
          site_depart: r.site_depart,
          site_arrivee: r.site_arrivee,
          initial_site_id: matchedArrivalSite ? matchedArrivalSite.id : sites[0]?.id || null,
          importer_id: imp?.id,
          importer_name: imp?.name,
          notes: `Départ: ${r.site_depart} | Arrivée: ${r.site_arrivee}${imp ? ` | Importateur: ${imp.code}` : ''}`,
          arrival_date: new Date().toISOString().split('T')[0],
        };
      });

      const res = await api.bulkCreateVehicles(payloads);

      setImportResult({
        totalRows: parsedRows.length,
        validCount: validRows.length,
        rejectedCount: parsedRows.length - validRows.length,
        addedCount: res.createdCount || validRows.length,
      });

      setCsvStep(5);
      onSuccess();
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'importation des véhicules.");
    } finally {
      setImportingCsv(false);
    }
  };

  const validRowsCount = parsedRows.filter((r) => r.isValid).length;
  const rejectedRowsCount = parsedRows.length - validRowsCount;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white border-2 border-slate-800 shadow-2xl max-w-4xl w-full my-auto flex flex-col max-h-[90vh]">
        {/* MODAL HEADER */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b-2 border-slate-800 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 text-white">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase tracking-wider">
                Ajouter au stock &gt; Nouveau Véhicule
              </h2>
              <p className="text-[11px] text-slate-300 font-medium">
                Saisie manuelle d'un véhicule ou import groupé par fichier CSV
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition rounded-none"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TABS SELECTOR */}
        <div className="flex border-b border-slate-200 bg-slate-100 flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('manual');
              setManualSuccessMsg(null);
            }}
            className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition border-b-2 ${
              activeTab === 'manual'
                ? 'bg-white text-blue-700 border-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>1. Saisie manuelle</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('csv')}
            className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition border-b-2 ${
              activeTab === 'csv'
                ? 'bg-white text-emerald-700 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>2. Import par fichier CSV</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          {/* ======================================================== */}
          {/* TAB 1: SAISIE MANUELLE */}
          {/* ======================================================== */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-5">
              {manualSuccessMsg && (
                <div className="p-4 bg-emerald-50 border-l-4 border-emerald-600 text-emerald-900 flex items-center justify-between shadow-xs">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <span className="text-xs font-black uppercase tracking-wider">
                      {manualSuccessMsg}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setManualSuccessMsg(null)}
                    className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 p-4 space-y-4">
                <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center space-x-2">
                    <Car className="w-4 h-4 text-blue-600" />
                    <span>Informations du Véhicule (5 Champs Métier)</span>
                  </h3>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    Tous les champs (*) sont obligatoires
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 1. VIN / CHÂSSIS */}
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                      N° Châssis / VIN <span className="text-rose-600">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={vin}
                        onChange={(e) => {
                          setVin(e.target.value.toUpperCase());
                          if (fieldErrors.vin) setFieldErrors({ ...fieldErrors, vin: undefined });
                        }}
                        placeholder="ex: VF1AAAAA123456789 (17 caractères exacts)"
                        maxLength={17}
                        className={`w-full px-3.5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider border transition rounded-none focus:outline-none focus:ring-2 ${
                          fieldErrors.vin
                            ? 'border-rose-600 focus:ring-rose-500 bg-rose-50/50'
                            : 'border-slate-300 focus:ring-blue-600 focus:border-blue-600'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowBarcodeScannerModal(true)}
                        className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-2 text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition flex-shrink-0"
                        title="Ouvrir le scanner de code-barres / QR Code VIN"
                      >
                        <Camera className="w-4 h-4 text-amber-200" />
                        <span className="hidden sm:inline">Scanner Code-Barres</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCameraOcrModal(true)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition flex-shrink-0"
                        title="Ouvrir la caméra pour lire l'étiquette VIN avec Gemini Vision"
                      >
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span className="hidden sm:inline">Caméra OCR</span>
                      </button>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      {fieldErrors.vin ? (
                        <p className="text-[11px] text-rose-600 font-bold flex items-center space-x-1">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{fieldErrors.vin}</span>
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-500 font-medium">
                          Doit comporter exactement 17 caractères alphanumériques uniques.
                        </p>
                      )}
                      <span className="text-[10px] font-mono text-slate-400">
                        {vin.trim().length}/17
                      </span>
                    </div>
                  </div>

                  {/* 2. MARQUE */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                      Marque <span className="text-rose-600">*</span>
                    </label>
                    <SearchableSelect
                      options={brandOptions}
                      value={marque}
                      onChange={(val) => {
                        setMarque(val);
                        setModele('');
                        if (fieldErrors.marque) setFieldErrors((p) => ({ ...p, marque: undefined }));
                        if (fieldErrors.modele) setFieldErrors((p) => ({ ...p, modele: undefined }));
                      }}
                      placeholder="-- Sélectionner une marque (ex: Peugeot) --"
                      searchPlaceholder="Rechercher une marque..."
                      error={!!fieldErrors.marque}
                      allowCustom={true}
                      customAddText="Ajouter marque"
                      onAddCustom={handleTriggerAddBrand}
                      onEditOption={handleTriggerEditBrand}
                      onDeleteOption={handleTriggerDeleteBrand}
                      isAdmin={true}
                    />
                    {fieldErrors.marque && (
                      <p className="text-[11px] text-rose-600 font-bold mt-1 flex items-center space-x-1">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{fieldErrors.marque}</span>
                      </p>
                    )}
                  </div>

                  {/* 3. MODÈLE */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                      Modèle <span className="text-rose-600">*</span>
                    </label>
                    <SearchableSelect
                      options={modelOptions}
                      value={modele}
                      onChange={(val) => {
                        setModele(val);
                        if (fieldErrors.modele) setFieldErrors((p) => ({ ...p, modele: undefined }));
                      }}
                      placeholder={
                        marque ? '-- Sélectionner un modèle (ex: 208) --' : 'Sélectionnez d’abord une marque'
                      }
                      searchPlaceholder="Rechercher un modèle..."
                      disabled={!marque}
                      error={!!fieldErrors.modele}
                      allowCustom={Boolean(marque)}
                      customAddText="Ajouter modèle"
                      onAddCustom={handleTriggerAddModel}
                      onEditOption={handleTriggerEditModel}
                      onDeleteOption={handleTriggerDeleteModel}
                      isAdmin={true}
                    />
                    {fieldErrors.modele && (
                      <p className="text-[11px] text-rose-600 font-bold mt-1 flex items-center space-x-1">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{fieldErrors.modele}</span>
                      </p>
                    )}
                  </div>

                  {/* Liaison Automatique Importateur Officiel */}
                  <div className="md:col-span-2 bg-amber-50/80 border border-amber-300 p-3 space-y-2 rounded-none">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="bg-amber-800 text-white font-black text-[9px] uppercase px-2 py-0.5 tracking-wider flex items-center space-x-1">
                          <Sparkles className="w-3 h-3 text-amber-300" />
                          <span>Liaison Automatique</span>
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
                          className="text-xs font-bold p-1 bg-white border border-amber-400 text-amber-950 focus:outline-none focus:ring-1 focus:ring-amber-600"
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
                        <span className="flex items-center space-x-1.5 text-emerald-900">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span>
                            Marque <strong>{marque}</strong> associée automatiquement à l'importateur officiel <strong>{probableImporter.name} ({probableImporter.code})</strong>.
                          </span>
                        </span>
                      ) : marque ? (
                        <span className="text-amber-800">
                          Aucun importateur officiel Tunisie prédéfini pour la marque <strong>{marque}</strong>. Vous pouvez en choisir un manuellement.
                        </span>
                      ) : (
                        <span className="text-amber-800">
                          Sélectionnez une marque (ex: Peugeot, Volkswagen, Renault, Kia, Hyundai...) pour lier automatiquement l'importateur officiel Tunisie.
                        </span>
                      )}
                    </p>
                  </div>

                  {/* 4. SITE DE DÉPART (Physique uniquement) */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                      Site Physique de Départ <span className="text-rose-600">*</span>
                    </label>
                    <SearchableSelect
                      options={siteOptions}
                      value={siteDepart}
                      onChange={(val) => {
                        setSiteDepart(val);
                        if (fieldErrors.siteDepart) setFieldErrors((p) => ({ ...p, siteDepart: undefined }));
                      }}
                      placeholder="-- Sélectionner le site de départ (ex: Port de La Goulette) --"
                      searchPlaceholder="Rechercher un site de départ..."
                      error={!!fieldErrors.siteDepart}
                    />
                    {fieldErrors.siteDepart && (
                      <p className="text-[11px] text-rose-600 font-bold mt-1 flex items-center space-x-1">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{fieldErrors.siteDepart}</span>
                      </p>
                    )}
                  </div>

                  {/* 5. SITE D'ARRIVÉE (Physique uniquement) */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                      Site Physique d’Arrivée <span className="text-rose-600">*</span>
                    </label>
                    <SearchableSelect
                      options={siteOptions.filter((opt) => opt.value !== siteDepart)}
                      value={siteArrivee}
                      onChange={(val) => {
                        setSiteArrivee(val);
                        if (fieldErrors.siteArrivee) setFieldErrors((p) => ({ ...p, siteArrivee: undefined }));
                      }}
                      placeholder="-- Sélectionner le site d'arrivée (ex: Entrepôt Charguia) --"
                      searchPlaceholder="Rechercher un site d'arrivée..."
                      error={!!fieldErrors.siteArrivee}
                    />
                    {fieldErrors.siteArrivee && (
                      <p className="text-[11px] text-rose-600 font-bold mt-1 flex items-center space-x-1">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{fieldErrors.siteArrivee}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* 3. INFORMATIONS TRANSPORT & LOGISTIQUE */}
                <div className="border border-slate-200 bg-slate-50/70 p-4 space-y-4">
                  <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                    <Truck className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                      3. Informations Transport & Ordre de Mission
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Carrier selection */}
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                        Transporteur (Prestataire)
                      </label>
                      <SearchableSelect
                        options={carrierOptions}
                        value={carrierId}
                        onChange={handleCarrierSelect}
                        placeholder="-- Sélectionner un transporteur (ex: STLT, Express Auto) --"
                        searchPlaceholder="Rechercher un transporteur..."
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Note: Le transporteur n'est pas un site de stockage. Il assure l'acheminement entre le site de départ et d'arrivée.
                      </p>
                    </div>

                    {/* Driver Name */}
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1 flex items-center space-x-1">
                        <UserIcon className="w-3 h-3 text-slate-500" />
                        <span>Nom du Chauffeur</span>
                      </label>
                      <input
                        type="text"
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        placeholder="ex: Mohamed Ben Ali"
                        className="w-full px-3.5 py-2 text-xs font-bold border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                      />
                    </div>

                    {/* Driver Phone */}
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1 flex items-center space-x-1">
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>Téléphone Chauffeur</span>
                      </label>
                      <input
                        type="text"
                        value={driverPhone}
                        onChange={(e) => setDriverPhone(e.target.value)}
                        placeholder="ex: +216 98 123 456"
                        className="w-full px-3.5 py-2 text-xs font-bold border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                      />
                    </div>

                    {/* Truck Plate */}
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1 flex items-center space-x-1">
                        <Truck className="w-3 h-3 text-slate-500" />
                        <span>Matricule Camion / Porte-Voitures</span>
                      </label>
                      <input
                        type="text"
                        value={truckPlate}
                        onChange={(e) => setTruckPlate(e.target.value)}
                        placeholder="ex: 123 TUN 456"
                        className="w-full px-3.5 py-2 text-xs font-bold border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                      />
                    </div>

                    {/* Delivery Note Reference */}
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1 flex items-center space-x-1">
                        <ClipboardList className="w-3 h-3 text-slate-500" />
                        <span>N° Bon de Livraison / Référence</span>
                      </label>
                      <input
                        type="text"
                        value={deliveryNoteRef}
                        onChange={(e) => setDeliveryNoteRef(e.target.value)}
                        placeholder="ex: BL-2026-0891"
                        className="w-full px-3.5 py-2 text-xs font-bold border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                      />
                    </div>

                    {/* Planned Pickup Date */}
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1 flex items-center space-x-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>Date / Heure Prévue de Ramassage</span>
                      </label>
                      <input
                        type="datetime-local"
                        value={plannedPickupDate}
                        onChange={(e) => setPlannedPickupDate(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs font-bold border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                      />
                    </div>

                    {/* Transport Notes */}
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                        Observations / Consignes
                      </label>
                      <input
                        type="text"
                        value={transportNotes}
                        onChange={(e) => setTransportNotes(e.target.value)}
                        placeholder="ex: Priorité livraison, vérifier état carrosserie..."
                        className="w-full px-3.5 py-2 text-xs font-bold border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Flux Example Info Banner */}
                  <div className="bg-blue-50 border border-blue-200 p-3 text-[11px] text-blue-900 space-y-1">
                    <div className="font-bold flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                      <span>Exemple de circuit logistique :</span>
                    </div>
                    <p className="text-[10px] leading-relaxed text-blue-800">
                      <strong>Départ :</strong> Port de La Goulette (Zone Portuaire) &rarr;{' '}
                      <strong>Transporteur :</strong> Transporteur X (Chauffeur: Mohamed Ben Ali - Camion: 123 TUN 456) &rarr;{' '}
                      <strong>Arrivée :</strong> Entrepôt Charguia.
                      <br />
                      Le véhicule sera créé avec le statut initial <span className="bg-amber-100 text-amber-800 px-1 font-bold">À ramasser</span>.
                    </p>
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 text-xs text-slate-700 font-bold uppercase tracking-wider border border-slate-300 hover:bg-slate-100 transition rounded-none"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingManual}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider transition shadow-sm flex items-center space-x-2 disabled:bg-slate-400 rounded-none"
                >
                  {submittingManual ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Enregistrer</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ======================================================== */}
          {/* TAB 2: IMPORT CSV WIZARD (5 STEPS) */}
          {/* ======================================================== */}
          {activeTab === 'csv' && (
            <div className="space-y-5">
              {/* WIZARD STEPPER HEADER */}
              <div className="bg-slate-50 border border-slate-200 p-3">
                <div className="grid grid-cols-5 gap-1 text-center">
                  {[
                    { step: 1, title: '1. Téléverser' },
                    { step: 2, title: '2. Colonnes' },
                    { step: 3, title: '3. Aperçu' },
                    { step: 4, title: '4. Valider' },
                    { step: 5, title: '5. Confirmer' },
                  ].map((s) => {
                    const isActive = csvStep === s.step;
                    const isPassed = csvStep > s.step;
                    return (
                      <div
                        key={s.step}
                        className={`py-2 px-1 text-[11px] font-black uppercase tracking-wider border transition ${
                          isActive
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : isPassed
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : 'bg-white text-slate-400 border-slate-200'
                        }`}
                      >
                        {s.title}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* STEP 1: UPLOAD OR DOWNLOAD SAMPLE */}
              {csvStep === 1 && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border-l-4 border-amber-500 p-4 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <strong className="font-black uppercase tracking-wider block mb-1 text-amber-900">
                        Format CSV requis (5 colonnes exactement) :
                      </strong>
                      <code className="bg-amber-100/80 px-2 py-1 font-mono font-bold text-amber-950 text-[11px] block sm:inline">
                        VIN,marque,modele,site_depart,site_arrivee
                      </code>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadSampleCsv}
                      className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-black uppercase tracking-wider transition shadow-xs flex-shrink-0"
                    >
                      <Download className="w-4 h-4" />
                      <span>Télécharger l'exemple CSV</span>
                    </button>
                  </div>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-emerald-600 bg-slate-50 hover:bg-emerald-50/40 p-8 text-center cursor-pointer transition space-y-3"
                  >
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center rounded-full">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-slate-800">
                        Cliquez ou glissez un fichier CSV ici
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Formats acceptés : .csv (séparateur virgule ou point-virgule)
                      </p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: CHECK COLUMNS */}
              {csvStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Étape 2 : Vérification de la structure des colonnes
                    </h3>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Fichier : {csvFile?.name}
                    </span>
                  </div>

                  {isHeaderValid === false ? (
                    <div className="p-4 bg-rose-50 border-l-4 border-rose-600 text-rose-900 space-y-3">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                        <strong className="text-xs font-black uppercase tracking-wider">
                          Colonnes Invalides ou Manquantes !
                        </strong>
                      </div>
                      <p className="text-xs font-medium whitespace-pre-line leading-relaxed">
                        {csvHeaderError}
                      </p>
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCsvStep(1);
                            setCsvFile(null);
                          }}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider transition"
                        >
                          Choisir un autre fichier CSV
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-emerald-50 border-l-4 border-emerald-600 text-emerald-950 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                          <span className="text-xs font-black uppercase tracking-wider">
                            Structure des colonnes 100% conforme au modèle requis !
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2">
                          Colonnes détectées dans votre fichier :
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {csvHeaders.map((h, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 bg-white border border-slate-300 font-mono text-xs font-bold text-slate-800"
                            >
                              {h}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-end space-x-3 pt-3 border-t">
                        <button
                          type="button"
                          onClick={() => setCsvStep(1)}
                          className="px-4 py-2 border border-slate-300 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-100"
                        >
                          Retour
                        </button>
                        <button
                          type="button"
                          onClick={() => setCsvStep(3)}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider transition flex items-center space-x-2"
                        >
                          <span>Poursuivre vers l'Aperçu ({parsedRows.length} lignes)</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3 & 4: APERÇU ET VALIDATION DE LIGNES */}
              {(csvStep === 3 || csvStep === 4) && (
                <div className="space-y-4">
                  {/* SUMMARY CARDS */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-100 border border-slate-300 p-3 text-center">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                        Total Lignes
                      </span>
                      <span className="text-xl font-black font-mono text-slate-800">
                        {parsedRows.length}
                      </span>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-300 p-3 text-center">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">
                        Lignes Valides
                      </span>
                      <span className="text-xl font-black font-mono text-emerald-800">
                        {validRowsCount}
                      </span>
                    </div>

                    <div className="bg-rose-50 border border-rose-300 p-3 text-center">
                      <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 block">
                        Lignes Rejetées
                      </span>
                      <span className="text-xl font-black font-mono text-rose-800">
                        {rejectedRowsCount}
                      </span>
                    </div>
                  </div>

                  {/* PREVIEW TABLE */}
                  <div className="border border-slate-300 overflow-x-auto max-h-60 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-800 text-white font-black uppercase tracking-wider sticky top-0">
                        <tr>
                          <th className="p-2 border-b border-slate-700">N°</th>
                          <th className="p-2 border-b border-slate-700 font-mono">VIN</th>
                          <th className="p-2 border-b border-slate-700">Marque</th>
                          <th className="p-2 border-b border-slate-700">Modèle</th>
                          <th className="p-2 border-b border-slate-700">Site Départ</th>
                          <th className="p-2 border-b border-slate-700">Site Arrivée</th>
                          <th className="p-2 border-b border-slate-700">Statut / Erreurs</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {parsedRows.map((row) => (
                          <tr
                            key={row.rowIndex}
                            className={row.isValid ? 'bg-white hover:bg-slate-50' : 'bg-rose-50/60 hover:bg-rose-100/50'}
                          >
                            <td className="p-2 font-mono text-slate-500">{row.rowIndex}</td>
                            <td className="p-2 font-mono font-bold text-slate-900">
                              {row.vin || <span className="text-rose-500 italic">Vide</span>}
                            </td>
                            <td className="p-2 font-bold text-slate-800">{row.marque}</td>
                            <td className="p-2 font-bold text-slate-800">{row.modele}</td>
                            <td className="p-2 text-slate-700">{row.site_depart}</td>
                            <td className="p-2 text-slate-700">{row.site_arrivee}</td>
                            <td className="p-2">
                              {row.isValid ? (
                                <span className="px-2 py-0.5 bg-emerald-600 text-white font-black text-[10px] uppercase tracking-wider inline-block">
                                  Valide
                                </span>
                              ) : (
                                <div className="space-y-0.5">
                                  <span className="px-2 py-0.5 bg-rose-600 text-white font-black text-[10px] uppercase tracking-wider inline-block">
                                    Invalide
                                  </span>
                                  <p className="text-[10px] text-rose-700 font-bold">
                                    {row.errors.join(', ')}
                                  </p>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* STEP NAV BUTTONS */}
                  <div className="flex items-center justify-between pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setCsvStep(2)}
                      className="px-4 py-2 border border-slate-300 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-100"
                    >
                      Retour
                    </button>

                    {csvStep === 3 ? (
                      <button
                        type="button"
                        onClick={() => setCsvStep(4)}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider transition flex items-center space-x-2"
                      >
                        <span>Valider les données</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConfirmImport}
                        disabled={validRowsCount === 0 || importingCsv}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider transition shadow-sm flex items-center space-x-2 disabled:bg-slate-300"
                      >
                        {importingCsv ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Importation en cours...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>
                              Confirmer l'import ({validRowsCount} véhicules valides)
                            </span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 5: FINAL CONFIRMATION & SUMMARY */}
              {csvStep === 5 && importResult && (
                <div className="space-y-5">
                  <div className="p-4 bg-emerald-600 text-white flex items-center space-x-3 shadow-md">
                    <CheckCircle2 className="w-8 h-8 flex-shrink-0" />
                    <div>
                      <h3 className="font-black text-sm uppercase tracking-wider">
                        Importation terminée avec succès !
                      </h3>
                      <p className="text-xs text-emerald-100 font-medium">
                        {importResult.addedCount} véhicule(s) ont été enregistrés dans la base de
                        données du stock.
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 p-4 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 border-b pb-2">
                      Résumé Général de l'Importation :
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div className="bg-white p-3 border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">
                          Total Lignes
                        </span>
                        <span className="text-lg font-black font-mono text-slate-800">
                          {importResult.totalRows}
                        </span>
                      </div>
                      <div className="bg-white p-3 border border-slate-200">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase block">
                          Lignes Valides
                        </span>
                        <span className="text-lg font-black font-mono text-emerald-800">
                          {importResult.validCount}
                        </span>
                      </div>
                      <div className="bg-white p-3 border border-slate-200">
                        <span className="text-[10px] font-bold text-rose-700 uppercase block">
                          Lignes Rejetées
                        </span>
                        <span className="text-lg font-black font-mono text-rose-800">
                          {importResult.rejectedCount}
                        </span>
                      </div>
                      <div className="bg-emerald-50 p-3 border border-emerald-300">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase block">
                          Véhicules Ajoutés
                        </span>
                        <span className="text-lg font-black font-mono text-emerald-900">
                          {importResult.addedCount}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-3 border-t">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider transition shadow-sm"
                    >
                      Terminer &amp; Fermer
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* EDIT CATALOG OPTION MODAL */}
      {editCatalogModal.isOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center space-x-2">
                <Pencil className="w-4 h-4 text-indigo-600" />
                <span>
                  Modifier {editCatalogModal.type === 'brand' ? 'la marque' : 'le modèle'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setEditCatalogModal((p) => ({ ...p, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Saisissez le nouveau nom pour <span className="font-bold">{editCatalogModal.oldValue}</span>. Les modifications seront propagées automatiquement dans tous les véhicules et modules.
            </p>

            <div>
              <input
                type="text"
                autoFocus
                value={editCatalogModal.newValue}
                onChange={(e) =>
                  setEditCatalogModal((p) => ({ ...p, newValue: e.target.value, error: null }))
                }
                className="w-full px-3.5 py-2.5 text-xs font-bold border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                placeholder="Nouveau nom..."
              />
              {editCatalogModal.error && (
                <p className="text-[11px] text-rose-600 font-bold mt-1">{editCatalogModal.error}</p>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditCatalogModal((p) => ({ ...p, isOpen: false }))}
                className="px-4 py-2 text-xs font-bold border border-slate-300 hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmEditCatalog}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider shadow-xs"
              >
                Appliquer &amp; Propager
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CATALOG OPTION CONFIRMATION MODAL */}
      {deleteCatalogModal.isOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-rose-200 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-rose-700 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>
                  Supprimer {deleteCatalogModal.type === 'brand' ? 'la marque' : 'le modèle'} du référentiel
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setDeleteCatalogModal((p) => ({ ...p, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">
              Êtes-vous sûr de vouloir supprimer{' '}
              <span className="font-bold text-slate-900">{deleteCatalogModal.targetValue}</span> du référentiel ?
              <br />
              <span className="text-rose-600 font-bold mt-1 block">
                Cette suppression retirera l'élément du catalogue et réinitialisera automatiquement les dépendances dans tous les véhicules associés.
              </span>
            </p>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setDeleteCatalogModal((p) => ({ ...p, isOpen: false }))}
                className="px-4 py-2 text-xs font-bold border border-slate-300 hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCatalog}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider shadow-xs"
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gemini Camera VIN OCR Modal */}
      <VinCameraOcrModal
        isOpen={showCameraOcrModal}
        onClose={() => setShowCameraOcrModal(false)}
        onVinConfirmed={(confirmedVin) => {
          setVin(confirmedVin);
          if (fieldErrors.vin) setFieldErrors({ ...fieldErrors, vin: undefined });
        }}
        existingVehicles={existingVehicles}
      />

      {/* Barcode / VIN Scanner Modal */}
      <QrBarcodeScannerModal
        isOpen={showBarcodeScannerModal}
        onClose={() => setShowBarcodeScannerModal(false)}
        onScanSuccess={(scannedVin) => {
          setVin(scannedVin);
          if (fieldErrors.vin) setFieldErrors({ ...fieldErrors, vin: undefined });
          setShowBarcodeScannerModal(false);
        }}
        sampleChassisList={existingVehicles.map((v) => v.chassis_number || v.vin).filter(Boolean)}
      />
    </div>
  );
};
