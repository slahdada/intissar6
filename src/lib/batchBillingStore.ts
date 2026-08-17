import { BillingBatch, BatchStatus, Vehicle, Invoice } from '../types';
import { localStore } from './localStore';
import { generateGroupedInvoicePDF, exportInvoicesToCSV } from './pdfInvoice';
import { saveDocToCloud, deleteDocFromCloud } from './cloudSyncStore';

const BATCH_STORAGE_KEY = 'parc_stafim_batches_v1';

export const INITIAL_BATCHES: BillingBatch[] = [
  {
    id: 'batch_stafim_001',
    batchNumber: 'LOT-202608-001',
    invoiceReference: 'FAC-202608-LOT1',
    importer: 'STAFIM SA',
    siteId: 'site_megrine',
    siteName: 'Parc STAFIM Megrine',
    billingType: 'livres',
    batchDate: '2026-08-01',
    currency: 'DT',
    vatRate: 19,
    discount: 0,
    discountType: 'flat',
    subtotal: 350.0,
    vatAmount: 66.5,
    timbreFiscal: 1.0,
    total: 417.5,
    status: 'facture',
    notes: 'Lot de facturation initiale pour livraison parc véhicules Peugeot & Citroën STAFIM SA',
    vehicleIds: ['veh_1', 'veh_2', 'veh_3', 'veh_4'],
    vehicleCount: 4,
    items: [
      {
        vehicleId: 'veh_1',
        chassisNumber: 'VF3P208X123456789',
        brand: 'Peugeot',
        model: '208',
        siteDepart: 'Port La Goulette',
        siteArrivee: 'Parc STAFIM Megrine',
        logisticsStatus: 'livre',
        billingStatus: 'facture',
        unitPriceHT: 85.0,
        totalHT: 85.0,
        color: 'Gris Titanium',
      },
      {
        vehicleId: 'veh_2',
        chassisNumber: 'VF3P3008X987654321',
        brand: 'Peugeot',
        model: '3008',
        siteDepart: 'Port La Goulette',
        siteArrivee: 'Parc STAFIM Megrine',
        logisticsStatus: 'livre',
        billingStatus: 'facture',
        unitPriceHT: 95.0,
        totalHT: 95.0,
        color: 'Noir Perla',
      },
      {
        vehicleId: 'veh_3',
        chassisNumber: 'VF7C3X77788899900',
        brand: 'Citroën',
        model: 'C3',
        siteDepart: 'Port La Goulette',
        siteArrivee: 'Hub Charguia',
        logisticsStatus: 'livre',
        billingStatus: 'facture',
        unitPriceHT: 80.0,
        totalHT: 80.0,
        color: 'Blanc Banquise',
      },
      {
        vehicleId: 'veh_4',
        chassisNumber: 'WOVMC7X1122334455',
        brand: 'Opel',
        model: 'Corsa',
        siteDepart: 'Port La Goulette',
        siteArrivee: 'Entrepôt Radès',
        logisticsStatus: 'livre',
        billingStatus: 'facture',
        unitPriceHT: 90.0,
        totalHT: 90.0,
        color: 'Rouge Pepper',
      },
    ],
    createdBy: 'Responsable Facturation',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T14:30:00.000Z',
  },
  {
    id: 'batch_stafim_002',
    batchNumber: 'LOT-202608-002',
    invoiceReference: 'FAC-202608-LOT2',
    importer: 'STAFIM SA',
    siteId: 'site_megrine',
    siteName: 'Parc STAFIM Megrine',
    billingType: 'a_livrer',
    batchDate: '2026-08-05',
    currency: 'DT',
    vatRate: 19,
    discount: 50.0,
    discountType: 'flat',
    subtotal: 260.0,
    vatAmount: 39.9,
    timbreFiscal: 1.0,
    total: 250.9,
    status: 'brouillon',
    notes: 'Facturation prévisionnelle sur arrivage Port La Goulette vers Parc STAFIM',
    vehicleIds: ['veh_5', 'veh_6', 'veh_7'],
    vehicleCount: 3,
    items: [
      {
        vehicleId: 'veh_5',
        chassisNumber: 'VF32008X556677889',
        brand: 'Peugeot',
        model: '2008',
        siteDepart: 'Port La Goulette',
        siteArrivee: 'Parc STAFIM Megrine',
        logisticsStatus: 'en_stock',
        billingStatus: 'en_lot',
        unitPriceHT: 100.0,
        totalHT: 100.0,
        color: 'Bleu Vertigo',
      },
      {
        vehicleId: 'veh_6',
        chassisNumber: 'VF7BERLX334455667',
        brand: 'Citroën',
        model: 'Berlingo',
        siteDepart: 'Port La Goulette',
        siteArrivee: 'Hub Charguia',
        logisticsStatus: 'en_transit',
        billingStatus: 'en_lot',
        unitPriceHT: 110.0,
        totalHT: 110.0,
        color: 'Gris Artense',
      },
      {
        vehicleId: 'veh_7',
        chassisNumber: 'WOVMOKX9988776655',
        brand: 'Opel',
        model: 'Mokka',
        siteDepart: 'Port La Goulette',
        siteArrivee: 'Entrepôt Radès',
        logisticsStatus: 'en_stock',
        billingStatus: 'en_lot',
        unitPriceHT: 100.0,
        totalHT: 100.0,
        color: 'Vert Mamba',
      },
    ],
    createdBy: 'Agent Logistique',
    createdAt: '2026-08-05T08:15:00.000Z',
    updatedAt: '2026-08-05T08:15:00.000Z',
  },
];

