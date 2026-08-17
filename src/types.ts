export type VehicleStatus = 'a_ramasser' | 'en_transit' | 'en_stock' | 'livre' | 'en_panne' | 'en_service' | 'vendu' | 'immobilise';
export type SiteType = 'port' | 'park' | 'warehouse' | 'importer';
export type MovementType = 'entry' | 'exit' | 'transfer' | 'pickup' | 'reception';
export type UserRole = 'admin' | 'agent' | 'viewer';

export interface VehicleCustomField {
  key: string;
  value: string;
}

export interface Carrier {
  id: string;
  raisonSociale: string;
  nomChauffeur: string;
  telephone: string;
  matriculeCamion: string;
  actif: boolean;
}

export interface Vehicle {
  id: string;
  chassis_number: string; // VIN
  vin?: string;
  brand: string; // Marque
  model: string; // Modèle
  site_depart?: string; // Site de Départ
  site_arrivee?: string; // Site d'Arrivée
  registration_number?: string; // Immatriculation / Plaque
  stock_number?: string; // Numéro interne / N° de stock
  year?: number | string;
  category?: string;
  body_style?: string;
  color?: string;
  fuel_type?: string;
  transmission?: string;
  capacity?: string;
  weight_gvwr?: string;

  // Exploitation
  mileage?: number | string;
  condition?: string;
  status: VehicleStatus;
  current_site_id: string | null;
  main_driver?: string;

  // Informations Transport
  carrier_id?: string;
  carrier_name?: string;
  driver_name?: string;
  driver_phone?: string;
  truck_plate?: string;
  planned_pickup_date?: string;
  actual_pickup_date?: string;
  reception_date?: string;
  delivery_note_ref?: string;
  transport_notes?: string;

  // Importateur Officiel
  importer_id?: string;
  importer_name?: string;

  // Gestion
  arrival_date: string;
  service_start_date?: string;
  insurance_company?: string;
  insurance_expiry?: string;
  inspection_expiry?: string;
  warranty_expiry?: string;
  notes?: string;

  // Médias
  photo_url?: string;

  // Facturation & Règlement (Solde)
  is_billed?: boolean;
  invoice_number?: string;
  invoice_date?: string;
  is_paid?: boolean;
  paid_date?: string;
  payment_method?: string;
  is_delivered?: boolean;
  billingStatus?: 'non_facture' | 'en_lot' | 'facture';
  batchId?: string;
  batchNumber?: string;
  billingDate?: string;
  billingAmount?: number;
  billingType?: 'livres' | 'a_livrer';

  // Catégorie dédiée : Champs personnalisés
  custom_fields?: VehicleCustomField[];

  // Truck Load reference
  truck_load_id?: string;
  truck_load_number?: string;

  created_at: string;
  updated_at: string;
}

export type TruckLoadStatus = 'prevu' | 'a_ramasser' | 'en_transit' | 'reception_partielle' | 'receptionne' | 'annule';

export interface TruckLoadVehicle {
  vehicle_id?: string;
  vin: string;
  brand: string;
  model: string;
  color?: string;
  status: 'a_ramasser' | 'en_transit' | 'en_stock' | 'anomalie';
  reception_status?: 'conforme' | 'absente' | 'endommagee' | 'refusee';
  reception_notes?: string;
  reception_date?: string;
}

export interface TruckLoadHistoryItem {
  date: string;
  action: string;
  user_name: string;
  notes?: string;
}

export interface TruckLoad {
  id: string;
  load_number: string; // e.g., CHG-2026-0001
  carrier_id?: string;
  carrier_name: string;
  driver_name: string;
  driver_phone: string;
  truck_plate: string;
  max_capacity: number; // default 20
  delivery_note_ref: string;
  planned_pickup_date: string;
  actual_pickup_date?: string;
  reception_date?: string;
  departure_site_id?: string;
  departure_site_name: string;
  arrival_site_id?: string;
  arrival_site_name: string;
  status: TruckLoadStatus;
  notes?: string;
  vehicles: TruckLoadVehicle[];
  created_by_user_id: string;
  created_by_user_name?: string;
  created_at: string;
  updated_at: string;
  history?: TruckLoadHistoryItem[];
}

export interface Site {
  id: string;
  name: string;
  type: SiteType;
  address: string;
  active: boolean;
}

export interface Movement {
  id: string;
  vehicle_id: string;
  chassis_number?: string;
  movement_type: MovementType;
  movement_date: string;
  departure_site_id: string | null;
  arrival_site_id: string | null;
  destination_text?: string;
  waypoints?: string[]; // Array of intermediate site IDs or names
  
  // Transport info
  carrier_id?: string;
  transporter_name?: string;
  driver_name?: string;
  driver_phone?: string;
  truck_plate?: string;
  planned_pickup_date?: string;
  actual_pickup_date?: string;
  reception_date?: string;
  delivery_note_ref?: string;

