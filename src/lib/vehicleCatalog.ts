export interface BrandReference {
  brand: string;
  models: string[];
}

export const CATALOG_BRANDS_MODELS: Record<string, string[]> = {
  'Peugeot': ['108', '208', '2008', '308', '3008', '408', '5008', '508', 'Rifter', 'Partner', 'Expert', 'Boxer', 'e-208', 'e-2008'],
  'Citroën': ['C3', 'C3 Aircross', 'C4', 'C4 X', 'C5 Aircross', 'C5 X', 'Berlingo', 'Jumpy', 'Jumper', 'Ami'],
  'DS': ['DS 3', 'DS 4', 'DS 7', 'DS 9'],
  'Fiat': ['500', '500X', '500e', 'Panda', 'Tipo', 'Doblo', 'Scudo', 'Ducato', 'Fiorino'],
  'Opel': ['Corsa', 'Mokka', 'Astra', 'Crossland', 'Grandland', 'Combo', 'Vivaro', 'Movano'],
  'Renault': ['Clio', 'Captur', 'Megane', 'Austral', 'Scenic', 'Arkana', 'Espace', 'Kangoo', 'Trafic', 'Master', 'Zoe', 'Twingo'],
  'Dacia': ['Sandero', 'Duster', 'Jogger', 'Spring'],
  'Volkswagen': ['Golf', 'Polo', 'T-Roc', 'Tiguan', 'Taigo', 'T-Cross', 'ID.3', 'ID.4', 'Passat', 'Caddy', 'Transporter'],
  'Toyota': ['Yaris', 'Yaris Cross', 'Corolla', 'RAV4', 'C-HR', 'Hilux', 'Proace', 'Aygo X'],
  'Audi': ['A1', 'A3', 'A4', 'A6', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'e-tron'],
  'BMW': ['Série 1', 'Série 2', 'Série 3', 'Série 5', 'X1', 'X3', 'X5', 'i4', 'iX'],
  'Mercedes-Benz': ['Classe A', 'Classe B', 'Classe C', 'Classe E', 'GLA', 'GLB', 'GLC', 'Sprinter', 'Vito'],
  'Hyundai': ['i10', 'i20', 'i30', 'Kona', 'Tucson', 'Santa Fe', 'Ioniq 5'],
  'Kia': ['Picanto', 'Rio', 'Ceed', 'Stonic', 'Sportage', 'Niro', 'EV6'],
  'Jeep': ['Renegade', 'Compass', 'Avenger', 'Wrangler'],
  'Alfa Romeo': ['Tonale', 'Giulia', 'Stelvio', 'Junior'],
  'Ford': ['Fiesta', 'Focus', 'Puma', 'Kuga', 'Ranger', 'Transit'],
  'MG': ['MG4', 'ZS', 'HS', 'MG5'],
  'Cupra': ['Formentor', 'Born', 'Leon', 'Ateca'],
  'Skoda': ['Fabia', 'Kamiq', 'Karoq', 'Kodiaq', 'Octavia'],
  'Volvo': ['XC40', 'XC60', 'XC90', 'EX30'],
  'Nissan': ['Micra', 'Juke', 'Qashqai', 'X-Trail', 'Leaf', 'Townstar'],
};

export const STANDARD_COLORS = [
  'Blanc Banquise',
  'Blanc Gelato',
  'Blanc Nacré',
  'Blanc Glacier',
  'Noir Perla Nera',
  'Noir Cinema',
  'Noir Profond',
  'Gris Artense',
  'Gris Platinum',
  'Gris Colosseo',
  'Gris Mountain',
  'Gris Amazonite',
  'Rouge Elixir',
  'Rouge Passion',
  'Bleu Celebes',
  'Bleu Vertigo',
  'Bleu Night',
  'Jaune Faro',
  'Vert Olivine',
  'Orange Fusion',
  'Argent',
  'Marron',
  'Beige',
  'Brun',
  'Bronze',
  'Anthracite',
];

/**
 * Normalizes brand name (e.g. "PEUGEOT" -> "Peugeot", "citroen" -> "Citroën").
 */
