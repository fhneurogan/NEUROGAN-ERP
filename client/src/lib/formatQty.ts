/**
 * Format a quantity for display with a maximum of 5 significant digits.
 * Like Excel: the displayed value is shortened but the underlying data stays intact.
 *
 * Examples:
 *   formatQty(0.0000123456) → "0.00001"
 *   formatQty(12345.6789)   → "12346"
 *   formatQty(1234.56789)   → "1234.6"
 *   formatQty(0.05)         → "0.05"
 *   formatQty(100)          → "100"
 *   formatQty(0)            → "0"
 */
export function formatQty(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  if (num === 0) return "0";

  // Use toPrecision(5) for 5 significant digits, then strip trailing zeros
  const formatted = num.toPrecision(5);

  // parseFloat removes trailing zeros and unnecessary decimal points
  return String(parseFloat(formatted));
}