  // Status transitions
  status_before?: VehicleStatus;
  status_after?: VehicleStatus;
  action_label?: string;

  notes?: string;
  created_by_user_id: string;
  created_by_user_name?: string;
  created_at: string;
}

export interface Route {
  id: string;
  departure_site_id: string;
  arrival_site_id: string;
  route_name: string;
  active: boolean;
  waypoints?: string[]; // Array of site IDs for intermediate stops (Multi-trajet)
}

export interface User {
  id: string;
  full_name: string;
  role: UserRole;
  email: string;
  active: boolean;
}

export interface StockStats {
  totalInStock: number;
  totalInTransit: number;
  totalToPickup?: number;
  totalDelivered: number;
  totalInRepair: number;
  vehiclesBySite: { siteId: string; siteName: string; count: number }[];
  movementsTodayCount: number;
  latestEntries: MovementWithDetails[];
  latestExits: MovementWithDetails[];
  latestTransfers: MovementWithDetails[];
}

export interface MovementWithDetails extends Movement {
  vehicle_chassis?: string;
  vehicle_brand?: string;
  vehicle_model?: string;
  departure_site_name?: string;
  arrival_site_name?: string;
  multi_route_summary?: string; // Full chain string: "Port de La Goulette > Parc STAFIM Megrine > Entrepôt Charguia"
}

export interface CreateVehiclePayload {
  allowUpdateExisting?: boolean;
  chassis_number?: string;
  vin?: string;
  brand: string;
  model: string;
  site_depart?: string;
  site_arrivee?: string;
  registration_number?: string;
  stock_number?: string;
  year?: number | string;
  category?: string;
  body_style?: string;
  color?: string;
  fuel_type?: string;
  transmission?: string;
  capacity?: string;
  weight_gvwr?: string;

  mileage?: number | string;
  condition?: string;
  status?: VehicleStatus;
  initial_site_id?: string | null;
  main_driver?: string;

  // Informations transport
  carrier_id?: string;
  carrier_name?: string;
  driver_name?: string;
  driver_phone?: string;
  truck_plate?: string;
  planned_pickup_date?: string;
  actual_pickup_date?: string;
  reception_date?: string;
  delivery_note_ref?: string;
  transport_notes?: string;

  importer_id?: string;
  importer_name?: string;

  arrival_date?: string;
  service_start_date?: string;
  insurance_company?: string;
  insurance_expiry?: string;
  inspection_expiry?: string;
  warranty_expiry?: string;
  notes?: string;

  photo_url?: string;
  custom_fields?: VehicleCustomField[];
}

export interface CreateMovementPayload {
  vehicle_id: string;
  movement_type: MovementType;
  movement_date?: string;
  departure_site_id?: string | null;
  arrival_site_id?: string | null;
  destination_text?: string;
  waypoints?: string[];

  // Transport info
  carrier_id?: string;
  transporter_name?: string;
  driver_name?: string;
  driver_phone?: string;
  truck_plate?: string;
  planned_pickup_date?: string;
  actual_pickup_date?: string;
  reception_date?: string;
  delivery_note_ref?: string;

  status_before?: VehicleStatus;
  status_after?: VehicleStatus;
  action_label?: string;

  notes?: string;
  created_by_user_id: string;
}

export type PaymentStatus = 'payee' | 'en_attente' | 'en_retard' | 'brouillon' | 'annulee';

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceHT: number;
  totalHT: number;
  tvaRate: number;
  vehicleId?: string;
  chassisNumber?: string;
  movementId?: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  client_name: string;
  client_address: string;
  client_mf: string;
  importer_id?: string;
  site_id?: string;
  site_name?: string;
  status: PaymentStatus;
  items: InvoiceItem[];
  subtotal_ht: number;
  tva_rate: number;
  tva_amount: number;
  timbre_fiscal: number;
  total_ttc: number;
  payment_method?: string;
  paid_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type BatchBillingType = 'livres' | 'a_livrer';
export type BatchStatus = 'brouillon' | 'valide' | 'facture' | 'annule';

export interface BillingBatchItem {
  vehicleId: string;
  chassisNumber: string;
  brand: string;
  model: string;
  siteDepart?: string;
  siteArrivee?: string;
  logisticsStatus: string;
  billingStatus?: string;
  unitPriceHT: number;
  totalHT: number;
  color?: string;
  arrivalDate?: string;
}

export interface BillingBatch {
  id: string;
  batchNumber: string;
  invoiceReference?: string;
  importer: string;
  siteId?: string;
  siteName?: string;
  billingType: BatchBillingType;
  batchDate: string;
  currency: string;
  vatRate: number;
  discount: number;
  discountType?: 'flat' | 'percent';
  subtotal: number;
  vatAmount: number;
  timbreFiscal: number;
  total: number;
  status: BatchStatus;
  notes?: string;
  vehicleIds: string[];
  vehicleCount: number;
  items: BillingBatchItem[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