export function loadBatches(): BillingBatch[] {
  try {
    const raw = localStorage.getItem(BATCH_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(INITIAL_BATCHES));
      syncVehiclesWithBatches(INITIAL_BATCHES);
      return INITIAL_BATCHES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.error('Error loading billing batches:', err);
  }
  return INITIAL_BATCHES;
}

export function saveBatches(batches: BillingBatch[]): void {
  try {
    localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(batches));
    syncVehiclesWithBatches(batches);
  } catch (err) {
    console.error('Error saving billing batches:', err);
  }
}

/**
 * Synchronize vehicle billing status in localStore based on batch states
 */
function syncVehiclesWithBatches(batches: BillingBatch[]): void {
  const allVehicles = localStore.getVehicles();
  let updatedCount = 0;

  // Build map of vehicleId -> batch status info
  const vehicleBatchMap = new Map<
    string,
    {
      batchId: string;
      batchNumber: string;
      billingStatus: 'non_facture' | 'en_lot' | 'facture';
      billingDate: string;
      billingAmount: number;
      billingType: 'livres' | 'a_livrer';
      isBilled: boolean;
      invoiceNumber?: string;
    }
  >();

  batches.forEach((batch) => {
    if (batch.status === 'annule') return; // Cancelled batches do not hold vehicles

    const isBilledState = batch.status === 'valide' || batch.status === 'facture';
    const statusLabel: 'non_facture' | 'en_lot' | 'facture' = isBilledState ? 'facture' : 'en_lot';

    batch.items.forEach((item) => {
      vehicleBatchMap.set(item.vehicleId, {
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        billingStatus: statusLabel,
        billingDate: batch.batchDate,
        billingAmount: item.totalHT,
        billingType: batch.billingType,
        isBilled: isBilledState,
        invoiceNumber: batch.invoiceReference || batch.batchNumber,
      });
    });
  });

  const updatedVehicles = allVehicles.map((v) => {
    const batchInfo = vehicleBatchMap.get(v.id);
    if (batchInfo) {
      updatedCount++;
      return {
        ...v,
        billingStatus: batchInfo.billingStatus,
        batchId: batchInfo.batchId,
        batchNumber: batchInfo.batchNumber,
        billingDate: batchInfo.billingDate,
        billingAmount: batchInfo.billingAmount,
        billingType: batchInfo.billingType,
        is_billed: batchInfo.isBilled,
        invoice_number: batchInfo.invoiceNumber,
      };
    } else {
      // If vehicle was linked to a cancelled or removed batch
      if (v.batchId) {
        return {
          ...v,
          billingStatus: 'non_facture' as const,
          batchId: undefined,
          batchNumber: undefined,
          billingDate: undefined,
          billingAmount: undefined,
          billingType: undefined,
          is_billed: false,
        };
      }
    }
    return v;
  });

  if (updatedCount > 0) {
    // Save updated vehicles to localStore silently
    try {
      const raw = localStorage.getItem('parc_stafim_db_v1');
      if (raw) {
        const db = JSON.parse(raw);
        db.vehicles = updatedVehicles;
        localStorage.setItem('parc_stafim_db_v1', JSON.stringify(db));
      }
    } catch (e) {
      console.error('Error syncing vehicles with batches:', e);
    }
  }
}

