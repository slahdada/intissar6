/**
 * Centralized Date Formatting Utility for "Gestion Parc Véhicules"
 * Formats dates uniformly in 'fr-TN' locale and 'Africa/Tunis' timeZone as 'JJ/MM/AAAA HH:mm' (or 'JJ/MM/AAAA').
 */

export function formatDateTime(
  dateInput?: Date | string | number | null,
  options?: {
    includeTime?: boolean;
    fallback?: string;
  }
): string {
  const fallback = options?.fallback ?? '-';
  if (!dateInput) return fallback;

  try {
    let d: Date;
    if (dateInput instanceof Date) {
      d = dateInput;
    } else if (typeof dateInput === 'number') {
      d = new Date(dateInput);
    } else if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim();
      if (!trimmed) return fallback;

      // Handle pure "YYYY-MM-DD" date strings safely without timezone shift
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [y, m, day] = trimmed.split('-').map(Number);
        d = new Date(y, m - 1, day, 12, 0, 0);
        // If includeTime was not explicitly requested, format as DD/MM/YYYY for pure date strings
        if (options?.includeTime === false) {
          const formatter = new Intl.DateTimeFormat('fr-TN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            timeZone: 'Africa/Tunis',
          });
          return formatter.format(d);
        }
      } else {
        d = new Date(trimmed);
      }
    } else {
      return fallback;
    }

    if (isNaN(d.getTime())) {
      return fallback;
    }

    const showTime = options?.includeTime ?? true;

    if (showTime) {
      const formatter = new Intl.DateTimeFormat('fr-TN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Africa/Tunis',
      });
      return formatter.format(d).replace(',', '').replace(/\s+/g, ' ');
    } else {
      const formatter = new Intl.DateTimeFormat('fr-TN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Africa/Tunis',
      });
      return formatter.format(d);
    }
  } catch (err) {
    console.error('Error in formatDateTime:', err);
    return fallback;
  }
}

/**
 * Helper to get the current date-time string in ISO or local format if needed.
 */
export function getCurrentDateTimeFormatted(): string {
  return formatDateTime(new Date());
}
