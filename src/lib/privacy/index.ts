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
  // 1. Long Bank Account Numbers (11 to 18 contiguous digits)
  {
    name: 'BankAccount',
    pattern: /\b\d{11,18}\b/g,
    replacement: '[ACCT-REDACTED]',
  },
  // 2. 10-digit Indian Mobile Numbers (optionally prefixed with +91- or +91 )
  {
    name: 'PhoneNumber',
    pattern: /\b(?:\+91[\-\s])?[6-9]\d{9}\b/g,
    replacement: '[PHONE-REDACTED]',
  },
  // 3. Indian UPI Handles (e.g. user@oksbi, payment@icici, 9876543210@paytm)
  {
    name: 'UPI_ID',
    pattern: /[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/g,
    replacement: '[UPI-REDACTED]',
  },
  // 4. Short Bank Accounts (9 to 10 digits)
  {
    name: 'BankAccount',
    pattern: /\b\d{9,10}\b/g,
    replacement: '[ACCT-REDACTED]',
  },
  // 5. Email Addresses
  {
    name: 'Email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: '[EMAIL-REDACTED]',
  },
  // 6. 16-digit Card numbers
  {
    name: 'PaymentCard',
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: '[CARD-REDACTED]',
  },
];

/**
 * Scrubs a text narration string using the redaction rules.
 */
export function sanitizeNarration(text: string): {
  sanitized: string;
  redactedCategories: string[];
} {
  if (!text) return { sanitized: '', redactedCategories: [] };

  let current = text;
  const redactedCategories = new Set<string>();

  for (const rule of DEFAULT_REDACTION_RULES) {
    if (rule.pattern.test(current)) {
      redactedCategories.add(rule.name);
      current = current.replace(rule.pattern, rule.replacement);
    }
  }

  return {
    sanitized: current,
    redactedCategories: Array.from(redactedCategories),
  };
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
