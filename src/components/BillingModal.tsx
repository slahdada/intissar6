import React, { useState, useEffect } from 'react';
import {
  X,
  Receipt,
  FileText,
  Download,
  Calculator,
  Building2,
  Filter,
  Tag,
  Car,
  CheckCircle2,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MovementWithDetails, Site } from '../types';
import { formatDateTime } from '../lib/dateUtils';
import { OFFICIAL_IMPORTERS, getImporterForBrand, ImporterInfo } from '../data/importers';

interface BillingModalProps {
  movements: MovementWithDetails[];
  sites: Site[];
  startDate?: string;
  endDate?: string;
  selectedSiteId?: string;
  initialImporterId?: string;
  initialBrand?: string;
  onClose: () => void;
}

export const BillingModal: React.FC<BillingModalProps> = ({
  movements,
  sites,
  startDate,
  endDate,
  selectedSiteId,
  initialImporterId = '',
  initialBrand = '',
  onClose,
}) => {
  // Filters inside modal
  const [selectedImporterId, setSelectedImporterId] = useState<string>(initialImporterId);
  const [selectedBrand, setSelectedBrand] = useState<string>(initialBrand);
  const [selectedModel, setSelectedModel] = useState<string>('');

  // Auto pre-select importer when initialBrand or selectedBrand changes
  const handleBrandSelectChange = (brandVal: string) => {
    setSelectedBrand(brandVal);
    setSelectedModel('');
    if (brandVal) {
      const imp = getImporterForBrand(brandVal);
      if (imp) {
        setSelectedImporterId(imp.id);
        setClientName(imp.name);
        setClientAddress(imp.address);
        setClientMF(imp.mf);
      }
    }
  };

  // Invoice Metadata state
  const [invoiceNumber, setInvoiceNumber] = useState(
    `FAC-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(
      1000 + Math.random() * 9000
    )}`
  );
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [clientName, setClientName] = useState('STAFIM SA');
  const [clientAddress, setClientAddress] = useState('Route de Sousse Km 6, Mégrine, Tunis');
  const [clientMF, setClientMF] = useState('0012845/A/P/M/000');

  // Pricing Tariffs (in TND / DT)
  const [rateEntry, setRateEntry] = useState<number>(50); // Entrée / Réception Port
  const [rateTransfer, setRateTransfer] = useState<number>(85); // Transfert Inter-sites
  const [rateExit, setRateExit] = useState<number>(60); // Sortie / Livraison
  const [tvaRate, setTvaRate] = useState<number>(19); // 19% TVA
  const [timbreFiscal, setTimbreFiscal] = useState<number>(1.0); // 1.000 DT Timbre fiscal

  // Auto-fill client details when selectedImporterId changes
  useEffect(() => {
    if (selectedImporterId) {
      const imp = OFFICIAL_IMPORTERS.find((i) => i.id === selectedImporterId);
      if (imp) {
        setClientName(imp.name);
        setClientAddress(imp.address);
        setClientMF(imp.mf);
      }
    } else {
      setClientName('Tous Importateurs / Global');
      setClientAddress('Tunis, Tunisie');
      setClientMF('0000000/GLOBAL/000');
    }
  }, [selectedImporterId]);

  // Extract all unique brands present in current movements list
  const availableBrands = Array.from(
    new Set(movements.map((m) => m.vehicle_brand).filter(Boolean))
  ).sort() as string[];

  // Extract models for selected brand
  const availableModels = Array.from(
    new Set(
      movements
        .filter((m) => !selectedBrand || (m.vehicle_brand && m.vehicle_brand.toLowerCase() === selectedBrand.toLowerCase()))
        .map((m) => m.vehicle_model)
        .filter(Boolean)
    )
  ).sort() as string[];

  // Filter movements for billing
  const billedMovements = movements.filter((m) => {
    const brand = m.vehicle_brand || '';
    const model = m.vehicle_model || '';
    const imp = getImporterForBrand(brand);
    const matchesImp = !selectedImporterId || imp?.id === selectedImporterId;
    const matchesBrand = !selectedBrand || brand.toLowerCase() === selectedBrand.toLowerCase();
    const matchesModel = !selectedModel || model.toLowerCase() === selectedModel.toLowerCase();
    return matchesImp && matchesBrand && matchesModel;
  });

  const siteMap = new Map<string, string>();
  sites.forEach((s) => siteMap.set(s.id, s.name));

  // Count movement types for billed movements
  const entriesCount = billedMovements.filter((m) => m.movement_type === 'entry').length;
  const transfersCount = billedMovements.filter((m) => m.movement_type === 'transfer').length;
  const exitsCount = billedMovements.filter((m) => m.movement_type === 'exit').length;

  // Subtotals
  const totalEntriesHT = entriesCount * rateEntry;
  const totalTransfersHT = transfersCount * rateTransfer;
  const totalExitsHT = exitsCount * rateExit;
  const subtotalHT = totalEntriesHT + totalTransfersHT + totalExitsHT;

  const tvaAmount = (subtotalHT * tvaRate) / 100;
  const totalTTC = subtotalHT + tvaAmount + timbreFiscal;

  const handleImporterSelect = (imp: ImporterInfo) => {
    setSelectedImporterId(imp.id);
    setSelectedBrand('');
    setClientName(imp.name);
    setClientAddress(imp.address);
    setClientMF(imp.mf);
  };

  const getItemPrice = (type: string) => {
    switch (type) {
      case 'entry':
        return rateEntry;
      case 'transfer':
        return rateTransfer;
      case 'exit':
        return rateExit;
      default:
        return 0;
    }
  };

  const getItemTypeName = (type: string) => {
    switch (type) {
      case 'entry':
        return 'Entrée / Déchargement Stock';
      case 'transfer':
        return 'Transfert Logistique Inter-Sites';
      case 'exit':
        return 'Sortie / Enlèvement Client';
      default:
        return type;
    }
  };

  const handleExportInvoicePDF = () => {
    const doc = new jsPDF();

    // Header Color & Branding
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 210, 38, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('FACTURE DE SERVICES LOGISTIQUES', 14, 20);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('GESTION DU PARC AUTOMOBILE & TRANSPORT', 14, 28);
    doc.text(`N° Facture : ${invoiceNumber}`, 145, 20);
    doc.text(`Date : ${invoiceDate}`, 145, 26);
    doc.text(`Échéance : ${dueDate}`, 145, 32);

    // Emetteur / Client Info
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('ÉMETTEUR (Prestataire Logistique) :', 14, 48);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('STAFIM LOGISTIQUE TUNISIE', 14, 54);
    doc.text('Port de La Goulette / Zone Industrielle Megrine', 14, 59);
    doc.text('MF : 0892341/B/A/M/000 - Tél : +216 71 000 000', 14, 64);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('CLIENT / IMPORTATEUR BENEFICIAIRE :', 120, 48);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(clientName || 'Client Logistique', 120, 54);
    doc.text(clientAddress || 'Tunis, Tunisie', 120, 59);
    doc.text(`MF : ${clientMF || 'Non renseigné'}`, 120, 64);

    // Filter summary line
    doc.setFillColor(241, 245, 249);
    doc.rect(14, 72, 182, 12, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const periodText = startDate || endDate ? `Période du ${startDate || 'début'} au ${endDate || 'ce jour'}` : 'Toutes dates';
    const siteText = selectedSiteId ? `Site : ${siteMap.get(selectedSiteId) || selectedSiteId}` : 'Tous les sites';
    const impText = selectedImporterId
      ? `Importateur : ${OFFICIAL_IMPORTERS.find((i) => i.id === selectedImporterId)?.code}`
      : 'Tous Importateurs';
    const brandText = selectedBrand ? ` | Marque : ${selectedBrand}` : '';
    doc.text(`Prestations effectuées - ${periodText} | ${siteText} | ${impText}${brandText} | Total Véhicules : ${billedMovements.length}`, 18, 79);

    // Summary Recap Table
    const recapData = [
      ['Prestation Entrée / Réception Port', `${entriesCount} véh.`, `${rateEntry.toFixed(3)} DT`, `${totalEntriesHT.toFixed(3)} DT`],
      ['Prestation Transfert Inter-Sites', `${transfersCount} véh.`, `${rateTransfer.toFixed(3)} DT`, `${totalTransfersHT.toFixed(3)} DT`],
      ['Prestation Sortie / Enlèvement Concession', `${exitsCount} véh.`, `${rateExit.toFixed(3)} DT`, `${totalExitsHT.toFixed(3)} DT`],
    ];

    autoTable(doc, {
      startY: 88,
      head: [['Désignation Prestation', 'Quantité', 'Tarif Unitaire HT', 'Total HT']],
      body: recapData,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 32, halign: 'right' },
        3: { cellWidth: 30, halign: 'right' },
      },
    });

    // Itemized Details Table
    const tableData = billedMovements.map((m, idx) => {
      const chassis = m.vehicle_chassis || m.chassis_number || '-';
      const brand = m.vehicle_brand || '';
      const imp = getImporterForBrand(brand);
      const model = `${brand} ${m.vehicle_model || ''}`.trim() || 'N/C';
      const dep = m.departure_site_name || '-';
      const arr = m.arrival_site_name || m.destination_text || '-';
      const dateStr = formatDateTime(m.movement_date);
      const price = getItemPrice(m.movement_type);

      return [
        (idx + 1).toString(),
        dateStr,
        chassis,
        imp ? `${imp.code}` : '-',
        model,
        getItemTypeName(m.movement_type),
        `${dep} -> ${arr}`,
        `${price.toFixed(3)} DT`,
      ];
    });

    const lastTableY = (doc as any).lastAutoTable.finalY || 120;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('Détail Nominatif par Numéro de Châssis (VIN 17) & Importateur :', 14, lastTableY + 8);

    autoTable(doc, {
      startY: lastTableY + 12,
      head: [['N°', 'Date', 'Châssis (VIN)', 'Importateur', 'Marque & Modèle', 'Opération', 'Trajet (Départ -> Arrivée)', 'Montant HT']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 18 },
        2: { cellWidth: 35, fontStyle: 'bold' },
        3: { cellWidth: 20, fontStyle: 'bold' },
        4: { cellWidth: 28 },
        5: { cellWidth: 28 },
        6: { cellWidth: 28 },
        7: { cellWidth: 17, halign: 'right' },
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 200;

    // Financial Totals Box
    const totalsX = 120;
    const totalsY = finalY > 230 ? 230 : finalY + 10;

    doc.setFillColor(248, 250, 252);
    doc.rect(totalsX - 5, totalsY - 4, 80, 42, 'F');
    doc.rect(totalsX - 5, totalsY - 4, 80, 42, 'S');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);

    doc.text(`Total Hors Taxes (HT) :`, totalsX, totalsY + 4);
    doc.text(`${subtotalHT.toFixed(3)} DT`, totalsX + 70, totalsY + 4, { align: 'right' });

    doc.text(`TVA (${tvaRate}%) :`, totalsX, totalsY + 12);
    doc.text(`${tvaAmount.toFixed(3)} DT`, totalsX + 70, totalsY + 12, { align: 'right' });

    doc.text(`Timbre Fiscal :`, totalsX, totalsY + 20);
    doc.text(`${timbreFiscal.toFixed(3)} DT`, totalsX + 70, totalsY + 20, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 58, 138); // blue-900
    doc.text(`TOTAL NET A PAYER (TTC) :`, totalsX, totalsY + 30);
    doc.text(`${totalTTC.toFixed(3)} DT`, totalsX + 70, totalsY + 30, { align: 'right' });

    // Footer signature and terms
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Conditions de règlement : Paiement sous 30 jours à réception de facture.', 14, totalsY + 20);
    doc.text('Cachet & Signature de l entreprise :', 14, totalsY + 28);
    doc.rect(14, totalsY + 32, 60, 20); // Stamp box

    const impCode = selectedImporterId ? OFFICIAL_IMPORTERS.find((i) => i.id === selectedImporterId)?.code || 'IMPORT' : 'GLOBAL';
    doc.save(`Facture_Logistique_${impCode}_${invoiceNumber}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportCSV = () => {
    const headers = [
      'N_Facture',
      'Date_Facture',
      'Importateur_Client',
      'Matricule_Fiscal',
      'Chassis_VIN',
      'Marque',
      'Modele',
      'Importateur_Attribue',
      'Type_Mouvement',
      'Date_Mouvement',
      'Depart',
      'Arrivee',
      'Tarif_HT_DT',
    ];

    const rows = billedMovements.map((m) => {
      const price = getItemPrice(m.movement_type);
      const imp = getImporterForBrand(m.vehicle_brand);
      return [
        invoiceNumber,
        invoiceDate,
        `"${clientName}"`,
        `"${clientMF}"`,
        `"${m.vehicle_chassis || m.chassis_number || ''}"`,
        `"${m.vehicle_brand || ''}"`,
        `"${m.vehicle_model || ''}"`,
        `"${imp?.code || ''}"`,
        m.movement_type,
        formatDateTime(m.movement_date),
        `"${m.departure_site_name || ''}"`,
        `"${m.arrival_site_name || m.destination_text || ''}"`,
        price.toFixed(3),
      ];
    });

    // Summary rows
    rows.push([]);
    rows.push(['', '', '', '', '', '', '', '', '', '', '', 'TOTAL_HT_DT', subtotalHT.toFixed(3)]);
    rows.push(['', '', '', '', '', '', '', '', '', '', '', `TVA_${tvaRate}%_DT`, tvaAmount.toFixed(3)]);
    rows.push(['', '', '', '', '', '', '', '', '', '', '', 'TIMBRE_FISCAL_DT', timbreFiscal.toFixed(3)]);
    rows.push(['', '', '', '', '', '', '', '', '', '', '', 'TOTAL_TTC_DT', totalTTC.toFixed(3)]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const impCode = selectedImporterId ? OFFICIAL_IMPORTERS.find((i) => i.id === selectedImporterId)?.code || 'IMPORT' : 'GLOBAL';
    link.setAttribute('download', `Facturation_${impCode}_${invoiceNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white border-2 border-slate-900 shadow-2xl max-w-5xl w-full my-6 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 text-white rounded-xs">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-wider flex items-center space-x-2">
                <span>Système de Facturation par Mouvements & Importateurs</span>
                <span className="bg-amber-500 text-slate-900 text-[10px] px-2 py-0.5 font-mono font-bold">
                  {billedMovements.length} / {movements.length} véh.
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Facturation dédiée par concessionnaire officiel, marque et type de mouvement
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50">
          {/* Importer & Brand Selector Banner */}
          <div className="bg-slate-900 text-white p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center space-x-2">
                <Tag className="w-4 h-4" />
                <span>Sélection de l Importateur & Marque pour Facturation</span>
              </span>
              <span className="text-[11px] text-slate-400">
                Auto-remplissage du client & calcul direct
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Select Importer */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-300 mb-1">
                  Filtrer par Importateur Officiel
                </label>
                <select
                  value={selectedImporterId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedImporterId(val);
                  }}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-xs font-bold px-3 py-2 focus:outline-none focus:border-amber-400"
                >
                  <option value="">Tous les Importateurs (Vue Globale)</option>
                  {OFFICIAL_IMPORTERS.map((imp) => (
                    <option key={imp.id} value={imp.id}>
                      {imp.name} ({imp.brands.join(', ')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Brand */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-300 mb-1">
                  Filtrer par Marque
                </label>
                <select
                  value={selectedBrand}
                  onChange={(e) => handleBrandSelectChange(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-xs font-bold px-3 py-2 focus:outline-none focus:border-amber-400"
                >
                  <option value="">Toutes les marques incluses</option>
                  {availableBrands.map((b) => {
                    const imp = getImporterForBrand(b);
                    return (
                      <option key={b} value={b}>
                        {b} {imp ? `(${imp.code})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Select Model */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-300 mb-1">
                  Filtrer par Modèle
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-xs font-bold px-3 py-2 focus:outline-none focus:border-amber-400"
                >
                  <option value="">Tous les modèles</option>
                  {availableModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Pills for Top Importers */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-bold text-slate-400 mr-1">Raccourcis concessionnaires :</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedImporterId('');
                  setSelectedBrand('');
                }}
                className={`text-[10px] font-bold px-2 py-0.5 border transition ${
                  !selectedImporterId && !selectedBrand
                    ? 'bg-amber-500 text-slate-900 border-amber-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                Tous
              </button>
              {OFFICIAL_IMPORTERS.slice(0, 7).map((imp) => (
                <button
                  key={imp.id}
                  type="button"
                  onClick={() => handleImporterSelect(imp)}
                  className={`text-[10px] font-bold px-2 py-0.5 border transition ${
                    selectedImporterId === imp.id
                      ? 'bg-amber-500 text-slate-900 border-amber-400'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {imp.code}
                </button>
              ))}
            </div>
          </div>

          {/* Grid Configuration: Client Info & Tariffs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Box: Client & Invoice Info */}
            <div className="bg-white p-4 border border-slate-300 shadow-xs space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Information Client (Auto-remplie)</span>
                </span>
                {selectedImporterId && (
                  <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5">
                    Importateur Identifié
                  </span>
                )}
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                    N° Facture
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-2.5 py-1.5 font-mono font-bold focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                    Date Facture
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-2.5 py-1.5 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                  Raison Sociale Client / Importateur
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-2.5 py-1.5 font-black focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                    Adresse Complète
                  </label>
                  <input
                    type="text"
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-2.5 py-1.5 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                    Matricule Fiscal (MF)
                  </label>
                  <input
                    type="text"
                    value={clientMF}
                    onChange={(e) => setClientMF(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-2.5 py-1.5 font-mono font-bold focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Right Box: Tariffs & Tax Rate */}
            <div className="bg-white p-4 border border-slate-300 shadow-xs space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center space-x-2 border-b border-slate-200 pb-2">
                <Calculator className="w-4 h-4 text-emerald-600" />
                <span>Grille Tarifaire par Mouvement (TND / DT)</span>
              </h3>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50/50 p-2.5 border border-emerald-200">
                  <span className="block text-[10px] font-black uppercase text-emerald-900 mb-1">
                    Entrée / Port
                  </span>
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      step="5"
                      min="0"
                      value={rateEntry}
                      onChange={(e) => setRateEntry(Number(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-300 text-slate-900 text-xs font-bold px-2 py-1"
                    />
                    <span className="text-xs font-bold text-slate-500">DT</span>
                  </div>
                  <span className="block text-[10px] text-slate-500 mt-1">
                    {entriesCount} unit. = {(entriesCount * rateEntry).toFixed(1)} DT
                  </span>
                </div>

                <div className="bg-blue-50/50 p-2.5 border border-blue-200">
                  <span className="block text-[10px] font-black uppercase text-blue-900 mb-1">
                    Transfert Inter-sites
                  </span>
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      step="5"
                      min="0"
                      value={rateTransfer}
                      onChange={(e) => setRateTransfer(Number(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-300 text-slate-900 text-xs font-bold px-2 py-1"
                    />
                    <span className="text-xs font-bold text-slate-500">DT</span>
                  </div>
                  <span className="block text-[10px] text-slate-500 mt-1">
                    {transfersCount} unit. = {(transfersCount * rateTransfer).toFixed(1)} DT
                  </span>
                </div>

                <div className="bg-amber-50/50 p-2.5 border border-amber-200">
                  <span className="block text-[10px] font-black uppercase text-amber-900 mb-1">
                    Sortie Client
                  </span>
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      step="5"
                      min="0"
                      value={rateExit}
                      onChange={(e) => setRateExit(Number(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-300 text-slate-900 text-xs font-bold px-2 py-1"
                    />
                    <span className="text-xs font-bold text-slate-500">DT</span>
                  </div>
                  <span className="block text-[10px] text-slate-500 mt-1">
                    {exitsCount} unit. = {(exitsCount * rateExit).toFixed(1)} DT
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                    Taux TVA (%)
                  </label>
                  <select
                    value={tvaRate}
                    onChange={(e) => setTvaRate(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-2.5 py-1.5 font-bold"
                  >
                    <option value={19}>19 % (Taux Général)</option>
                    <option value={7}>7 % (Taux Réduit Transport)</option>
                    <option value={0}>0 % (Exonéré de TVA)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-600 mb-1">
                    Timbre Fiscal (DT)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={timbreFiscal}
                    onChange={(e) => setTimbreFiscal(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs px-2.5 py-1.5 font-mono focus:bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Financial Calculation Card */}
          <div className="bg-slate-900 text-white p-5 border border-slate-800 shadow-md">
            <h3 className="text-xs font-black uppercase tracking-wider text-blue-400 mb-4 flex items-center justify-between border-b border-slate-800 pb-2">
              <span>Décompte Financier de la Facture</span>
              <span className="font-mono text-white text-sm">{invoiceNumber}</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="border-r border-slate-800 pr-3">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Total HT (Hors Taxes)
                </span>
                <span className="text-xl font-black text-white font-mono">
                  {subtotalHT.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} DT
                </span>
              </div>

              <div className="border-r border-slate-800 pr-3">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  TVA ({tvaRate}%)
                </span>
                <span className="text-xl font-black text-blue-300 font-mono">
                  {tvaAmount.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} DT
                </span>
              </div>

              <div className="border-r border-slate-800 pr-3">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  Timbre Fiscal
                </span>
                <span className="text-xl font-black text-slate-300 font-mono">
                  {timbreFiscal.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} DT
                </span>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase text-amber-400 block">
                  TOTAL NET A PAYER (TTC)
                </span>
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  {totalTTC.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} DT
                </span>
              </div>
            </div>
          </div>

          {/* Billed Movements Table Preview */}
          <div className="bg-white border border-slate-300 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-slate-900 flex items-center space-x-2">
                <Car className="w-4 h-4 text-blue-600" />
                <span>Mouvements Facturés ({billedMovements.length})</span>
              </h4>
              <span className="text-[11px] text-slate-500">
                Tarification appliquée individuellement avec attribution d importateur
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Châssis (VIN)</th>
                    <th className="p-2.5">Importateur Attribué</th>
                    <th className="p-2.5">Marque & Modèle</th>
                    <th className="p-2.5">Type Mouvement</th>
                    <th className="p-2.5">Trajet / Destination</th>
                    <th className="p-2.5 text-right">Tarif HT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                  {billedMovements.slice(0, 50).map((m) => {
                    const price = getItemPrice(m.movement_type);
                    const imp = getImporterForBrand(m.vehicle_brand);
                    return (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-sans">
                          {formatDateTime(m.movement_date)}
                        </td>
                        <td className="p-2.5 font-bold text-slate-900">
                          {m.vehicle_chassis || m.chassis_number || '-'}
                        </td>
                        <td className="p-2.5 font-sans">
                          {imp ? (
                            <span className="bg-blue-50 text-blue-900 font-black px-1.5 py-0.5 border border-blue-200 text-[10px]">
                              {imp.code}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[10px]">Non spécifié</span>
                          )}
                        </td>
                        <td className="p-2.5 font-sans font-semibold">
                          {m.vehicle_brand} {m.vehicle_model}
                        </td>
                        <td className="p-2.5 font-sans">
                          <span
                            className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                              m.movement_type === 'entry'
                                ? 'bg-emerald-100 text-emerald-800'
                                : m.movement_type === 'transfer'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {getItemTypeName(m.movement_type)}
                          </span>
                        </td>
                        <td className="p-2.5 font-sans text-slate-600">
                          {m.departure_site_name || '-'} → {m.arrival_site_name || m.destination_text || '-'}
                        </td>
                        <td className="p-2.5 text-right font-bold text-slate-900">
                          {price.toFixed(3)} DT
                        </td>
                      </tr>
                    );
                  })}
                  {billedMovements.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500 italic">
                        Aucun mouvement correspondant aux critères d importateur / marque sélectionnés.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {billedMovements.length > 50 && (
                <div className="p-2 text-center text-xs text-slate-500 bg-slate-50 border-t border-slate-200 italic">
                  + {billedMovements.length - 50} autres mouvements inclus dans le décompte total et l export PDF/Excel.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold uppercase transition"
          >
            Fermer
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportCSV}
              disabled={billedMovements.length === 0}
              className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-900 px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition border border-slate-300"
            >
              <Download className="w-4 h-4 text-emerald-700" />
              <span>Exporter Excel (.csv)</span>
            </button>

            <button
              onClick={handleExportInvoicePDF}
              disabled={billedMovements.length === 0}
              className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 text-xs font-black uppercase tracking-wider transition border border-blue-700 shadow-sm"
            >
              <FileText className="w-4 h-4" />
              <span>Générer Facture PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
