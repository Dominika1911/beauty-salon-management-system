export const formatDatePL = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

/**
 * value: string w formacie "0.00" (kontrakt API)
 */
export const formatCurrencyPLN = (value: string): string => {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(n);
};

export const formatPercent = (value: number | null | undefined): string => {
  if (value == null) return '—';
  if (!Number.isFinite(value)) return '—';
  return `${value}%`;
};

/**
 * Formatowanie numeru telefonu do postaci czytelnej w PL.
 * Przykłady:
 * - +48601111002 -> +48 601 111 002
 * - 601111002 -> 601 111 002
 * Jeśli format jest nietypowy, zwracamy oryginał.
 */
export const formatPhonePL = (phone: string | null | undefined): string => {
  const raw = (phone ?? '').trim();
  if (!raw) return '—';

  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');

  const group9 = (nine: string) => `${nine.slice(0, 3)} ${nine.slice(3, 6)} ${nine.slice(6, 9)}`;

  if (hasPlus && digits.length >= 10) {
    const cc = digits.slice(0, digits.length - 9);
    const rest = digits.slice(-9);
    return `+${cc} ${group9(rest)}`;
  }

  if (!hasPlus && digits.length === 9) {
    return group9(digits);
  }

  return raw;
};
