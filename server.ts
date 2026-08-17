import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

import {
  Vehicle,
  Site,
  Movement,
  Route,
  User,
  Carrier,
  TruckLoad,
  TruckLoadVehicle,
  CreateVehiclePayload,
  CreateMovementPayload,
  StockStats,
  MovementWithDetails,
  VehicleStatus,
} from './src/types.js';

import {
  INITIAL_SITES,
  INITIAL_ROUTES,
  INITIAL_USERS,
  INITIAL_VEHICLES,
  INITIAL_MOVEMENTS,
  INITIAL_CARRIERS,
  INITIAL_TRUCK_LOADS,
} from './src/data/seedData.js';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Persistent store in data/db.json
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

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
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initialDb: DatabaseSchema = {
        vehicles: INITIAL_VEHICLES,
        sites: INITIAL_SITES,
        movements: INITIAL_MOVEMENTS,
        routes: INITIAL_ROUTES,
        users: INITIAL_USERS,
        carriers: INITIAL_CARRIERS,
        truckLoads: INITIAL_TRUCK_LOADS,
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
      return initialDb;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
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

    const carriers: Carrier[] = parsed.carriers && parsed.carriers.length > 0 ? parsed.carriers : INITIAL_CARRIERS;

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

    const truckLoads: TruckLoad[] = parsed.truckLoads && parsed.truckLoads.length > 0 ? parsed.truckLoads : INITIAL_TRUCK_LOADS;

    const loadedDb: DatabaseSchema = {
      vehicles: migratedVehicles,
      sites: validSites,
      movements: parsed.movements || INITIAL_MOVEMENTS,
      routes: parsed.routes || INITIAL_ROUTES,
      users: parsed.users || INITIAL_USERS,
      carriers,
      truckLoads,
    };
    saveDB(loadedDb);
    return loadedDb;
  } catch (err) {
    console.error('Error reading DB, using initial fallback', err);
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
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving DB', err);
  }
}

let db = loadDB();

// API Endpoints

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /api/stats
app.get('/api/stats', (req: Request, res: Response) => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const inStock = db.vehicles.filter((v) => v.status === 'en_stock');
  const inTransit = db.vehicles.filter((v) => v.status === 'en_transit');
  const delivered = db.vehicles.filter((v) => v.status === 'livre');
  const inRepair = db.vehicles.filter((v) => v.status === 'en_panne');

  // Count vehicles by site
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

  const latestEntries = sortedMovements
    .filter((m) => m.movement_type === 'entry')
    .slice(0, 5)
    .map(getMovementDetails);

  const latestExits = sortedMovements
    .filter((m) => m.movement_type === 'exit')
    .slice(0, 5)
    .map(getMovementDetails);

  const latestTransfers = sortedMovements
    .filter((m) => m.movement_type === 'transfer')
    .slice(0, 5)
    .map(getMovementDetails);

  const stats: StockStats = {
    totalInStock: inStock.length,
    totalInTransit: inTransit.length,
    totalDelivered: delivered.length,
    totalInRepair: inRepair.length,
    vehiclesBySite,
    movementsTodayCount: movementsToday.length,
    latestEntries,
    latestExits,
    latestTransfers,
  };

  res.json(stats);
});

// GET /api/vehicles
app.get('/api/vehicles', (req: Request, res: Response) => {
  const { search, site, brand, model, status } = req.query;
  let results = [...db.vehicles];

  if (search && typeof search === 'string') {
    const s = search.trim().toLowerCase();
    results = results.filter(
      (v) =>
        v.chassis_number.toLowerCase().includes(s) ||
        v.brand.toLowerCase().includes(s) ||
        v.model.toLowerCase().includes(s) ||
        (v.notes && v.notes.toLowerCase().includes(s))
    );
  }

  if (site && typeof site === 'string') {
    results = results.filter((v) => v.current_site_id === site);
  }

  if (brand && typeof brand === 'string') {
    results = results.filter((v) => v.brand.toLowerCase() === brand.toLowerCase());
  }

  if (model && typeof model === 'string') {
    results = results.filter((v) => v.model.toLowerCase() === model.toLowerCase());
  }

  if (status && typeof status === 'string') {
    results = results.filter((v) => v.status === status);
  }

  // Sort by updated_at desc
  results.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  res.json(results);
});

// GET /api/vehicles/:id
app.get('/api/vehicles/:id', (req: Request, res: Response) => {
  const vehicle = db.vehicles.find((v) => v.id === req.params.id);
  if (!vehicle) {
    return res.status(404).json({ error: 'Véhicule non trouvé.' });
  }

  const siteMap = new Map<string, string>();
  db.sites.forEach((s) => siteMap.set(s.id, s.name));

  const vehicleMovements = db.movements
    .filter((m) => m.vehicle_id === vehicle.id)
    .sort((a, b) => new Date(b.movement_date).getTime() - new Date(a.movement_date).getTime())
    .map((m) => ({
      ...m,
      departure_site_name: m.departure_site_id ? siteMap.get(m.departure_site_id) : undefined,
      arrival_site_name: m.arrival_site_id ? siteMap.get(m.arrival_site_id) : undefined,
    }));

  const currentSiteName = vehicle.current_site_id
    ? siteMap.get(vehicle.current_site_id) || 'Inconnu'
    : 'Aucun (Sorti)';

  res.json({
    ...vehicle,
    current_site_name: currentSiteName,
    movements: vehicleMovements,
  });
});

// GET /api/vehicles/chassis/:chassis
app.get('/api/vehicles/chassis/:chassis', (req: Request, res: Response) => {
  const chassis = req.params.chassis.trim().toUpperCase();
  const vehicle = db.vehicles.find((v) => v.chassis_number.toUpperCase() === chassis);
  if (!vehicle) {
    return res.status(404).json({ error: `Aucun véhicule trouvé avec le châssis ${chassis}.` });
  }
  res.json(vehicle);
});