export function normalizeBrand(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  for (const catalogBrand of Object.keys(CATALOG_BRANDS_MODELS)) {
    if (catalogBrand.toLowerCase() === lower) {
      return catalogBrand;
    }
  }

  return trimmed
    .split(/[\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Normalizes model name
 */
export function normalizeModel(input: string, brand?: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (!brand) return trimmed;

  const normalizedBrand = normalizeBrand(brand);
  const catalogModels = CATALOG_BRANDS_MODELS[normalizedBrand] || [];

  for (const m of catalogModels) {
    if (m.toLowerCase() === trimmed.toLowerCase()) {
      return m;
    }
  }

  return trimmed;
}

/**
 * Normalizes color name
 */
export function normalizeColor(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();

  for (const c of STANDARD_COLORS) {
    if (c.toLowerCase() === trimmed.toLowerCase()) {
      return c;
    }
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Get sorted list of all available brands (Catalog + Stock vehicles)
 */
export function editBrand(oldBrand: string, newBrandInput: string): { success: boolean; normalized: string; error?: string } {
  if (!newBrandInput || !newBrandInput.trim()) {
    return { success: false, normalized: '', error: 'Veuillez saisir un nom de marque.' };
  }

  const normNew = normalizeBrand(newBrandInput);

  // Find existing key case-insensitively
  const realKey = Object.keys(CATALOG_BRANDS_MODELS).find(
    (k) => k.toLowerCase() === oldBrand.toLowerCase() || k.toLowerCase() === normalizeBrand(oldBrand).toLowerCase()
  );

  let existingModels: string[] = [];
  if (realKey) {
    existingModels = CATALOG_BRANDS_MODELS[realKey] || [];
    if (realKey !== normNew) {
      delete CATALOG_BRANDS_MODELS[realKey];
    }
  }

  // Also check if normNew already exists and merge models if so
  const targetKey = Object.keys(CATALOG_BRANDS_MODELS).find((k) => k.toLowerCase() === normNew.toLowerCase()) || normNew;
  const currentTargetModels = CATALOG_BRANDS_MODELS[targetKey] || [];

  // Combine models
  const combinedModels = Array.from(new Set([...currentTargetModels, ...existingModels]));
  CATALOG_BRANDS_MODELS[targetKey] = combinedModels;

  return { success: true, normalized: targetKey };
}

export function deleteBrand(brand: string): { success: boolean; error?: string } {
  const normBrand = normalizeBrand(brand);
  const keysToDelete = Object.keys(CATALOG_BRANDS_MODELS).filter(
    (k) => k.toLowerCase() === brand.toLowerCase() || k.toLowerCase() === normBrand.toLowerCase()
  );

  keysToDelete.forEach((k) => {
    delete CATALOG_BRANDS_MODELS[k];
  });

  return { success: true };
}

export function editModel(brand: string, oldModel: string, newModelInput: string): { success: boolean; normalized: string; error?: string } {
  if (!newModelInput || !newModelInput.trim()) {
    return { success: false, normalized: '', error: 'Veuillez saisir un nom de modèle.' };
  }

  const normBrand = normalizeBrand(brand);
  const brandKey = Object.keys(CATALOG_BRANDS_MODELS).find((k) => k.toLowerCase() === normBrand.toLowerCase()) || normBrand;

  if (!CATALOG_BRANDS_MODELS[brandKey]) {
    CATALOG_BRANDS_MODELS[brandKey] = [];
  }

  const models = CATALOG_BRANDS_MODELS[brandKey];
  const normNewModel = normalizeModel(newModelInput, brandKey);

  // Remove oldModel case-insensitively if present
  const idx = models.findIndex((m) => m.toLowerCase() === oldModel.toLowerCase());
  if (idx !== -1) {
    models.splice(idx, 1);
  }

  // Add normNewModel if not already present
  if (!models.some((m) => m.toLowerCase() === normNewModel.toLowerCase())) {
    models.push(normNewModel);
  }

  return { success: true, normalized: normNewModel };
}

export function deleteModel(brand: string, model: string): { success: boolean; error?: string } {
  const normBrand = normalizeBrand(brand);
  const brandKey = Object.keys(CATALOG_BRANDS_MODELS).find((k) => k.toLowerCase() === normBrand.toLowerCase());

  if (brandKey && CATALOG_BRANDS_MODELS[brandKey]) {
    const models = CATALOG_BRANDS_MODELS[brandKey];
    const filtered = models.filter((m) => m.toLowerCase() !== model.toLowerCase());
    CATALOG_BRANDS_MODELS[brandKey] = filtered;
  }

  return { success: true };
}

export function editColor(oldColor: string, newColorInput: string): { success: boolean; normalized: string; error?: string } {
  if (!newColorInput || !newColorInput.trim()) {
    return { success: false, normalized: '', error: 'Veuillez saisir une couleur.' };
  }

  const normNew = normalizeColor(newColorInput);

  const idx = STANDARD_COLORS.findIndex((c) => c.toLowerCase() === oldColor.toLowerCase());
  if (idx !== -1) {
    STANDARD_COLORS[idx] = normNew;
  } else if (!STANDARD_COLORS.some((c) => c.toLowerCase() === normNew.toLowerCase())) {
    STANDARD_COLORS.push(normNew);
  }

  return { success: true, normalized: normNew };
}

export function deleteColor(color: string): { success: boolean; error?: string } {
  const idx = STANDARD_COLORS.findIndex((c) => c.toLowerCase() === color.toLowerCase());
  if (idx !== -1) {
    STANDARD_COLORS.splice(idx, 1);
  }
  return { success: true };
}

export function addCustomBrand(brandInput: string): { success: boolean; normalized: string; error?: string } {
  if (!brandInput || !brandInput.trim()) {
    return { success: false, normalized: '', error: 'Veuillez saisir un nom de marque.' };
  }

  const normalized = normalizeBrand(brandInput);
  const lowerNorm = normalized.toLowerCase();

  // Check existing brands
  const existingBrands = Object.keys(CATALOG_BRANDS_MODELS);
  const matchedExisting = existingBrands.find((b) => b.toLowerCase() === lowerNorm);

  if (matchedExisting) {
    return {
      success: false,
      normalized: matchedExisting,
      error: `La marque "${matchedExisting}" existe déjà dans le référentiel.`,
    };
  }

  // Add new brand
  CATALOG_BRANDS_MODELS[normalized] = [];
  return { success: true, normalized };
}

export function addCustomModel(brandInput: string, modelInput: string): { success: boolean; normalized: string; error?: string } {
  if (!brandInput || !brandInput.trim()) {
    return { success: false, normalized: '', error: 'Une marque doit être sélectionnée avant d\'ajouter un modèle.' };
  }
  if (!modelInput || !modelInput.trim()) {
    return { success: false, normalized: '', error: 'Veuillez saisir un nom de modèle.' };
  }

  const normalizedBrand = normalizeBrand(brandInput);
  if (!CATALOG_BRANDS_MODELS[normalizedBrand]) {
    CATALOG_BRANDS_MODELS[normalizedBrand] = [];
  }

  const normalizedModel = normalizeModel(modelInput, normalizedBrand);
  const lowerModel = normalizedModel.toLowerCase();

  const existingModels = CATALOG_BRANDS_MODELS[normalizedBrand];
  const matchedModel = existingModels.find((m) => m.toLowerCase() === lowerModel);

  if (matchedModel) {
    return {
      success: false,
      normalized: matchedModel,
      error: `Le modèle "${matchedModel}" existe déjà pour la marque "${normalizedBrand}".`,
    };
  }

  existingModels.push(normalizedModel);
  return { success: true, normalized: normalizedModel };
}

export function addCustomColor(colorInput: string): { success: boolean; normalized: string; error?: string } {
  if (!colorInput || !colorInput.trim()) {
    return { success: false, normalized: '', error: 'Veuillez saisir un nom de couleur.' };
  }

  const normalized = normalizeColor(colorInput);
  const lowerNorm = normalized.toLowerCase();

  const matchedColor = STANDARD_COLORS.find((c) => c.toLowerCase() === lowerNorm);

  if (matchedColor) {
    return {
      success: false,
      normalized: matchedColor,
      error: `La couleur "${matchedColor}" existe déjà dans le référentiel.`,
    };
  }

  STANDARD_COLORS.push(normalized);
  return { success: true, normalized };
}

export function getAvailableBrands(vehiclesInStock: { brand: string }[]): { value: string; label: string }[] {
  const brandSet = new Map<string, string>();

  Object.keys(CATALOG_BRANDS_MODELS).forEach((b) => {
    brandSet.set(b.toLowerCase(), b);
  });

  vehiclesInStock.forEach((v) => {
    if (v.brand) {
      const norm = normalizeBrand(v.brand);
      if (norm) {
        brandSet.set(norm.toLowerCase(), norm);
      }
    }
  });

  const sorted = Array.from(brandSet.values()).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

  return sorted.map((b) => ({ value: b, label: b }));
}

/**
 * Get sorted list of models for a specific brand (Catalog + Stock vehicles)
 */
export function getAvailableModels(selectedBrand: string, vehiclesInStock: { brand: string; model: string }[]): { value: string; label: string }[] {
  if (!selectedBrand) return [];

  const normBrand = normalizeBrand(selectedBrand);
  const modelSet = new Map<string, string>();

  const catalogModels = CATALOG_BRANDS_MODELS[normBrand] || [];
  catalogModels.forEach((m) => {
    modelSet.set(m.toLowerCase(), m);
  });

  vehiclesInStock.forEach((v) => {
    if (v.brand && normalizeBrand(v.brand).toLowerCase() === normBrand.toLowerCase() && v.model) {
      const normM = normalizeModel(v.model, normBrand);
      modelSet.set(normM.toLowerCase(), normM);
    }
  });

  const sorted = Array.from(modelSet.values()).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

  return sorted.map((m) => ({ value: m, label: m }));
}

/**
 * Get sorted list of colors (Catalog + Stock vehicles)
 */
export function getAvailableColors(vehiclesInStock: { color?: string }[]): { value: string; label: string }[] {
  const colorSet = new Map<string, string>();

  STANDARD_COLORS.forEach((c) => {
    colorSet.set(c.toLowerCase(), c);
  });

  vehiclesInStock.forEach((v) => {
    if (v.color) {
      const normC = normalizeColor(v.color);
      if (normC) {
        colorSet.set(normC.toLowerCase(), normC);
      }
    }
  });

  const sorted = Array.from(colorSet.values()).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

  return sorted.map((c) => ({ value: c, label: c }));
}
