import { Vehicle, Movement, Invoice } from '../types';

export interface VehicleSoldedDetails {
  isDelivered: boolean;
  isBilled: boolean;
  isPaid: boolean;
  isSolded: boolean;
  deliveryDate: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  paidDate: string | null;
  totalAmountTTC: number | null;
  matchedInvoice: Invoice | null;
}

export function getVehicleSoldedDetails(
  v: Vehicle,
  invoices: Invoice[] = [],
  movements: Movement[] = []
): VehicleSoldedDetails {
  if (!v) {
    return {
      isDelivered: false,
      isBilled: false,
      isPaid: false,
      isSolded: false,
      deliveryDate: null,
      invoiceNumber: null,
      invoiceDate: null,
      paidDate: null,
      totalAmountTTC: null,
      matchedInvoice: null,
    };
  }

  // 1. Check Delivery status
  const vehicleMovements = movements
    .filter((m) => m && (m.vehicle_id === v.id || m.chassis_number === v.chassis_number))
    .sort((a, b) => new Date(b.movement_date).getTime() - new Date(a.movement_date).getTime());

  const lastMovement = vehicleMovements[0];
  const isDelivered =
    v.status === 'livre' ||
    v.status === 'vendu' ||
    v.is_delivered === true ||
    (lastMovement && lastMovement.movement_type === 'exit') ||
    (v.notes || '').toLowerCase().includes('livré') ||
    (v.notes || '').toLowerCase().includes('livre');

  const deliveryDate =
    lastMovement?.movement_type === 'exit'
      ? lastMovement.movement_date
      : v.updated_at || v.arrival_date || null;

  // 2. Check Invoice status in Invoices list or direct fields
  const chassisNorm = (v.chassis_number || v.vin || '').toUpperCase().trim();

  // Find invoice linked to this vehicle
  const matchedInvoice =
    invoices.find((inv) => {
      if (!inv || !Array.isArray(inv.items)) return false;
      return inv.items.some((item) => {
        if (!item) return false;
        if (item.vehicleId && item.vehicleId === v.id) return true;
        if (item.chassisNumber && item.chassisNumber.toUpperCase().trim() === chassisNorm) return true;
        if (item.description && chassisNorm && item.description.toUpperCase().includes(chassisNorm)) return true;
        return false;
      });
    }) || null;

  const isBilled =
    Boolean(v.is_billed) ||
    Boolean(v.invoice_number && v.invoice_number.trim() !== '') ||
    Boolean(matchedInvoice);

  const invoiceNumber = v.invoice_number || matchedInvoice?.invoice_number || null;
  const invoiceDate = v.invoice_date || matchedInvoice?.invoice_date || null;
  const totalAmountTTC = matchedInvoice?.total_ttc || null;

  // 3. Check Payment / Settlement status
  const isPaid =
    Boolean(v.is_paid) ||
    (v as any).payment_status === 'payee' ||
    (v as any).payment_status === 'regle' ||
    Boolean(matchedInvoice && matchedInvoice.status === 'payee');

  const paidDate = v.paid_date || matchedInvoice?.paid_date || null;

  // 4. Vehicle is Soldé / Prêt à suppression IF delivered + billed + paid
  const isSolded = isDelivered && isBilled && isPaid;

  return {
    isDelivered,
    isBilled,
    isPaid,
    isSolded,
    deliveryDate,
    invoiceNumber,
    invoiceDate,
    paidDate,
    totalAmountTTC,
    matchedInvoice,
  };
}

export function isVehicleSolded(
  v: Vehicle,
  invoices: Invoice[] = [],
  movements: Movement[] = []
): boolean {
  return getVehicleSoldedDetails(v, invoices, movements).isSolded;
}