// POST /api/vehicles/rename-brand
app.post('/api/vehicles/rename-brand', (req: Request, res: Response) => {
  const { oldBrand, newBrand } = req.body;
  if (!oldBrand || !newBrand) return res.status(400).json({ error: 'oldBrand and newBrand are required.' });
  let updatedCount = 0;
  db.vehicles = db.vehicles.map((v) => {
    if (v.brand && v.brand.toLowerCase() === oldBrand.toLowerCase()) {
      updatedCount++;
      return { ...v, brand: newBrand, updated_at: new Date().toISOString() };
    }
    return v;
  });
  if (updatedCount > 0) saveDB(db);
  res.json({ updatedCount });
});

// POST /api/vehicles/rename-model
app.post('/api/vehicles/rename-model', (req: Request, res: Response) => {
  const { brand, oldModel, newModel } = req.body;
  if (!brand || !oldModel || !newModel) return res.status(400).json({ error: 'brand, oldModel and newModel are required.' });
  let updatedCount = 0;
  db.vehicles = db.vehicles.map((v) => {
    if (
      v.brand && v.brand.toLowerCase() === brand.toLowerCase() &&
      v.model && v.model.toLowerCase() === oldModel.toLowerCase()
    ) {
      updatedCount++;
      return { ...v, model: newModel, updated_at: new Date().toISOString() };
    }
    return v;
  });
  if (updatedCount > 0) saveDB(db);
  res.json({ updatedCount });
});

// POST /api/vehicles/delete-brand
app.post('/api/vehicles/delete-brand', (req: Request, res: Response) => {
  const { brand } = req.body;
  if (!brand) return res.status(400).json({ error: 'brand is required.' });
  let updatedCount = 0;
  db.vehicles = db.vehicles.map((v) => {
    if (v.brand && v.brand.toLowerCase() === brand.toLowerCase()) {
      updatedCount++;
      return { ...v, brand: 'Non spécifiée', model: 'Non spécifié', updated_at: new Date().toISOString() };
    }
    return v;
  });
  if (updatedCount > 0) saveDB(db);
  res.json({ updatedCount });
});

// POST /api/vehicles/delete-model
app.post('/api/vehicles/delete-model', (req: Request, res: Response) => {
  const { brand, model } = req.body;
  if (!brand || !model) return res.status(400).json({ error: 'brand and model are required.' });
  let updatedCount = 0;
  db.vehicles = db.vehicles.map((v) => {
    if (
      v.brand && v.brand.toLowerCase() === brand.toLowerCase() &&
      v.model && v.model.toLowerCase() === model.toLowerCase()
    ) {
      updatedCount++;
      return { ...v, model: 'Non spécifié', updated_at: new Date().toISOString() };
    }
    return v;
  });
  if (updatedCount > 0) saveDB(db);
  res.json({ updatedCount });
});

// POST /api/vehicles (Create new vehicle + entry movement)
app.post('/api/vehicles', (req: Request, res: Response) => {
  const payload: CreateVehiclePayload = req.body;

  if (!payload.brand || !payload.brand.trim() || !payload.model || !payload.model.trim()) {
    return res.status(400).json({ error: 'La marque et le modèle sont obligatoires.' });
  }

  let normalizedChassis = payload.chassis_number?.trim().toUpperCase();
  const normalizedRegistration = payload.registration_number?.trim().toUpperCase();
  const normalizedStockNum = payload.stock_number?.trim().toUpperCase();

  if (!normalizedChassis && !normalizedRegistration) {
    return res.status(400).json({
      error: 'Au moins un identifiant unique est obligatoire : Numéro de châssis / VIN ou Immatriculation.',
    });
  }

  if (!normalizedChassis && normalizedRegistration) {
    normalizedChassis = `VIN-IMMAT-${normalizedRegistration.replace(/\s+/g, '')}`;
  } else if (!normalizedChassis) {
    normalizedChassis = `VIN-AUTO-${Date.now()}`;
  }

  // Validate uniqueness
  const existing = db.vehicles.find((v) => v.chassis_number.toUpperCase() === normalizedChassis);
  if (existing) {
    if (existing.status !== 'livre') {
      return res.status(400).json({
        error: `Ce numéro de châssis/VIN (${normalizedChassis}) est déjà présent en stock sur le site "${existing.current_site_id ? (db.sites.find(s => s.id === existing.current_site_id)?.name || 'Inconnu') : 'Inconnu'}".`,
      });
    }

    // Vehicle was previously delivered / exited ('livre') -> Re-activate for customer/owner return!
    if (!payload.initial_site_id) {
      return res.status(400).json({ error: 'Le site de ré-entrée en stock est obligatoire.' });
    }

    const site = db.sites.find((s) => s.id === payload.initial_site_id);
    if (!site) {
      return res.status(400).json({ error: 'Le site spécifié est introuvable.' });
    }

    const now = new Date().toISOString();
    existing.status = 'en_stock';
    existing.current_site_id = payload.initial_site_id;
    if (payload.brand) existing.brand = payload.brand.trim();
    if (payload.model) existing.model = payload.model.trim();
    if (payload.color) existing.color = payload.color.trim();
    if (payload.notes) existing.notes = payload.notes.trim();
    if (payload.registration_number) existing.registration_number = normalizedRegistration;
    if (payload.stock_number) existing.stock_number = normalizedStockNum;
    existing.updated_at = now;

    const returnMovement: Movement = {
      id: `mov_${Date.now()}`,
      vehicle_id: existing.id,
      chassis_number: normalizedChassis,
      movement_type: 'entry',
      movement_date: payload.arrival_date || now,
      departure_site_id: null,
      arrival_site_id: payload.initial_site_id,
      destination_text: `Ré-entrée en stock (Retour client / propriétaire) - Site : ${site.name}`,
      notes: payload.notes ? `[Retour Client/Propriétaire] ${payload.notes.trim()}` : 'Ré-entrée en stock suite à un retour du client ou propriétaire.',
      created_by_user_id: 'usr_admin',
      created_by_user_name: 'Administrateur Système',
      created_at: now,
    };

    db.movements.push(returnMovement);
    saveDB(db);

    return res.status(200).json({
      vehicle: existing,
      movement: returnMovement,
      isReturn: true,
      message: `Fiche véhicule (${normalizedChassis}) réactivée et enregistrée à l'entrée en stock avec succès (Retour client / propriétaire).`,
    });
  }

  if (normalizedRegistration) {
    const dupReg = db.vehicles.find(
      (v) => v.registration_number && v.registration_number.toUpperCase() === normalizedRegistration && v.status !== 'livre'
    );
    if (dupReg) {
      return res.status(400).json({
        error: `Un véhicule actif avec cette immatriculation (${normalizedRegistration}) existe déjà.`,
      });
    }
  }

  if (normalizedStockNum) {
    const dupStock = db.vehicles.find(
      (v) => v.stock_number && v.stock_number.toUpperCase() === normalizedStockNum && v.status !== 'livre'
    );
    if (dupStock) {
      return res.status(400).json({
        error: `Un véhicule actif avec ce numéro interne (${normalizedStockNum}) existe déjà.`,
      });
    }
  }

  const initialSiteId = payload.initial_site_id || (db.sites[0]?.id || null);
  const site = initialSiteId ? db.sites.find((s) => s.id === initialSiteId) : null;

  const now = new Date().toISOString();
  const newVehicleId = `veh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const newVehicle: Vehicle = {
    id: newVehicleId,
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
    status: payload.status || (initialSiteId ? 'en_stock' : 'en_transit'),
    current_site_id: initialSiteId,
    main_driver: payload.main_driver?.trim() || undefined,
    arrival_date: payload.arrival_date || now,
    service_start_date: payload.service_start_date || undefined,
    insurance_company: payload.insurance_company?.trim() || undefined,
    insurance_expiry: payload.insurance_expiry || undefined,
    inspection_expiry: payload.inspection_expiry || undefined,
    warranty_expiry: payload.warranty_expiry || undefined,
    notes: payload.notes?.trim() || undefined,
    photo_url: payload.photo_url?.trim() || undefined,
    custom_fields: payload.custom_fields && payload.custom_fields.length > 0 ? payload.custom_fields : undefined,
    created_at: now,
    updated_at: now,
  };

  let newMovement: Movement | null = null;
  if (initialSiteId) {
    newMovement = {
      id: `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      vehicle_id: newVehicleId,
      chassis_number: normalizedChassis,
      movement_type: 'entry',
      movement_date: newVehicle.arrival_date,
      departure_site_id: null,
      arrival_site_id: initialSiteId,
      destination_text: `Entrée en stock - Site : ${site ? site.name : 'Inconnu'}`,
      notes: payload.notes ? payload.notes.trim() : `Entrée en stock initiale (${newVehicle.brand} ${newVehicle.model})`,
      created_by_user_id: 'usr_admin',
      created_by_user_name: 'Administrateur Système',
      created_at: now,
    };
    db.movements.push(newMovement);
  }

  db.vehicles.push(newVehicle);
  saveDB(db);

  res.status(201).json({ vehicle: newVehicle, movement: newMovement });
});

