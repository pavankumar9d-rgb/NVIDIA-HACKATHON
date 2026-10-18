/**
 * ProofLedger AI — CSV Parsing, Mapping & Formula-Safe Export Engine
 */

import Papa from 'papaparse';
import { parseToPaise } from '../money';

export interface ColumnMapping {
  dateCol: string;
  descriptionCol: string;
  amountCol?: string;
  debitCol?: string;
  creditCol?: string;
  referenceCol?: string;
  balanceCol?: string;
}

export interface RawParseResult {
  headers: string[];
  rows: Record<string, string>[];
  detectedMapping: ColumnMapping;
  errors: string[];
}

export interface ValidatedCSVRow {
  rowNumber: number;
  date: string;
  description: string;
  amountPaise: number;
  direction: 'debit' | 'credit';
  signedAmountPaise: number;
  reference?: string;
  raw: Record<string, string>;
  validationErrors: string[];
}

/**
 * Auto-detects standard financial column headers from common CSV patterns.
 */
export function detectColumnMapping(headers: string[]): ColumnMapping {
  const norm = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

  let dateCol = '';
  let descriptionCol = '';
  let amountCol = '';
  let debitCol = '';
  let creditCol = '';
  let referenceCol = '';
  let balanceCol = '';

  for (const h of headers) {
    const n = norm(h);
    if (!dateCol && (n.includes('date') || n === 'txndate' || n === 'valuedate')) {
      dateCol = h;
    } else if (!descriptionCol && (n.includes('desc') || n.includes('narration') || n.includes('particulars') || n.includes('memo') || n.includes('details'))) {
      descriptionCol = h;
    } else if (!amountCol && (n === 'amount' || n === 'txnamount' || n === 'netamount' || n === 'value')) {
      amountCol = h;
    } else if (!debitCol && (n.includes('debit') || n === 'dr' || n === 'withdrawal' || n === 'spent' || n === 'expense')) {
      debitCol = h;
    } else if (!creditCol && (n.includes('credit') || n === 'cr' || n === 'deposit' || n === 'received' || n === 'income')) {
      creditCol = h;
    } else if (!referenceCol && (n.includes('ref') || n.includes('utr') || n.includes('cheque') || n.includes('chq') || n.includes('txnno') || n.includes('transid') || n === 'id')) {
      referenceCol = h;
    } else if (!balanceCol && (n.includes('balance') || n === 'closingbal')) {
      balanceCol = h;
    }
  }

  // Fallbacks if not detected
  if (!dateCol && headers.length > 0) dateCol = headers[0];
  if (!descriptionCol && headers.length > 1) descriptionCol = headers[1];

  return {
    dateCol,
    descriptionCol,
    amountCol: amountCol || undefined,
    debitCol: debitCol || undefined,
    creditCol: creditCol || undefined,
    referenceCol: referenceCol || undefined,
    balanceCol: balanceCol || undefined,
  };
}

/**
 * In-browser parsing of CSV string or File using PapaParse.
 */
export function parseCSVString(csvText: string): Promise<RawParseResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const headers = results.meta.fields || [];
        const detectedMapping = detectColumnMapping(headers);
        const errors = results.errors.map((e) => `Line ${e.row}: ${e.message}`);
        resolve({
          headers,
          rows: results.data,
          detectedMapping,
          errors,
        });
      },
    });
  });
}

/**
 * Validates and transforms raw rows into normalized financial rows.
 * Collects any invalid dates or corrupted amounts without silently dropping rows.
 */
