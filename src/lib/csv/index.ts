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

export type DateFormat = 'AUTO' | 'DMY' | 'MDY' | 'YMD';

export interface DateParseResult {
  isoDate?: string;
  isAmbiguous?: boolean;
  error?: string;
}

export interface MappingDetectionResult {
  mapping: ColumnMapping;
  confidence: 'HIGH' | 'LOW';
  missingFields: string[];
  detectedAmountMode: 'SEPARATE_DR_CR' | 'SINGLE_AMOUNT' | 'NONE';
  detectedDateFormat: DateFormat;
}

export interface RawParseResult {
  headers: string[];
  rows: Record<string, string>[];
  detectedMapping: ColumnMapping;
  inspection: MappingDetectionResult;
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
 * Validates calendar correctness without relying on Date objects or timezone shifting.
 * Accurately handles leap years (e.g. 2024-02-29 is valid; 2025-02-29 is rejected).
 */
export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/**
 * Deterministically parses a date string into ISO YYYY-MM-DD.
 * Prevents JavaScript Date timezone shifting and detects format ambiguities (e.g. 04/05/2026).
 */
export function parseDeterministicDate(
  rawDate: string,
  preferredFormat: DateFormat = 'AUTO'
): DateParseResult {
  const trimmed = rawDate.trim();
  if (!trimmed) return { error: 'Missing transaction date' };

  // 1. Check ISO YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(trimmed);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (!isValidCalendarDate(year, month, day)) {
      return { error: `Calendar date does not exist: "${rawDate}"` };
    }
    return { isoDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
  }

  // 2. Check DD-Mon-YYYY or DD Mon YYYY (e.g. 05-Sep-2026, 5 September 2026)
  const dMonYMatch = /^(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ](\d{4})$/.exec(trimmed);
  if (dMonYMatch) {
    const day = parseInt(dMonYMatch[1], 10);
    const monthStr = dMonYMatch[2].toLowerCase();
    const year = parseInt(dMonYMatch[3], 10);
    const month = MONTH_NAMES[monthStr];
    if (!month || !isValidCalendarDate(year, month, day)) {
      return { error: `Invalid date with month name: "${rawDate}"` };
    }
    return { isoDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
  }

  // 3. Check DD/MM/YYYY or MM/DD/YYYY (or with hyphens)
  const dmyMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(trimmed);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);

    let day: number;
    let month: number;

    if (preferredFormat === 'DMY') {
      day = p1;
      month = p2;
    } else if (preferredFormat === 'MDY') {
      month = p1;
      day = p2;
    } else if (preferredFormat === 'YMD') {
      return { error: `Expected YYYY-MM-DD format but found: "${rawDate}"` };
    } else {
      // AUTO detection
      if (p1 > 12 && p2 <= 12) {
        day = p1;
        month = p2;
      } else if (p2 > 12 && p1 <= 12) {
        month = p1;
        day = p2;
      } else if (p1 === p2 && p1 <= 12) {
        day = p1;
        month = p2;
      } else {
        return {
          isAmbiguous: true,
          error: `Ambiguous date "${rawDate}". Please specify whether date format is DD/MM/YYYY or MM/DD/YYYY in import settings.`
        };
      }
    }

    if (!isValidCalendarDate(year, month, day)) {
      return { error: `Calendar date does not exist: "${rawDate}"` };
    }
    return { isoDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
  }

  return { error: `Unrecognized date format: "${rawDate}". Supported: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, DD-Mon-YYYY.` };
}

/**
 * Inspects a sample of rows to determine if a date column is unambiguous.
 */
export function detectFileDateFormat(rows: Record<string, string>[], dateCol?: string): DateFormat {
  if (!dateCol || rows.length === 0) return 'AUTO';

  let hasYMD = false;
  let hasDMYIndicator = false;
  let hasMDYIndicator = false;

  for (const row of rows.slice(0, 100)) {
    const val = row[dateCol]?.trim();
    if (!val) continue;

    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(val)) {
      hasYMD = true;
    }
    const match = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(val);
    if (match) {
      const p1 = parseInt(match[1], 10);
      const p2 = parseInt(match[2], 10);
      if (p1 > 12 && p2 <= 12) hasDMYIndicator = true;
      if (p2 > 12 && p1 <= 12) hasMDYIndicator = true;
    }
  }

  if (hasYMD) return 'YMD';
  if (hasDMYIndicator && !hasMDYIndicator) return 'DMY';
  if (hasMDYIndicator && !hasDMYIndicator) return 'MDY';
  return 'AUTO';
}

