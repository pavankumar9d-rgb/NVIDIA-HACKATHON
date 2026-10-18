/**
 * ProofLedger AI — Privacy & Redaction Engine
 * 
 * Guarantees that raw sensitive customer data (Bank Account Numbers, UPI IDs,
 * Phone Numbers, Emails) never leaks into prompts or outbound network requests.
 */

export interface RedactionRule {
  name: string;
  pattern: RegExp;
  replacement: string;
}

export const DEFAULT_REDACTION_RULES: RedactionRule[] = [
  // 1. Payment Cards (16 digits formatted or contiguous)
  {
    name: 'PaymentCard',
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: '[CARD-REDACTED]',
  },
  // 2. Indian PAN Card (5 letters, 4 digits, 1 letter, e.g. ABCDE1234F)
  {
    name: 'PAN_Card',
    pattern: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g,
    replacement: '[PAN-REDACTED]',
  },
  // 3. Indian Aadhaar Number (12 digits, often formatted as 4-4-4)
  {
    name: 'Aadhaar',
    pattern: /\b\d{4}\s\d{4}\s\d{4}\b/g,
    replacement: '[AADHAAR-REDACTED]',
  },
  // 4. Formatted Bank Accounts with hyphens or spaces (e.g. 1234-5678-9012 or 1234 5678 9012)
  {
    name: 'BankAccount',
    pattern: /\b\d{3,5}[-\s]\d{3,5}[-\s]\d{3,6}\b/g,
    replacement: '[ACCT-REDACTED]',
  },
  // 5. 10-digit Indian Mobile Numbers with optional +91 and spaces/hyphens
  {
    name: 'PhoneNumber',
    pattern: /(?<!\d)(?:\+91[\-\s]?)?[6-9](?:[\-\s]?\d){9}(?!\d)/g,
    replacement: '[PHONE-REDACTED]',
  },
  // 6. Long Bank Account Numbers (11 to 18 contiguous digits)
  {
    name: 'BankAccount',
    pattern: /\b\d{11,18}\b/g,
    replacement: '[ACCT-REDACTED]',
  },
  // 7. Indian UPI Handles (e.g. user@oksbi, payment@icici, 9876543210@paytm)
  {
    name: 'UPI_ID',
    pattern: /[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/g,
    replacement: '[UPI-REDACTED]',
  },
  // 8. Email Addresses
  {
    name: 'Email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: '[EMAIL-REDACTED]',
  },
  // 9. Short Bank Accounts (9 to 10 contiguous digits)
  {
    name: 'BankAccount',
    pattern: /\b\d{9,10}\b/g,
    replacement: '[ACCT-REDACTED]',
  },
];

/**
 * Normalizes text by removing zero-width characters and normalizing Unicode forms (NFKC).
 */
export function normalizeTextForPrivacy(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

/**
 * Scrubs a text narration string using the redaction rules.
 * Automatically normalizes Unicode and strips zero-width evasion characters.
 */
export function sanitizeNarration(text: string): {
  sanitized: string;
  redactedCategories: string[];
} {
  if (!text) return { sanitized: '', redactedCategories: [] };

  let current = normalizeTextForPrivacy(text);
  const redactedCategories = new Set<string>();

  for (const rule of DEFAULT_REDACTION_RULES) {
    if (rule.pattern.test(current)) {
      redactedCategories.add(rule.name);
      current = current.replace(rule.pattern, rule.replacement);
    }
  }

  // Cap sanitized narration to reasonable maximum length (200 characters)
  if (current.length > 200) {
    current = `${current.slice(0, 197)}...`;
  }

  return {
    sanitized: current,
    redactedCategories: Array.from(redactedCategories),
  };
}

/**
 * Server-side independent sanitization for transaction descriptions.
 * The server NEVER trusts client-claimed "sanitizedDescription".
 */
export function serverSanitizeNarration(input: unknown): string {
  if (typeof input !== 'string') return '';
  const { sanitized } = sanitizeNarration(input);
  return sanitized;
}

/**
 * Builds a minimized outbound payload for an exception to be sent to Nebius Token Factory.
 * Strips raw records down strictly to the minimal fields necessary for financial explanation.
 */
export function buildMinimizedExceptionPayload(params: {
  exceptionId: string;
  type: string;
  bankRow?: { id: string; date: string; amountPaise: number; direction: string; description: string; reference?: string };
  ledgerRow?: { id: string; date: string; amountPaise: number; direction: string; description: string; reference?: string };
  candidateRows?: Array<{ id: string; date: string; amountPaise: number; direction: string; description: string }>;
  deltaPaise: number;
  dateLagDays: number;
}) {
  const bankSanitized = params.bankRow
    ? {
        id: params.bankRow.id,
        date: params.bankRow.date,
        amountRupees: (params.bankRow.amountPaise / 100).toFixed(2),
        direction: params.bankRow.direction,
        sanitizedDescription: sanitizeNarration(params.bankRow.description).sanitized,
        referenceMasked: params.bankRow.reference ? `REF-${params.bankRow.reference.slice(-4)}` : undefined,
      }
    : null;

  const ledgerSanitized = params.ledgerRow
    ? {
        id: params.ledgerRow.id,
        date: params.ledgerRow.date,
        amountRupees: (params.ledgerRow.amountPaise / 100).toFixed(2),
        direction: params.ledgerRow.direction,
        sanitizedDescription: sanitizeNarration(params.ledgerRow.description).sanitized,
        referenceMasked: params.ledgerRow.reference ? `REF-${params.ledgerRow.reference.slice(-4)}` : undefined,
      }
    : null;

  return {
    exceptionId: params.exceptionId,
    exceptionType: params.type,
    amountDeltaRupees: (params.deltaPaise / 100).toFixed(2),
    dateDeltaDays: params.dateLagDays,
    bankEvidence: bankSanitized,
    ledgerEvidence: ledgerSanitized,
    candidateCount: params.candidateRows?.length || 0,
  };
}
