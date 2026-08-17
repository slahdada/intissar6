import {
  Vehicle,
  Site,
  Movement,
  Route,
  User,
  Carrier,
  TruckLoad,
  TruckLoadVehicle,
  TruckLoadHistoryItem,
  CreateVehiclePayload,
  CreateMovementPayload,
  StockStats,
  MovementWithDetails,
  SiteType,
  UserRole,
  VehicleStatus,
  MovementType,
} from '../types';

import {
  INITIAL_SITES,
  INITIAL_ROUTES,
  INITIAL_USERS,
  INITIAL_VEHICLES,
  INITIAL_MOVEMENTS,
  INITIAL_CARRIERS,
  INITIAL_TRUCK_LOADS,
} from '../data/seedData';

import { saveDocToCloud, deleteDocFromCloud } from './cloudSyncStore';

const LOCAL_STORAGE_KEY = 'parc_stafim_db_v2';

interface DatabaseSchema {
  vehicles: Vehicle[];
  sites: Site[];
  movements: Movement[];
  routes: Route[];
  users: User[];
  carriers: Carrier[];
  truckLoads: TruckLoad[];
}

function loadDB(): DatabaseSchema {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      const initialDb: DatabaseSchema = {
        vehicles: INITIAL_VEHICLES,
        sites: INITIAL_SITES,
        movements: INITIAL_MOVEMENTS,
        routes: INITIAL_ROUTES,
        users: INITIAL_USERS,
        carriers: INITIAL_CARRIERS,
        truckLoads: INITIAL_TRUCK_LOADS,
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialDb));
      return initialDb;
    }
    const parsed = JSON.parse(raw);

    // Filter out pseudo-site TRANSPORTEUR (Rule 1 & Rule 9)
    const validSites: Site[] = (parsed.sites || INITIAL_SITES)
      .filter((s: Site) => {
        const nameUpper = s.name.toUpperCase();
        return !nameUpper.includes('TRANSPORTEUR') && s.id !== 'site_transporter' && s.id !== 'transporter';
      })
      .map((s: Site) => {
        if (s.id === 'site_stafim' || s.name.includes('STAFIM Gros')) {
          return { ...s, name: 'STAFIM SA' };
        }
        return s;
      });

    // Merge carriers
    const carriers: Carrier[] = parsed.carriers && parsed.carriers.length > 0 ? parsed.carriers : INITIAL_CARRIERS;
    const truckLoads: TruckLoad[] = parsed.truckLoads && parsed.truckLoads.length > 0 ? parsed.truckLoads : INITIAL_TRUCK_LOADS;

    // Migrate vehicles where site was TRANSPORTEUR (Rule 9)
    const migratedVehicles: Vehicle[] = (parsed.vehicles || INITIAL_VEHICLES).map((v: Vehicle) => {
      const isTransporterSite =
        v.current_site_id === 'site_transporter' ||
        v.current_site_id === 'transporter' ||
        (v.site_arrivee && v.site_arrivee.toUpperCase().includes('TRANSPORTEUR'));

      if (isTransporterSite) {
        return {
          ...v,
          status: 'en_transit' as VehicleStatus,
          current_site_id: v.site_depart ? (validSites.find((s) => s.name === v.site_depart)?.id || null) : null,
          transport_notes: v.transport_notes || 'Migré du site TRANSPORTEUR vers le statut En transit.',
        };
      }
      return v;
    });

    const localDb: DatabaseSchema = {
      vehicles: migratedVehicles,
      sites: validSites,
      movements: parsed.movements || INITIAL_MOVEMENTS,
      routes: parsed.routes || INITIAL_ROUTES,
      users: parsed.users || INITIAL_USERS,
      carriers,
      truckLoads,
    };
    saveDB(localDb);
    return localDb;
  } catch {
    return {
      vehicles: INITIAL_VEHICLES,
      sites: INITIAL_SITES,
      movements: INITIAL_MOVEMENTS,
      routes: INITIAL_ROUTES,
      users: INITIAL_USERS,
      carriers: INITIAL_CARRIERS,
      truckLoads: INITIAL_TRUCK_LOADS,
    };
  }
}

function saveDB(db: DatabaseSchema) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(db));
  } catch (err) {
    console.error('Error saving local db', err);
  }
}

