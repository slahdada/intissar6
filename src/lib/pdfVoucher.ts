import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MovementWithDetails, Site } from '../types';
import { getImporterForBrand } from '../data/importers';
import { formatDateTime } from './dateUtils';

export function generateMovementVoucherPDF(movement: MovementWithDetails, sites: Site[]): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const siteMap = new Map<string, string>();
  sites.forEach((s) => siteMap.set(s.id, s.name));

  const chassis = movement.vehicle_chassis || movement.chassis_number || 'N/A';
  const depName = movement.departure_site_id
    ? siteMap.get(movement.departure_site_id) || movement.departure_site_name
    : 'Origine non spécifiée';
  const arrName = movement.arrival_site_id
    ? siteMap.get(movement.arrival_site_id) || movement.arrival_site_name
    : movement.destination_text || 'Destination non spécifiée';

  const waypoints = movement.waypoints || [];
  const waypointNames = waypoints.map((wId) => siteMap.get(wId) || wId);

  const imp = getImporterForBrand(movement.vehicle_brand);
  const importerName = imp ? `${imp.code} - ${imp.name}` : '-';

  const dateStr = formatDateTime(movement.movement_date);

  let typeTitle = 'BON DE MOUVEMENT & TRANSFERT';
  let typeSub = 'TRANSFERT INTER-SITES DE VÉHICULE';
  if (movement.movement_type === 'entry') {
    typeTitle = "BON D'ENTRÉE EN PARC & RÉCEPTION";
    typeSub = 'RÉCEPTION PORTUAIRE & MISE EN STOCK';
  } else if (movement.movement_type === 'exit') {
    typeTitle = 'BON DE SORTIE LOGISTIQUE & LIVRAISON';
    typeSub = 'LIVRAISON CLIENT / CONCESSIONNAIRE';
  }

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 32, 'F');

  // Blue Accent bar
  doc.setFillColor(37, 99, 235); // blue-600
  doc.rect(0, 32, 210, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('STAFIM - LOGISTIQUE VÉHICULES NEUFS', 14, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(`${typeTitle} | ${typeSub}`, 14, 22);

  // Voucher Number Badge (Right Aligned)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(245, 158, 11); // amber-500
  doc.text(`N° BON : #MOV-${movement.id}`, 196, 16, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Émis le ${dateStr}`, 196, 23, { align: 'right' });

  // Section 1: Identification du Véhicule
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('1. IDENTIFICATION DU VÉHICULE CONCERNÉ', 14, 45);

  const vehicleRows = [
    [
      'Numéro de Châssis (VIN)',
      chassis,
      'Type d\'Opération',
      movement.movement_type.toUpperCase(),
    ],
    [
      'Marque du Véhicule',
      movement.vehicle_brand || '-',
      'Modèle',
      movement.vehicle_model || '-',
    ],
    [
      'Importateur Officiel',
      importerName,
      'Opérateur Saisisseur',
      movement.created_by_user_name || 'Agent Système',
    ],
  ];

  autoTable(doc, {
    startY: 48,
    body: vehicleRows,
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 3.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 42 },
      1: { fontStyle: 'bold', textColor: [15, 23, 42], cellWidth: 58 },
      2: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 40 },
      3: { fontStyle: 'bold', cellWidth: 42 },
    },
    margin: { left: 14, right: 14 },
  });

  // Section 2: Itinéraire & Transport
  const section2Y = (doc as any).lastAutoTable.finalY + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('2. ITINÉRAIRE & DÉTAILS DU TRANSPORT', 14, section2Y);

  const routeRows: string[][] = [
    ['Site Origine / Départ', depName],
    ['Destination / Site d\'Arrivée', arrName],
  ];

  if (waypointNames.length > 0) {
    routeRows.push(['Escales / Multi-Trajet', waypointNames.join(' ➔ ')]);
  }

  routeRows.push(['Observations & Instructions', movement.notes || 'Aucune observation particulière.']);

  autoTable(doc, {
    startY: section2Y + 3,
    body: routeRows,
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 3.5,
    },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 50 },
      1: { cellWidth: 132 },
    },
    margin: { left: 14, right: 14 },
  });

  // Section 3: Signature & Validation Boxes
  const section3Y = (doc as any).lastAutoTable.finalY + 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('3. VISAS & SIGNATURES POUR CONFORMITÉ ET PRICING', 14, section3Y);

  const boxWidth = 57;
  const boxHeight = 45;
  const boxY = section3Y + 5;

  // Box 1: Expéditeur
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.rect(14, boxY, boxWidth, boxHeight, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('EXPÉDITEUR / RESPONSABLE PARC', 17, boxY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Nom :', 17, boxY + 14);
  doc.text('Date & Heure :', 17, boxY + 20);
  doc.text('Signature :', 17, boxY + 26);

  // Box 2: Transporteur
  doc.rect(14 + boxWidth + 5, boxY, boxWidth, boxHeight, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('TRANSPORTEUR / CHAUFFEUR', 14 + boxWidth + 8, boxY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Nom Chauffeur :', 14 + boxWidth + 8, boxY + 14);
  doc.text('Immat. Camion :', 14 + boxWidth + 8, boxY + 20);
  doc.text('Signature :', 14 + boxWidth + 8, boxY + 26);

  // Box 3: Destinataire
  doc.rect(14 + (boxWidth + 5) * 2, boxY, boxWidth, boxHeight, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('RÉCEPTIONNAIRE / DESTINATAIRE', 14 + (boxWidth + 5) * 2 + 3, boxY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Nom :', 14 + (boxWidth + 5) * 2 + 3, boxY + 14);
  doc.text('Date Réception :', 14 + (boxWidth + 5) * 2 + 3, boxY + 20);
  doc.text('Signature :', 14 + (boxWidth + 5) * 2 + 3, boxY + 26);

  // Footer text
  const footerY = boxY + boxHeight + 12;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'Ce bon de mouvement est un document officiel de traçabilité. Toute réserve sur le véhicule doit être consignée avant signature.',
    105,
    footerY,
    { align: 'center' }
  );

  // Download PDF
  const filename = `Bon_Mouvement_MOV-${movement.id}_${chassis}.pdf`;
  doc.save(filename);

  // Attempt printable window preview as backup/convenience
  try {
    const blobUrl = doc.output('bloburl');
    if (blobUrl) {
      window.open(blobUrl, '_blank');
    }
  } catch (e) {
    // Ignore if blocked by pop-up blocker (doc.save handles the download already)
  }
}
