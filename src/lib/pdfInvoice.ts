import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, PaymentStatus, Vehicle } from '../types';
import { formatDateTime } from './dateUtils';

export function getStatusLabel(status: PaymentStatus): { label: string; color: [number, number, number] } {
  switch (status) {
    case 'payee':
      return { label: 'PAYÉE', color: [16, 185, 129] }; // emerald-500
    case 'en_attente':
      return { label: 'EN ATTENTE DE RÈGLEMENT', color: [245, 158, 11] }; // amber-500
    case 'en_retard':
      return { label: 'EN RETARD', color: [239, 68, 68] }; // red-500
    case 'brouillon':
      return { label: 'BROUILLON', color: [100, 116, 139] }; // slate-500
    case 'annulee':
      return { label: 'ANNULÉE', color: [148, 163, 184] };
    default:
      return { label: String(status || '').toUpperCase(), color: [100, 116, 139] };
  }
}

export interface DetailedVehicleInvoiceItem {
  index: number;
  description: string;
  unitPriceHT: number;
  totalHT: number;
  vehicleId?: string;
  chassisNumber: string;
  brand: string;
  model: string;
  color?: string;
  fuelType?: string;
  transmission?: string;
  registrationNumber?: string;
  stockNumber?: string;
  year?: string | number;
  mileage?: string | number;
  siteDepart?: string;
  siteArrivee?: string;
  arrivalDate?: string;
  notes?: string;
  customFields?: { key: string; value: string }[];
}

/**
 * Extract and resolve technical vehicle details for each invoice item
 */
export function extractVehicleDetailsFromInvoice(
  invoice: Invoice,
  vehiclesList: Vehicle[] = []
): DetailedVehicleInvoiceItem[] {
  const result: DetailedVehicleInvoiceItem[] = [];

  (invoice.items || []).forEach((item, idx) => {
    // 1. Find matching vehicle in database by ID or Chassis/VIN
    let matchedVeh: Vehicle | undefined;

    if (item.vehicleId) {
      matchedVeh = vehiclesList.find((v) => v.id === item.vehicleId);
    }

    if (!matchedVeh && item.chassisNumber) {
      matchedVeh = vehiclesList.find(
        (v) =>
          (v.chassis_number && v.chassis_number.toLowerCase() === item.chassisNumber?.toLowerCase()) ||
          (v.vin && v.vin.toLowerCase() === item.chassisNumber?.toLowerCase())
      );
    }

    if (!matchedVeh) {
      // Try Regex match from description (VIN: XYZ...)
      const vinMatch = item.description.match(/VIN:\s*([A-Za-z0-9]+)/i);
      if (vinMatch && vinMatch[1]) {
        const foundVin = vinMatch[1];
        matchedVeh = vehiclesList.find(
          (v) =>
            (v.chassis_number && v.chassis_number.toLowerCase() === foundVin.toLowerCase()) ||
            (v.vin && v.vin.toLowerCase() === foundVin.toLowerCase())
        );
      }
    }

    // Extract chassis number fallback
    const vinFallback =
      item.chassisNumber ||
      item.description.match(/VIN:\s*([A-Za-z0-9]+)/i)?.[1] ||
      matchedVeh?.chassis_number ||
      matchedVeh?.vin ||
      `CHASSIS-${idx + 1}`;

    // Extract brand & model fallback from description if matchedVeh is missing
    let brand = matchedVeh?.brand || 'Non spécifié';
    let model = matchedVeh?.model || '';

    if (!matchedVeh) {
      // Try parsing description e.g. "Prestation logistique - Peugeot 208 (VIN: ...)"
      const descClean = item.description.replace(/^Prestation\s+logistique\s*(&\s*livraison)?\s*-\s*/i, '');
      const parts = descClean.split('(');
      if (parts.length > 0) {
        const brandModelPart = parts[0].trim();
        const words = brandModelPart.split(' ');
        if (words.length > 0) {
          brand = words[0];
          model = words.slice(1).join(' ');
        }
      }
    }

    result.push({
      index: idx + 1,
      description: item.description,
      unitPriceHT: item.unitPriceHT,
      totalHT: item.totalHT,
      vehicleId: matchedVeh?.id || item.vehicleId,
      chassisNumber: vinFallback,
      brand: brand,
      model: model || 'Véhicule',
      color: matchedVeh?.color || 'Non renseignée',
      fuelType: matchedVeh?.fuel_type || 'Non renseigné',
      transmission: matchedVeh?.transmission || 'Non renseignée',
      registrationNumber: matchedVeh?.registration_number || 'Non immatriculé',
      stockNumber: matchedVeh?.stock_number || 'N/A',
      year: matchedVeh?.year || new Date().getFullYear(),
      mileage: matchedVeh?.mileage !== undefined ? `${matchedVeh.mileage} km` : '0 km',
      siteDepart: matchedVeh?.site_depart || 'Port La Goulette',
      siteArrivee: matchedVeh?.site_arrivee || invoice.site_name || 'Hub Mégrine',
      arrivalDate: matchedVeh?.arrival_date ? formatDateTime(matchedVeh.arrival_date) : invoice.invoice_date,
      notes: matchedVeh?.notes || item.description,
      customFields: matchedVeh?.custom_fields || [],
    });
  });

  return result;
}