/**
 * Inspects headers and returns column mapping alongside detection confidence and missing fields.
 */
export function inspectColumnMapping(headers: string[]): MappingDetectionResult {
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
    if (!dateCol && (n.includes('date') || n === 'txndate' || n === 'valuedate' || n === 'postingdate' || n === 'bookingdate')) {
      dateCol = h;
    } else if (!descriptionCol && (n.includes('desc') || n.includes('narration') || n.includes('particulars') || n.includes('memo') || n.includes('details') || n.includes('remarks'))) {
      descriptionCol = h;
    } else if (!debitCol && (n.includes('debit') || n === 'dr' || n === 'withdrawal' || n === 'spent' || n === 'expense' || n === 'outflow' || n.includes('debitexpense'))) {
      debitCol = h;
    } else if (!creditCol && (n.includes('credit') || n === 'cr' || n === 'deposit' || n === 'received' || n === 'income' || n === 'inflow' || n.includes('creditincome'))) {
      creditCol = h;
    } else if (!amountCol && (n === 'amount' || n === 'txnamount' || n === 'netamount' || n === 'value' || n === 'transamount')) {
      amountCol = h;
    } else if (!referenceCol && (n.includes('ref') || n.includes('utr') || n.includes('cheque') || n.includes('chq') || n.includes('txnno') || n.includes('transid') || n === 'id' || n.includes('voucher'))) {
      referenceCol = h;
    } else if (!balanceCol && (n.includes('balance') || n === 'closingbal' || n === 'runningbal' || n === 'availablebalance')) {
      balanceCol = h;
    }
  }

  const missingFields: string[] = [];
  if (!dateCol) missingFields.push('Date');
  if (!descriptionCol) missingFields.push('Description / Narration');

  let detectedAmountMode: 'SEPARATE_DR_CR' | 'SINGLE_AMOUNT' | 'NONE' = 'NONE';
  if (debitCol && creditCol) {
    detectedAmountMode = 'SEPARATE_DR_CR';
  } else if (amountCol) {
    detectedAmountMode = 'SINGLE_AMOUNT';
  } else if (debitCol || creditCol) {
    detectedAmountMode = 'SEPARATE_DR_CR';
  } else {
    missingFields.push('Amount or Debit/Credit');
  }

  const confidence: 'HIGH' | 'LOW' = missingFields.length === 0 ? 'HIGH' : 'LOW';

  return {
    mapping: {
      dateCol: dateCol || (headers[0] || ''),
      descriptionCol: descriptionCol || (headers[1] || ''),
      amountCol: amountCol || undefined,
      debitCol: debitCol || undefined,
      creditCol: creditCol || undefined,
      referenceCol: referenceCol || undefined,
      balanceCol: balanceCol || undefined,
    },
    confidence,
    missingFields,
    detectedAmountMode,
    detectedDateFormat: 'AUTO',
  };
}

/**
 * Auto-detects standard financial column headers from common CSV patterns.
 */
export function detectColumnMapping(headers: string[]): ColumnMapping {
  return inspectColumnMapping(headers).mapping;
}

export const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5 MB ceiling
export const MAX_CSV_ROWS = 10_000; // 10,000 row ceiling to prevent browser main thread freeze

/**
 * In-browser parsing of CSV string using PapaParse with strict size & structure guards.
 */
