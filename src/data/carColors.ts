const STORAGE_KEY = 'parc_auto_vehicle_colors';

export const DEFAULT_COLORS: string[] = [
  'Blanc',
  'Vert',
  'Noir',
  'Gris',
  'Rouge',
  'Bleu',
  'Gris Aluminium',
  'Blanc Banquise',
  'Noir Perla Nera',
];

export function normalizeColorName(color: string): string {
  const trimmed = color.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function getStoredColors(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure default colors are included if missing
        const combined = [...parsed];
        for (const def of DEFAULT_COLORS) {
          if (!combined.some((c) => c.toLowerCase() === def.toLowerCase())) {
            combined.push(def);
          }
        }
        return combined;
      }
    }
  } catch (err) {
    console.error('Error reading colors from localStorage:', err);
  }
  return [...DEFAULT_COLORS];
}

export function saveStoredColor(color: string): { updatedList: string[]; normalized: string } {
  const normalized = normalizeColorName(color);
  if (!normalized) {
    return { updatedList: getStoredColors(), normalized: '' };
  }

  const currentList = getStoredColors();
  const exists = currentList.some((c) => c.toLowerCase() === normalized.toLowerCase());

  if (!exists) {
    const newList = [...currentList, normalized];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
    } catch (err) {
      console.error('Error saving color to localStorage:', err);
    }
    return { updatedList: newList, normalized };
  }

  // Find exact case version from list if already exists
  const existingExact = currentList.find((c) => c.toLowerCase() === normalized.toLowerCase()) || normalized;
  return { updatedList: currentList, normalized: existingExact };
}
