import { Invoice, PaymentStatus, InvoiceItem } from '../types';
import { saveDocToCloud, deleteDocFromCloud } from './cloudSyncStore';

const INVOICE_STORAGE_KEY = 'parc_stafim_invoices_v1';

export const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'inv_001',
    invoice_number: 'FAC-202607-001',
    invoice_date: '2026-07-15',
    due_date: '2026-08-15',
    client_name: 'STAFIM SA',
    client_address: 'Route de Sousse Km 6, Mégrine, Tunis',
    client_mf: '0012845/A/P/M/000',
    importer_id: 'stafim',
    site_id: 'site_megrine',
    site_name: 'Parc STAFIM Megrine',
    status: 'payee',
    payment_method: 'Virement bancaire',
    paid_date: '2026-07-28',
    subtotal_ht: 2450.0,
    tva_rate: 19,
    tva_amount: 465.5,
    timbre_fiscal: 1.0,
    total_ttc: 2916.5,
    notes: 'Facture mensuelle prestation déchargement portuaire et transfert parc Mégrine',
    created_at: '2026-07-15T09:00:00Z',
    updated_at: '2026-07-28T14:30:00Z',
    items: [
      {
        id: 'item_1',
        description: 'Réception portuaire & Déchargement navire (Peugeot 208)',
        quantity: 20,
        unitPriceHT: 50.0,
        totalHT: 1000.0,
        tvaRate: 19,
      },
      {
        id: 'item_2',
        description: 'Transfert logistique Port de La Goulette -> Parc Mégrine',
        quantity: 15,
        unitPriceHT: 85.0,
        totalHT: 1275.0,
        tvaRate: 19,
      },
      {
        id: 'item_3',
        description: 'Frais d amarrage & gardiennage temporaire',
        quantity: 1,
        unitPriceHT: 175.0,
        totalHT: 175.0,
        tvaRate: 19,
      },
    ],
  },
  {
    id: 'inv_002',
    invoice_number: 'FAC-202607-002',
    invoice_date: '2026-07-20',
    due_date: '2026-08-20',
    client_name: 'OPEL TUNISIE / AURES',
    client_address: 'Avenue de Carthage, Tunis',
    client_mf: '0458921/B/A/M/000',
    importer_id: 'opel_tunisie',
    site_id: 'site_radès',
    site_name: 'Entrepôt Logistique Radès',
    status: 'en_attente',
    payment_method: 'Chèque',
    subtotal_ht: 1890.0,
    tva_rate: 19,
    tva_amount: 359.1,
    timbre_fiscal: 1.0,
    total_ttc: 2250.1,
    notes: 'Transferts inter-sites Opel Corsa et Mokka',
    created_at: '2026-07-20T11:20:00Z',
    updated_at: '2026-07-20T11:20:00Z',
    items: [
      {
        id: 'item_4',
        description: 'Transfert convoyage camion plateau Radès -> Charguia',
        quantity: 12,
        unitPriceHT: 95.0,
        totalHT: 1140.0,
        tvaRate: 19,
      },
      {
        id: 'item_5',
        description: 'Mise en préparation & contrôle avant livraison concession',
        quantity: 10,
        unitPriceHT: 75.0,
        totalHT: 750.0,
        tvaRate: 19,
      },
    ],
  },
  {
    id: 'inv_003',
    invoice_number: 'FAC-202606-089',
    invoice_date: '2026-06-10',
    due_date: '2026-07-10',
    client_name: 'CITROËN TUNISIE',
    client_address: 'ZI Charguia II, Ariana',
    client_mf: '0098432/C/A/M/000',
    importer_id: 'citroen_tunisie',
    site_id: 'site_charguia',
    site_name: 'Hub Distribution Charguia',
    status: 'en_retard',
    payment_method: 'Virement bancaire',
    subtotal_ht: 3200.0,
    tva_rate: 19,
    tva_amount: 608.0,
    timbre_fiscal: 1.0,
    total_ttc: 3809.0,
    notes: 'Relance effectuée le 15/07 - En attente d accord de trésorerie',
    created_at: '2026-06-10T14:00:00Z',
    updated_at: '2026-07-15T16:00:00Z',
    items: [
      {
        id: 'item_6',
        description: 'Entrée en parc portuaire Citroën C3 & Berlingo',
        quantity: 40,
        unitPriceHT: 50.0,
        totalHT: 2000.0,
        tvaRate: 19,
      },
      {
        id: 'item_7',
        description: 'Livraison finale vers concessions régionales (Sousse & Sfax)',
        quantity: 20,
        unitPriceHT: 60.0,
        totalHT: 1200.0,
        tvaRate: 19,
      },
    ],
  },
];

export function loadInvoices(): Invoice[] {
  try {
    const raw = localStorage.getItem(INVOICE_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(INITIAL_INVOICES));
      return INITIAL_INVOICES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const sanitized = parsed.map((inv) => {
        if (
          inv.client_name === 'STAFIM Grossiste & Concessionnaire' ||
          inv.client_name === 'STAFIM PEUGEOT SA'
        ) {
          return { ...inv, client_name: 'STAFIM SA' };
        }
        return inv;
      });
      localStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(sanitized));
      return sanitized;
    }
  } catch (err) {
    console.error('Error loading invoices from localStorage:', err);
  }
  return INITIAL_INVOICES;
}

export function saveInvoices(invoices: Invoice[]): void {
  try {
    localStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(invoices));
  } catch (err) {
    console.error('Error saving invoices to localStorage:', err);
  }
}

export function createInvoice(invoice: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>): Invoice {
  const list = loadInvoices();
  const now = new Date().toISOString();
  const newInvoice: Invoice = {
    ...invoice,
    id: `inv_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    created_at: now,
    updated_at: now,
  };
  const updated = [newInvoice, ...list];
  saveInvoices(updated);
  saveDocToCloud('invoices', newInvoice.id, newInvoice);
  return newInvoice;
}

export function updateInvoice(id: string, updates: Partial<Invoice>): Invoice | null {
  const list = loadInvoices();
  const index = list.findIndex((inv) => inv.id === id);
  if (index === -1) return null;

  const updatedInvoice: Invoice = {
    ...list[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  list[index] = updatedInvoice;
  saveInvoices(list);
  saveDocToCloud('invoices', updatedInvoice.id, updatedInvoice);
  return updatedInvoice;
}

export function deleteInvoice(id: string): boolean {
  const list = loadInvoices();
  const filtered = list.filter((inv) => inv.id !== id);
  if (filtered.length !== list.length) {
    saveInvoices(filtered);
    deleteDocFromCloud('invoices', id);
    return true;
  }
  return false;
}

export function deleteInvoices(ids: string[]): number {
  if (!ids || ids.length === 0) return 0;
  const list = loadInvoices();
  const idSet = new Set(ids);
  const filtered = list.filter((inv) => !idSet.has(inv.id));
  const deletedCount = list.length - filtered.length;
  if (deletedCount > 0) {
    saveInvoices(filtered);
    ids.forEach((id) => deleteDocFromCloud('invoices', id));
  }
  return deletedCount;
}

export function overrideInvoicesFromCloud(cloudInvoices: Invoice[]) {
  saveInvoices(cloudInvoices);
}

export const invoiceStore = {
  loadInvoices,
  saveInvoices,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  deleteInvoices,
  overrideInvoicesFromCloud,
};