// POST /api/vehicles/bulk (Bulk CSV Import)
app.post('/api/vehicles/bulk', (req: Request, res: Response) => {
  const items: CreateVehiclePayload[] = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Liste de véhicules invalide ou vide.' });
  }

  const created: Vehicle[] = [];
  const errors: { index: number; chassis_number?: string; error: string }[] = [];

  items.forEach((payload, index) => {
    try {
      if (!payload.brand || !payload.brand.trim() || !payload.model || !payload.model.trim()) {
        errors.push({ index, chassis_number: payload.chassis_number, error: 'Marque et Modèle sont obligatoires.' });
        return;
      }

      let normalizedChassis = payload.chassis_number?.trim().toUpperCase();
      const normalizedRegistration = payload.registration_number?.trim().toUpperCase();
      const normalizedStockNum = payload.stock_number?.trim().toUpperCase();

      if (!normalizedChassis && !normalizedRegistration) {
        errors.push({ index, error: 'Au moins un VIN ou Immatriculation est requis.' });
        return;
      }

      if (!normalizedChassis && normalizedRegistration) {
        normalizedChassis = `VIN-IMMAT-${normalizedRegistration.replace(/\s+/g, '')}`;
      } else if (!normalizedChassis) {
        normalizedChassis = `VIN-AUTO-${Date.now()}-${index}`;
      }

      const dupChassis = db.vehicles.find((v) => v.chassis_number.toUpperCase() === normalizedChassis && v.status !== 'livre');
      if (dupChassis) {
        errors.push({ index, chassis_number: normalizedChassis, error: `Numéro de châssis/VIN déjà présent.` });
        return;
      }

      if (normalizedRegistration) {
        const dupReg = db.vehicles.find((v) => v.registration_number && v.registration_number.toUpperCase() === normalizedRegistration && v.status !== 'livre');
        if (dupReg) {
          errors.push({ index, chassis_number: normalizedChassis, error: `Immatriculation (${normalizedRegistration}) déjà présente.` });
          return;
        }
      }

      const initialSiteId = payload.initial_site_id || (db.sites[0]?.id || null);
      const site = initialSiteId ? db.sites.find((s) => s.id === initialSiteId) : null;
      const now = new Date().toISOString();
      const newVehId = `veh_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 5)}`;

      const newVeh: Vehicle = {
        id: newVehId,
        chassis_number: normalizedChassis,
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
        status: payload.status || (initialSiteId ? 'en_stock' : 'en_transit'),
        current_site_id: initialSiteId,
        main_driver: payload.main_driver?.trim() || undefined,
        arrival_date: payload.arrival_date || now,
        service_start_date: payload.service_start_date || undefined,
        insurance_company: payload.insurance_company?.trim() || undefined,
        insurance_expiry: payload.insurance_expiry || undefined,
        inspection_expiry: payload.inspection_expiry || undefined,
        warranty_expiry: payload.warranty_expiry || undefined,
        notes: payload.notes?.trim() || undefined,
        photo_url: payload.photo_url?.trim() || undefined,
        custom_fields: payload.custom_fields && payload.custom_fields.length > 0 ? payload.custom_fields : undefined,
        created_at: now,
        updated_at: now,
      };

      if (initialSiteId) {
        db.movements.push({
          id: `mov_${Date.now()}_${index}`,
          vehicle_id: newVehId,
          chassis_number: normalizedChassis,
          movement_type: 'entry',
          movement_date: newVeh.arrival_date,
          departure_site_id: null,
          arrival_site_id: initialSiteId,
          destination_text: `Importation CSV Bulk - Site : ${site ? site.name : 'Inconnu'}`,
          notes: 'Entrée en stock via Importation Masse CSV',
          created_by_user_id: 'usr_admin',
          created_by_user_name: 'Administrateur Système',
          created_at: now,
        });
      }

      db.vehicles.push(newVeh);
      created.push(newVeh);
    } catch (err: any) {
      errors.push({ index, error: err.message || 'Erreur lors de la création' });
    }
  });

  saveDB(db);
  return res.status(200).json({ createdCount: created.length, errorCount: errors.length, created, errors });
});

