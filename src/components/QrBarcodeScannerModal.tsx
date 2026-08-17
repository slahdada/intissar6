import React, { useEffect, useState, useRef } from 'react';
import { Camera, X, Upload, CheckCircle2, AlertCircle, RefreshCw, Car } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface QrBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (chassisNumber: string) => void;
  sampleChassisList?: string[];
}

export const QrBarcodeScannerModal: React.FC<QrBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  sampleChassisList = [],
}) => {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current?.clear();
            scannerRef.current = null;
          })
          .catch(() => {
            scannerRef.current = null;
          });
      }
      setScanning(false);
      setCameraError(null);
      setScannedResult(null);
      return;
    }

    const scannerId = 'qr-barcode-reader-view';
    const html5QrCode = new Html5Qrcode(scannerId);
    scannerRef.current = html5QrCode;

    setScanning(true);
    setCameraError(null);

    const config = {
      fps: 10,
      qrbox: { width: 260, height: 160 },
      aspectRatio: 1.0,
    };

    html5QrCode
      .start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          const cleanText = decodedText.trim().toUpperCase();
          setScannedResult(cleanText);
          onScanSuccess(cleanText);
          // Stop scanner after successful scan
          html5QrCode
            .stop()
            .then(() => {
              html5QrCode.clear();
              scannerRef.current = null;
              onClose();
            })
            .catch(() => {
              onClose();
            });
        },
        () => {
          // Frame scan error (normal scanning iterations)
        }
      )
      .catch((err) => {
        console.warn('Camera start error:', err);
        setScanning(false);
        setCameraError(
          'Impossible d accéder à la caméra. Vérifiez les autorisations de votre navigateur ou importez une photo du code-barres.'
        );
      });

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current?.clear();
            scannerRef.current = null;
          })
          .catch(() => {});
      }
    };
  }, [isOpen]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCameraError(null);
      const html5QrCode = scannerRef.current || new Html5Qrcode('qr-barcode-reader-view');
      const result = await html5QrCode.scanFile(file, true);
      const cleanText = result.trim().toUpperCase();
      setScannedResult(cleanText);
      onScanSuccess(cleanText);
      onClose();
    } catch (err) {
      setCameraError('Aucun code-barres ou QR code lisible n a été détecté sur cette photo.');
    }
  };

  const handleSelectSample = (vin: string) => {
    setScannedResult(vin);
    onScanSuccess(vin);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-none">
      <div className="bg-white shadow-2xl max-w-md w-full border-2 border-slate-900 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b-4 border-blue-600">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 text-white">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-100">
                Scanner Châssis / VIN
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Caméra direct ou importation d image
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Viewfinder Container */}
          <div className="relative bg-slate-950 border-2 border-slate-800 rounded-none overflow-hidden min-h-[260px] flex items-center justify-center">
            <div id="qr-barcode-reader-view" className="w-full h-full" />

            {scanning && !cameraError && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                <div className="w-64 h-36 border-2 border-blue-500 border-dashed relative animate-pulse">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-blue-400" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-blue-400" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-blue-400" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-blue-400" />
                </div>
                <span className="text-[10px] bg-slate-900/90 text-blue-300 font-mono font-bold uppercase px-2 py-1 mt-3 border border-blue-500/40">
                  Alignez le code-barres VIN dans le cadre
                </span>
              </div>
            )}
          </div>

          {/* Scanned Result Notice */}
          {scannedResult && (
            <div className="bg-emerald-50 border-l-4 border-emerald-600 border-y border-r border-emerald-200 p-3 flex items-center space-x-2 text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <div>
                <span className="font-black uppercase tracking-wider block text-[10px]">Châssis Scanné :</span>
                <span className="font-mono font-bold text-sm text-emerald-950">{scannedResult}</span>
              </div>
            </div>
          )}

          {/* Error Notice */}
          {cameraError && (
            <div className="bg-rose-50 border-l-4 border-rose-600 border-y border-r border-rose-200 p-3 text-xs text-rose-900 space-y-2">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] font-medium leading-relaxed">{cameraError}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 border-t border-slate-200 flex flex-col gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold uppercase tracking-wider p-2.5 border border-slate-300 transition"
            >
              <Upload className="w-4 h-4 text-slate-600" />
              <span>Charger une photo / fichier code-barres</span>
            </button>
          </div>

          {/* Quick Demo Scan Shortcuts for testing */}
          {sampleChassisList.length > 0 && (
            <div className="pt-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">
                Raccourcis de simulation de scan :
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {sampleChassisList.slice(0, 6).map((vin) => (
                  <button
                    key={vin}
                    type="button"
                    onClick={() => handleSelectSample(vin)}
                    className="bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-900 border border-slate-200 hover:border-blue-300 text-[10px] font-mono font-bold px-2 py-1 transition flex items-center space-x-1"
                  >
                    <Car className="w-3 h-3 text-slate-400" />
                    <span>{vin}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 p-3 border-t border-slate-300 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 text-white text-xs font-black uppercase tracking-wider hover:bg-slate-800 transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