export function generateSingleInvoicePDF(invoice: Invoice, vehiclesList: Vehicle[] = []): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const nowStr = formatDateTime(new Date());
  const invDateStr = invoice.invoice_date ? formatDateTime(invoice.invoice_date) : nowStr;
  const dueDateStr = invoice.due_date ? formatDateTime(invoice.due_date) : '-';

  // Check if invoice is grouped / multi-vehicle
  const detailedVehicles = extractVehicleDetailsFromInvoice(invoice, vehiclesList);
  const isGroupedInvoice =
    detailedVehicles.length > 1 ||
    invoice.notes?.toLowerCase().includes('group') ||
    invoice.items?.some((it) => it.vehicleId || it.chassisNumber || it.description.includes('VIN:'));

  // ==================== PAGE 1: FACTURE OFFICIELLE ====================
  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 36, 'F');

  doc.setFillColor(37, 99, 235); // blue-600
  doc.rect(0, 36, 210, 3, 'F');

  // Brand Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('STAFIM LOGISTIQUE AUTOMOBILE', 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(
    isGroupedInvoice
      ? 'FACTURE GROUPÉE MULTI-VÉHICULES & BORDEREAU DE PRESTATIONS'
      : 'FACTURE OFFICIELLE DE PRESTATIONS & GESTION PARC VÉHICULES',
    14,
    23
  );
  doc.text('Port de La Goulette & Hubs Régionaux | Tél : +216 71 000 000', 14, 29);

  // Invoice Number & Status Badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(245, 158, 11); // amber-500
  doc.text(`N° FACTURE : ${invoice.invoice_number}`, 196, 15, { align: 'right' });

  const statusInfo = getStatusLabel(invoice.status);
  doc.setFontSize(8.5);
  doc.setTextColor(statusInfo.color[0], statusInfo.color[1], statusInfo.color[2]);
  doc.text(`[ ${statusInfo.label} ]`, 196, 22, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Date : ${invDateStr} | Échéance : ${dueDateStr}`, 196, 29, { align: 'right' });

  // Company / Provider vs Client Section Box
  const boxY = 46;

  // Prestataire (Left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('ÉMETTEUR / PRESTATAIRE :', 14, boxY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('STAFIM SA - Division Logistique Parc', 14, boxY + 5);
  doc.text('Route de Sousse Km 6, Mégrine 2033, Tunis', 14, boxY + 10);
  doc.text('Matricule Fiscal : 0012845/A/P/M/000', 14, boxY + 15);
  doc.text('Registre de Commerce : B148921996', 14, boxY + 20);

  // Client (Right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('CLIENT / CONCESSIONNAIRE BÉNÉFICIAIRE :', 115, boxY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 58, 138); // blue-900
  doc.text(invoice.client_name || 'Client Non Renseigné', 115, boxY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(invoice.client_address || 'Adresse non renseignée', 115, boxY + 10);
  doc.text(`Matricule Fiscal : ${invoice.client_mf || 'Non communiqué'}`, 115, boxY + 15);
  if (invoice.site_name) {
    doc.text(`Site rattaché : ${invoice.site_name}`, 115, boxY + 20);
  }

  let tableY = boxY + 28;

  // Grouped Banner Tag
  if (isGroupedInvoice) {
    doc.setFillColor(239, 246, 255); // blue-50
    doc.setDrawColor(191, 219, 254); // blue-200
    doc.rect(14, tableY, 182, 8, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 58, 138);
    doc.text(
      `BORDEREAU DE FACTURATION GROUPÉE : ${detailedVehicles.length} VÉHICULE(S) SÉLECTIONNÉ(S) (DÉTAILS EN ANNEXE TECHNIQUE PAGE 2)`,
      17,
      tableY + 5.5
    );
    tableY += 12;
  }

  // Line Items Table
  const itemRows = (invoice.items || []).map((item, idx) => {
    return [
      (idx + 1).toString(),
      item.description,
      item.quantity.toString(),
      `${item.unitPriceHT.toFixed(3)} DT`,
      `${item.tvaRate}%`,
      `${item.totalHT.toFixed(3)} DT`,
    ];
  });

  autoTable(doc, {
    startY: tableY,
    head: [['#', 'Désignation de la Prestation / Logistique', 'Qté', 'Prix Unitaire HT', 'TVA', 'Total HT']],
    body: itemRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 10, halign: 'center' },
      1: { cellWidth: 95 },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 28, halign: 'right' },
      4: { cellWidth: 15, halign: 'center' },
      5: { fontStyle: 'bold', cellWidth: 28, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  const finalTableY = (doc as any).lastAutoTable.finalY || 140;

  // Financial Summary Box (Right)
  const totalsX = 122;
  const totalsY = finalTableY + 8;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.rect(totalsX, totalsY, 74, 42, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  doc.text('Total Général HT :', totalsX + 4, totalsY + 8);
  doc.text(`${invoice.subtotal_ht.toFixed(3)} DT`, totalsX + 70, totalsY + 8, { align: 'right' });

  doc.text(`Montant TVA (${invoice.tva_rate}%) :`, totalsX + 4, totalsY + 16);
  doc.text(`${invoice.tva_amount.toFixed(3)} DT`, totalsX + 70, totalsY + 16, { align: 'right' });

  doc.text('Timbre Fiscal :', totalsX + 4, totalsY + 24);
  doc.text(`${invoice.timbre_fiscal.toFixed(3)} DT`, totalsX + 70, totalsY + 24, { align: 'right' });

  doc.setFillColor(15, 23, 42);
  doc.rect(totalsX, totalsY + 30, 74, 12, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text('NET À PAYER (TTC) :', totalsX + 4, totalsY + 38);
  doc.text(`${invoice.total_ttc.toFixed(3)} DT`, totalsX + 70, totalsY + 38, { align: 'right' });

  // Notes & Signatures (Left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('MODALITÉS DE PAIEMENT & INFORMATIONS :', 14, totalsY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Mode de règlement : ${invoice.payment_method || 'Virement Bancaire'}`, 14, totalsY + 12);
  if (invoice.paid_date) {
    doc.text(`Date de paiement constaté : ${formatDateTime(invoice.paid_date)}`, 14, totalsY + 17);
  } else {
    doc.text(`Date d échéance limite : ${dueDateStr}`, 14, totalsY + 17);
  }
  doc.text('RIB Bancaire : TN59 10 000 001234567890 42 (STB Bank)', 14, totalsY + 22);

  if (invoice.notes) {
    doc.text(`Notes : ${invoice.notes}`, 14, totalsY + 27);
  }

  // Stamp Box
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(255, 255, 255);
  doc.rect(14, totalsY + 32, 55, 18, 'FD');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Cachet et Signature Émetteur', 16, totalsY + 36);

  // ==================== PAGE 2: ANNEXE TECHNIQUE DES VÉHICULES ====================
  if (isGroupedInvoice && detailedVehicles.length > 0) {
    doc.addPage('a4', 'landscape'); // Landscape orientation for technical table

    // Header Banner Annex
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 297, 28, 'F');

    doc.setFillColor(245, 158, 11); // amber-500 strip
    doc.rect(0, 28, 297, 2.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(`ANNEXE TECHNIQUE : DÉTAIL DES VÉHICULES FACTURÉS (${detailedVehicles.length} VÉHICULES)`, 14, 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225);
    doc.text(
      `Facture N° : ${invoice.invoice_number} | Client : ${invoice.client_name} (MF: ${invoice.client_mf}) | Date : ${invDateStr}`,
      14,
      21
    );

    // Summary Notice
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(
      'Document officiel annexé à la facture. Contient l identification physique et les données techniques complètes des véhicules livrés.',
      14,
      36
    );

    // Technical Vehicles Table
    const annexTableRows = detailedVehicles.map((v) => {
      return [
        v.index.toString(),
        v.chassisNumber,
        `${v.brand} ${v.model}`,
        `${v.color} (${v.year})`,
        `${v.fuelType} / ${v.transmission}`,
        `${v.registrationNumber}\nStock: ${v.stockNumber}`,
        `${v.siteDepart} > ${v.siteArrivee}`,
        v.arrivalDate,
        `${v.unitPriceHT.toFixed(3)} DT`,
      ];
    });

    autoTable(doc, {
      startY: 40,
      head: [
        [
          '#',
          'N° Châssis (VIN)',
          'Marque & Modèle',
          'Couleur (Année)',
          'Motorisation / Boîte',
          'Immat. & Stock',
          'Trajet & Site',
          'Date Réception',
          'Prix HT',
        ],
      ],
      body: annexTableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        textColor: [30, 41, 59],
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 8, halign: 'center' },
        1: { fontStyle: 'bold', cellWidth: 42, halign: 'left' },
        2: { fontStyle: 'bold', cellWidth: 40 },
        3: { cellWidth: 32 },
        4: { cellWidth: 32 },
        5: { cellWidth: 35 },
        6: { cellWidth: 42 },
        7: { cellWidth: 22, halign: 'center' },
        8: { fontStyle: 'bold', cellWidth: 22, halign: 'right' },
      },
      margin: { left: 14, right: 14 },
    });

    const annexFinalY = (doc as any).lastAutoTable.finalY || 160;

    // Certification footer for technical annex
    if (annexFinalY < 175) {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.rect(14, annexFinalY + 6, 269, 16, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 58, 138);
      doc.text('ATTESTATION DE CONFORMITÉ TECHNIQUE LOGISTIQUE :', 18, annexFinalY + 11);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(
        'STAFIM SA certifie l exactitude des numéros de châssis (VIN) et des spécifications techniques ci-dessus. Tous les véhicules ont été inspectés à la réception du port et livrés conformément au bordereau de livraison.',
        18,
        annexFinalY + 17
      );
    }
  }

  // Save PDF
  const filename = `Facture_${isGroupedInvoice ? 'Groupee_' : ''}${invoice.invoice_number}_${invoice.client_name.replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);

  try {
    const blobUrl = doc.output('bloburl');
    if (blobUrl) {
      window.open(blobUrl, '_blank');
    }
  } catch (e) {
    // Ignore popup blocker if opened
  }
}

/**
 * Export alias for grouped invoice PDF with technical details
 */
export function generateGroupedInvoicePDF(invoice: Invoice, vehiclesList: Vehicle[] = []): void {
  generateSingleInvoicePDF(invoice, vehiclesList);
}

export function exportInvoicesToCSV(invoices: Invoice[]): void {
  const headers = [
    'N_Facture',
    'Date_Facture',
    'Date_Echeance',
    'Client_Importateur',
    'Matricule_Fiscal',
    'Site',
    'Statut',
    'Sous_Total_HT_DT',
    'TVA_Taux',
    'Montant_TVA_DT',
    'Timbre_Fiscal_DT',
    'Total_TTC_DT',
    'Mode_Paiement',
    'Date_Paiement',
    'Notes',
  ];

  const rows = invoices.map((inv) => {
    return [
      inv.invoice_number,
      inv.invoice_date ? formatDateTime(inv.invoice_date) : '',
      inv.due_date ? formatDateTime(inv.due_date) : '',
      `"${inv.client_name}"`,
      `"${inv.client_mf}"`,
      `"${inv.site_name || ''}"`,
      inv.status.toUpperCase(),
      inv.subtotal_ht.toFixed(3),
      `${inv.tva_rate}%`,
      inv.tva_amount.toFixed(3),
      inv.timbre_fiscal.toFixed(3),
      inv.total_ttc.toFixed(3),
      `"${inv.payment_method || ''}"`,
      inv.paid_date ? formatDateTime(inv.paid_date) : '',
      `"${inv.notes || ''}"`,
    ];
  });

  const csvContent =
    'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `Export_Factures_STAFIM_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