export function createBatch(data: Omit<BillingBatch, 'id' | 'createdAt' | 'updatedAt'>): BillingBatch {
  const batches = loadBatches();
  const now = new Date().toISOString();
  const newBatch: BillingBatch = {
    ...data,
    id: `batch_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    createdAt: now,
    updatedAt: now,
  };

  const updated = [newBatch, ...batches];
  saveBatches(updated);
  saveDocToCloud('billing_batches', newBatch.id, newBatch);
  return newBatch;
}

export function updateBatch(id: string, updates: Partial<BillingBatch>): BillingBatch | null {
  const batches = loadBatches();
  const index = batches.findIndex((b) => b.id === id);
  if (index === -1) return null;

  const updatedBatch: BillingBatch = {
    ...batches[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  batches[index] = updatedBatch;
  saveBatches(batches);
  saveDocToCloud('billing_batches', updatedBatch.id, updatedBatch);
  return updatedBatch;
}

export function deleteBatch(id: string): boolean {
  const batches = loadBatches();
  const filtered = batches.filter((b) => b.id !== id);
  if (filtered.length !== batches.length) {
    saveBatches(filtered);
    deleteDocFromCloud('billing_batches', id);
    return true;
  }
  return false;
}

export function deleteBatches(ids: string[]): number {
  if (!ids || ids.length === 0) return 0;
  const batches = loadBatches();
  const idSet = new Set(ids);
  const filtered = batches.filter((b) => !idSet.has(b.id));
  const count = batches.length - filtered.length;
  if (count > 0) {
    saveBatches(filtered);
    ids.forEach((id) => deleteDocFromCloud('billing_batches', id));
  }
  return count;
}

/**
 * Convert a BillingBatch to an Invoice object for PDF generation
 */
export function convertBatchToInvoice(batch: BillingBatch): Invoice {
  const subtotalHT = batch.subtotal;
  const vatAmount = (subtotalHT - batch.discount) * (batch.vatRate / 100);
  const totalTTC = subtotalHT - batch.discount + vatAmount + batch.timbreFiscal;

  return {
    id: batch.id,
    invoice_number: batch.invoiceReference || batch.batchNumber,
    invoice_date: batch.batchDate,
    due_date: batch.batchDate,
    client_name: batch.importer,
    client_address: 'Route de Sousse Km 6, Mégrine, Tunis',
    client_mf: batch.importer === 'STAFIM SA' ? '0012845/A/P/M/000' : '0000000/M/A/000',
    site_name: batch.siteName || 'Tous les Hubs Logistiques',
    status: batch.status === 'facture' ? 'payee' : batch.status === 'valide' ? 'en_attente' : 'brouillon',
    subtotal_ht: subtotalHT,
    tva_rate: batch.vatRate,
    tva_amount: vatAmount,
    timbre_fiscal: batch.timbreFiscal,
    total_ttc: totalTTC,
    notes: batch.notes || `Lot de facturation ${batch.batchNumber} - ${batch.vehicleCount} véhicules (${batch.billingType === 'livres' ? 'Livrés' : 'À livrer'})`,
    created_at: batch.createdAt,
    updated_at: batch.updatedAt,
    items: batch.items.map((item, idx) => ({
      id: `batch_item_${idx + 1}`,
      description: `Logistique ${batch.billingType === 'livres' ? 'Livraison' : 'Transits'} - ${item.brand} ${item.model} (VIN: ${item.chassisNumber})`,
      quantity: 1,
      unitPriceHT: item.unitPriceHT,
      totalHT: item.totalHT,
      tvaRate: batch.vatRate,
      vehicleId: item.vehicleId,
      chassisNumber: item.chassisNumber,
    })),
  };
}

export function exportBatchToPDF(batch: BillingBatch, vehiclesList: Vehicle[] = []): void {
  const inv = convertBatchToInvoice(batch);
  generateGroupedInvoicePDF(inv, vehiclesList);
}

export function exportBatchesToCSV(batches: BillingBatch[]): void {
  const headers = [
    'No_Lot',
    'Ref_Facture',
    'Date_Lot',
    'Importateur',
    'Type_Facturation',
    'Nombre_Vehicules',
    'Sous_Total_HT_DT',
    'Remise_DT',
    'TVA_Taux_%',
    'Montant_TVA_DT',
    'Timbre_Fiscal_DT',
    'Total_TTC_DT',
    'Statut',
    'Cree_Par',
    'Notes',
  ];

  const rows = batches.map((b) => [
    b.batchNumber,
    `"${b.invoiceReference || ''}"`,
    b.batchDate,
    `"${b.importer}"`,
    b.billingType === 'livres' ? 'Vehicules Livres' : 'Vehicules A Livrer',
    b.vehicleCount,
    b.subtotal.toFixed(3),
    b.discount.toFixed(3),
    b.vatRate,
    b.vatAmount.toFixed(3),
    b.timbreFiscal.toFixed(3),
    b.total.toFixed(3),
    b.status.toUpperCase(),
    `"${b.createdBy}"`,
    `"${b.notes || ''}"`,
  ]);

  const csvContent =
    'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `Export_Lots_Facturation_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function overrideBatchesFromCloud(cloudBatches: BillingBatch[]) {
  saveBatches(cloudBatches);
}

export const batchBillingStore = {
  loadBatches,
  saveBatches,
  createBatch,
  updateBatch,
  deleteBatch,
  convertBatchToInvoice,
  exportBatchToPDF,
  exportBatchesToCSV,
  overrideBatchesFromCloud,
};