// PUT /api/vehicles/:id
app.put('/api/vehicles/:id', (req: Request, res: Response) => {
  const vehicle = db.vehicles.find((v) => v.id === req.params.id);
  if (!vehicle) {
    return res.status(404).json({ error: 'Véhicule non trouvé.' });
  }

  const { chassis_number, brand, model, color, notes, status, current_site_id, arrival_date } = req.body;
  if (arrival_date !== undefined && arrival_date.trim() !== '') vehicle.arrival_date = arrival_date.trim();

  if (chassis_number !== undefined && chassis_number.trim() !== '') {
    const normChassis = chassis_number.trim().toUpperCase();
    const exists = db.vehicles.some((v) => v.id !== vehicle.id && v.chassis_number.toUpperCase() === normChassis);
    if (exists) {
      return res.status(400).json({ error: `Ce numéro de châssis (${normChassis}) est déjà utilisé par un autre véhicule.` });
    }
    vehicle.chassis_number = normChassis;
    // Update linked movements
    db.movements.forEach((m) => {
      if (m.vehicle_id === vehicle.id) {
        m.chassis_number = normChassis;
      }
    });
  }

  if (brand !== undefined && brand.trim() !== '') vehicle.brand = brand.trim();
  if (model !== undefined && model.trim() !== '') vehicle.model = model.trim();
  if (color !== undefined) vehicle.color = color.trim();
  if (notes !== undefined) vehicle.notes = notes.trim();
  if (status !== undefined) vehicle.status = status;

  if (current_site_id !== undefined && current_site_id !== vehicle.current_site_id) {
    const oldSiteObj = db.sites.find((s) => s.id === vehicle.current_site_id);
    const newSiteObj = db.sites.find((s) => s.id === current_site_id);
    const oldSiteName = oldSiteObj ? oldSiteObj.name : 'Ancien emplacement';
    const newSiteName = newSiteObj ? newSiteObj.name : 'Nouveau site';
    const departureSiteId = vehicle.current_site_id;

    vehicle.current_site_id = current_site_id || null;

    // Log movement for audit trail
    const now = new Date().toISOString();
    db.movements.push({
      id: `mvt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      vehicle_id: vehicle.id,
      chassis_number: vehicle.chassis_number,
      movement_type: 'transfer',
      movement_date: now,
      departure_site_id: departureSiteId,
      arrival_site_id: current_site_id || null,
      destination_text: `Modification directe du site : ${newSiteName}`,
      notes: `Transfert direct effectué via modification de la fiche (De ${oldSiteName} vers ${newSiteName})`,
      created_by_user_id: 'usr_admin',
      created_by_user_name: 'Administrateur',
      created_at: now,
    });
  }

  vehicle.updated_at = new Date().toISOString();

  saveDB(db);
  res.json(vehicle);
});

// GET /api/movements
app.get('/api/movements', (req: Request, res: Response) => {
  const { vehicle_id, site_id, movement_type, startDate, endDate, chassis } = req.query;
  let results = [...db.movements];

  const siteMap = new Map<string, string>();
  db.sites.forEach((s) => siteMap.set(s.id, s.name));

  const vehicleMap = new Map<string, Vehicle>();
  db.vehicles.forEach((v) => vehicleMap.set(v.id, v));

  if (vehicle_id && typeof vehicle_id === 'string') {
    results = results.filter((m) => m.vehicle_id === vehicle_id);
  }

  if (chassis && typeof chassis === 'string') {
    const ch = chassis.trim().toUpperCase();
    results = results.filter((m) => {
      const v = vehicleMap.get(m.vehicle_id);
      return (
        (m.chassis_number && m.chassis_number.toUpperCase().includes(ch)) ||
        (v && v.chassis_number.toUpperCase().includes(ch))
      );
    });
  }

  if (site_id && typeof site_id === 'string') {
    results = results.filter(
      (m) => m.departure_site_id === site_id || m.arrival_site_id === site_id
    );
  }

  if (movement_type && typeof movement_type === 'string') {
    results = results.filter((m) => m.movement_type === movement_type);
  }

  if (startDate && typeof startDate === 'string') {
    results = results.filter((m) => new Date(m.movement_date) >= new Date(startDate));
  }

  if (endDate && typeof endDate === 'string') {
    results = results.filter(
      (m) => new Date(m.movement_date) <= new Date(`${endDate}T23:59:59.999Z`)
    );
  }

  results.sort(
    (a, b) => new Date(b.movement_date).getTime() - new Date(a.movement_date).getTime()
  );

  const decorated = results.map((m) => {
    const v = vehicleMap.get(m.vehicle_id);
    const depName = m.departure_site_id ? siteMap.get(m.departure_site_id) : undefined;
    const arrName = m.arrival_site_id ? siteMap.get(m.arrival_site_id) : m.destination_text;
    let multiSummary: string | undefined = undefined;
    if (m.waypoints && m.waypoints.length > 0) {
      const waypointNames = m.waypoints.map((id) => siteMap.get(id) || id);
      multiSummary = [depName, ...waypointNames, arrName].filter(Boolean).join(' > ');
    }

    return {
      ...m,
      vehicle_chassis: m.chassis_number || v?.chassis_number,
      vehicle_brand: v?.brand,
      vehicle_model: v?.model,
      departure_site_name: depName,
      arrival_site_name: m.arrival_site_id ? siteMap.get(m.arrival_site_id) : undefined,
      multi_route_summary: multiSummary,
    };
  });

  res.json(decorated);
});

// POST /api/movements (Record a movement)
app.post('/api/movements', (req: Request, res: Response) => {
  const payload: CreateMovementPayload = req.body;

  if (!payload.vehicle_id) {
    return res.status(400).json({ error: 'Le véhicule est obligatoire.' });
  }

  const vehicle = db.vehicles.find((v) => v.id === payload.vehicle_id);
  if (!vehicle) {
    return res.status(404).json({ error: 'Véhicule introuvable.' });
  }

  const siteMap = new Map<string, string>();
  db.sites.forEach((s) => siteMap.set(s.id, s.name));

  const now = new Date().toISOString();
  const user = db.users.find((u) => u.id === payload.created_by_user_id) || {
    id: payload.created_by_user_id || 'usr_agent',
    full_name: 'Agent de Saisie',
  };

  // Check business rules
  if (payload.movement_type === 'transfer') {
    if (!payload.departure_site_id) {
      return res.status(400).json({ error: 'Le site de départ est obligatoire pour un transfert.' });
    }
    if (!payload.arrival_site_id) {
      return res.status(400).json({ error: 'Le site d arrivée est obligatoire pour un transfert.' });
    }
    if (payload.departure_site_id === payload.arrival_site_id) {
      return res
        .status(400)
        .json({ error: 'Le site de départ et le site d arrivée doivent être différents.' });
    }
    if (vehicle.status === 'livre') {
      return res
        .status(400)
        .json({ error: 'Impossible de transférer un véhicule qui a déjà été livré (sorti du stock).' });
    }
    // Check if vehicle is currently on the departure site
    if (vehicle.current_site_id !== payload.departure_site_id) {
      const currentSiteName = vehicle.current_site_id
        ? siteMap.get(vehicle.current_site_id) || 'Inconnu'
        : 'Aucun (Sorti)';
      return res.status(400).json({
        error: `Incohérence de mouvement : Le véhicule (châssis : ${vehicle.chassis_number}) ne se trouve pas sur le site de départ sélectionné. Son emplacement actuel est : "${currentSiteName}".`,
      });
    }

    // Update vehicle
    vehicle.current_site_id = payload.arrival_site_id;
    vehicle.status = 'en_stock';
    vehicle.updated_at = now;
  } else if (payload.movement_type === 'exit') {
    if (!payload.departure_site_id) {
      return res.status(400).json({ error: 'Le site de départ est obligatoire pour une sortie.' });
    }
    if (vehicle.status === 'livre') {
      return res.status(400).json({ error: 'Ce véhicule a déjà été sorti du stock.' });
    }
    if (vehicle.current_site_id !== payload.departure_site_id) {
      const currentSiteName = vehicle.current_site_id
        ? siteMap.get(vehicle.current_site_id) || 'Inconnu'
        : 'Aucun';
      return res.status(400).json({
        error: `Incohérence de mouvement : Le véhicule (châssis : ${vehicle.chassis_number}) ne se trouve pas sur le site de départ sélectionné. Son emplacement actuel est : "${currentSiteName}".`,
      });
    }

    // Update vehicle to delivered while preserving last site reference
    vehicle.current_site_id = payload.arrival_site_id || payload.departure_site_id || null;
    vehicle.status = 'livre';
    vehicle.updated_at = now;
  } else if (payload.movement_type === 'entry') {
    if (!payload.arrival_site_id) {
      return res.status(400).json({ error: 'Le site d arrivée est obligatoire pour une entrée.' });
    }
    vehicle.current_site_id = payload.arrival_site_id;
    vehicle.status = 'en_stock';
    vehicle.updated_at = now;
  }

  const newMovement: Movement = {
    id: `mov_${Date.now()}`,
    vehicle_id: vehicle.id,
    chassis_number: vehicle.chassis_number,
    movement_type: payload.movement_type,
    movement_date: payload.movement_date || now,
    departure_site_id: payload.departure_site_id || null,
    arrival_site_id: payload.arrival_site_id || null,
    destination_text: payload.destination_text || '',
    waypoints: payload.waypoints || [],
    notes: payload.notes || '',
    created_by_user_id: user.id,
    created_by_user_name: user.full_name,
    created_at: now,
  };

  db.movements.push(newMovement);
  saveDB(db);

  res.status(201).json({ vehicle, movement: newMovement });
});

// GET /api/sites
app.get('/api/sites', (req: Request, res: Response) => {
  res.json(db.sites);
});

// POST /api/sites
app.post('/api/sites', (req: Request, res: Response) => {
  const { name, type, address } = req.body;
  if (!name || !type) {
    return res.status(400).json({ error: 'Le nom et le type du site sont requis.' });
  }
  const newSite: Site = {
    id: `site_${Date.now()}`,
    name: name.trim(),
    type,
    address: address?.trim() || '',
    active: true,
  };
  db.sites.push(newSite);
  saveDB(db);
  res.status(201).json(newSite);
});

// PUT /api/sites/:id
app.put('/api/sites/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, type, address } = req.body;
  const site = db.sites.find((s) => s.id === id);
  if (!site) {
    return res.status(404).json({ error: 'Site non trouvé.' });
  }
  if (name) site.name = name.trim();
  if (type) site.type = type;
  if (address !== undefined) site.address = address.trim();
  saveDB(db);
  res.json(site);
});

// DELETE /api/sites/:id
app.delete('/api/sites/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const index = db.sites.findIndex((s) => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Site non trouvé.' });
  }
  db.sites.splice(index, 1);
  saveDB(db);
  res.json({ message: 'Site supprimé avec succès.' });
});

// GET /api/routes
app.get('/api/routes', (req: Request, res: Response) => {
  res.json(db.routes);
});

// POST /api/routes
app.post('/api/routes', (req: Request, res: Response) => {
  const { departure_site_id, arrival_site_id, waypoints, route_name } = req.body;
  if (!departure_site_id || !arrival_site_id) {
    return res.status(400).json({ error: 'Les sites de départ et d arrivée sont requis.' });
  }
  const dep = db.sites.find((s) => s.id === departure_site_id);
  const arr = db.sites.find((s) => s.id === arrival_site_id);

  let defaultName = `${dep?.name || 'Départ'} -> ${arr?.name || 'Arrivée'}`;
  if (waypoints && Array.isArray(waypoints) && waypoints.length > 0) {
    const siteMap = new Map<string, string>();
    db.sites.forEach((s) => siteMap.set(s.id, s.name));
    const waypointNames = waypoints.map((id: string) => siteMap.get(id) || id);
    defaultName = [dep?.name || 'Départ', ...waypointNames, arr?.name || 'Arrivée'].join(' > ');
  }

  const newRoute: Route = {
    id: `route_${Date.now()}`,
    departure_site_id,
    arrival_site_id,
    waypoints: Array.isArray(waypoints) ? waypoints : [],
    route_name: route_name || defaultName,
    active: true,
  };
  db.routes.push(newRoute);
  saveDB(db);
  res.status(201).json(newRoute);
});

// PUT /api/routes/:id
app.put('/api/routes/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { departure_site_id, arrival_site_id, waypoints, route_name } = req.body;
  const route = db.routes.find((r) => r.id === id);
  if (!route) {
    return res.status(404).json({ error: 'Trajet non trouvé.' });
  }
  if (departure_site_id) route.departure_site_id = departure_site_id;
  if (arrival_site_id) route.arrival_site_id = arrival_site_id;
  if (waypoints && Array.isArray(waypoints)) route.waypoints = waypoints;
  if (route_name) route.route_name = route_name.trim();
  saveDB(db);
  res.json(route);
});

// DELETE /api/routes/:id
app.delete('/api/routes/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const index = db.routes.findIndex((r) => r.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Trajet non trouvé.' });
  }
  db.routes.splice(index, 1);
  saveDB(db);
  res.json({ message: 'Trajet supprimé avec succès.' });
});

// Carrier Endpoints
app.get('/api/carriers', (req: Request, res: Response) => {
  res.json(db.carriers || INITIAL_CARRIERS);
});

app.post('/api/carriers', (req: Request, res: Response) => {
  const { raisonSociale, nomChauffeur, telephone, matriculeCamion } = req.body;
  if (!raisonSociale || !raisonSociale.trim()) {
    return res.status(400).json({ error: 'La raison sociale est obligatoire.' });
  }
  const newCarrier: Carrier = {
    id: `carr_${Date.now()}`,
    raisonSociale: raisonSociale.trim(),
    nomChauffeur: (nomChauffeur || '').trim(),
    telephone: (telephone || '').trim(),
    matriculeCamion: (matriculeCamion || '').trim(),
    actif: true,
  };
  if (!db.carriers) db.carriers = [];
  db.carriers.push(newCarrier);
  saveDB(db);
  res.status(201).json(newCarrier);
});

app.put('/api/carriers/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { raisonSociale, nomChauffeur, telephone, matriculeCamion, actif } = req.body;
  if (!db.carriers) db.carriers = [];
  const carrier = db.carriers.find((c) => c.id === id);
  if (!carrier) {
    return res.status(404).json({ error: 'Transporteur non trouvé.' });
  }
  if (raisonSociale !== undefined) carrier.raisonSociale = raisonSociale.trim();
  if (nomChauffeur !== undefined) carrier.nomChauffeur = nomChauffeur.trim();
  if (telephone !== undefined) carrier.telephone = telephone.trim();
  if (matriculeCamion !== undefined) carrier.matriculeCamion = matriculeCamion.trim();
  if (actif !== undefined) carrier.actif = actif;
  saveDB(db);
  res.json(carrier);
});

app.delete('/api/carriers/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  if (!db.carriers) db.carriers = [];
  const index = db.carriers.findIndex((c) => c.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Transporteur non trouvé.' });
  }
  db.carriers.splice(index, 1);
  saveDB(db);
  res.json({ message: 'Transporteur supprimé avec succès.' });
});

// Truck Load Endpoints
app.get('/api/truck-loads', (req: Request, res: Response) => {
  const loads = (db.truckLoads || []).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  res.json(loads);
});

app.get('/api/truck-loads/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const load = (db.truckLoads || []).find((l) => l.id === id);
  if (!load) {
    return res.status(404).json({ error: 'Chargement introuvable.' });
  }
  res.json(load);
});

app.post('/api/truck-loads', (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const capacity = payload.max_capacity && payload.max_capacity > 0 ? payload.max_capacity : 20;

    if (payload.departure_site_id === payload.arrival_site_id) {
      return res.status(400).json({ error: 'Le site de départ et le site d’arrivée doivent être deux sites physiques différents.' });
    }

    const depUpper = (payload.departure_site_name || '').toUpperCase();
    const arrUpper = (payload.arrival_site_name || '').toUpperCase();
    if (depUpper.includes('TRANSPORTEUR') || arrUpper.includes('TRANSPORTEUR')) {
      return res.status(400).json({ error: 'Le transporteur ne peut pas être sélectionné comme site de stockage.' });
    }

    if (payload.vehicles.length > capacity) {
      return res.status(400).json({ error: `Le nombre de véhicules (${payload.vehicles.length}) dépasse la capacité maximale du camion (${capacity}).` });
    }

    if (payload.vehicles.length === 0) {
      return res.status(400).json({ error: 'Veuillez ajouter au moins un véhicule dans le chargement.' });
    }

    const vinsInPayload = payload.vehicles.map((v: any) => v.vin.trim().toUpperCase());
    const uniqueVins = new Set(vinsInPayload);
    if (uniqueVins.size !== vinsInPayload.length) {
      return res.status(400).json({ error: 'Des numéros de châssis / VIN dupliqués sont présents dans la liste de chargement.' });
    }

    for (const vin of vinsInPayload) {
      if (vin.length !== 17) {
        return res.status(400).json({ error: `Le VIN "${vin}" est invalide. Il doit comporter exactement 17 caractères.` });
      }

      const existingInStock = db.vehicles.find((v) => v.chassis_number.toUpperCase() === vin);
      if (existingInStock) {
        if (existingInStock.status === 'livre') {
          return res.status(400).json({ error: `Le VIN "${vin}" correspond à un véhicule déjà livré.` });
        }
        if (existingInStock.status === 'en_transit' || existingInStock.status === 'a_ramasser') {
          return res.status(400).json({ error: `Le VIN "${vin}" est déjà affecté à un chargement actif ou en cours de transport.` });
        }
      }
    }

    const year = new Date().getFullYear();
    const currentYearLoads = (db.truckLoads || []).filter((l) => l.load_number.startsWith(`CHG-${year}`));
    const seqNum = currentYearLoads.length + 1;
    const loadNumber = `CHG-${year}-${String(seqNum).padStart(4, '0')}`;

    const now = new Date().toISOString();
    const loadId = `chg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const loadedVehicles: TruckLoadVehicle[] = [];

    payload.vehicles.forEach((vehPayload: any) => {
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

    res.status(201).json(newTruckLoad);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la création du chargement.' });
  }
});

app.post('/api/truck-loads/:id/start-transit', (req: Request, res: Response) => {
  const { id } = req.params;
  const { user_id, user_name } = req.body;
  const load = (db.truckLoads || []).find((l) => l.id === id);
  if (!load) {
    return res.status(404).json({ error: 'Chargement introuvable.' });
  }

  if (load.status === 'en_transit') {
    return res.status(400).json({ error: 'Ce chargement est déjà en transit.' });
  }
  if (load.status === 'receptionne' || load.status === 'annule') {
    return res.status(400).json({ error: 'Impossible de démarrer le transit pour un chargement clôturé ou annulé.' });
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
  res.json(load);
});

app.post('/api/truck-loads/:id/confirm-reception', (req: Request, res: Response) => {
  const { id } = req.params;
  const { confirmations, user_id, user_name } = req.body;
  const load = (db.truckLoads || []).find((l) => l.id === id);
  if (!load) {
    return res.status(404).json({ error: 'Chargement introuvable.' });
  }

  const now = new Date().toISOString();

  try {
    confirmations.forEach((conf: any) => {
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
    res.json(load);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erreur lors de la confirmation de réception.' });
  }
});

app.post('/api/truck-loads/:id/cancel', (req: Request, res: Response) => {
  const { id } = req.params;
  const { user_id, user_name, reason } = req.body;
  const load = (db.truckLoads || []).find((l) => l.id === id);
  if (!load) {
    return res.status(404).json({ error: 'Chargement introuvable.' });
  }

  if (load.status === 'receptionne') {
    return res.status(400).json({ error: 'Impossible d’annuler un chargement déjà totalement réceptionné.' });
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
  res.json(load);
});

// DELETE /api/vehicles/purge (Purge all vehicles and movements to launch new stock)
app.delete('/api/vehicles/purge', (req: Request, res: Response) => {
  const count = db.vehicles.length;
  db.vehicles = [];
  db.movements = [];
  saveDB(db);
  res.json({ message: `Le stock a été entièrement réinitialisé (${count} véhicules supprimés).`, count });
});

// DELETE /api/vehicles/:id
app.delete('/api/vehicles/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const index = db.vehicles.findIndex((v) => v.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Véhicule non trouvé.' });
  }
  db.vehicles.splice(index, 1);
  saveDB(db);
  res.json({ message: 'Véhicule supprimé avec succès.' });
});

// PUT /api/movements/:id
app.put('/api/movements/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    movement_type,
    departure_site_id,
    arrival_site_id,
    destination_text,
    movement_date,
    notes,
    waypoints,
  } = req.body;

  const movement = db.movements.find((m) => m.id === id);
  if (!movement) {
    return res.status(404).json({ error: 'Mouvement non trouvé.' });
  }

  if (movement_type) movement.movement_type = movement_type;
  if (departure_site_id !== undefined) movement.departure_site_id = departure_site_id;
  if (arrival_site_id !== undefined) movement.arrival_site_id = arrival_site_id;
  if (destination_text !== undefined) movement.destination_text = destination_text;
  if (movement_date) movement.movement_date = movement_date;
  if (notes !== undefined) movement.notes = notes;
  if (waypoints !== undefined && Array.isArray(waypoints)) movement.waypoints = waypoints;

  // Check if this is the latest movement for the vehicle to update vehicle location/status
  const vehicleMovements = db.movements
    .filter((m) => m.vehicle_id === movement.vehicle_id)
    .sort((a, b) => new Date(b.movement_date).getTime() - new Date(a.movement_date).getTime());

  if (vehicleMovements.length > 0 && vehicleMovements[0].id === movement.id) {
    const vehicle = db.vehicles.find((v) => v.id === movement.vehicle_id);
    if (vehicle) {
      if (movement.movement_type === 'transfer' && movement.arrival_site_id) {
        vehicle.current_site_id = movement.arrival_site_id;
        vehicle.status = 'en_stock';
      } else if (movement.movement_type === 'entry' && movement.arrival_site_id) {
        vehicle.current_site_id = movement.arrival_site_id;
        vehicle.status = 'en_stock';
      } else if (movement.movement_type === 'exit') {
        vehicle.current_site_id = null;
        vehicle.status = 'livre';
      }
      vehicle.updated_at = new Date().toISOString();
    }
  }

  saveDB(db);
  res.json(movement);
});

// DELETE /api/movements/:id
app.delete('/api/movements/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const index = db.movements.findIndex((m) => m.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Mouvement non trouvé.' });
  }
  db.movements.splice(index, 1);
  saveDB(db);
  res.json({ message: 'Mouvement supprimé avec succès.' });
});

