import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Vehicle, Site } from '../types';
import { formatDateTime } from './dateUtils';

interface StockReportOptions {
  vehicles: Vehicle[];
  sites: Site[];
  selectedSite?: string;
  selectedBrand?: string;
  selectedModel?: string;
  selectedStatus?: string;
}

export function generateStockReportPDF(options: StockReportOptions): void {
  const { vehicles, sites, selectedSite, selectedBrand, selectedModel, selectedStatus } = options;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const siteMap = new Map<string, string>();
  sites.forEach((s) => siteMap.set(s.id, s.name));

  const dateStr = formatDateTime(new Date());

  // Header Band
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 297, 28, 'F');

  doc.setFillColor(37, 99, 235); // blue-600
  doc.rect(0, 28, 297, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('ETAT ET INVENTAIRE DU STOCK VÉHICULES NEUFS', 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(`Rapport émis le ${dateStr} - Total véhicules listés : ${vehicles.length}`, 14, 22);

  // Active filters note
  const filterDesc: string[] = [];
  if (selectedBrand) filterDesc.push(`Marque: ${selectedBrand}`);
  if (selectedModel) filterDesc.push(`Modèle: ${selectedModel}`);
  if (selectedSite) filterDesc.push(`Site: ${siteMap.get(selectedSite) || selectedSite}`);
  if (selectedStatus) filterDesc.push(`Statut: ${selectedStatus.toUpperCase()}`);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const filterText = filterDesc.length > 0 ? `Filtres actifs : ${filterDesc.join(' | ')}` : 'Filtres actifs : Aucun (Tous les véhicules du parc)';
  doc.text(filterText, 14, 37);

  // Table Data
  const tableRows = vehicles.map((v, idx) => {
    const siteName = v.current_site_id ? siteMap.get(v.current_site_id) || v.current_site_id : 'Livré (Hors Parc)';
    const statusLabel =
      v.status === 'en_stock'
        ? 'EN STOCK'
        : v.status === 'en_transit'
        ? 'EN TRANSIT'
        : v.status === 'livre'
        ? 'LIVRÉ'
        : 'EN PANNE';

    const arrDate = formatDateTime(v.arrival_date);

    return [
      (idx + 1).toString(),
      v.chassis_number,
      v.brand,
      v.model,
      v.color || '-',
      statusLabel,
      siteName,
      arrDate,
      v.notes || '',
    ];
  });

  autoTable(doc, {
    startY: 42,
    head: [['#', 'N° Châssis (VIN)', 'Marque', 'Modèle', 'Couleur', 'Statut', 'Site / Emplacement', 'Arrivée', 'Notes']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 10, halign: 'center' },
      1: { fontStyle: 'bold', cellWidth: 48 },
      2: { fontStyle: 'bold', cellWidth: 28 },
      3: { cellWidth: 28 },
      4: { cellWidth: 28 },
      5: { fontStyle: 'bold', cellWidth: 26, halign: 'center' },
      6: { cellWidth: 42 },
      7: { cellWidth: 22, halign: 'center' },
      8: { cellWidth: 37 },
    },
    margin: { left: 14, right: 14 },
  });

  const dateFileName = new Date().toISOString().split('T')[0];
  const fileName = `Inventaire_Stock_Vehicules_${dateFileName}.pdf`;
  doc.save(fileName);

  try {
    const blobUrl = doc.output('bloburl');
    if (blobUrl) {
      window.open(blobUrl, '_blank');
    }
  } catch (e) {
    // Ignore popup blocker if opened
  }
}
