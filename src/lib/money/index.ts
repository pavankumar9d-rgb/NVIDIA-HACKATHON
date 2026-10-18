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
 * Normalizes any currency string or number into signed integer paise.
 * Strictly validates:
 * - Indian number grouping (e.g. 1,25,000.50) and international grouping (e.g. 125,000.50)
 * - Decimal precision: Exactly 0, 1, or 2 decimal places for INR. Rejects 3+ decimal digits.
 * - Rejects malformed strings with unexpected characters (e.g. "12x3.456").
 * - Accounting parentheses e.g. "(250.00)" -> -25000
 * - Explicit Dr/Cr indicators e.g. "450.75 Dr" -> -45075, "1500 Cr" -> 150000
 * - Enforces safe integer boundaries (Number.MAX_SAFE_INTEGER).
 * 
 * Examples:
 *   "₹12,450.50"   -> 1245050
 *   "-₹1,200.00"   -> -120000
 *   "450.75 Dr"    -> -45075
 *   "1500 Cr"      -> 150000
 *   "(250.00)"     -> -25000
 *   "12x3.456"     -> throws Error
 *   "12.345"       -> throws Error
 */
export function parseToPaise(input: string | number | null | undefined): number {
  if (input === null || input === undefined) return 0;

  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      throw new Error('Cannot parse non-finite number as monetary value');
    }
    const scaled = input * 100;
    if (Math.abs(scaled) > Number.MAX_SAFE_INTEGER) {
      throw new Error(`Monetary amount exceeds safe integer limit: ${input}`);
    }
    // Check if the number had more than 2 decimal places
    const rounded = Math.round(scaled);
    if (Math.abs(scaled - rounded) > 1e-5) {
      throw new Error(`Unsupported precision: number ${input} has fractional paise digits beyond 2 decimal places`);
    }
    return rounded;
  }

  const trimmed = input.trim();
  if (!trimmed) return 0;

  let isNegative = false;
  let str = trimmed;

  // 1. Accounting parentheses check: e.g. (1,200.50)
  if (str.startsWith('(') && str.endsWith(')')) {
    isNegative = true;
    str = str.slice(1, -1).trim();
  }

  // 2. Debit / Credit indicators: "Dr", "Debit", "Cr", "Credit"
  if (/(?:^|\s)(?:dr|debit)(?:\.|\b)/i.test(str)) {
    isNegative = true;
    str = str.replace(/(?:^|\s)(?:dr|debit)(?:\.|\b)/gi, '').trim();
  } else if (/(?:^|\s)(?:cr|credit)(?:\.|\b)/i.test(str)) {
    str = str.replace(/(?:^|\s)(?:cr|credit)(?:\.|\b)/gi, '').trim();
  }

  // 3. Leading / Trailing algebraic signs
  if (str.startsWith('-')) {
    isNegative = !isNegative;
    str = str.substring(1).trim();
  } else if (str.startsWith('+')) {
    str = str.substring(1).trim();
  }

  if (str.endsWith('-')) {
    isNegative = !isNegative;
    str = str.slice(0, -1).trim();
  } else if (str.endsWith('+')) {
    str = str.slice(0, -1).trim();
  }

  // 4. Strip permitted currency symbols / ISO codes
  str = str
    .replace(/^(?:₹|rs\.?|inr|\$|usd|€|eur|£|gbp)\s*/i, '')
    .replace(/\s*(?:₹|rs\.?|inr|\$|usd|€|eur|£|gbp)$/i, '')
    .trim();

  if (!str) return 0;

  // 5. Strict character validation: ONLY digits, commas, and a single decimal point allowed
  if (!/^[0-9,.]+$/.test(str)) {
    throw new Error(`Malformed monetary amount: "${input}". Contains invalid characters.`);
  }

  // 6. Decimal point structure
  const parts = str.split('.');
  if (parts.length > 2) {
    throw new Error(`Invalid monetary format with multiple decimal separators: "${input}"`);
  }

  const integerStr = parts[0];
  const fractionalStr = parts[1];

  // 7. Fractional precision validation: Max 2 decimal digits for INR
  if (fractionalStr !== undefined && fractionalStr.length > 2) {
    throw new Error(
      `Unsupported monetary precision: "${input}" has ${fractionalStr.length} decimal places (maximum 2 allowed for INR).`
    );
  }

  // 8. Number grouping / comma validation
  if (integerStr.includes(',')) {
    // Valid Indian format: 1,00,000 or 12,34,567 (last group 3 digits, preceding groups 2 digits)
    const isValidIndian = /^\d{1,2}(,\d{2})*,\d{3}$/.test(integerStr);
    // Valid International format: 100,000 or 1,234,567 (groups of 3 digits)
    const isValidInternational = /^\d{1,3}(,\d{3})*$/.test(integerStr);

    if (!isValidIndian && !isValidInternational) {
      throw new Error(`Malformed number grouping with invalid comma placement: "${input}"`);
    }
  }

  const cleanIntStr = integerStr.replace(/,/g, '');
  if (cleanIntStr.length > 15) {
    throw new Error(`Monetary amount exceeds safe integer limit: "${input}"`);
  }

  const intPart = parseInt(cleanIntStr || '0', 10);
  let fracPart = 0;

  if (fractionalStr !== undefined) {
    fracPart = parseInt(fractionalStr.padEnd(2, '0'), 10);
  }

  const totalPaise = intPart * 100 + fracPart;
  if (!Number.isSafeInteger(totalPaise)) {
    throw new Error(`Monetary amount exceeds safe integer limit: "${input}"`);
  }

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

  if (!Number.isSafeInteger(paise)) {
    throw new Error(`Cannot format unsafe integer paise: ${paise}`);
  }

  const isNeg = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const cents = absPaise % 100;

  const centsStr = cents.toString().padStart(2, '0');
  
  // Format with Indian numbering system (e.g. 12,34,567.00)
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
 * Sums an array of paise integers safely, verifying safe integer bounds.
 */
export function sumPaise(items: number[]): number {
  let sum = 0;
  for (const item of items) {
    if (!Number.isSafeInteger(item)) {
      throw new Error(`Cannot sum unsafe integer amount: ${item}`);
    }
    sum += item;
    if (!Number.isSafeInteger(sum)) {
      throw new Error(`Aggregate monetary sum exceeded safe integer limit: ${sum}`);
    }
  }
  return sum;
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
