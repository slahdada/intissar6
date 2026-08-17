import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  X,
  Upload,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Car,
  Edit3,
  Check,
  Search,
} from 'lucide-react';
import { Vehicle } from '../types';
import { api } from '../lib/api';

interface VinCameraOcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVinConfirmed: (vin: string) => void;
  existingVehicles?: Vehicle[];
}

export const VinCameraOcrModal: React.FC<VinCameraOcrModalProps> = ({
  isOpen,
  onClose,
  onVinConfirmed,
  existingVehicles = [],
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  // Gemini OCR Raw Result
  const [ocrResult, setOcrResult] = useState<{
    vin: string;
    confidence: number;
    message: string;
  } | null>(null);

  // User-editable VIN input
  const [editableVin, setEditableVin] = useState('');
  const [manualMode, setManualMode] = useState(false);

  // Validation States
  const [validationError, setValidationError] = useState<string | null>(null);
  const [forbiddenCharsWarning, setForbiddenCharsWarning] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [duplicateVehicle, setDuplicateVehicle] = useState<Vehicle | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop camera stream tracks safely
  const stopCameraStream = () => {
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      setStream(null);
    }
  };

  // Start Camera with facingMode: "environment"
  const startCamera = async () => {
    stopCameraStream();
    setCameraError(null);
    setIsPermissionDenied(false);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('La caméra n’est pas prise en charge sur cet appareil ou ce navigateur.');
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('Camera access failed:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setIsPermissionDenied(true);
        setCameraError(
          "Autorisation d'accès à la caméra refusée. Vous pouvez autoriser l'accès dans les réglages de votre navigateur ou importer une photo de l'étiquette VIN."
        );
      } else {
        setCameraError(
          "Aucune caméra arrière n'a pu être initialisée. Utilisez le bouton d'import d'image ci-dessous."
        );
      }
    }
  };

  // Manage modal open/close lifecycle
  useEffect(() => {
    if (isOpen) {
      // Reset modal state
      setCapturedImage(null);
      setOcrResult(null);
      setEditableVin('');
      setValidationError(null);
      setForbiddenCharsWarning(null);
      setApiError(null);
      setDuplicateVehicle(null);
      setManualMode(false);
      startCamera();
    } else {
      stopCameraStream();
    }

    return () => {
      stopCameraStream();
    };
  }, [isOpen]);

  // Handle Capture from live video stream
  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

    setCapturedImage(dataUrl);
    stopCameraStream();
    processImageWithGemini(dataUrl);
  };

  // Handle File Import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCapturedImage(dataUrl);
        stopCameraStream();
        processImageWithGemini(dataUrl);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Process image via Gemini Vision API
  const processImageWithGemini = async (imageDataUrl: string) => {
    setIsAnalyzing(true);
    setApiError(null);
    setValidationError(null);
    setForbiddenCharsWarning(null);
    setOcrResult(null);
    setDuplicateVehicle(null);

    try {
      const res = await api.scanVinOcr(imageDataUrl);

      const rawVin = (res.vin || '').toUpperCase().trim();
      // Clean string: remove spaces, dashes, special chars
      const cleaned = rawVin.replace(/[^A-Z0-9]/g, '');

      setOcrResult({
        vin: cleaned,
        confidence: res.confidence !== undefined ? res.confidence : 0,
        message: res.message || '',
      });

      setEditableVin(cleaned);
      validateVinInput(cleaned, rawVin);
    } catch (err: any) {
      console.error('Gemini Vision OCR Error:', err);
      setApiError(
        err.message ||
          "Impossible d'analyser l'image via Gemini Vision. Conservez l'image et tentez une nouvelle analyse ou saisissez le VIN manuellement."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Validate VIN string according to strict specifications
  const validateVinInput = (valToTest: string, originalRawText?: string) => {
    setValidationError(null);
    setForbiddenCharsWarning(null);
    setDuplicateVehicle(null);

    const uppercase = valToTest.toUpperCase().replace(/\s+/g, '').replace(/-/g, '');

    if (!uppercase) {
      setValidationError(
        'VIN non détecté. Rapprochez-vous de l’étiquette, améliorez la lumière ou saisissez-le manuellement.'
      );
      return false;
    }

    // Check forbidden characters I, O, Q
    const textToCheck = originalRawText ? originalRawText.toUpperCase() : uppercase;
    const forbiddenMatches = textToCheck.match(/[IOQ]/g);
    if (forbiddenMatches) {
      const forbiddenUnique = Array.from(new Set(forbiddenMatches)).join(', ');
      setForbiddenCharsWarning(
        `Attention : La ou les lettres [ ${forbiddenUnique} ] sont strictement interdites dans un VIN ISO 3779 (confusion avec 1, 0, 9). Veuillez la/les remplacer par le chiffre ou la lettre exacte.`
      );
    }

    if (uppercase.length !== 17) {
      setValidationError(
        `Le VIN doit comporter exactement 17 caractères alphanumériques (actuellement : ${uppercase.length}).`
      );
      return false;
    }

    // Check duplicate VIN in active stock
    if (existingVehicles && existingVehicles.length > 0) {
      const dup = existingVehicles.find(
        (v) => (v.chassis_number?.toUpperCase() === uppercase || v.vin?.toUpperCase() === uppercase) && v.status !== 'livre'
      );
      if (dup) {
        setDuplicateVehicle(dup);
      }
    }

    return !forbiddenMatches && uppercase.length === 17;
  };

  // On typing in the editable VIN field
  const handleEditableVinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setEditableVin(val);
    validateVinInput(val, val);
  };

  // Final confirmation step
  const handleConfirmVin = () => {
    const cleaned = editableVin.toUpperCase().trim();
    if (cleaned.length !== 17) {
      setValidationError('Veuillez saisir un VIN valide de exactement 17 caractères avant de confirmer.');
      return;
    }
    if (/[IOQ]/.test(cleaned)) {
      setValidationError('Les lettres I, O et Q sont interdites dans un numéro VIN.');
      return;
    }

    onVinConfirmed(cleaned);
    stopCameraStream();
    onClose();
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setOcrResult(null);
    setEditableVin('');
    setValidationError(null);
    setForbiddenCharsWarning(null);
    setApiError(null);
    setDuplicateVehicle(null);
    startCamera();
  };

  if (!isOpen) return null;

  // Render confidence badge
  const renderConfidenceBadge = (score: number) => {
    let level = 'Faible';
    let colorClass = 'bg-amber-100 text-amber-900 border-amber-300';
    const percentage = Math.round(score * 100);

    if (score >= 0.85) {
      level = 'Élevée';
      colorClass = 'bg-emerald-100 text-emerald-900 border-emerald-300';
    } else if (score >= 0.6) {
      level = 'Moyenne';
      colorClass = 'bg-blue-100 text-blue-900 border-blue-300';
    }

    return (
      <span
        className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded text-[11px] font-black uppercase tracking-wider border ${colorClass}`}
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>
          Confiance {level} ({percentage > 0 ? `${percentage}%` : 'Standard'})
        </span>
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 text-white rounded-none border-2 border-slate-700 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-600/20 border border-blue-500/30 text-blue-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-100 flex items-center gap-2">
                <span>Scanner VIN par Caméra</span>
                <span className="text-[10px] bg-blue-600 text-white font-bold px-2 py-0.5 rounded tracking-normal">
                  IA Gemini Vision
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Reconnaissance automatique du numéro de châssis (17 caractères)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 transition rounded"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* File Input (Hidden) */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* STATE 1: Live Camera View or Camera Error */}
          {!capturedImage && !manualMode && (
            <div className="space-y-4">
              {cameraError ? (
                /* Camera Error Box */
                <div className="bg-slate-950 border border-amber-500/40 p-5 rounded space-y-3">
                  <div className="flex items-start space-x-3 text-amber-400">
                    <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold uppercase tracking-wider">
                        Accès Caméra Limité ou Refusé
                      </h3>
                      <p className="text-xs text-slate-300 leading-relaxed">{cameraError}</p>
                    </div>
                  </div>
                  <div className="pt-2 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider py-3 px-4 flex items-center justify-center space-x-2 transition shadow-md min-h-[44px]"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Importer une Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider py-3 px-4 flex items-center justify-center space-x-2 transition min-h-[44px]"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Réessayer la Caméra</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Live Video View with Guiding Frame */
                <div className="relative bg-black rounded border border-slate-800 overflow-hidden aspect-video max-h-[320px] flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  {/* Guiding Box Overlay */}
                  <div className="absolute inset-0 border-2 border-dashed border-blue-400/60 pointer-events-none flex flex-col items-center justify-center m-6 rounded-lg bg-blue-900/10">
                    <div className="w-full h-full border-2 border-blue-400 relative rounded">
                      {/* Corner accents */}
                      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-blue-400" />
                      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-blue-400" />
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-blue-400" />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-blue-400" />
                    </div>
                  </div>

                  <div className="absolute bottom-2 left-0 right-0 text-center px-2">
                    <span className="bg-slate-950/90 text-slate-200 text-[10px] font-mono px-3 py-1 rounded border border-slate-800 backdrop-blur-sm shadow-sm inline-block">
                      🎯 Visez l'étiquette VIN ou la plaque gravée de châssis
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {!cameraError && (
                  <button
                    type="button"
                    onClick={handleCapturePhoto}
                    className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-black text-xs uppercase tracking-wider py-3.5 px-4 flex items-center justify-center space-x-2 transition shadow-md min-h-[44px]"
                  >
                    <Camera className="w-5 h-5" />
                    <span>Capturer la photo</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider py-3.5 px-4 flex items-center justify-center space-x-2 transition min-h-[44px]"
                >
                  <Upload className="w-4 h-4 text-blue-400" />
                  <span>Importer une photo</span>
                </button>
              </div>
            </div>
          )}

          {/* STATE 2: Analyzing with Gemini Vision */}
          {isAnalyzing && (
            <div className="bg-slate-950 p-6 border border-slate-800 text-center space-y-4 rounded">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
                <Sparkles className="w-7 h-7 text-blue-400 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-100">
                  Analyse de l'image en cours…
                </h3>
                <p className="text-xs text-slate-400">
                  Extraction et vérification du VIN à 17 caractères par l'IA Gemini Vision
                </p>
              </div>

              {capturedImage && (
                <div className="max-w-[200px] mx-auto rounded overflow-hidden border border-slate-800 opacity-60">
                  <img src={capturedImage} alt="Capture VIN" className="w-full h-auto object-cover max-h-28" />
                </div>
              )}
            </div>
          )}

          {/* STATE 3: Gemini API Error */}
          {apiError && !isAnalyzing && (
            <div className="bg-rose-950/60 border border-rose-600/60 p-4 rounded space-y-3">
              <div className="flex items-start space-x-3 text-rose-300">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
                <div className="text-xs space-y-1">
                  <strong className="font-bold uppercase tracking-wider block text-rose-200">
                    Erreur d'analyse IA
                  </strong>
                  <p>{apiError}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => capturedImage && processImageWithGemini(capturedImage)}
                  className="bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs uppercase px-3 py-2 transition min-h-[44px]"
                >
                  Réessayer l'Analyse
                </button>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase px-3 py-2 transition min-h-[44px]"
                >
                  Reprendre une Photo
                </button>
              </div>
            </div>
          )}

          {/* STATE 4: Result Display & VIN Editing */}
          {capturedImage && !isAnalyzing && (ocrResult || editableVin !== '') && (
            <div className="space-y-4">
              {/* Photo Thumbnail + Gemini Status */}
              <div className="flex flex-col sm:flex-row gap-3 bg-slate-950 p-3 border border-slate-800 rounded">
                <div className="w-full sm:w-32 shrink-0 rounded overflow-hidden border border-slate-800 bg-black flex items-center justify-center">
                  <img
                    src={capturedImage}
                    alt="Photo analysée"
                    className="max-h-24 object-contain w-full"
                  />
                </div>
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      Résultat Détecté par Gemini
                    </span>
                    {ocrResult && renderConfidenceBadge(ocrResult.confidence)}
                  </div>
                  {ocrResult?.message && (
                    <p className="text-xs text-slate-300 italic bg-slate-900 p-2 rounded border border-slate-800">
                      "{ocrResult.message}"
                    </p>
                  )}
                </div>
              </div>

              {/* Warnings / Errors */}
              {validationError && (
                <div className="bg-amber-950/70 border border-amber-600/80 p-3.5 rounded text-xs text-amber-200 flex items-start space-x-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <strong className="font-black uppercase tracking-wider block text-amber-300">
                      VIN Douteux ou Non Détecté :
                    </strong>
                    <p>{validationError}</p>
                  </div>
                </div>
              )}

              {forbiddenCharsWarning && (
                <div className="bg-rose-950/70 border border-rose-600/80 p-3.5 rounded text-xs text-rose-200 flex items-start space-x-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <strong className="font-black uppercase tracking-wider block text-rose-300">
                      Lettres Interdites Détectées :
                    </strong>
                    <p>{forbiddenCharsWarning}</p>
                  </div>
                </div>
              )}

              {duplicateVehicle && (
                <div className="bg-blue-950/80 border border-blue-500 p-3.5 rounded text-xs text-blue-200 space-y-2">
                  <div className="flex items-start space-x-2.5">
                    <Car className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-black uppercase tracking-wider block text-blue-300">
                        Véhicule Déjà Existant en Stock !
                      </strong>
                      <p>
                        Ce numéro de châssis ({duplicateVehicle.chassis_number}) est actuellement enregistré
                        dans le parc : <br />
                        <span className="font-bold text-white">
                          {duplicateVehicle.brand} {duplicateVehicle.model} ({duplicateVehicle.color})
                        </span>{' '}
                        sur le site{' '}
                        <span className="font-bold text-blue-300">
                          {duplicateVehicle.current_site_id || 'Non spécifié'}
                        </span>.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Editable VIN Field */}
              <div className="bg-slate-950 p-4 border border-slate-800 space-y-2 rounded">
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-300 flex items-center justify-between">
                  <span>Vérifiez & Confirmez le VIN (17 Caractères)*</span>
                  <span className="text-slate-400 font-mono text-[10px]">
                    {editableVin.length}/17 caractères
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={editableVin}
                    onChange={handleEditableVinChange}
                    maxLength={17}
                    placeholder="Saisissez ou corrigez le VIN 17 chars"
                    className={`w-full font-mono text-base uppercase font-bold p-3 bg-slate-900 border text-slate-100 tracking-widest focus:outline-none focus:ring-2 ${
                      editableVin.length === 17 && !forbiddenCharsWarning
                        ? 'border-emerald-500 focus:ring-emerald-500/50'
                        : 'border-amber-500/80 focus:ring-amber-500/50'
                    }`}
                  />
                  {editableVin.length === 17 && !forbiddenCharsWarning && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  )}
                </div>
                <p className="text-[10px] text-slate-400">
                  Vous pouvez éditer les caractères directement ci-dessus en cas de doute ou d'imprécision OCR.
                </p>
              </div>
            </div>
          )}

          {/* STATE 5: Manual Entry Fallback Toggle */}
          {manualMode && (
            <div className="bg-slate-950 p-4 border border-slate-800 space-y-3 rounded">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-400" />
                <span>Saisie Manuelle de Secours</span>
              </h3>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  Saisissez les 17 caractères alphanumériques :
                </label>
                <input
                  type="text"
                  value={editableVin}
                  onChange={handleEditableVinChange}
                  maxLength={17}
                  placeholder="EX: VF3P208AX10029381"
                  className="w-full font-mono text-sm uppercase font-bold p-3 bg-slate-900 border border-slate-700 text-white tracking-widest focus:outline-none focus:border-blue-500"
                />
              </div>
              <p className="text-[10px] text-slate-400">
                Format standard VIN : 17 caractères, majuscules, sans espaces ni tirets, excluant I, O et Q.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            {!manualMode ? (
              <button
                type="button"
                onClick={() => setManualMode(true)}
                className="text-[11px] text-slate-400 hover:text-blue-400 underline uppercase font-bold tracking-wider"
              >
                Passer en saisie manuelle
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setManualMode(false);
                  startCamera();
                }}
                className="text-[11px] text-slate-400 hover:text-blue-400 underline uppercase font-bold tracking-wider"
              >
                Retour à la caméra
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            {capturedImage && (
              <button
                type="button"
                onClick={handleRetake}
                className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider transition min-h-[44px]"
              >
                Reprendre Photo
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                stopCameraStream();
                onClose();
              }}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider transition min-h-[44px]"
            >
              Fermer
            </button>

            {(editableVin !== '' || capturedImage) && (
              <button
                type="button"
                onClick={handleConfirmVin}
                disabled={editableVin.length !== 17 || !!forbiddenCharsWarning}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-wider flex items-center space-x-1.5 transition shadow-md min-h-[44px]"
              >
                <Check className="w-4 h-4" />
                <span>Utiliser ce VIN</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
