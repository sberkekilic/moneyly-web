// ============================================
// FORMATTERS
// Replaces: intl package (NumberFormat, DateFormat)
// ============================================

// ── Currency formatting (tr_TR locale) ───────────────────────────

export const formatCurrency = (
  amount: number,
  currency = 'TRY',
  locale = 'tr-TR'
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatAmount = (amount: number, locale = 'tr-TR'): string =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

export const parseAmount = (str: string): number => {
  // Handle Turkish format: "1.234,56" → 1234.56
  const cleaned = str.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

// ── Date formatting ───────────────────────────────────────────────

export const formatDate = (
  date: Date | string,
  fmt = 'dd/MM/yyyy'
): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return fmt
    .replace('dd', day)
    .replace('MM', month)
    .replace('yyyy', String(year));
};

export const formatDateShort = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatDay = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return String(d.getDate());
};

export const formatMonthYear = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' });
};

export const parseDate = (dateStr: string, fmt = 'dd/MM/yyyy'): Date => {
  if (fmt === 'dd/MM/yyyy') {
    const [day, month, year] = dateStr.split('/').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(dateStr);
};