/**
 * ProofLedger AI — Decimal-Safe Monetary Mathematics Engine
 * 
 * Strict rule: Binary floating point arithmetic (0.1 + 0.2 = 0.30000000000000004)
 * is NEVER used for financial balances or reconciliation. All amounts are stored
 * and calculated in integer minor units (paise for INR, cents for USD).
 */

export interface MoneyValue {
  paise: number; // Integer minor units (1 INR = 100 paise)
  currency: string;
}

/**
 * Normalizes any currency string into signed integer paise.
 * Handles commas, currency symbols (₹, $, €, £), whitespace, and explicit Dr/Cr indicators.
 * 
 * Examples:
 *   "₹12,450.50" -> 1245050
 *   "-₹1,200.00" -> -120000
 *   "450.75 Dr"  -> -45075
 *   "1500 Cr"    -> 150000
 *   "(250.00)"   -> -25000
 */
export function parseToPaise(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return 0;
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) throw new Error('Cannot parse non-finite number');
    // Round to nearest integer to eliminate minor float quirks
    return Math.round(input * 100);
  }

  const trimmed = input.trim();
  if (!trimmed) return 0;

  let isNegative = false;
  let cleanStr = trimmed;

  // Check for accounting parentheses e.g. (1200.50)
  if (cleanStr.startsWith('(') && cleanStr.endsWith(')')) {
    isNegative = true;
    cleanStr = cleanStr.slice(1, -1);
  }

  // Check for Dr / Cr suffix or prefix
  if (/(\bdr\b|\bdebit\b)/i.test(cleanStr)) {
    isNegative = true;
    cleanStr = cleanStr.replace(/(\bdr\b|\bdebit\b)/gi, '');
  } else if (/(\bcr\b|\bcredit\b)/i.test(cleanStr)) {
    cleanStr = cleanStr.replace(/(\bcr\b|\bcredit\b)/gi, '');
  }

  // Check for leading minus or plus
  if (cleanStr.startsWith('-')) {
    isNegative = !isNegative;
    cleanStr = cleanStr.substring(1);
  } else if (cleanStr.startsWith('+')) {
    cleanStr = cleanStr.substring(1);
  }

  // Remove currency symbols, commas, spaces
  cleanStr = cleanStr.replace(/[^0-9.]/g, '');

  if (!cleanStr) return 0;

  const parts = cleanStr.split('.');
  if (parts.length > 2) {
    throw new Error(`Invalid monetary format with multiple decimals: "${input}"`);
  }

  const integerPart = parseInt(parts[0] || '0', 10);
  let fractionalPart = 0;

  if (parts.length === 2) {
    const fracStr = parts[1].padEnd(2, '0').slice(0, 2); // 2 decimal digits for paise
    fractionalPart = parseInt(fracStr, 10);
  }

  const totalPaise = integerPart * 100 + fractionalPart;
  return isNegative ? -totalPaise : totalPaise;
}

/**
 * Formats integer paise into standard Indian Rupee notation with ₹ symbol.
 * Example: 1245050 -> "₹12,450.50", -50000 -> "-₹500.00"
 */
export function formatPaise(
  paise: number,
  options: {
    showSign?: boolean;
    currencySymbol?: string;
    showCurrency?: boolean;
  } = {}
): string {
  const {
    showSign = false,
    currencySymbol = '₹',
    showCurrency = true,
  } = options;

  const isNeg = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const cents = absPaise % 100;

  const centsStr = cents.toString().padStart(2, '0');
  
  // Format with Indian numbering system (e.g. 12,34,567.00) or standard international
  const rupeesStr = rupees.toLocaleString('en-IN');
  const formatted = `${rupeesStr}.${centsStr}`;
  const curr = showCurrency ? currencySymbol : '';

  if (isNeg) {
    return `-${curr}${formatted}`;
  }
  if (showSign && paise > 0) {
    return `+${curr}${formatted}`;
  }
  return `${curr}${formatted}`;
}

/**
 * Sums an array of paise integers safely.
 */
export function sumPaise(items: number[]): number {
  return items.reduce((acc, curr) => acc + curr, 0);
}

/**
 * Validates that two currencies match. Mixed currency reconciliation is blocked by default.
 */
export function validateSameCurrency(currA: string, currB: string): void {
  const normA = (currA || 'INR').trim().toUpperCase();
  const normB = (currB || 'INR').trim().toUpperCase();
  if (normA !== normB) {
    throw new Error(
      `Cross-currency reconciliation blocked: Cannot match ${normA} against ${normB} without verified exchange rates.`
    );
  }
}
