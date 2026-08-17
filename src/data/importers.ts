export interface ImporterInfo {
  id: string;
  name: string;
  code: string;
  mf: string; // Matricule Fiscal
  address: string;
  brands: string[]; // e.g. ['Peugeot', 'Citroën', 'Opel', 'DS']
}

export const OFFICIAL_IMPORTERS: ImporterInfo[] = [
  {
    id: 'stafim',
    name: 'STAFIM SA',
    code: 'STAFIM',
    mf: '0012845/A/P/M/000',
    address: 'Route de Sousse Km 6, Mégrine / Charguia, Tunis',
    brands: ['Peugeot', 'Citroën', 'Opel', 'DS', 'DS Automobiles'],
  },
  {
    id: 'ennakl',
    name: 'ENNAKL Automobiles SA',
    code: 'ENNAKL',
    mf: '0048392/B/P/M/000',
    address: 'Zone Pétrolière Radès / Route de la Marsa, La Soukra, Tunis',
    brands: ['Volkswagen', 'Audi', 'SEAT', 'Škoda', 'Skoda', 'Porsche'],
  },
  {
    id: 'artes',
    name: 'ARTES - Groupe Moncef Mzabi',
    code: 'ARTES',
    mf: '0019283/C/P/M/000',
    address: '39 Avenue Khereddine Pacha, Tunis',
    brands: ['Renault', 'Dacia', 'Nissan'],
  },
  {
    id: 'citycars',
    name: 'City Cars - Concessionnaire Officiel KIA',
    code: 'CITY CARS',
    mf: '0072819/D/P/M/000',
    address: 'Z.I. Le Kram, Route de la Marsa, Tunis',
    brands: ['Kia', 'KIA'],
  },
  {
    id: 'hyundai',
    name: 'Alpha Hyundai Motor Tunisie',
    code: 'HYUNDAI',
    mf: '0098231/E/P/M/000',
    address: 'Ain Zaghouan, Route de la Marsa, Tunis',
    brands: ['Hyundai'],
  },
  {
    id: 'toyota',
    name: 'BSB Toyota Tunisie',
    code: 'BSB TOYOTA',
    mf: '0034821/F/P/M/000',
    address: 'Z.I. La Charguia II, Tunis',
    brands: ['Toyota'],
  },
  {
    id: 'bmw',
    name: 'Ben Jemâa Motors',
    code: 'BJM',
    mf: '0056123/G/P/M/000',
    address: 'Z.I. La Soukra, Route de Chotrana, Tunis',
    brands: ['BMW', 'MINI', 'Mini'],
  },
  {
    id: 'lemoteur',
    name: 'Le Moteur SA',
    code: 'LE MOTEUR',
    mf: '0023910/H/P/M/000',
    address: 'Z.I. La Charguia I, Tunis',
    brands: ['Mercedes-Benz', 'Mercedes'],
  },
  {
    id: 'italcar',
    name: 'Italcar Tunisie',
    code: 'ITALCAR',
    mf: '0081726/I/P/M/000',
    address: 'Z.I. Mégrine / Les Berges du Lac, Tunis',
    brands: ['Fiat', 'Alfa Romeo', 'Lancia', 'Jeep', 'Changan'],
  },
  {
    id: 'ford',
    name: 'Alpha Ford Tunisie',
    code: 'FORD',
    mf: '0062910/J/P/M/000',
    address: 'Ain Zaghouan, Route de la Marsa, Tunis',
    brands: ['Ford'],
  },
  {
    id: 'honda',
    name: 'JMC Japan Motors (Honda)',
    code: 'JMC HONDA',
    mf: '0049182/K/P/M/000',
    address: 'Route de la Marsa GP9, Tunis',
    brands: ['Honda'],
  },
  {
    id: 'greatwall',
    name: 'Atlas Auto (Haval & Great Wall)',
    code: 'ATLAS AUTO',
    mf: '0038291/L/P/M/000',
    address: 'Z.I. Ben Arous, Tunis',
    brands: ['Haval', 'HAVAL', 'Great Wall', 'GWM'],
  },
  {
    id: 'mazda',
    name: 'Economic Auto (Mazda)',
    code: 'ECONOMIC AUTO',
    mf: '0018273/M/P/M/000',
    address: 'Route de Sousse Km 7, Ben Arous, Tunis',
    brands: ['Mazda'],
  },
  {
    id: 'sta_chery',
    name: 'STA Chery Tunisie',
    code: 'STA CHERY',
    mf: '0091827/N/P/M/000',
    address: 'Z.I. Borj Cédria, Ben Arous, Tunis',
    brands: ['Chery'],
  },
  {
    id: 'suzuki',
    name: 'CARPRO Suzuki Tunisie',
    code: 'CARPRO',
    mf: '0071625/O/P/M/000',
    address: 'Z.I. Charguia II, Tunis',
    brands: ['Suzuki'],
  },
  {
    id: 'geely',
    name: 'SAMI Geely Tunisie',
    code: 'SAMI GEELY',
    mf: '0051829/P/P/M/000',
    address: 'Z.I. La Charguia I, Tunis',
    brands: ['Geely'],
  },
  {
    id: 'mg',
    name: 'MG Motor Tunisie (ONAUTO)',
    code: 'MG MOTOR',
    mf: '0039281/Q/P/M/000',
    address: 'Les Berges du Lac 2, Tunis',
    brands: ['MG', 'MG Motor', 'Morris Garages'],
  },
  {
    id: 'byd',
    name: 'BYD Tunisia (Helios Cars)',
    code: 'BYD',
    mf: '0082910/R/P/M/000',
    address: 'Les Berges du Lac 1, Tunis',
    brands: ['BYD'],
  },
];

export function getImporterForBrand(brandName?: string): ImporterInfo | undefined {
  if (!brandName) return undefined;
  
  const normalize = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const b = normalize(brandName);
  if (!b) return undefined;

  // 1. Direct match on brands list
  const direct = OFFICIAL_IMPORTERS.find((imp) =>
    imp.brands.some((brand) => normalize(brand) === b)
  );
  if (direct) return direct;

  // 2. Fallback match by importer code, id, or substring
  return OFFICIAL_IMPORTERS.find((imp) =>
    normalize(imp.id) === b ||
    normalize(imp.code) === b ||
    normalize(imp.name).includes(b) ||
    imp.brands.some((brand) => normalize(brand).includes(b) || b.includes(normalize(brand)))
  );
}
