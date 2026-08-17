import { OFFICIAL_IMPORTERS, getImporterForBrand, ImporterInfo } from './importers';
import { CATALOG_BRANDS_MODELS, normalizeBrand } from '../lib/vehicleCatalog';

export interface CarBrandData {
  brand: string;
  models: string[];
}

export const CAR_CATALOG: CarBrandData[] = [
  {
    brand: 'Peugeot',
    models: ['108', '208', '2008', '301', '308', '3008', '408', '508', '5008', 'Rifter', 'Partner', 'Expert', 'Boxer', 'Landtrek'],
  },
  {
    brand: 'Citroën',
    models: ['C1', 'C3', 'C3 Aircross', 'C4', 'C4 X', 'C5 Aircross', 'C-Élysée', 'Berlingo', 'Jumpy', 'Jumper'],
  },
  {
    brand: 'Opel',
    models: ['Corsa', 'Crossland', 'Mokka', 'Astra', 'Grandland', 'Combo Cargo', 'Vivaro', 'Movano'],
  },
  {
    brand: 'DS Automobiles',
    models: ['DS 3', 'DS 4', 'DS 7', 'DS 9'],
  },
  {
    brand: 'Renault',
    models: ['Clio', 'Captur', 'Megane', 'Express Van', 'Kangoo', 'Master', 'Trafic', 'Austral', 'Arkana'],
  },
  {
    brand: 'Dacia',
    models: ['Sandero', 'Sandero Stepway', 'Logan', 'Duster', 'Jogger', 'Spring'],
  },
  {
    brand: 'Nissan',
    models: ['Micra', 'Juke', 'Qashqai', 'X-Trail', 'Navara', 'Townstar'],
  },
  {
    brand: 'Volkswagen',
    models: ['Polo', 'Golf', 'T-Roc', 'Tiguan', 'Passat', 'Touareg', 'Caddy', 'Crafter', 'Amarok', 'ID.4'],
  },
  {
    brand: 'Audi',
    models: ['A1', 'A3', 'A4', 'A6', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'e-tron'],
  },
  {
    brand: 'SEAT',
    models: ['Ibiza', 'Arona', 'Leon', 'Ateca', 'Tarraco'],
  },
  {
    brand: 'Škoda',
    models: ['Fabia', 'Kamiq', 'Scala', 'Octavia', 'Karoq', 'Kodiaq', 'Superb'],
  },
  {
    brand: 'Porsche',
    models: ['Macan', 'Cayenne', 'Panamera', '911', 'Taycan'],
  },
  {
    brand: 'Fiat',
    models: ['500', '500X', 'Panda', 'Tipo', 'Fiorino', 'Doblò', 'Ducato', 'Titano'],
  },
  {
    brand: 'Alfa Romeo',
    models: ['Giulia', 'Stelvio', 'Tonale'],
  },
  {
    brand: 'Jeep',
    models: ['Renegade', 'Compass', 'Wrangler', 'Grand Cherokee', 'Avenger'],
  },
  {
    brand: 'Toyota',
    models: ['Yaris', 'Yaris Cross', 'Corolla', 'C-HR', 'RAV4', 'Hilux', 'Land Cruiser', 'Proace'],
  },
  {
    brand: 'Hyundai',
    models: ['i10', 'i20', 'i30', 'Bayon', 'Kona', 'Tucson', 'Santa Fe', 'Staria', 'H100'],
  },
  {
    brand: 'Kia',
    models: ['Picanto', 'Rio', 'Stonic', 'Ceed', 'Sportage', 'Sorento', 'K2500'],
  },
  {
    brand: 'BMW',
    models: ['Série 1', 'Série 2', 'Série 3', 'Série 4', 'Série 5', 'X1', 'X3', 'X5', 'X6', 'i4'],
  },
  {
    brand: 'MINI',
    models: ['Cooper', 'Countryman', 'Clubman'],
  },
  {
    brand: 'Mercedes-Benz',
    models: ['Classe A', 'Classe C', 'Classe E', 'GLA', 'GLC', 'GLE', 'Sprinter', 'Vito'],
  },
  {
    brand: 'Ford',
    models: ['Fiesta', 'Focus', 'Puma', 'Kuga', 'Ranger', 'Transit'],
  },
  {
    brand: 'Honda',
    models: ['Civic', 'HR-V', 'CR-V', 'Jazz'],
  },
  {
    brand: 'Haval',
    models: ['Jolion', 'H6', 'Dargo', 'H9'],
  },
  {
    brand: 'Great Wall',
    models: ['Wingle 5', 'Wingle 7', 'Poer'],
  },
  {
    brand: 'Mazda',
    models: ['Mazda2', 'Mazda3', 'CX-30', 'CX-5', 'CX-60'],
  },
  {
    brand: 'Chery',
    models: ['Tiggo 2 Pro', 'Tiggo 4 Pro', 'Tiggo 7 Pro', 'Tiggo 8 Pro', 'Arrizo 5'],
  },
  {
    brand: 'Suzuki',
    models: ['Swift', 'Dzire', 'Baleno', 'Jimny', 'Vitara', 'S-Cross', 'Ertiga'],
  },
  {
    brand: 'Geely',
    models: ['GX3 Pro', 'Coolray', 'Azkarra', 'Emgrand', 'Geometry C'],
  },
  {
    brand: 'MG Motor',
    models: ['MG3', 'MG ZS', 'MG HS', 'MG GT', 'MG4 EV'],
  },
  {
    brand: 'BYD',
    models: ['Atto 3', 'Dolphin', 'Seal', 'Tang', 'Han'],
  },
  {
    brand: 'Changan',
    models: ['Alsvin', 'CS35 Plus', 'CS55 Plus', 'CS75 Plus', 'UNI-T', 'Hunter'],
  },
];

