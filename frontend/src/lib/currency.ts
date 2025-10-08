export function formatCurrency(
  value: number | string | null | undefined,
  currency: string | undefined | null = 'USD',
  fractionDigits = 2
): string {
  if (value == null) return '—';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return '—';

  const symbol = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : '';
  return `${symbol}${numeric.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

export function formatCurrencyWhole(
  value: number | string | null | undefined,
  currency: string | undefined | null = 'USD'
): string {
  if (value == null) return '—';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return '—';
  const rounded = Math.round(numeric);
  return formatCurrency(rounded, currency, 0);
}