export const localStore = {
  getFullDatabase: (): DatabaseSchema => {
    return loadDB();
  },

  overrideDatabaseFromCloud: (cloudDb: Partial<DatabaseSchema>) => {
    const db = loadDB();
    const newDb: DatabaseSchema = {
      vehicles: cloudDb.vehicles || db.vehicles,
      sites: cloudDb.sites || db.sites,
      movements: cloudDb.movements || db.movements,
      routes: cloudDb.routes || db.routes,
      carriers: cloudDb.carriers || db.carriers,
      truckLoads: cloudDb.truckLoads || db.truckLoads,
      users: cloudDb.users || db.users,
    };
    saveDB(newDb);
    return newDb;
  },

  getStats: (): StockStats => {
    const db = loadDB();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const inStock = db.vehicles.filter((v) => v.status === 'en_stock');
    const inTransit = db.vehicles.filter((v) => v.status === 'en_transit');
    const toPickup = db.vehicles.filter((v) => v.status === 'a_ramasser');
    const delivered = db.vehicles.filter((v) => v.status === 'livre');
    const inRepair = db.vehicles.filter((v) => v.status === 'en_panne');

    const siteMap = new Map<string, string>();
    db.sites.forEach((s) => siteMap.set(s.id, s.name));

    const siteCounts: Record<string, number> = {};
    db.sites.forEach((s) => (siteCounts[s.id] = 0));

    inStock.forEach((v) => {
      if (v.current_site_id && siteCounts[v.current_site_id] !== undefined) {
        siteCounts[v.current_site_id]++;
      }
    });

    const vehiclesBySite = Object.keys(siteCounts).map((siteId) => ({
      siteId,
      siteName: siteMap.get(siteId) || 'Inconnu',
      count: siteCounts[siteId],
    }));

    const movementsToday = db.movements.filter(
      (m) => m.movement_date && m.movement_date.startsWith(todayStr)
    );

    const getMovementDetails = (m: Movement): MovementWithDetails => {
      const v = db.vehicles.find((veh) => veh.id === m.vehicle_id);
      const dep = m.departure_site_id ? siteMap.get(m.departure_site_id) : undefined;
      const arr = m.arrival_site_id ? siteMap.get(m.arrival_site_id) : undefined;
      return {
        ...m,
        vehicle_chassis: m.chassis_number || v?.chassis_number,
        vehicle_brand: v?.brand,
        vehicle_model: v?.model,
        departure_site_name: dep,
        arrival_site_name: arr,
      };
    };

    const sortedMovements = [...db.movements].sort(
      (a, b) => new Date(b.movement_date).getTime() - new Date(a.movement_date).getTime()
    );

    return {
      totalInStock: inStock.length,
      totalInTransit: inTransit.length,
      totalToPickup: toPickup.length,
      totalDelivered: delivered.length,
      totalInRepair: inRepair.length,
      vehiclesBySite,
      movementsTodayCount: movementsToday.length,
      latestEntries: sortedMovements
        .filter((m) => m.movement_type === 'entry')
        .slice(0, 5)
        .map(getMovementDetails),
      latestExits: sortedMovements
        .filter((m) => m.movement_type === 'exit')
        .slice(0, 5)
        .map(getMovementDetails),
      latestTransfers: sortedMovements
        .filter((m) => m.movement_type === 'transfer' || m.movement_type === 'pickup' || m.movement_type === 'reception')
        .slice(0, 5)
        .map(getMovementDetails),
    };
  },

  getCarriers: (): Carrier[] => {
    const db = loadDB();
    return db.carriers || INITIAL_CARRIERS;
  },

  createCarrier: (payload: { raisonSociale: string; nomChauffeur: string; telephone: string; matriculeCamion: string }) => {
    const db = loadDB();
    const newCarrier: Carrier = {
      id: `carr_${Date.now()}`,
      raisonSociale: payload.raisonSociale.trim(),
      nomChauffeur: payload.nomChauffeur.trim(),
      telephone: payload.telephone.trim(),
      matriculeCamion: payload.matriculeCamion.trim(),
      actif: true,
    };
    db.carriers.push(newCarrier);
    saveDB(db);
    saveDocToCloud('carriers', newCarrier.id, newCarrier);
    return newCarrier;
  },

  updateCarrier: (id: string, payload: Partial<Carrier>) => {
    const db = loadDB();
    const carrier = db.carriers.find((c) => c.id === id);
    if (!carrier) throw new Error('Transporteur introuvable.');
    if (payload.raisonSociale !== undefined) carrier.raisonSociale = payload.raisonSociale.trim();
    if (payload.nomChauffeur !== undefined) carrier.nomChauffeur = payload.nomChauffeur.trim();
    if (payload.telephone !== undefined) carrier.telephone = payload.telephone.trim();
    if (payload.matriculeCamion !== undefined) carrier.matriculeCamion = payload.matriculeCamion.trim();
    if (payload.actif !== undefined) carrier.actif = payload.actif;
    saveDB(db);
    saveDocToCloud('carriers', carrier.id, carrier);
    return carrier;
  },

  deleteCarrier: (id: string) => {
    const db = loadDB();
    const index = db.carriers.findIndex((c) => c.id === id);
    if (index === -1) throw new Error('Transporteur introuvable.');
    db.carriers.splice(index, 1);
    saveDB(db);
    deleteDocFromCloud('carriers', id);
    return { message: 'Transporteur supprimé avec succès.' };
  },

  getVehicles: (params?: {
    search?: string;
    site?: string;
    brand?: string;
    model?: string;
    status?: string;
  }): Vehicle[] => {
    const db = loadDB();
    return db.vehicles.filter((v) => {
      if (params?.search) {
        const q = params.search.toLowerCase();
        const matchesChassis = v.chassis_number.toLowerCase().includes(q);
        const matchesBrand = v.brand.toLowerCase().includes(q);
        const matchesModel = v.model.toLowerCase().includes(q);
        const matchesColor = v.color ? v.color.toLowerCase().includes(q) : false;
        if (!matchesChassis && !matchesBrand && !matchesModel && !matchesColor) return false;
      }
      if (params?.site && v.current_site_id !== params.site) return false;
      if (params?.brand && v.brand.toLowerCase() !== params.brand.toLowerCase()) return false;
      if (params?.model && v.model.toLowerCase() !== params.model.toLowerCase()) return false;
      if (params?.status && v.status !== params.status) return false;
      return true;
    });
  },

  getVehicleById: (id: string) => {
    const db = loadDB();
    const vehicle = db.vehicles.find((v) => v.id === id);
    if (!vehicle) throw new Error('Véhicule introuvable');

    const siteMap = new Map<string, string>();
    db.sites.forEach((s) => siteMap.set(s.id, s.name));

    const vMovements = db.movements
      .filter((m) => m.vehicle_id === id)
      .sort((a, b) => new Date(b.movement_date).getTime() - new Date(a.movement_date).getTime());

    return {
      ...vehicle,
      current_site_name: vehicle.current_site_id
        ? siteMap.get(vehicle.current_site_id) || 'Inconnu'
        : 'Non assigné',
      movements: vMovements,
    };
  },

  getVehicleByChassis: (chassis: string): Vehicle => {
    const db = loadDB();
    const cleanQuery = chassis.trim().toLowerCase().replace(/\s+/g, '');
    if (!cleanQuery) throw new Error('Numéro de châssis invalide.');

    // 1. Exact match on chassis_number, registration_number, or stock_number
    let v = db.vehicles.find((veh) => {
      const c = veh.chassis_number.toLowerCase().replace(/\s+/g, '');
      const r = veh.registration_number ? veh.registration_number.toLowerCase().replace(/\s+/g, '') : '';
      const s = veh.stock_number ? veh.stock_number.toLowerCase().replace(/\s+/g, '') : '';
      return c === cleanQuery || (r && r === cleanQuery) || (s && s === cleanQuery);
    });

    // 2. Partial match if exactly 1 vehicle matches
    if (!v) {
      const matches = db.vehicles.filter((veh) => {
        const c = veh.chassis_number.toLowerCase().replace(/\s+/g, '');
        const r = veh.registration_number ? veh.registration_number.toLowerCase().replace(/\s+/g, '') : '';
        const s = veh.stock_number ? veh.stock_number.toLowerCase().replace(/\s+/g, '') : '';
        return c.includes(cleanQuery) || (r && r.includes(cleanQuery)) || (s && s.includes(cleanQuery));
      });
      if (matches.length === 1) {
        v = matches[0];
      }
    }

    if (!v) throw new Error('Véhicule introuvable avec ce numéro de châssis.');
    return v;
  },

  createVehicle: (payload: CreateVehiclePayload) => {
    const db = loadDB();
    
    // Normalize chassis / VIN
    let normalizedChassis = payload.chassis_number?.trim().toUpperCase();
    const normalizedRegistration = payload.registration_number?.trim().toUpperCase();
    const normalizedStockNum = payload.stock_number?.trim().toUpperCase();

    if (!normalizedChassis && normalizedRegistration) {
      normalizedChassis = `VIN-IMMAT-${normalizedRegistration.replace(/\s+/g, '')}`;
    } else if (!normalizedChassis) {
      normalizedChassis = `VIN-AUTO-${Date.now()}`;
    }

    // Check duplicates
    const existingByChassis = db.vehicles.find(
      (v) => (v.chassis_number || '').toUpperCase() === normalizedChassis
    );
    const existingByRegistration = normalizedRegistration
      ? db.vehicles.find(
          (v) => v.registration_number && v.registration_number.toUpperCase() === normalizedRegistration
        )
      : null;
    const existingByStock = normalizedStockNum
      ? db.vehicles.find((v) => v.stock_number && v.stock_number.toUpperCase() === normalizedStockNum)
      : null;

    if (existingByChassis) {
      if (existingByChassis.status !== 'livre' && !payload.allowUpdateExisting) {
        throw new Error(`Un véhicule actif en stock avec ce numéro de châssis/VIN (${normalizedChassis}) existe déjà.`);
      }

      // Re-activate or update vehicle
      const nowIso = new Date().toISOString();
      if (payload.status) existingByChassis.status = payload.status;
      else if (existingByChassis.status === 'livre') existingByChassis.status = 'en_stock';

      if (payload.initial_site_id) existingByChassis.current_site_id = payload.initial_site_id;
      if (payload.brand && payload.brand.trim()) existingByChassis.brand = payload.brand.trim();
      if (payload.model && payload.model.trim()) existingByChassis.model = payload.model.trim();
      if (payload.color && payload.color.trim()) existingByChassis.color = payload.color.trim();
      if (payload.notes && payload.notes.trim()) existingByChassis.notes = payload.notes.trim();
      if (payload.registration_number) existingByChassis.registration_number = normalizedRegistration;
      if (payload.stock_number) existingByChassis.stock_number = normalizedStockNum;
      if (payload.year) existingByChassis.year = Number(payload.year);
      if (payload.category) existingByChassis.category = payload.category;
      if (payload.body_style) existingByChassis.body_style = payload.body_style;
      if (payload.fuel_type) existingByChassis.fuel_type = payload.fuel_type;
      if (payload.transmission) existingByChassis.transmission = payload.transmission;
      if (payload.condition) existingByChassis.condition = payload.condition;
      if (payload.mileage !== undefined && payload.mileage !== '') existingByChassis.mileage = Number(payload.mileage);
      existingByChassis.updated_at = nowIso;

      const user = db.users[0];
      const returnMvt: Movement = {
        id: `mvt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        vehicle_id: existingByChassis.id,
        chassis_number: normalizedChassis,
        movement_type: 'entry',
        departure_site_id: null,
        arrival_site_id: payload.initial_site_id || null,
        destination_text: 'Ré-entrée en stock (Retour client / propriétaire)',
        movement_date: payload.arrival_date || nowIso,
        created_by_user_id: user?.id || 'usr_admin',
        created_by_user_name: user?.full_name || 'Ayari Intissar',
        notes: payload.notes ? `[Retour Client/Propriétaire] ${payload.notes.trim()}` : 'Ré-entrée en stock suite à un retour client/propriétaire.',
        created_at: nowIso,
      };

      db.movements.push(returnMvt);
      saveDB(db);
      saveDocToCloud('vehicles', existingByChassis.id, existingByChassis);
      saveDocToCloud('movements', returnMvt.id, returnMvt);
      return { vehicle: existingByChassis, movement: returnMvt };
    }

    if (existingByRegistration && existingByRegistration.status !== 'livre') {
      throw new Error(`Un véhicule actif en stock avec cette immatriculation (${normalizedRegistration}) existe déjà.`);
    }

    if (existingByStock && existingByStock.status !== 'livre') {
      throw new Error(`Un véhicule actif en stock avec ce numéro interne (${normalizedStockNum}) existe déjà.`);
    }

    const nowIso = new Date().toISOString();
    const initialStatus = payload.status || 'a_ramasser';

    const newVehicle: Vehicle = {
      id: `veh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      chassis_number: normalizedChassis,
      vin: normalizedChassis,
      site_depart: payload.site_depart?.trim() || undefined,
      site_arrivee: payload.site_arrivee?.trim() || undefined,
      registration_number: normalizedRegistration || undefined,
      stock_number: normalizedStockNum || undefined,
      brand: payload.brand.trim(),
      model: payload.model.trim(),
      year: payload.year || new Date().getFullYear(),
      category: payload.category?.trim() || undefined,
      body_style: payload.body_style?.trim() || undefined,
      color: payload.color?.trim() || 'Non spécifiée',
      fuel_type: payload.fuel_type?.trim() || undefined,
      transmission: payload.transmission?.trim() || undefined,
      capacity: payload.capacity?.trim() || undefined,
      weight_gvwr: payload.weight_gvwr?.trim() || undefined,
      mileage: payload.mileage !== undefined && payload.mileage !== '' ? payload.mileage : undefined,
      condition: payload.condition?.trim() || 'Neuf',
      status: initialStatus as VehicleStatus,
      current_site_id: payload.initial_site_id || null,
      main_driver: payload.main_driver?.trim() || undefined,
      
      // Transport Fields
      carrier_id: payload.carrier_id,
      carrier_name: payload.carrier_name,
      driver_name: payload.driver_name,
      driver_phone: payload.driver_phone,
      truck_plate: payload.truck_plate,
      planned_pickup_date: payload.planned_pickup_date,
      actual_pickup_date: payload.actual_pickup_date,
      reception_date: payload.reception_date,
      delivery_note_ref: payload.delivery_note_ref,
      transport_notes: payload.transport_notes,

      arrival_date: payload.arrival_date || nowIso,
      service_start_date: payload.service_start_date || undefined,
      insurance_company: payload.insurance_company?.trim() || undefined,
      insurance_expiry: payload.insurance_expiry || undefined,
      inspection_expiry: payload.inspection_expiry || undefined,
      warranty_expiry: payload.warranty_expiry || undefined,
      notes: payload.notes?.trim() || undefined,
      photo_url: payload.photo_url?.trim() || undefined,
      custom_fields: payload.custom_fields && payload.custom_fields.length > 0 ? payload.custom_fields : undefined,
      created_at: nowIso,
      updated_at: nowIso,
    };

    db.vehicles.push(newVehicle);

    let initialMovement: Movement | undefined;
    const user = db.users[0];
    const depSite = payload.site_depart ? db.sites.find((s) => s.name === payload.site_depart || s.id === payload.site_depart) : null;
    const arrSite = payload.site_arrivee ? db.sites.find((s) => s.name === payload.site_arrivee || s.id === payload.site_arrivee) : null;

    initialMovement = {
      id: `mvt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      vehicle_id: newVehicle.id,
      chassis_number: newVehicle.chassis_number,
      movement_type: 'entry',
      departure_site_id: depSite ? depSite.id : null,
      arrival_site_id: arrSite ? arrSite.id : (payload.initial_site_id || null),
      destination_text: payload.site_arrivee || 'Site d\'arrivée',
      movement_date: newVehicle.arrival_date,
      
      carrier_id: payload.carrier_id,
      transporter_name: payload.carrier_name,
      driver_name: payload.driver_name,
      driver_phone: payload.driver_phone,
      truck_plate: payload.truck_plate,
      planned_pickup_date: payload.planned_pickup_date,
      actual_pickup_date: payload.actual_pickup_date,
      reception_date: payload.reception_date,
      delivery_note_ref: payload.delivery_note_ref,

      status_before: undefined,
      status_after: initialStatus as VehicleStatus,
      action_label: 'Création / Mis à ramasser',

      created_by_user_id: user?.id || 'usr_admin',
      created_by_user_name: user?.full_name || 'Ayari Intissar',
      notes: payload.notes ? payload.notes.trim() : `Création véhicule ${newVehicle.brand} ${newVehicle.model} (${normalizedChassis}) - Départ: ${payload.site_depart || '-'} -> Arrivée: ${payload.site_arrivee || '-'}`,
      created_at: nowIso,
    };
    db.movements.push(initialMovement);

    saveDB(db);
    saveDocToCloud('vehicles', newVehicle.id, newVehicle);
    if (initialMovement) saveDocToCloud('movements', initialMovement.id, initialMovement);
    return { vehicle: newVehicle, movement: initialMovement };
  },

  bulkCreateVehicles: (payloads: CreateVehiclePayload[]) => {
    const created: Vehicle[] = [];
    const errors: { index: number; chassis_number?: string; error: string }[] = [];

    payloads.forEach((item, index) => {
      try {
        const result = localStore.createVehicle(item);
        created.push(result.vehicle);
      } catch (err: any) {
        errors.push({
          index,
          chassis_number: item.chassis_number || item.registration_number,
          error: err.message || 'Erreur lors de la création du véhicule',
        });
      }
    });

    return { createdCount: created.length, errorCount: errors.length, created, errors };
  },

  updateVehicle: (
    id: string,
    payload: {
      chassis_number?: string;
      brand?: string;
      model?: string;
      color?: string;
      notes?: string;
      arrival_date?: string;
      status?: string;
      current_site_id?: string | null;
      is_billed?: boolean;
      invoice_number?: string;
      is_paid?: boolean;
      paid_date?: string;
    }
  ) => {
    const db = loadDB();
    const idx = db.vehicles.findIndex((v) => v.id === id);
    if (idx === -1) throw new Error('Véhicule non trouvé');

    const v = db.vehicles[idx];

    let normChassis = v.chassis_number;
    if (payload.chassis_number && payload.chassis_number.trim() !== '') {
      normChassis = payload.chassis_number.trim().toUpperCase();
      const exists = db.vehicles.some((item) => item.id !== id && item.chassis_number.toUpperCase() === normChassis);
      if (exists) {
        throw new Error(`Ce numéro de châssis (${normChassis}) est déjà utilisé par un autre véhicule.`);
      }
      db.movements.forEach((m) => {
        if (m.vehicle_id === id) {
          m.chassis_number = normChassis;
        }
      });
    }

    if (payload.current_site_id !== undefined && payload.current_site_id !== v.current_site_id) {
      const oldSiteObj = db.sites.find((s) => s.id === v.current_site_id);
      const newSiteObj = db.sites.find((s) => s.id === payload.current_site_id);
      const oldSiteName = oldSiteObj ? oldSiteObj.name : 'Ancien emplacement';
      const newSiteName = newSiteObj ? newSiteObj.name : 'Nouveau site';
      const now = new Date().toISOString();
      db.movements.push({
        id: `mvt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        vehicle_id: v.id,
        chassis_number: normChassis,
        movement_type: 'transfer',
        movement_date: now,
        departure_site_id: v.current_site_id,
        arrival_site_id: payload.current_site_id || null,
        destination_text: `Modification directe du site : ${newSiteName}`,
        notes: `Transfert direct effectué via modification de la fiche (De ${oldSiteName} vers ${newSiteName})`,
        created_by_user_id: 'usr_admin',
        created_by_user_name: 'Administrateur',
        created_at: now,
      });
    }

    const updated: Vehicle = {
      ...v,
      chassis_number: normChassis,
      brand: payload.brand !== undefined && payload.brand.trim() !== '' ? payload.brand.trim() : v.brand,
      model: payload.model !== undefined && payload.model.trim() !== '' ? payload.model.trim() : v.model,
      color: payload.color !== undefined ? payload.color.trim() : v.color,
      notes: payload.notes !== undefined ? payload.notes.trim() : v.notes,
      arrival_date: payload.arrival_date !== undefined && payload.arrival_date.trim() !== '' ? payload.arrival_date.trim() : v.arrival_date,
      status: payload.status ? (payload.status as VehicleStatus) : v.status,
      current_site_id: payload.current_site_id !== undefined ? payload.current_site_id : v.current_site_id,
      is_billed: payload.is_billed !== undefined ? payload.is_billed : v.is_billed,
      invoice_number: payload.invoice_number !== undefined ? payload.invoice_number : v.invoice_number,
      is_paid: payload.is_paid !== undefined ? payload.is_paid : v.is_paid,
      paid_date: payload.paid_date !== undefined ? payload.paid_date : v.paid_date,
      updated_at: new Date().toISOString(),
    };
    db.vehicles[idx] = updated;
    saveDB(db);
    saveDocToCloud('vehicles', updated.id, updated);
    return updated;
  },

  deleteVehicle: (id: string) => {
    const db = loadDB();
    db.vehicles = db.vehicles.filter((v) => v.id !== id);
    db.movements = db.movements.filter((m) => m.vehicle_id !== id);
    saveDB(db);
    deleteDocFromCloud('vehicles', id);
    return { message: 'Véhicule et ses mouvements supprimés.' };
  },

  purgeAllVehicles: () => {
    const db = loadDB();
    const count = db.vehicles.length;
    db.vehicles = [];
    db.movements = [];
    saveDB(db);
    return { message: `Tout le stock a été réinitialisé (${count} véhicules).`, count };
  },

  getMovements: (params?: {
    vehicle_id?: string;
    site_id?: string;
    movement_type?: string;
    startDate?: string;
    endDate?: string;
    chassis?: string;
  }): MovementWithDetails[] => {
    const db = loadDB();
    const siteMap = new Map<string, string>();
    db.sites.forEach((s) => siteMap.set(s.id, s.name));

    let result = [...db.movements];

    if (params?.vehicle_id) {
      result = result.filter((m) => m.vehicle_id === params.vehicle_id);
    }
    if (params?.site_id) {
      result = result.filter(
        (m) => m.departure_site_id === params.site_id || m.arrival_site_id === params.site_id
      );
    }
    if (params?.movement_type) {
      result = result.filter((m) => m.movement_type === params.movement_type);
    }
    if (params?.chassis) {
      const q = params.chassis.toLowerCase();
      result = result.filter((m) => (m.chassis_number || '').toLowerCase().includes(q));
    }
    if (params?.startDate) {
      result = result.filter((m) => m.movement_date >= params.startDate!);
    }
    if (params?.endDate) {
      result = result.filter((m) => m.movement_date <= params.endDate!);
    }

    return result
      .sort((a, b) => new Date(b.movement_date).getTime() - new Date(a.movement_date).getTime())
      .map((m) => {
        const v = db.vehicles.find((veh) => veh.id === m.vehicle_id);
        const dep = m.departure_site_id ? siteMap.get(m.departure_site_id) : undefined;
        const arr = m.arrival_site_id ? siteMap.get(m.arrival_site_id) : undefined;
        return {
          ...m,
          vehicle_chassis: m.chassis_number || v?.chassis_number,
          vehicle_brand: v?.brand,
          vehicle_model: v?.model,
          departure_site_name: dep,
          arrival_site_name: arr,
        };
      });
  },

  createMovement: (payload: CreateMovementPayload) => {
    const db = loadDB();
    const vehicle = db.vehicles.find((v) => v.id === payload.vehicle_id);
    if (!vehicle) throw new Error('Véhicule introuvable');

    const user = db.users.find((u) => u.id === payload.created_by_user_id) || db.users[0];
    const nowIso = new Date().toISOString();
    const statusBefore = vehicle.status;
    let statusAfter: VehicleStatus = vehicle.status;

    // Handle logistics movement types
    if (payload.movement_type === 'pickup') {
      statusAfter = 'en_transit';
      vehicle.status = 'en_transit';
      vehicle.actual_pickup_date = payload.actual_pickup_date || nowIso;
    } else if (payload.movement_type === 'reception') {
      statusAfter = 'en_stock';
      vehicle.status = 'en_stock';
      if (payload.arrival_site_id) {
        vehicle.current_site_id = payload.arrival_site_id;
      }
      vehicle.reception_date = payload.reception_date || nowIso;
    } else if (payload.movement_type === 'transfer') {
      statusAfter = payload.status_after || 'en_stock';
      vehicle.status = statusAfter;
      if (payload.arrival_site_id) {
        vehicle.current_site_id = payload.arrival_site_id;
      }
    } else if (payload.movement_type === 'exit') {
      statusAfter = 'livre';
      vehicle.status = 'livre';
      vehicle.current_site_id = payload.arrival_site_id || payload.departure_site_id || null;
    } else if (payload.movement_type === 'entry') {
      statusAfter = 'en_stock';
      vehicle.status = 'en_stock';
      if (payload.arrival_site_id) {
        vehicle.current_site_id = payload.arrival_site_id;
      }
    }

    // Update vehicle transport fields if provided
    if (payload.carrier_id) vehicle.carrier_id = payload.carrier_id;
    if (payload.transporter_name) vehicle.carrier_name = payload.transporter_name;
    if (payload.driver_name) vehicle.driver_name = payload.driver_name;
    if (payload.driver_phone) vehicle.driver_phone = payload.driver_phone;
    if (payload.truck_plate) vehicle.truck_plate = payload.truck_plate;
    if (payload.delivery_note_ref) vehicle.delivery_note_ref = payload.delivery_note_ref;
    vehicle.updated_at = nowIso;

    const newMvt: Movement = {
      id: `mvt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      vehicle_id: vehicle.id,
      chassis_number: vehicle.chassis_number,
      movement_type: payload.movement_type,
      departure_site_id: payload.departure_site_id || null,
      arrival_site_id: payload.arrival_site_id || null,
      destination_text: payload.destination_text,
      movement_date: payload.movement_date || nowIso,

      carrier_id: payload.carrier_id || vehicle.carrier_id,
      transporter_name: payload.transporter_name || vehicle.carrier_name,
      driver_name: payload.driver_name || vehicle.driver_name,
      driver_phone: payload.driver_phone || vehicle.driver_phone,
      truck_plate: payload.truck_plate || vehicle.truck_plate,
      planned_pickup_date: payload.planned_pickup_date || vehicle.planned_pickup_date,
      actual_pickup_date: payload.actual_pickup_date || vehicle.actual_pickup_date,
      reception_date: payload.reception_date || vehicle.reception_date,
      delivery_note_ref: payload.delivery_note_ref || vehicle.delivery_note_ref,

      status_before: statusBefore,
      status_after: statusAfter,
      action_label: payload.action_label || (
        payload.movement_type === 'pickup' ? 'Ramassage par le transporteur' :
        payload.movement_type === 'reception' ? 'Réception au site d\'arrivée' :
        payload.movement_type === 'transfer' ? 'Transfert inter-sites' :
        payload.movement_type === 'exit' ? 'Sortie définitive' : 'Entrée en stock'
      ),

      created_by_user_id: user?.id || 'usr_admin',
      created_by_user_name: user?.full_name || 'Ayari Intissar',
      notes: payload.notes,
      created_at: nowIso,
    };

    db.movements.push(newMvt);
    saveDB(db);
    saveDocToCloud('movements', newMvt.id, newMvt);
    saveDocToCloud('vehicles', vehicle.id, vehicle);
    return { vehicle, movement: newMvt };
  },

  updateMovement: (
    id: string,
    payload: {
      movement_type?: MovementType;
      departure_site_id?: string | null;
      arrival_site_id?: string | null;
      destination_text?: string;
      movement_date?: string;
      notes?: string;
      waypoints?: string[];
    }
  ) => {
    const db = loadDB();
    const idx = db.movements.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error('Mouvement non trouvé');

    const updated: Movement = {
      ...db.movements[idx],
      ...(payload.movement_type && { movement_type: payload.movement_type }),
      ...(payload.departure_site_id !== undefined && { departure_site_id: payload.departure_site_id }),
      ...(payload.arrival_site_id !== undefined && { arrival_site_id: payload.arrival_site_id }),
      ...(payload.destination_text !== undefined && { destination_text: payload.destination_text }),
      ...(payload.movement_date && { movement_date: payload.movement_date }),
      ...(payload.notes !== undefined && { notes: payload.notes }),
      ...(payload.waypoints !== undefined && { waypoints: payload.waypoints }),
    };

    db.movements[idx] = updated;

    // Check if this is the most recent movement for the vehicle
    const vehicleMovements = db.movements
      .filter((m) => m.vehicle_id === updated.vehicle_id)
      .sort((a, b) => new Date(b.movement_date).getTime() - new Date(a.movement_date).getTime());

    if (vehicleMovements.length > 0 && vehicleMovements[0].id === updated.id) {
      const vehicle = db.vehicles.find((v) => v.id === updated.vehicle_id);
      if (vehicle) {
        if (updated.movement_type === 'transfer' && updated.arrival_site_id) {
          vehicle.current_site_id = updated.arrival_site_id;
          vehicle.status = 'en_stock';
        } else if (updated.movement_type === 'entry' && updated.arrival_site_id) {
          vehicle.current_site_id = updated.arrival_site_id;
          vehicle.status = 'en_stock';
        } else if (updated.movement_type === 'exit') {
          vehicle.current_site_id = updated.arrival_site_id || updated.departure_site_id || null;
          vehicle.status = 'livre';
        }
        vehicle.updated_at = new Date().toISOString();
      }
    }

    saveDB(db);
    saveDocToCloud('movements', updated.id, updated);
    const vObj = db.vehicles.find((v) => v.id === updated.vehicle_id);
    if (vObj) saveDocToCloud('vehicles', vObj.id, vObj);
    return updated;
  },

  deleteMovement: (id: string) => {
    const db = loadDB();
    db.movements = db.movements.filter((m) => m.id !== id);
    saveDB(db);
    deleteDocFromCloud('movements', id);
    return { message: 'Mouvement supprimé avec succès.' };
  },

  getSites: (): Site[] => {
    const db = loadDB();
    return db.sites;
  },

  createSite: (payload: { name: string; type: string; address?: string }): Site => {
    const db = loadDB();
    const newSite: Site = {
      id: `site_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      name: payload.name.trim(),
      type: payload.type as SiteType,
      address: payload.address?.trim() || '',
      active: true,
    };
    db.sites.push(newSite);
    saveDB(db);
    saveDocToCloud('sites', newSite.id, newSite);
    return newSite;
  },

  updateSite: (id: string, payload: { name?: string; type?: string; address?: string }): Site => {
    const db = loadDB();
    const idx = db.sites.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error('Site non trouvé');

    const updated: Site = {
      ...db.sites[idx],
      name: payload.name !== undefined ? payload.name : db.sites[idx].name,
      type: payload.type !== undefined ? (payload.type as SiteType) : db.sites[idx].type,
      address: payload.address !== undefined ? payload.address : db.sites[idx].address,
    };
    db.sites[idx] = updated;
    saveDB(db);
    saveDocToCloud('sites', updated.id, updated);
    return updated;
  },

  deleteSite: (id: string) => {
    const db = loadDB();
    db.sites = db.sites.filter((s) => s.id !== id);
    saveDB(db);
    deleteDocFromCloud('sites', id);
    return { message: 'Site supprimé.' };
  },

  getRoutes: (): Route[] => {
    const db = loadDB();
    return db.routes;
  },

  createRoute: (payload: { departure_site_id: string; arrival_site_id: string; waypoints?: string[]; route_name?: string }): Route => {
    const db = loadDB();
    const newRoute: Route = {
      id: `route_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      departure_site_id: payload.departure_site_id,
      arrival_site_id: payload.arrival_site_id,
      waypoints: payload.waypoints || [],
      route_name: payload.route_name || 'Trajet',
      active: true,
    };
    db.routes.push(newRoute);
    saveDB(db);
    return newRoute;
  },

  updateRoute: (id: string, payload: { departure_site_id?: string; arrival_site_id?: string; waypoints?: string[]; route_name?: string }): Route => {
    const db = loadDB();
    const idx = db.routes.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('Trajet non trouvé');

    const updated = { ...db.routes[idx], ...payload };
    db.routes[idx] = updated;
    saveDB(db);
    return updated;
  },

  deleteRoute: (id: string) => {
    const db = loadDB();
    db.routes = db.routes.filter((r) => r.id !== id);
    saveDB(db);
    return { message: 'Trajet supprimé.' };
  },

  getUsers: (): User[] => {
    const db = loadDB();
    return db.users;
  },

  createUser: (payload: { full_name: string; role: string; email: string }): User => {
    const db = loadDB();
    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      full_name: payload.full_name.trim(),
      role: payload.role as UserRole,
      email: payload.email.trim(),
      active: true,
    };
    db.users.push(newUser);
    saveDB(db);
    saveDocToCloud('users', newUser.id, newUser);
    return newUser;
  },

  updateUser: (id: string, payload: { full_name?: string; role?: string; email?: string }): User => {
    const db = loadDB();
    const idx = db.users.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error('Utilisateur non trouvé');

    const updated: User = {
      ...db.users[idx],
      full_name: payload.full_name !== undefined ? payload.full_name : db.users[idx].full_name,
      role: payload.role !== undefined ? (payload.role as UserRole) : db.users[idx].role,
      email: payload.email !== undefined ? payload.email : db.users[idx].email,
    };
    db.users[idx] = updated;
    saveDB(db);
    saveDocToCloud('users', updated.id, updated);
    return updated;
  },

  deleteUser: (id: string) => {
    const db = loadDB();
    db.users = db.users.filter((u) => u.id !== id);
    saveDB(db);
    deleteDocFromCloud('users', id);
    return { message: 'Utilisateur supprimé.' };
  },

  resetData: () => {
    const initialDb: DatabaseSchema = {
      vehicles: INITIAL_VEHICLES,
      sites: INITIAL_SITES,
      movements: INITIAL_MOVEMENTS,
      routes: INITIAL_ROUTES,
      users: INITIAL_USERS,
      carriers: INITIAL_CARRIERS,
      truckLoads: INITIAL_TRUCK_LOADS,
    };
    saveDB(initialDb);
    return { message: 'Données réinitialisées avec succès.' };
  },

  aiAssistant: (prompt: string) => {
    const db = loadDB();
    const vinRegex = /[A-HJ-NPR-Z0-9]{17}/gi;
    const extractedVins = Array.from(new Set(prompt.match(vinRegex) || []));

    const totalStock = db.vehicles.filter((v) => v.status === 'en_stock').length;

    let response = `🤖 **Synthèse Logistique Automatisée (Mode Client)** :\n\n`;

    if (extractedVins.length > 0) {
      response += `✅ **N° Châssis VIN détectés (${extractedVins.length})** :\n`;
      extractedVins.forEach((vin) => {
        const found = db.vehicles.find((v) => v.chassis_number.toUpperCase() === vin.toUpperCase());
        if (found) {
          response += `- \`${vin}\` : ${found.brand} ${found.model} (${found.status}) - ${found.color || 'Couleur N/C'}\n`;
        } else {
          response += `- \`${vin}\` : ⚠️ Non répertorié au parc (Prêt pour enregistrement d entrée)\n`;
        }
      });
      response += `\n`;
    }

    response += `📊 **État Général du Parc** :\n- Véhicules en stock : **${totalStock}**\n- Sites actifs : **${db.sites.length}**\n- Mouvements enregistrés : **${db.movements.length}**\n\n`;
    response += `*Note : Si votre requête concerne un transfert ou une note de livraison, vous pouvez procéder directement via l onglet "Saisie Mouvement".*`;

    return { text: response };
  },

  scanVinOcr: (imageDataUrl: string) => {
    return {
      vin: '',
      confidence: 0,
      message: 'Service OCR hors ligne indisponible sans connexion au serveur Gemini.',
    };
  },

  // Truck Load Operations
  getTruckLoads: (): TruckLoad[] => {
    const db = loadDB();
    return (db.truckLoads || []).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  getTruckLoadById: (id: string): TruckLoad => {
    const db = loadDB();
    const load = (db.truckLoads || []).find((l) => l.id === id);
    if (!load) throw new Error('Chargement camion introuvable.');
    return load;
  },

  createTruckLoad: (payload: {
    carrier_id?: string;
    carrier_name: string;
    driver_name: string;
    driver_phone: string;
    truck_plate: string;
    max_capacity?: number;
    delivery_note_ref: string;
    planned_pickup_date: string;
    departure_site_id: string;
    departure_site_name: string;
    arrival_site_id: string;
    arrival_site_name: string;
    notes?: string;
    vehicles: { vin: string; brand: string; model: string; color?: string }[];
    created_by_user_id: string;
    created_by_user_name?: string;
  }) => {
    const db = loadDB();
    const capacity = payload.max_capacity && payload.max_capacity > 0 ? payload.max_capacity : 20;

    // Rule 1: Departure and Arrival sites must be different
    if (payload.departure_site_id === payload.arrival_site_id) {
      throw new Error('Le site de départ et le site d’arrivée doivent être deux sites physiques différents.');
    }

    // Check transporter site rule
    const depUpper = (payload.departure_site_name || '').toUpperCase();
    const arrUpper = (payload.arrival_site_name || '').toUpperCase();
    if (depUpper.includes('TRANSPORTEUR') || arrUpper.includes('TRANSPORTEUR')) {
      throw new Error('Le transporteur ne peut pas être sélectionné comme site de stockage.');
    }

    // Capacity check
    if (payload.vehicles.length > capacity) {
      throw new Error(`Le nombre de véhicules (${payload.vehicles.length}) dépasse la capacité maximale du camion (${capacity}).`);
    }

    if (payload.vehicles.length === 0) {
      throw new Error('Veuillez ajouter au moins un véhicule dans le chargement.');
    }

    // Check duplicate VINs inside payload
    const vinsInPayload = payload.vehicles.map((v) => v.vin.trim().toUpperCase());
    const uniqueVins = new Set(vinsInPayload);
    if (uniqueVins.size !== vinsInPayload.length) {
      throw new Error('Des numéros de châssis / VIN dupliqués sont présents dans la liste de chargement.');
    }

    // Validate VIN length & duplicates against stock
    vinsInPayload.forEach((vin) => {
      if (vin.length !== 17) {
        throw new Error(`Le VIN "${vin}" est invalide. Il doit comporter exactement 17 caractères.`);
      }

      const existingInStock = db.vehicles.find((v) => v.chassis_number.toUpperCase() === vin);
      if (existingInStock) {
        if (existingInStock.status === 'livre') {
          throw new Error(`Le VIN "${vin}" correspond à un véhicule déjà livré.`);
        }
        if (existingInStock.status === 'en_transit' || existingInStock.status === 'a_ramasser') {
          throw new Error(`Le VIN "${vin}" est déjà affecté à un chargement actif ou en cours de transport.`);
        }
      }
    });

    // Generate unique load number CHG-2026-XXXX
    const year = new Date().getFullYear();
    const currentYearLoads = (db.truckLoads || []).filter((l) => l.load_number.startsWith(`CHG-${year}`));
    const seqNum = currentYearLoads.length + 1;
    const loadNumber = `CHG-${year}-${String(seqNum).padStart(4, '0')}`;

    const now = new Date().toISOString();
    const loadId = `chg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Create / update vehicles in stock
    const loadedVehicles: TruckLoadVehicle[] = [];

    payload.vehicles.forEach((vehPayload) => {
      const normVin = vehPayload.vin.trim().toUpperCase();
      let existing = db.vehicles.find((v) => v.chassis_number.toUpperCase() === normVin);

      if (existing) {
        existing.status = 'a_ramasser';
        existing.truck_load_id = loadId;
        existing.truck_load_number = loadNumber;
        existing.carrier_id = payload.carrier_id;
        existing.carrier_name = payload.carrier_name;
        existing.driver_name = payload.driver_name;
        existing.driver_phone = payload.driver_phone;
        existing.truck_plate = payload.truck_plate;
        existing.planned_pickup_date = payload.planned_pickup_date;
        existing.delivery_note_ref = payload.delivery_note_ref;
        existing.site_depart = payload.departure_site_name;
        existing.site_arrivee = payload.arrival_site_name;
        existing.brand = vehPayload.brand || existing.brand;
        existing.model = vehPayload.model || existing.model;
        if (vehPayload.color) existing.color = vehPayload.color;
        existing.updated_at = now;

        loadedVehicles.push({
          vehicle_id: existing.id,
          vin: normVin,
          brand: existing.brand,
          model: existing.model,
          color: existing.color,
          status: 'a_ramasser',
        });
      } else {
        const newVehId = `veh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newVeh: Vehicle = {
          id: newVehId,
          chassis_number: normVin,
          vin: normVin,
          brand: vehPayload.brand || 'Marque',
          model: vehPayload.model || 'Modèle',
          color: vehPayload.color || 'Non spécifiée',
          status: 'a_ramasser',
          current_site_id: payload.departure_site_id,
          site_depart: payload.departure_site_name,
          site_arrivee: payload.arrival_site_name,
          carrier_id: payload.carrier_id,
          carrier_name: payload.carrier_name,
          driver_name: payload.driver_name,
          driver_phone: payload.driver_phone,
          truck_plate: payload.truck_plate,
          planned_pickup_date: payload.planned_pickup_date,
          delivery_note_ref: payload.delivery_note_ref,
          truck_load_id: loadId,
          truck_load_number: loadNumber,
          arrival_date: now,
          created_at: now,
          updated_at: now,
        };
        db.vehicles.push(newVeh);

        loadedVehicles.push({
          vehicle_id: newVehId,
          vin: normVin,
          brand: newVeh.brand,
          model: newVeh.model,
          color: newVeh.color,
          status: 'a_ramasser',
        });
      }

      const vObj = db.vehicles.find((v) => v.chassis_number.toUpperCase() === normVin);
      if (vObj) {
        db.movements.push({
          id: `mvt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          vehicle_id: vObj.id,
          chassis_number: normVin,
          movement_type: 'pickup',
          movement_date: now,
          departure_site_id: payload.departure_site_id,
          arrival_site_id: payload.arrival_site_id,
          destination_text: `Programmé sur le chargement ${loadNumber}`,
          carrier_id: payload.carrier_id,
          transporter_name: payload.carrier_name,
          driver_name: payload.driver_name,
          driver_phone: payload.driver_phone,
          truck_plate: payload.truck_plate,
          planned_pickup_date: payload.planned_pickup_date,
          delivery_note_ref: payload.delivery_note_ref,
          status_before: undefined,
          status_after: 'a_ramasser',
          action_label: `Affecté au Chargement Camion ${loadNumber}`,
          created_by_user_id: payload.created_by_user_id,
          created_by_user_name: payload.created_by_user_name || 'Utilisateur',
          notes: `Chargement camion porte-voitures (${loadedVehicles.length} / ${capacity}) - Ref BL: ${payload.delivery_note_ref}`,
          created_at: now,
        });
      }
    });

    const newTruckLoad: TruckLoad = {
      id: loadId,
      load_number: loadNumber,
      carrier_id: payload.carrier_id,
      carrier_name: payload.carrier_name,
      driver_name: payload.driver_name,
      driver_phone: payload.driver_phone,
      truck_plate: payload.truck_plate,
      max_capacity: capacity,
      delivery_note_ref: payload.delivery_note_ref,
      planned_pickup_date: payload.planned_pickup_date,
      departure_site_id: payload.departure_site_id,
      departure_site_name: payload.departure_site_name,
      arrival_site_id: payload.arrival_site_id,
      arrival_site_name: payload.arrival_site_name,
      status: 'a_ramasser',
      notes: payload.notes,
      vehicles: loadedVehicles,
      created_by_user_id: payload.created_by_user_id,
      created_by_user_name: payload.created_by_user_name || 'Administrateur',
      created_at: now,
      updated_at: now,
      history: [
        {
          date: now,
          action: 'Création du chargement camion',
          user_name: payload.created_by_user_name || 'Utilisateur',
          notes: `${loadedVehicles.length} véhicule(s) enregistrés - Capacité max : ${capacity}`,
        },
      ],
    };

    if (!db.truckLoads) db.truckLoads = [];
    db.truckLoads.push(newTruckLoad);
    saveDB(db);

    return newTruckLoad;
  },

  startTruckLoadTransit: (id: string, user_id: string, user_name?: string) => {
    const db = loadDB();
    const load = (db.truckLoads || []).find((l) => l.id === id);
    if (!load) throw new Error('Chargement introuvable.');

    if (load.status === 'en_transit') {
      throw new Error('Ce chargement est déjà en transit.');
    }
    if (load.status === 'receptionne' || load.status === 'annule') {
      throw new Error('Impossible de démarrer le transit pour un chargement clôturé ou annulé.');
    }

    const now = new Date().toISOString();
    load.status = 'en_transit';
    load.actual_pickup_date = now;
    load.updated_at = now;

    load.vehicles.forEach((tv) => {
      tv.status = 'en_transit';
      const v = db.vehicles.find((veh) => veh.chassis_number.toUpperCase() === tv.vin.toUpperCase());
      if (v) {
        v.status = 'en_transit';
        v.actual_pickup_date = now;
        v.updated_at = now;

        db.movements.push({
          id: `mvt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          vehicle_id: v.id,
          chassis_number: v.chassis_number,
          movement_type: 'pickup',
          movement_date: now,
          departure_site_id: load.departure_site_id || null,
          arrival_site_id: load.arrival_site_id || null,
          destination_text: `En transit camion ${load.load_number} vers ${load.arrival_site_name}`,
          actual_pickup_date: now,
          status_before: 'a_ramasser',
          status_after: 'en_transit',
          action_label: `Démarrage Transit (${load.load_number})`,
          created_by_user_id: user_id,
          created_by_user_name: user_name || 'Agent',
          notes: `Camion ${load.truck_plate} conduit par ${load.driver_name} parti du site ${load.departure_site_name}`,
          created_at: now,
        });
      }
    });

    if (!load.history) load.history = [];
    load.history.push({
      date: now,
      action: 'Démarrage du transit',
      user_name: user_name || 'Agent',
      notes: `Ramassage effectué à ${load.departure_site_name} par ${load.driver_name}`,
    });

    saveDB(db);
    return load;
  },

  confirmTruckLoadReception: (
    id: string,
    confirmations: {
      vin: string;
      reception_status: 'conforme' | 'absente' | 'endommagee' | 'refusee';
      notes?: string;
    }[],
    user_id: string,
    user_name?: string
  ) => {
    const db = loadDB();
    const load = (db.truckLoads || []).find((l) => l.id === id);
    if (!load) throw new Error('Chargement introuvable.');

    const now = new Date().toISOString();

    confirmations.forEach((conf) => {
      const tv = load.vehicles.find((v) => v.vin.toUpperCase() === conf.vin.toUpperCase());
      if (tv) {
        tv.reception_status = conf.reception_status;
        tv.reception_notes = conf.notes;
        tv.reception_date = now;

        const v = db.vehicles.find((veh) => veh.chassis_number.toUpperCase() === conf.vin.toUpperCase());

        if (conf.reception_status === 'conforme') {
          tv.status = 'en_stock';
          if (v) {
            v.status = 'en_stock';
            v.current_site_id = load.arrival_site_id || null;
            v.reception_date = now;
            v.updated_at = now;
          }
        } else {
          if (!conf.notes || conf.notes.trim() === '') {
            throw new Error(`Un commentaire explicatif est obligatoire pour la réserve/anomalie du véhicule VIN ${conf.vin}.`);
          }
          tv.status = 'anomalie';
          if (v) {
            v.status = conf.reception_status === 'endommagee' ? 'en_panne' : 'immobilise';
            v.current_site_id = load.arrival_site_id || null;
            v.notes = `[Réception Anormale ${conf.reception_status.toUpperCase()}] ${conf.notes.trim()}`;
            v.updated_at = now;
          }
        }

        if (v) {
          db.movements.push({
            id: `mvt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            vehicle_id: v.id,
            chassis_number: v.chassis_number,
            movement_type: 'reception',
            movement_date: now,
            departure_site_id: load.departure_site_id || null,
            arrival_site_id: load.arrival_site_id || null,
            destination_text: `Réception sur site : ${load.arrival_site_name}`,
            reception_date: now,
            status_before: 'en_transit',
            status_after: v.status,
            action_label: `Réception (${conf.reception_status.toUpperCase()})`,
            created_by_user_id: user_id,
            created_by_user_name: user_name || 'Agent',
            notes: conf.notes ? `[Réserves Réception ${conf.reception_status}] ${conf.notes}` : `Réception conforme du véhicule sur site ${load.arrival_site_name}`,
            created_at: now,
          });
        }
      }
    });

    const totalVehicles = load.vehicles.length;
    const confirmedVehicles = load.vehicles.filter((v) => v.reception_status !== undefined);
    const conforms = load.vehicles.filter((v) => v.reception_status === 'conforme');

    if (confirmedVehicles.length === totalVehicles) {
      if (conforms.length === totalVehicles) {
        load.status = 'receptionne';
      } else {
        load.status = 'reception_partielle';
      }
      load.reception_date = now;
    } else {
      load.status = 'reception_partielle';
    }

    load.updated_at = now;

    if (!load.history) load.history = [];
    load.history.push({
      date: now,
      action: 'Confirmation Réception',
      user_name: user_name || 'Agent',
      notes: `${confirmations.length} véhicule(s) réceptionnés au site ${load.arrival_site_name}`,
    });

    saveDB(db);
    return load;
  },

  cancelTruckLoad: (id: string, user_id: string, user_name?: string, reason?: string) => {
    const db = loadDB();
    const load = (db.truckLoads || []).find((l) => l.id === id);
    if (!load) throw new Error('Chargement introuvable.');

    if (load.status === 'receptionne') {
      throw new Error('Impossible d’annuler un chargement déjà totalement réceptionné.');
    }

    const now = new Date().toISOString();
    load.status = 'annule';
    load.updated_at = now;

    load.vehicles.forEach((tv) => {
      const v = db.vehicles.find((veh) => veh.chassis_number.toUpperCase() === tv.vin.toUpperCase());
      if (v && v.status === 'a_ramasser') {
        v.status = 'en_stock';
        v.truck_load_id = undefined;
        v.truck_load_number = undefined;
        v.updated_at = now;
      }
    });

    if (!load.history) load.history = [];
    load.history.push({
      date: now,
      action: 'Annulation du chargement',
      user_name: user_name || 'Administrateur',
      notes: reason ? `Motif: ${reason}` : 'Chargement camion annulé par l’utilisateur.',
    });

    saveDB(db);
    return load;
  },

  renameBrandInVehicles: (oldBrand: string, newBrand: string) => {
    const db = loadDB();
    let updatedCount = 0;
    db.vehicles = db.vehicles.map((v) => {
      if (v.brand && v.brand.toLowerCase() === oldBrand.toLowerCase()) {
        updatedCount++;
        return { ...v, brand: newBrand, updated_at: new Date().toISOString() };
      }
      return v;
    });
    if (updatedCount > 0) saveDB(db);
    return updatedCount;
  },

  deleteBrandInVehicles: (brand: string) => {
    const db = loadDB();
    let updatedCount = 0;
    db.vehicles = db.vehicles.map((v) => {
      if (v.brand && v.brand.toLowerCase() === brand.toLowerCase()) {
        updatedCount++;
        return { ...v, brand: 'Non spécifiée', model: 'Non spécifié', updated_at: new Date().toISOString() };
      }
      return v;
    });
    if (updatedCount > 0) saveDB(db);
    return updatedCount;
  },

  renameModelInVehicles: (brand: string, oldModel: string, newModel: string) => {
    const db = loadDB();
    let updatedCount = 0;
    db.vehicles = db.vehicles.map((v) => {
      if (
        v.brand &&
        v.brand.toLowerCase() === brand.toLowerCase() &&
        v.model &&
        v.model.toLowerCase() === oldModel.toLowerCase()
      ) {
        updatedCount++;
        return { ...v, model: newModel, updated_at: new Date().toISOString() };
      }
      return v;
    });
    if (updatedCount > 0) saveDB(db);
    return updatedCount;
  },

  deleteModelInVehicles: (brand: string, model: string) => {
    const db = loadDB();
    let updatedCount = 0;
    db.vehicles = db.vehicles.map((v) => {
      if (
        v.brand &&
        v.brand.toLowerCase() === brand.toLowerCase() &&
        v.model &&
        v.model.toLowerCase() === model.toLowerCase()
      ) {
        updatedCount++;
        return { ...v, model: 'Non spécifié', updated_at: new Date().toISOString() };
      }
      return v;
    });
    if (updatedCount > 0) saveDB(db);
    return updatedCount;
  },
};