export function parseCSVString(csvText: string): Promise<RawParseResult> {
  return new Promise((resolve) => {
    // 1. Enforce byte length bounds before parsing
    if (!csvText || !csvText.trim()) {
      const inspection = inspectColumnMapping([]);
      resolve({
        headers: [],
        rows: [],
        detectedMapping: inspection.mapping,
        inspection,
        errors: ['CSV input is empty. Please provide a valid CSV file with header and transaction rows.'],
      });
      return;
    }

    if (csvText.length > MAX_CSV_BYTES) {
      const inspection = inspectColumnMapping([]);
      resolve({
        headers: [],
        rows: [],
        detectedMapping: inspection.mapping,
        inspection,
        errors: [`CSV file exceeds maximum size limit of 5 MB (${(csvText.length / (1024 * 1024)).toFixed(2)} MB uploaded).`],
      });
      return;
    }

    // 2. Strip UTF-8 Byte Order Mark (BOM: \uFEFF) to prevent header name corruption
    let cleanText = csvText;
    if (cleanText.charCodeAt(0) === 0xfeff) {
      cleanText = cleanText.slice(1);
    }

    Papa.parse<Record<string, string>>(cleanText, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const headers = results.meta.fields || [];
        const inspection = inspectColumnMapping(headers);
        const detectedMapping = inspection.mapping;
        const errors = results.errors.map((e) => `Line ${e.row}: ${e.message}`);

        // 3. Enforce maximum row count bound
        if (results.data.length > MAX_CSV_ROWS) {
          errors.push(
            `CSV row count exceeds maximum limit of 10,000 rows (${results.data.length} rows detected). Please split the dataset.`
          );
        }

        if (headers.length === 0) {
          errors.push('No detectable header columns found in CSV.');
        }

        resolve({
          headers,
          rows: results.data.length > MAX_CSV_ROWS ? results.data.slice(0, MAX_CSV_ROWS) : results.data,
          detectedMapping,
          inspection,
          errors,
        });
      },
    });
  });
}

export interface NormalizationOptions {
  dateFormat?: DateFormat;
}

export interface NormalizationResult {
  validRows: ValidatedCSVRow[];
  invalidRows: ValidatedCSVRow[];
  detectedOpeningBalancePaise?: number;
  detectedClosingBalancePaise?: number;
  hasOpeningBalanceRow: boolean;
  hasClosingBalanceRow: boolean;
}

/**
 * Validates and transforms raw rows into normalized financial rows.
 * Collects any invalid dates or corrupted amounts without silently dropping rows.
 * Also detects opening balance anchor rows and ending balances when present.
 */