// PUT /api/users/:id
app.put('/api/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { full_name, role, email } = req.body;
  const user = db.users.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé.' });
  }
  if (full_name) user.full_name = full_name.trim();
  if (role) user.role = role;
  if (email) user.email = email.trim().toLowerCase();
  saveDB(db);
  res.json(user);
});

// DELETE /api/users/:id
app.delete('/api/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const index = db.users.findIndex((u) => u.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Utilisateur non trouvé.' });
  }
  db.users.splice(index, 1);
  saveDB(db);
  res.json({ message: 'Utilisateur supprimé avec succès.' });
});

// GET /api/users
app.get('/api/users', (req: Request, res: Response) => {
  res.json(db.users);
});

// POST /api/users
app.post('/api/users', (req: Request, res: Response) => {
  const { full_name, role, email } = req.body;
  if (!full_name || !role || !email) {
    return res.status(400).json({ error: 'Tous les champs utilisateur sont requis.' });
  }
  const newUser: User = {
    id: `usr_${Date.now()}`,
    full_name: full_name.trim(),
    role,
    email: email.trim().toLowerCase(),
    active: true,
  };
  db.users.push(newUser);
  saveDB(db);
  res.status(201).json(newUser);
});

// POST /api/reset-data (Reset to initial seed)
app.post('/api/reset-data', (req: Request, res: Response) => {
  db = {
    vehicles: [...INITIAL_VEHICLES],
    sites: [...INITIAL_SITES],
    movements: [...INITIAL_MOVEMENTS],
    routes: [...INITIAL_ROUTES],
    users: [...INITIAL_USERS],
    carriers: [...INITIAL_CARRIERS],
    truckLoads: [...INITIAL_TRUCK_LOADS],
  };
  saveDB(db);
  res.json({ message: 'Données réinitialisées avec succès.' });
});