export const ALL_CATALOG_BRANDS_STATIC = CAR_CATALOG.map((item) => item.brand).sort();

const CUSTOM_MODELS_KEY = 'parc_auto_custom_vehicle_models';
const CUSTOM_BRANDS_KEY = 'parc_auto_custom_vehicle_brands';

export function getStoredCustomModels(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(CUSTOM_MODELS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading custom models from localStorage:', err);
  }
  return {};
}

export function getStoredCustomBrands(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_BRANDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading custom brands from localStorage:', err);
  }
  return [];
}

export function getAllCatalogBrands(): string[] {
  const staticBrands = CAR_CATALOG.map((item) => item.brand);
  const customBrands = getStoredCustomBrands();
  const customModelObj = getStoredCustomModels();
  const keysFromModels = Object.keys(customModelObj);
  const catalogKeys = Object.keys(CATALOG_BRANDS_MODELS);

  const brandSet = new Map<string, string>();

  for (const b of staticBrands) {
    brandSet.set(b.toLowerCase(), b);
  }
  for (const b of catalogKeys) {
    brandSet.set(b.toLowerCase(), b);
  }
  for (const b of customBrands) {
    if (b.trim() && !brandSet.has(b.trim().toLowerCase())) {
      const capitalized = b.trim().charAt(0).toUpperCase() + b.trim().slice(1);
      brandSet.set(b.trim().toLowerCase(), capitalized);
    }
  }
  for (const k of keysFromModels) {
    if (k.trim() && !brandSet.has(k.trim().toLowerCase())) {
      const capitalized = k.trim().charAt(0).toUpperCase() + k.trim().slice(1);
      brandSet.set(k.trim().toLowerCase(), capitalized);
    }
  }

  return Array.from(brandSet.values()).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
}

export const ALL_CATALOG_BRANDS = getAllCatalogBrands();

export function getModelsForBrand(brandName: string): string[] {
  if (!brandName || brandName === 'Autre') return ['Autre'];
  const normBrand = normalizeBrand(brandName);

  const staticEntry = CAR_CATALOG.find(
    (item) => item.brand.toLowerCase() === normBrand.toLowerCase()
  );
  const staticModels = staticEntry ? staticEntry.models : [];

  const catalogBrandKey = Object.keys(CATALOG_BRANDS_MODELS).find((k) => k.toLowerCase() === normBrand.toLowerCase());
  const catalogModels = catalogBrandKey ? CATALOG_BRANDS_MODELS[catalogBrandKey] : [];

  const customObj = getStoredCustomModels();
  const customModels = customObj[normBrand.toLowerCase()] || [];

  const combinedMap = new Map<string, string>();
  for (const m of staticModels) {
    if (m && m.toLowerCase() !== 'autre') {
      combinedMap.set(m.toLowerCase(), m);
    }
  }
  for (const m of catalogModels) {
    if (m && m.toLowerCase() !== 'autre') {
      combinedMap.set(m.toLowerCase(), m);
    }
  }
  for (const m of customModels) {
    if (m && m.toLowerCase() !== 'autre') {
      combinedMap.set(m.toLowerCase(), m);
    }
  }

  const result = Array.from(combinedMap.values());
  result.push('Autre');
  return result;
}

export function saveStoredModel(
  brandName: string,
  modelName: string
): { brand: string; model: string; updatedModels: string[] } {
  const normBrand = brandName ? brandName.trim() : '';
  const normModel = modelName ? modelName.trim() : '';

  if (
    !normBrand ||
    !normModel ||
    normModel.toLowerCase() === 'autre' ||
    normBrand.toLowerCase() === 'autre'
  ) {
    return { brand: normBrand, model: normModel, updatedModels: getModelsForBrand(normBrand) };
  }

  const brandKey = normBrand.toLowerCase();

  // Save model
  const customObj = getStoredCustomModels();
  const existingList = customObj[brandKey] || [];
  const exists = existingList.some((m) => m.toLowerCase() === normModel.toLowerCase());

  if (!exists) {
    const formattedModel = normModel.charAt(0).toUpperCase() + normModel.slice(1);
    customObj[brandKey] = [...existingList, formattedModel];

    try {
      localStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(customObj));
    } catch (err) {
      console.error('Error saving custom model to localStorage:', err);
    }
  }

  // Save brand if not in static catalog
  const staticExists = CAR_CATALOG.some((c) => c.brand.toLowerCase() === brandKey);
  if (!staticExists) {
    const customBrands = getStoredCustomBrands();
    if (!customBrands.some((b) => b.toLowerCase() === brandKey)) {
      const formattedBrand = normBrand.charAt(0).toUpperCase() + normBrand.slice(1);
      const updatedBrands = [...customBrands, formattedBrand];
      try {
        localStorage.setItem(CUSTOM_BRANDS_KEY, JSON.stringify(updatedBrands));
      } catch (err) {
        console.error('Error saving custom brand to localStorage:', err);
      }
    }
  }

  return { brand: normBrand, model: normModel, updatedModels: getModelsForBrand(normBrand) };
}

export function getProbableImporterForBrand(brandName: string): ImporterInfo | undefined {
  return getImporterForBrand(brandName);
}