export function validateAndNormalizeRows(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  _sourcePrefix?: 'BNK' | 'LDG',
  options?: NormalizationOptions | DateFormat
): NormalizationResult {
  const validRows: ValidatedCSVRow[] = [];
  const invalidRows: ValidatedCSVRow[] = [];
  let detectedOpeningBalancePaise: number | undefined;
  let detectedClosingBalancePaise: number | undefined;
  let hasOpeningBalanceRow = false;
  let hasClosingBalanceRow = false;

  const dateFormat: DateFormat = typeof options === 'string' ? options : (options?.dateFormat ?? 'AUTO');

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // 1-indexed, header is row 1
    const validationErrors: string[] = [];

    // Description
    const description = (mapping.descriptionCol ? row[mapping.descriptionCol] : '')?.trim() || '';

    // Check if this is an Opening Balance anchor row
    const isOpeningRow = /opening\s*balance|initial\s*balance|balance\s*b\/?f|brought\s*forward/i.test(description);
    if (isOpeningRow) {
      const candidateBal = (mapping.balanceCol && row[mapping.balanceCol]) ||
                           (mapping.amountCol && row[mapping.amountCol]) ||
                           (mapping.creditCol && row[mapping.creditCol]);
      if (candidateBal && candidateBal.trim() !== '') {
        try {
          detectedOpeningBalancePaise = parseToPaise(candidateBal);
          hasOpeningBalanceRow = true;
          return; // Handled as opening balance anchor, not a transaction row
        } catch {
          // Continue standard validation if corrupted
        }
      }
    }

    // Check if this is a Closing Balance anchor row
    const isClosingRow = /closing\s*balance|ending\s*balance|balance\s*c\/?f|carried\s*forward/i.test(description);
    if (isClosingRow) {
      const candidateBal = (mapping.balanceCol && row[mapping.balanceCol]) ||
                           (mapping.amountCol && row[mapping.amountCol]) ||
                           (mapping.creditCol && row[mapping.creditCol]);
      if (candidateBal && candidateBal.trim() !== '') {
        try {
          detectedClosingBalancePaise = parseToPaise(candidateBal);
          hasClosingBalanceRow = true;
          return; // Handled as closing balance anchor, not a transaction row
        } catch {
          // Continue standard validation if corrupted
        }
      }
    }

    // Date extraction
    const rawDate = (mapping.dateCol ? row[mapping.dateCol] : '')?.trim() || '';
    let normalizedDate = '';

    if (!rawDate) {
      validationErrors.push('Missing transaction date');
    } else {
      const dateResult = parseDeterministicDate(rawDate, dateFormat);
      if (dateResult.error) {
        validationErrors.push(dateResult.error);
      } else if (dateResult.isoDate) {
        normalizedDate = dateResult.isoDate;
      }
    }

    if (!description) {
      validationErrors.push('Empty transaction description');
    }

    // Amount extraction
    let amountPaise = 0;
    let direction: 'debit' | 'credit' = 'credit';

    try {
      const hasDebitVal = Boolean(mapping.debitCol && row[mapping.debitCol] && row[mapping.debitCol].trim() !== '');
      const hasCreditVal = Boolean(mapping.creditCol && row[mapping.creditCol] && row[mapping.creditCol].trim() !== '');

      if (hasDebitVal && hasCreditVal) {
        const dVal = parseToPaise(row[mapping.debitCol!]);
        const cVal = parseToPaise(row[mapping.creditCol!]);
        if (dVal !== 0 && cVal !== 0) {
          validationErrors.push('Conflicting entries: both Debit and Credit columns contain non-zero amounts');
        } else if (dVal !== 0) {
          amountPaise = Math.abs(dVal);
          direction = 'debit';
        } else if (cVal !== 0) {
          amountPaise = Math.abs(cVal);
          direction = 'credit';
        }
      } else if (hasDebitVal) {
        const dVal = parseToPaise(row[mapping.debitCol!]);
        if (dVal !== 0) {
          amountPaise = Math.abs(dVal);
          direction = 'debit';
        }
      } else if (hasCreditVal) {
        const cVal = parseToPaise(row[mapping.creditCol!]);
        if (cVal !== 0) {
          amountPaise = Math.abs(cVal);
          direction = 'credit';
        }
      }

      // If separate debit/credit wasn't mapped or was zero, check combined amount column
      if (amountPaise === 0 && mapping.amountCol && row[mapping.amountCol] && row[mapping.amountCol].trim() !== '') {
        const parsedAmount = parseToPaise(row[mapping.amountCol]);
        if (parsedAmount < 0) {
          amountPaise = Math.abs(parsedAmount);
          direction = 'debit';
        } else if (parsedAmount > 0) {
          amountPaise = parsedAmount;
          direction = 'credit';
        }
      }

      if (amountPaise === 0 && validationErrors.length === 0) {
        validationErrors.push('Zero or missing transaction amount');
      }
    } catch (err: any) {
      validationErrors.push(`Corrupted monetary amount: ${err.message}`);
    }

    // Track running / ending balance if balance column is mapped
    if (mapping.balanceCol && row[mapping.balanceCol] && row[mapping.balanceCol].trim() !== '') {
      try {
        detectedClosingBalancePaise = parseToPaise(row[mapping.balanceCol]);
      } catch {
        // Ignore unparseable running balance
      }
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

  return {
    validRows,
    invalidRows,
    detectedOpeningBalancePaise,
    detectedClosingBalancePaise,
    hasOpeningBalanceRow,
    hasClosingBalanceRow,
  };
}

/**
 * Formula Injection Escaper (CWE-1236 Prevention).
 * If a text cell begins with dangerous prefixes (=, +, -, @, \t, \r, |, %),
 * even if preceded by whitespace, prepends an apostrophe (') so spreadsheet software
 * (Microsoft Excel, LibreOffice Calc, Google Sheets) treats it strictly as literal text.
 * Leaves legitimate signed financial figures in numeric columns untouched.
 */
export function sanitizeCellForCSV(val: any, isNumericColumn = false): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);

  // If this is an explicit numeric column with a valid financial number (e.g. -500.00, +1250.00), preserve it
  if (isNumericColumn && /^[+-]?\d+(?:\.\d+)?$/.test(str.trim())) {
    return str.trim();
  }

  let escaped = str;
  const trimmedLeading = str.replace(/^[\s\uFEFF\xA0]+/, '');
  const dangerousPrefixes = ['=', '+', '-', '@', '\t', '\r', '|', '%'];

  if (dangerousPrefixes.some((p) => trimmedLeading.startsWith(p))) {
    escaped = `'${escaped}`;
  }

  // Escape inner double quotes per RFC 4180
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