export function validateAndNormalizeRows(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  _sourcePrefix?: 'BNK' | 'LDG'
): { validRows: ValidatedCSVRow[]; invalidRows: ValidatedCSVRow[] } {
  const validRows: ValidatedCSVRow[] = [];
  const invalidRows: ValidatedCSVRow[] = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // 1-indexed, header is row 1
    const validationErrors: string[] = [];

    // Date extraction
    const rawDate = row[mapping.dateCol]?.trim() || '';
    if (!rawDate) {
      validationErrors.push('Missing transaction date');
    }

    // Standardize ISO YYYY-MM-DD
    let normalizedDate = rawDate;
    const parsedDate = new Date(rawDate);
    if (isNaN(parsedDate.getTime())) {
      // Try parsing DD/MM/YYYY or DD-MM-YYYY
      const parts = rawDate.split(/[\/\-]/);
      if (parts.length === 3 && parts[2].length === 4) {
        normalizedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else {
        validationErrors.push(`Unrecognized date format: "${rawDate}"`);
      }
    } else {
      normalizedDate = parsedDate.toISOString().split('T')[0];
    }

    // Description
    const description = row[mapping.descriptionCol]?.trim() || '';
    if (!description) {
      validationErrors.push('Empty transaction description');
    }

    // Amount extraction
    let amountPaise = 0;
    let direction: 'debit' | 'credit' = 'credit';

    try {
      if (mapping.debitCol && row[mapping.debitCol] && row[mapping.debitCol].trim() !== '') {
        const debitVal = parseToPaise(row[mapping.debitCol]);
        if (debitVal > 0) {
          amountPaise = debitVal;
          direction = 'debit';
        }
      }
      if (mapping.creditCol && row[mapping.creditCol] && row[mapping.creditCol].trim() !== '') {
        const creditVal = parseToPaise(row[mapping.creditCol]);
        if (creditVal > 0) {
          amountPaise = creditVal;
          direction = 'credit';
        }
      }

      // If separate debit/credit wasn't used or was zero, check combined amount column
      if (amountPaise === 0 && mapping.amountCol && row[mapping.amountCol]) {
        const parsedAmount = parseToPaise(row[mapping.amountCol]);
        if (parsedAmount < 0) {
          amountPaise = Math.abs(parsedAmount);
          direction = 'debit';
        } else {
          amountPaise = parsedAmount;
          direction = 'credit';
        }
      }

      if (amountPaise === 0) {
        validationErrors.push('Zero or missing transaction amount');
      }
    } catch (err: any) {
      validationErrors.push(`Corrupted monetary amount: ${err.message}`);
    }

    const reference = mapping.referenceCol ? row[mapping.referenceCol]?.trim() : undefined;
    const signedAmountPaise = direction === 'debit' ? -amountPaise : amountPaise;

    const validated: ValidatedCSVRow = {
      rowNumber: rowNum,
      date: normalizedDate,
      description,
      amountPaise,
      direction,
      signedAmountPaise,
      reference: reference || undefined,
      raw: row,
      validationErrors,
    };

    if (validationErrors.length === 0) {
      validRows.push(validated);
    } else {
      invalidRows.push(validated);
    }
  });

  return { validRows, invalidRows };
}

/**
 * Formula Injection Escaper (CWE-1236 Prevention).
 * If a text cell begins with dangerous prefixes (=, +, -, @, \t, \r),
 * prepends an apostrophe (') so Microsoft Excel/LibreOffice treats it purely as text.
 * Leaves legitimate signed numbers untouched.
 */
export function sanitizeCellForCSV(val: any, isNumericColumn = false): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);

  // If this is a numeric column with a valid number (e.g. -500.00), preserve it
  if (isNumericColumn && /^[+-]?\d+(?:\.\d+)?$/.test(str.trim())) {
    return str.trim();
  }

  let escaped = str;
  const dangerousPrefixes = ['=', '+', '-', '@', '\t', '\r'];
  if (dangerousPrefixes.some((p) => escaped.startsWith(p))) {
    escaped = `'${escaped}`;
  }

  // Escape inner double quotes
  return `"${escaped.replace(/"/g, '""')}"`;
}

/**
 * Exports data objects to a safe, formula-neutralized CSV string.
 */
export function exportToSafeCSV(
  rows: Record<string, any>[],
  columns: { key: string; label: string; isNumeric?: boolean }[]
): string {
  const headerLine = columns.map((c) => sanitizeCellForCSV(c.label)).join(',');
  const rowLines = rows.map((row) =>
    columns.map((c) => sanitizeCellForCSV(row[c.key], c.isNumeric)).join(',')
  );
  return [headerLine, ...rowLines].join('\r\n');
}

/**
 * Downloadable CSV Templates for user import.
 */
export const SAMPLE_BANK_CSV_TEMPLATE = `Date,Description,Reference_No,Debit,Credit,Balance
2026-09-01,Opening Balance,INIT-001,,,250000.00
2026-09-02,Client Retainer Acme Corp,NEFT-9281720,,75000.00,325000.00
2026-09-03,AWS Cloud Infrastructure,CHQ-481920,12450.00,,312550.00
2026-09-05,Office Lease Payment,RTGS-019283,45000.00,,267550.00`;

export const SAMPLE_LEDGER_CSV_TEMPLATE = `Date,Account_Narration,Voucher_Ref,Debit_Expense,Credit_Income
2026-09-02,Acme Corp Monthly Retainer,NEFT-9281720,,75000.00
2026-09-03,AWS Cloud Hosting Sep 2026,CHQ-481920,12450.00,
2026-09-05,Commercial Office Lease,RTGS-019283,45000.00,`;
