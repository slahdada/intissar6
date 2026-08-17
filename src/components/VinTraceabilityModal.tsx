import React, { useState } from 'react';
import {
  X,
  History,
  Route,
  Building2,
  Calendar,
  UserCheck,
  Truck,
  ArrowRight,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  FileText,
  Printer,
  Copy,
  Check,
  Car,
  Download,
  Info,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MovementWithDetails, Site } from '../types';
import { formatDateTime } from '../lib/dateUtils';
import { generateMovementVoucherPDF } from '../lib/pdfVoucher';
import { getImporterForBrand } from '../data/importers';

interface VinTraceabilityModalProps {
  vin: string;
  movements: MovementWithDetails[];
  sites: Site[];
  onClose: () => void;
  onSelectVehicle?: (chassis: string) => void;
}

export const VinTraceabilityModal: React.FC<VinTraceabilityModalProps> = ({
  vin,
  movements,
  sites,
  onClose,
  onSelectVehicle,
}) => {
  const [copied, setCopied] = useState(false);

  const siteMap = new Map<string, string>();
  sites.forEach((s) => siteMap.set(s.id, s.name));

  const cleanVin = vin.trim().toUpperCase();

  // Filter movements for this specific VIN and sort chronologically (ascending: earliest to latest)
  const vinMovements = movements
    .filter((m) => {
      const chassis = (m.vehicle_chassis || m.chassis_number || '').trim().toUpperCase();
      return chassis === cleanVin;
    })
    .sort((a, b) => new Date(a.movement_date).getTime() - new Date(b.movement_date).getTime());

  // Vehicle info summary from movements
  const brand = vinMovements[0]?.vehicle_brand || '';
  const model = vinMovements[0]?.vehicle_model || '';
  const imp = getImporterForBrand(brand);

  const firstMovement = vinMovements[0];
  const lastMovement = vinMovements[vinMovements.length - 1];

  const initialEntrySite =
    firstMovement?.departure_site_name ||
    (firstMovement?.departure_site_id ? siteMap.get(firstMovement.departure_site_id) : null) ||
    firstMovement?.arrival_site_name ||
    'Port / Concessionnaire';

  const currentSite =
    lastMovement?.arrival_site_name ||
    (lastMovement?.arrival_site_id ? siteMap.get(lastMovement.arrival_site_id) : null) ||
    lastMovement?.destination_text ||
    'Parc STAFIM';

  const handleCopyVin = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cleanVin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getMovementBadge = (type: string, statusBefore?: string, statusAfter?: string) => {
    switch (type) {
      case 'entry':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-black uppercase bg-emerald-100 text-emerald-900 border border-emerald-300">
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>Création / Entrée en Stock</span>
          </span>
        );
      case 'pickup':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300">
            <Truck className="w-3.5 h-3.5" />
            <span>Ramassage (En transit)</span>
          </span>
        );
      case 'reception':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-black uppercase bg-blue-100 text-blue-900 border border-blue-300">
            <Building2 className="w-3.5 h-3.5" />
            <span>Réception à l'arrivée (En stock)</span>
          </span>
        );
      case 'transfer':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-black uppercase bg-indigo-100 text-indigo-900 border border-indigo-300">
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Transfert Inter-sites</span>
          </span>
        );
      case 'exit':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-black uppercase bg-purple-100 text-purple-900 border border-purple-300">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Sortie Définitive / Livraison</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-black uppercase bg-slate-100 text-slate-800 border border-slate-300">
            <span>Mouvement</span>
          </span>
        );
    }
  };

  const handleExportTraceabilityPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Header Banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 34, 'F');

    doc.setFillColor(37, 99, 235); // blue-600
    doc.rect(0, 34, 210, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('RAPPORT DE TRAÇABILITÉ COMPLÈTE DU VÉHICULE', 14, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(203, 213, 225);
    doc.text(`NUMÉRO DE CHÂSSIS (VIN) : ${cleanVin}`, 14, 23);

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Édité le ${formatDateTime(new Date())} | Parc Logistique STAFIM`, 14, 29);

    // Summary Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 42, 182, 26, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`Marque / Modèle : ${brand || '-'} ${model || '-'}`, 18, 50);
    doc.text(`Premier enregistrement : ${firstMovement ? formatDateTime(firstMovement.movement_date) : '-'}`, 18, 56);
    doc.text(`Site d'Entrée : ${initialEntrySite}`, 18, 62);

    doc.text(`Total Mouvements : ${vinMovements.length}`, 115, 50);
    doc.text(`Dernier statut : ${lastMovement ? lastMovement.movement_type.toUpperCase() : '-'}`, 115, 56);
    doc.text(`Localisation Actuelle : ${currentSite}`, 115, 62);

    // Timeline Table
    const tableColumns = ['Étape', 'Horodatage', 'Type', 'Départ ➔ Arrivée', 'Opérateur', 'Notes / Transport'];

    const tableRows = vinMovements.map((m, idx) => {
      const typeLabel =
        m.movement_type === 'entry'
          ? 'ENTRÉE'
          : m.movement_type === 'transfer'
          ? 'TRANSFERT'
          : 'SORTIE';
      const dep = m.departure_site_name || (m.departure_site_id ? siteMap.get(m.departure_site_id) : '-') || '-';
      const arr = m.arrival_site_name || (m.arrival_site_id ? siteMap.get(m.arrival_site_id) : '-') || m.destination_text || '-';

      let details = m.notes || '';
      if (m.driver_name || m.truck_plate) {
        details += ` (Chauffeur: ${m.driver_name || '-'}, Camion: ${m.truck_plate || '-'})`;
      }

      return [
        `N°${idx + 1}`,
        formatDateTime(m.movement_date),
        typeLabel,
        `${dep} ➔ ${arr}`,
        m.created_by_user_name || 'Agent',
        details.trim() || '-',
      ];
    });

    autoTable(doc, {
      startY: 74,
      head: [tableColumns],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [30, 41, 59],
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 16 },
        1: { fontStyle: 'bold', cellWidth: 32 },
        2: { fontStyle: 'bold', cellWidth: 24 },
        3: { cellWidth: 50 },
        4: { cellWidth: 28 },
        5: { cellWidth: 'auto' },
      },
      margin: { left: 14, right: 14, bottom: 20 },
      didDrawPage: (data) => {
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 8);
        doc.text(
          `Document de Traçabilité Officiel STAFIM | VIN: ${cleanVin}`,
          doc.internal.pageSize.width - 120,
          doc.internal.pageSize.height - 8
        );
      },
    });

    doc.save(`tracabilite_VIN_${cleanVin}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4 overflow-y-auto backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-white border-2 border-slate-900 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b-4 border-blue-600 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 text-white">
              <Route className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-black uppercase tracking-wider">
                  Traçabilité Chronologique du Véhicule
                </h2>
                <span className="bg-blue-500 text-white text-[10px] font-black px-2 py-0.5 uppercase tracking-widest">
                  Parc STAFIM
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 flex items-center space-x-2 font-mono">
                <span>Châssis VIN : <strong>{cleanVin}</strong></span>
                <button
                  type="button"
                  onClick={handleCopyVin}
                  className="hover:text-blue-400 transition inline-flex items-center space-x-1 text-slate-400 p-0.5"
                  title="Copier le VIN"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportTraceabilityPDF}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider px-3 py-2 border border-blue-400 transition flex items-center space-x-1.5 shadow-sm"
              title="Exporter le rapport de traçabilité en PDF"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exporter Rapport PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Fermer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Vehicle Summary Bar */}
        <div className="bg-slate-800 text-slate-100 p-4 border-b border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-4 flex-shrink-0 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Marque & Modèle
            </span>
            <div className="font-black text-white text-sm uppercase flex items-center space-x-1.5 mt-0.5">
              <span>{brand || '-'} {model}</span>
              {imp && (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] px-1.5 py-0.2 font-mono">
                  {imp.code}
                </span>
              )}
            </div>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Entrée en Stock Initial
            </span>
            <span className="font-mono text-slate-200 font-bold block mt-0.5">
              {firstMovement ? formatDateTime(firstMovement.movement_date) : 'Aucun mouvement'}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Emplacement Actuel / Dernier
            </span>
            <span className="font-bold text-blue-300 block mt-0.5 truncate">
              {currentSite}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Total Mouvements
            </span>
            <span className="font-mono text-amber-400 font-black text-sm block mt-0.5">
              {vinMovements.length} Étape{vinMovements.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Modal Body - Timeline */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center space-x-2">
              <History className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">
                Historique Chronologique des Mouvements (Du premier au dernier transfert)
              </h3>
            </div>
            {onSelectVehicle && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSelectVehicle(cleanVin);
                }}
                className="text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline flex items-center space-x-1"
              >
                <Car className="w-3.5 h-3.5" />
                <span>Ouvrir la Fiche Véhicule Générale</span>
              </button>
            )}
          </div>

          {vinMovements.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200">
              <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700 uppercase">
                Aucun mouvement enregistré pour le VIN : {cleanVin}
              </p>
            </div>
          ) : (
            <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-1 before:bg-blue-200">
              {vinMovements.map((m, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === vinMovements.length - 1;
                const dep =
                  m.departure_site_name ||
                  (m.departure_site_id ? siteMap.get(m.departure_site_id) : null) ||
                  '-';
                const arr =
                  m.arrival_site_name ||
                  (m.arrival_site_id ? siteMap.get(m.arrival_site_id) : null) ||
                  m.destination_text ||
                  '-';

                return (
                  <div key={m.id} className="relative group">
                    {/* Timeline Dot */}
                    <div
                      className={`absolute -left-6 sm:-left-8 top-3 w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-black z-10 transition ${
                        isFirst
                          ? 'bg-emerald-600 border-emerald-700 text-white shadow-xs'
                          : isLast
                          ? 'bg-blue-600 border-blue-700 text-white shadow-xs'
                          : 'bg-white border-slate-400 text-slate-700'
                      }`}
                    >
                      {idx + 1}
                    </div>

                    {/* Step Card */}
                    <div className="bg-white border-2 border-slate-200 hover:border-blue-500 transition p-5 shadow-xs space-y-3">
                      {/* Step Card Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center space-x-2">
                          {getMovementBadge(m.movement_type)}
                          <span className="text-xs font-mono font-bold text-slate-700">
                            {formatDateTime(m.movement_date)}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2 text-slate-500 text-xs">
                          <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-bold">
                            Agent : {m.created_by_user_name || 'Système'}
                          </span>
                        </div>
                      </div>

                      {/* Itinerary */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3.5 border border-slate-200">
                        <div className="flex items-start space-x-2">
                          <Building2 className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                              Site de Départ (Origine)
                            </span>
                            <span className="text-xs font-black text-slate-900 uppercase">
                              {dep}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start space-x-2">
                          <ArrowRight className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0 hidden md:block" />
                          <Building2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0 md:hidden" />
                          <div>
                            <span className="text-[10px] font-black uppercase text-blue-600 block tracking-wider">
                              Site d'Arrivée (Destination)
                            </span>
                            <span className="text-xs font-black text-slate-900 uppercase">
                              {arr}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Multi route or Transport Details if present */}
                      {(m.driver_name || m.truck_plate || m.transporter_name || m.notes) && (
                        <div className="text-xs space-y-1.5 pt-1">
                          {(m.transporter_name || m.driver_name || m.truck_plate) && (
                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-700 bg-blue-50/50 p-2 border border-blue-100">
                              <span className="font-bold flex items-center space-x-1 text-blue-900">
                                <Truck className="w-3.5 h-3.5 text-blue-600" />
                                <span>Logistique :</span>
                              </span>
                              {m.transporter_name && <span>Société : <strong>{m.transporter_name}</strong></span>}
                              {m.driver_name && <span>Chauffeur : <strong>{m.driver_name}</strong></span>}
                              {m.truck_plate && <span>Camion : <strong className="font-mono">{m.truck_plate}</strong></span>}
                              {m.driver_phone && <span>Tél : <strong className="font-mono">{m.driver_phone}</strong></span>}
                            </div>
                          )}

                          {m.notes && (
                            <div className="text-slate-600 italic bg-amber-50/60 p-2 border border-amber-100 text-[11px]">
                              <strong className="not-italic text-amber-900">Remarque / Observation :</strong> {m.notes}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Step Footer Actions */}
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-[10px] font-mono text-slate-400 uppercase">
                          Réf Mouvement: #{m.id}
                        </span>
                        <button
                          type="button"
                          onClick={() => generateMovementVoucherPDF(m, sites)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-800 text-[10px] font-black uppercase tracking-wider border border-slate-300 transition flex items-center space-x-1"
                          title="Télécharger le bon de mouvement de cette étape en PDF"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Imprimer Bon de Mouvement</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-white p-4 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Affichage de la traçabilité complète du VIN <strong className="font-mono text-slate-800">{cleanVin}</strong>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