// POST /api/ai/assistant (Optional Gemini AI helper for VIN parsing / stock query)
app.post('/api/ai/assistant', async (req: Request, res: Response) => {
  const { prompt, textInput } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(400).json({
      error: 'La clé API Gemini (GEMINI_API_KEY) n est pas configurée dans l environnement.',
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    const model = 'gemini-3.6-flash';

    const systemContext = `Tu es l assistant IA expert en logistique automobile pour l application "Gestion Parc Véhicules". 
Tu aides les utilisateurs à analyser des textes de livraison, extraire des numéros de châssis (VIN 17 caractères), suggérer des transferts de véhicules entre sites ou résumer l état des stocks.
Réponds toujours en Français professionnel, concis et structuré.
Contexte actuel du parc : ${db.vehicles.length} véhicules enregistrés, dont ${db.vehicles.filter((v) => v.status === 'en_stock').length} en stock.`;

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemContext}\n\nDemande utilisateur:\n${prompt || textInput}` }],
        },
      ],
    });

    res.json({ text: response.text });
  } catch (err: any) {
    console.error('Gemini API Error:', err);
    res.status(500).json({ error: 'Erreur lors du traitement par l IA Gemini : ' + err.message });
  }
});

// POST /api/ai/scan-vin-ocr (Gemini Vision VIN OCR Reader)
app.post('/api/ai/scan-vin-ocr', async (req: Request, res: Response) => {
  const { image, mimeType } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!image) {
    return res.status(400).json({ error: 'Aucune image fournie.' });
  }

  if (!apiKey) {
    return res.status(400).json({
      error: "La clé API Gemini (GEMINI_API_KEY) n'est pas configurée dans l'environnement.",
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const cleanBase64 = image.includes('base64,') ? image.split('base64,')[1] : image;
    let effectiveMimeType = mimeType || 'image/jpeg';
    if (image.startsWith('data:image/png')) effectiveMimeType = 'image/png';
    else if (image.startsWith('data:image/webp')) effectiveMimeType = 'image/webp';

    const imagePart = {
      inlineData: {
        mimeType: effectiveMimeType,
        data: cleanBase64,
      },
    };

    const promptText = `Analyse cette image. Cherche exclusivement un numéro VIN / numéro de châssis automobile lisible. Un VIN valide comporte exactement 17 caractères alphanumériques et ne contient jamais les lettres I, O ou Q. Ne devine jamais de caractère masqué ou flou. Retourne uniquement le JSON demandé.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: {
        parts: [
          imagePart,
          { text: promptText },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            vin: {
              type: Type.STRING,
              description: 'Le numéro VIN de 17 caractères extrait de l image, ou chaîne vide si aucun VIN lisible',
            },
            confidence: {
              type: Type.NUMBER,
              description: 'Score de confiance de la détection entre 0.0 et 1.0',
            },
            message: {
              type: Type.STRING,
              description: 'Explication succinte sur la lisibilité ou le résultat de l extraction',
            },
          },
          required: ['vin', 'confidence', 'message'],
        },
      },
    });

    const rawText = response.text || '{}';
    let parsed: any = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { vin: '', confidence: 0, message: 'Format de réponse JSON invalide' };
    }

    res.json(parsed);
  } catch (err: any) {
    console.error('Gemini Vision OCR Error:', err);
    res.status(500).json({
      error: "Erreur lors de l'analyse d'image par l'IA Gemini : " + (err.message || 'Erreur serveur'),
    });
  }
});

// Vite Development Server Middleware / Static file serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Gestion Parc Véhicules] Server active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
