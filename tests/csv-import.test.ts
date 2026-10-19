import { describe, it, expect } from 'vitest';
import { 
  parseCSVString, 
  validateAndNormalizeRows, 
  parseDeterministicDate, 
  isValidCalendarDate,
  inspectColumnMapping,
  detectFileDateFormat,
  sanitizeCellForCSV
} from '../src/lib/csv';
import { runReconciliation } from '../src/lib/reconciliation';
import type { CanonicalTransaction, ReconciliationOptions } from '../src/lib/reconciliation';
import { getReconciliationBridge } from '../src/lib/reconciliation/analytics';

describe('Real-World Financial CSV Import & Boundary Hardening', () => {

  // Case 1: Standard ISO-date bank CSV with separate debit and credit columns
  it('1. correctly parses standard ISO-date bank CSV with separate debit and credit columns', async () => {
    const csv = `Date,Narration,Ref,Debit,Credit
2026-09-01,Client Retainer Acme Corp,NEFT-9281720,,75000.00
2026-09-02,AWS Cloud Hosting,CHQ-481920,12450.00,
2026-09-03,Office Lease,RTGS-019283,45000.00,`;

    const parsed = await parseCSVString(csv);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.inspection.confidence).toBe('HIGH');
    expect(parsed.inspection.detectedAmountMode).toBe('SEPARATE_DR_CR');

    const { validRows, invalidRows } = validateAndNormalizeRows(parsed.rows, parsed.detectedMapping, 'BNK');
    expect(invalidRows).toHaveLength(0);
    expect(validRows).toHaveLength(3);

    expect(validRows[0].direction).toBe('credit');
    expect(validRows[0].amountPaise).toBe(7500000); // ₹75,000.00
    expect(validRows[1].direction).toBe('debit');
    expect(validRows[1].amountPaise).toBe(1245000); // ₹12,450.00
    expect(validRows[1].signedAmountPaise).toBe(-1245000);
  });

  // Case 2: Indian DD/MM/YYYY date format
  it('2. deterministically parses Indian DD/MM/YYYY dates without date inversion or timezone drift', async () => {
    const csv = `Date,Description,Reference,Amount,Type
04/05/2026,Client Advance,NEFT-001,50000.00,CR
25/09/2026,Consulting Fee,NEFT-002,25000.00,CR`;

    const parsed = await parseCSVString(csv);
    // Explicitly using DMY convention for Indian statements
    const { validRows, invalidRows } = validateAndNormalizeRows(
      parsed.rows, 
      { dateCol: 'Date', descriptionCol: 'Description', amountCol: 'Amount', referenceCol: 'Reference' },
      'BNK',
      { dateFormat: 'DMY' }
    );

    expect(invalidRows).toHaveLength(0);
    expect(validRows).toHaveLength(2);
    // 04/05/2026 in DD/MM/YYYY must be 4th May (2026-05-04), NOT 5th April (2026-04-05)
    expect(validRows[0].date).toBe('2026-05-04');
    expect(validRows[1].date).toBe('2026-09-25');
  });

  // Case 3: US MM/DD/YYYY date format
  it('3. deterministically parses US MM/DD/YYYY dates when configured', async () => {
    const csv = `Date,Description,Reference,Amount
04/05/2026,US SaaS Subscription,REF-US-01,1500.00
09/25/2026,Stripe Payout,REF-US-02,32000.00`;

    const parsed = await parseCSVString(csv);
    const { validRows, invalidRows } = validateAndNormalizeRows(
      parsed.rows,
      { dateCol: 'Date', descriptionCol: 'Description', amountCol: 'Amount', referenceCol: 'Reference' },
      'BNK',
      { dateFormat: 'MDY' }
    );

    expect(invalidRows).toHaveLength(0);
    expect(validRows).toHaveLength(2);
    // 04/05/2026 in MM/DD/YYYY must be April 5th (2026-04-05)
    expect(validRows[0].date).toBe('2026-04-05');
    expect(validRows[1].date).toBe('2026-09-25');
  });

  // Case 4: Single signed amount column (negative for debit, positive for credit)
  it('4. handles single signed amount column with positive and negative numbers', async () => {
    const csv = `Date,Narration,TransactionAmount,Balance
2026-09-01,Stripe Customer Payout,84500.00,184500.00
2026-09-02,Google Cloud Platform,-3200.50,181299.50
2026-09-03,Vendor Wire Return,1200.00,182499.50`;

    const parsed = await parseCSVString(csv);
    const { validRows, invalidRows } = validateAndNormalizeRows(
      parsed.rows,
      { dateCol: 'Date', descriptionCol: 'Narration', amountCol: 'TransactionAmount', balanceCol: 'Balance' },
      'BNK'
    );

    expect(invalidRows).toHaveLength(0);
    expect(validRows).toHaveLength(3);

    expect(validRows[0].direction).toBe('credit');
    expect(validRows[0].amountPaise).toBe(8450000);
    expect(validRows[1].direction).toBe('debit');
    expect(validRows[1].amountPaise).toBe(320050); // ₹3,200.50
    expect(validRows[1].signedAmountPaise).toBe(-320050);
  });

  // Case 5: Opening and closing balance rows detection and isolation
  it('5. identifies opening and closing balance rows as anchors without counting them as active transactions', async () => {
    const csv = `Date,Description,Debit,Credit,Balance
2026-09-01,Opening Balance b/f,,,250000.00
2026-09-02,Client Retainer,,50000.00,300000.00
2026-09-03,Office Supplies,5000.00,,295000.00
2026-09-30,Closing Balance c/f,,,295000.00`;

    const parsed = await parseCSVString(csv);
    const { validRows, invalidRows, detectedOpeningBalancePaise, detectedClosingBalancePaise, hasOpeningBalanceRow, hasClosingBalanceRow } =
      validateAndNormalizeRows(parsed.rows, parsed.detectedMapping, 'BNK');

    expect(invalidRows).toHaveLength(0);
    // Only 2 active transactions: Client Retainer and Office Supplies (opening and closing were recognized as anchors)
    expect(validRows).toHaveLength(2);
    expect(hasOpeningBalanceRow).toBe(true);
    expect(hasClosingBalanceRow).toBe(true);
    expect(detectedOpeningBalancePaise).toBe(25000000); // ₹2,50,000.00
    expect(detectedClosingBalancePaise).toBe(29500000); // ₹2,95,000.00
  });

  // Case 6: Missing reference numbers
  it('6. reconciles transactions with missing reference numbers via description, amount, and date tolerance', async () => {
    const bankCanonical: CanonicalTransaction[] = [
      {
        id: 'BNK-001',
        source: 'bank',
        sourceRowNumber: 1,
        date: '2026-09-05',
        rawDescription: 'Adobe Creative Cloud',
        sanitizedDescription: 'Adobe Creative Cloud',
        amountPaise: 420000,
        direction: 'debit',
        signedAmountPaise: -420000,
        reference: undefined, // Missing reference
        currency: 'INR',
        rawRow: {},
      },
    ];

    const ledgerCanonical: CanonicalTransaction[] = [
      {
        id: 'LDG-001',
        source: 'ledger',
        sourceRowNumber: 1,
        date: '2026-09-04', // 1 day earlier
        rawDescription: 'Adobe Creative Cloud Subscription',
        sanitizedDescription: 'Adobe Creative Cloud Subscription',
        amountPaise: 420000,
        direction: 'debit',
        signedAmountPaise: -420000,
        reference: undefined, // Missing reference
        currency: 'INR',
        rawRow: {},
      },
    ];

    const result = runReconciliation(bankCanonical, ledgerCanonical, { maxDateToleranceDays: 3 });
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].tier).toBe('EXACT_AMOUNT_DATE_TOLERANCE');
    expect(result.matches[0].dateDeltaDays).toBe(1);
    expect(result.exceptions).toHaveLength(0);
  });

  // Case 7: Invalid amount and date rows collection (never silently dropped)
  it('7. collects invalid date and corrupted amount rows into invalidRows with descriptive errors', async () => {
    const csv = `Date,Description,Reference,Debit,Credit
2026-09-01,Valid Transaction,REF-01,,10000.00
2025-02-29,Invalid Leap Year Date,REF-02,5000.00,
2026-09-03,Corrupted Amount,REF-03,12x45.00,
,Missing Date Row,REF-04,,5000.00
2026-09-05,Zero Amount Row,REF-05,0.00,`;

    const parsed = await parseCSVString(csv);
    const { validRows, invalidRows } = validateAndNormalizeRows(parsed.rows, parsed.detectedMapping, 'BNK');

    expect(validRows).toHaveLength(1);
    expect(invalidRows).toHaveLength(4);

    // Row 2: 2025-02-29 is not a leap year!
    expect(invalidRows[0].validationErrors[0]).toContain('Calendar date does not exist');
    // Row 3: corrupted amount
    expect(invalidRows[1].validationErrors[0]).toContain('Corrupted monetary amount');
    // Row 4: missing date
    expect(invalidRows[2].validationErrors[0]).toContain('Missing transaction date');
    // Row 5: zero amount
    expect(invalidRows[3].validationErrors[0]).toContain('Zero or missing transaction amount');
  });

  // Case 8: Unfamiliar headers requiring inspection and manual mapping
  it('8. flags unfamiliar headers with LOW confidence and allows custom mapping', async () => {
    const weirdCsv = `Posted_Timestamp,Transaction_Note,Trace_Identifier,Outflow_INR,Inflow_INR
2026-09-01,Vendor Hardware Payment,TRC-99182,45000.00,
2026-09-02,Customer Retainer,TRC-99183,,120000.00`;

    const parsed = await parseCSVString(weirdCsv);
    const inspection = inspectColumnMapping(parsed.headers);

    // Missing 'Date' and 'Description / Narration' standard keywords
    expect(inspection.confidence).toBe('LOW');
    expect(inspection.missingFields).toContain('Date');
    expect(inspection.missingFields).toContain('Description / Narration');

    // Manually specify correct mapping
    const customMapping = {
      dateCol: 'Posted_Timestamp',
      descriptionCol: 'Transaction_Note',
      referenceCol: 'Trace_Identifier',
      debitCol: 'Outflow_INR',
      creditCol: 'Inflow_INR',
    };

    const { validRows, invalidRows } = validateAndNormalizeRows(parsed.rows, customMapping, 'BNK');
    expect(invalidRows).toHaveLength(0);
    expect(validRows).toHaveLength(2);
    expect(validRows[0].description).toBe('Vendor Hardware Payment');
    expect(validRows[0].amountPaise).toBe(4500000);
    expect(validRows[1].amountPaise).toBe(12000000);
  });

  // Case 9: Duplicate and ambiguous transaction candidates
  it('9. identifies suspected duplicate candidates and ambiguous candidate ties', async () => {
    const bankCanonical: CanonicalTransaction[] = [
      {
        id: 'BNK-001',
        source: 'bank',
        sourceRowNumber: 1,
        date: '2026-09-02',
        rawDescription: 'ATM Cash Withdrawal',
        sanitizedDescription: 'ATM Cash Withdrawal',
        amountPaise: 500000,
        direction: 'debit',
        signedAmountPaise: -500000,
        reference: 'ATM-00912',
        currency: 'INR',
        rawRow: {},
      },
      {
        id: 'BNK-002',
        source: 'bank',
        sourceRowNumber: 2,
        date: '2026-09-02',
        rawDescription: 'ATM Cash Withdrawal',
        sanitizedDescription: 'ATM Cash Withdrawal',
        amountPaise: 500000,
        direction: 'debit',
        signedAmountPaise: -500000,
        reference: 'ATM-00912', // Duplicate reference & same amount on same date
        currency: 'INR',
        rawRow: {},
      },
    ];

    const ledgerCanonical: CanonicalTransaction[] = [
      {
        id: 'LDG-001',
        source: 'ledger',
        sourceRowNumber: 1,
        date: '2026-09-02',
        rawDescription: 'Petty Cash Replenishment',
        sanitizedDescription: 'Petty Cash Replenishment',
        amountPaise: 500000,
        direction: 'debit',
        signedAmountPaise: -500000,
        reference: 'ATM-00912',
        currency: 'INR',
        rawRow: {},
      },
    ];

    const result = runReconciliation(bankCanonical, ledgerCanonical);

    // One bank row matches, second is identified as DUPLICATE_CANDIDATE
    expect(result.matches).toHaveLength(1);
    expect(result.exceptions.some((e) => e.type === 'DUPLICATE_CANDIDATE')).toBe(true);
    expect(result.exceptions[0].candidateTransactions).toBeDefined();

    // Ambiguous Match case: 1 bank row with 2 eligible ledger candidates
    const ambiguousLedger: CanonicalTransaction[] = [
      { ...ledgerCanonical[0], id: 'LDG-001' },
      { ...ledgerCanonical[0], id: 'LDG-002' },
    ];
    const ambResult = runReconciliation([bankCanonical[0]], ambiguousLedger);
    expect(ambResult.exceptions.some((e) => e.type === 'AMBIGUOUS_MATCH')).toBe(true);
  });

  // Case 10: Untrusted formula-like descriptions preserved and escaped
  it('10. safely preserves formula-like untrusted descriptions in memory and neutralizes them in CSV', () => {
    const rawVal = '=cmd|"/C calc"!A0';
    const escaped = sanitizeCellForCSV(rawVal, false);

    // Prepends apostrophe to neutralize macro execution in Excel
    expect(escaped).toBe("\"'=cmd|\"\"/C calc\"\"!A0\"");

    // Legitimate signed numbers in numeric columns are not escaped
    expect(sanitizeCellForCSV('-18500.00', true)).toBe('-18500.00');
    expect(sanitizeCellForCSV('25000.50', true)).toBe('25000.50');
  });

  // Case 11: Regression test for balance anchors and closing variance
  it('11. proves imported opening and closing balance anchors affect closing position and variance correctly', () => {
    const bankCanonical: CanonicalTransaction[] = [
      {
        id: 'BNK-001',
        source: 'bank',
        sourceRowNumber: 1,
        date: '2026-09-02',
        rawDescription: 'Client Receipt',
        sanitizedDescription: 'Client Receipt',
        amountPaise: 5000000, // +₹50,000.00
        direction: 'credit',
        signedAmountPaise: 5000000,
        currency: 'INR',
        rawRow: {},
      },
    ];

    const ledgerCanonical: CanonicalTransaction[] = [
      {
        id: 'LDG-001',
        source: 'ledger',
        sourceRowNumber: 1,
        date: '2026-09-02',
        rawDescription: 'Client Invoice',
        sanitizedDescription: 'Client Invoice',
        amountPaise: 5000000, // +₹50,000.00
        direction: 'credit',
        signedAmountPaise: 5000000,
        currency: 'INR',
        rawRow: {},
      },
    ];

    const balances: ReconciliationOptions = {
      openingBankBalancePaise: 10000000, // ₹1,00,000.00
      closingBankBalancePaise: 15000000, // ₹1,50,000.00
      openingLedgerBalancePaise: 8000000, // ₹80,000.00
      closingLedgerBalancePaise: 13000000, // ₹1,30,000.00
      hasBankOpeningAnchor: true,
      hasLedgerOpeningAnchor: true,
      hasBankClosingAnchor: true,
      excludedBankRowCount: 2,
      excludedLedgerRowCount: 1,
    };

    const result = runReconciliation(bankCanonical, ledgerCanonical, balances);

    expect(result.summary.openingBankBalancePaise).toBe(10000000);
    expect(result.summary.closingBankBalancePaise).toBe(15000000);
    expect(result.summary.openingLedgerBalancePaise).toBe(8000000);
    expect(result.summary.closingLedgerBalancePaise).toBe(13000000);
    // Closing variance: ₹1,50,000 - ₹1,30,000 = ₹20,000 (2000000 paise)
    expect(result.summary.unresolvedVariancePaise).toBe(2000000);
    expect(result.summary.hasBankOpeningAnchor).toBe(true);
    expect(result.summary.excludedBankRowCount).toBe(2);
    expect(result.summary.excludedLedgerRowCount).toBe(1);
  });

  // Case 12: Leap year verification
  it('12. validates calendar leap days accurately', () => {
    // 2024 is a leap year (divisible by 4 and not 100)
    expect(isValidCalendarDate(2024, 2, 29)).toBe(true);
    expect(parseDeterministicDate('2024-02-29').isoDate).toBe('2024-02-29');

    // 2000 is a leap year (divisible by 400)
    expect(isValidCalendarDate(2000, 2, 29)).toBe(true);

    // 2025 is NOT a leap year
    expect(isValidCalendarDate(2025, 2, 29)).toBe(false);
    expect(parseDeterministicDate('2025-02-29').error).toContain('Calendar date does not exist');

    // 1900 is NOT a leap year (divisible by 100 but not 400)
    expect(isValidCalendarDate(1900, 2, 29)).toBe(false);
  });

  // Case 13: Auto format detection from column sample
  it('13. detects date format from column values automatically', () => {
    const dmyRows = [
      { Date: '14/09/2026' },
      { Date: '25/09/2026' },
    ];
    expect(detectFileDateFormat(dmyRows, 'Date')).toBe('DMY');

    const mdyRows = [
      { Date: '09/14/2026' },
      { Date: '09/25/2026' },
    ];
    expect(detectFileDateFormat(mdyRows, 'Date')).toBe('MDY');

    const isoRows = [
      { Date: '2026-09-14' },
      { Date: '2026-09-25' },
    ];
    expect(detectFileDateFormat(isoRows, 'Date')).toBe('YMD');
  });

  // Case 14: Bank opening detected, ledger opening missing -> ledger provenance is NOT reported as statement-verified
  it('14. bank opening detected, ledger opening missing: ledger provenance is not reported as statement-verified', () => {
    const bankCanonical: CanonicalTransaction[] = [
      {
        id: 'BNK-001',
        source: 'bank',
        sourceRowNumber: 1,
        date: '2026-09-02',
        rawDescription: 'Client Retainer',
        sanitizedDescription: 'Client Retainer',
        amountPaise: 1000000,
        direction: 'credit',
        signedAmountPaise: 1000000,
        currency: 'INR',
        rawRow: {},
      },
    ];

    const ledgerCanonical: CanonicalTransaction[] = [
      {
        id: 'LDG-001',
        source: 'ledger',
        sourceRowNumber: 1,
        date: '2026-09-02',
        rawDescription: 'Client Retainer',
        sanitizedDescription: 'Client Retainer',
        amountPaise: 1000000,
        direction: 'credit',
        signedAmountPaise: 1000000,
        currency: 'INR',
        rawRow: {},
      },
    ];

    // Bank opening anchor detected from bank CSV row, but ledger CSV has no opening balance row and user supplied none
    const balances: ReconciliationOptions = {
      openingBankBalancePaise: 45000000, // ₹4,50,000.00
      hasBankOpeningAnchor: true,
      openingLedgerBalancePaise: 45000000, // used as unverified baseline
      hasLedgerOpeningAnchor: false, // NOT statement verified
    };

    const result = runReconciliation(bankCanonical, ledgerCanonical, balances);

    expect(result.summary.hasBankOpeningAnchor).toBe(true);
    expect(result.summary.hasLedgerOpeningAnchor).toBe(false);
    expect(result.summary.openingBankBalancePaise).toBe(45000000);
    expect(result.summary.openingLedgerBalancePaise).toBe(45000000);
  });

  // Case 15: Explicit ledger opening entered -> provenance reflects reviewer-supplied value
  it('15. explicit ledger opening entered: provenance reflects reviewer-supplied value', () => {
    const bankCanonical: CanonicalTransaction[] = [];
    const ledgerCanonical: CanonicalTransaction[] = [];

    const balances: ReconciliationOptions = {
      openingBankBalancePaise: 45000000,
      hasBankOpeningAnchor: true,
      openingLedgerBalancePaise: 42000000, // Reviewer explicitly entered ₹4,20,000.00
      hasLedgerOpeningAnchor: true, // Reviewer supplied
    };

    const result = runReconciliation(bankCanonical, ledgerCanonical, balances);

    expect(result.summary.hasBankOpeningAnchor).toBe(true);
    expect(result.summary.hasLedgerOpeningAnchor).toBe(true);
    expect(result.summary.openingLedgerBalancePaise).toBe(42000000);
    expect(result.summary.openingBankBalancePaise).toBe(45000000);
  });

  // Case 16: Ledger closing anchor detected -> reconciliation uses it
  it('16. ledger closing anchor detected: reconciliation uses it as closing position', () => {
    const bankCanonical: CanonicalTransaction[] = [
      {
        id: 'BNK-001',
        source: 'bank',
        sourceRowNumber: 1,
        date: '2026-09-02',
        rawDescription: 'Vendor Pay',
        sanitizedDescription: 'Vendor Pay',
        amountPaise: 500000,
        direction: 'debit',
        signedAmountPaise: -500000,
        currency: 'INR',
        rawRow: {},
      },
    ];

    const ledgerCanonical: CanonicalTransaction[] = [
      {
        id: 'LDG-001',
        source: 'ledger',
        sourceRowNumber: 1,
        date: '2026-09-02',
        rawDescription: 'Vendor Pay',
        sanitizedDescription: 'Vendor Pay',
        amountPaise: 500000,
        direction: 'debit',
        signedAmountPaise: -500000,
        currency: 'INR',
        rawRow: {},
      },
    ];

    const balances: ReconciliationOptions = {
      openingBankBalancePaise: 50000000,
      closingBankBalancePaise: 49500000,
      hasBankOpeningAnchor: true,
      hasBankClosingAnchor: true,
      openingLedgerBalancePaise: 50000000,
      closingLedgerBalancePaise: 49000000, // Statement-detected closing ledger balance
      hasLedgerOpeningAnchor: true,
      hasLedgerClosingAnchor: true,
    };

    const result = runReconciliation(bankCanonical, ledgerCanonical, balances);

    expect(result.summary.hasLedgerClosingAnchor).toBe(true);
    expect(result.summary.closingLedgerBalancePaise).toBe(49000000);
    expect(result.summary.closingBankBalancePaise).toBe(49500000);
    // Unresolved variance = Bank closing (49500000) - Ledger closing (49000000) = +500000
    expect(result.summary.unresolvedVariancePaise).toBe(500000);
  });

  // Case 17: Ledger closing anchor absent -> derived balance is clearly identified as derived
  it('17. ledger closing anchor absent: derived balance is clearly identified as derived, not supplied', () => {
    const bankCanonical: CanonicalTransaction[] = [];
    const ledgerCanonical: CanonicalTransaction[] = [
      {
        id: 'LDG-001',
        source: 'ledger',
        sourceRowNumber: 1,
        date: '2026-09-05',
        rawDescription: 'Client Income',
        sanitizedDescription: 'Client Income',
        amountPaise: 2500000, // +₹25,000.00
        direction: 'credit',
        signedAmountPaise: 2500000,
        currency: 'INR',
        rawRow: {},
      },
      {
        id: 'LDG-002',
        source: 'ledger',
        sourceRowNumber: 2,
        date: '2026-09-10',
        rawDescription: 'Office Supplies',
        sanitizedDescription: 'Office Supplies',
        amountPaise: 500000, // -₹5,000.00
        direction: 'debit',
        signedAmountPaise: -500000,
        currency: 'INR',
        rawRow: {},
      },
    ];

    const balances: ReconciliationOptions = {
      openingBankBalancePaise: 10000000,
      openingLedgerBalancePaise: 10000000,
      hasBankOpeningAnchor: true,
      hasLedgerOpeningAnchor: false,
      // closingLedgerBalancePaise omitted -> must derive
    };

    const result = runReconciliation(bankCanonical, ledgerCanonical, balances);

    // net movement: +2500000 - 500000 = +2000000
    // derived closing ledger balance: 10000000 + 2000000 = 12000000
    expect(result.summary.hasLedgerClosingAnchor).toBe(false);
    expect(result.summary.netLedgerMovementPaise).toBe(2000000);
    expect(result.summary.closingLedgerBalancePaise).toBe(12000000);
  });

  // Case 18: Closing variance and bridge equation verification against synthetic fixtures
  it('18. verifies closing variance and two-way bridge equation against synthetic fixtures with detected vs derived balances', () => {
    const bankCanonical: CanonicalTransaction[] = [
      {
        id: 'BNK-001',
        source: 'bank',
        sourceRowNumber: 1,
        date: '2026-09-02',
        rawDescription: 'Direct Interest Credit',
        sanitizedDescription: 'Direct Interest Credit',
        amountPaise: 342000, // +₹3,420.00 (Unmatched Bank)
        direction: 'credit',
        signedAmountPaise: 342000,
        currency: 'INR',
        rawRow: {},
      },
    ];

    const ledgerCanonical: CanonicalTransaction[] = [
      {
        id: 'LDG-001',
        source: 'ledger',
        sourceRowNumber: 1,
        date: '2026-09-05',
        rawDescription: 'Vendor Cheque Issued',
        sanitizedDescription: 'Vendor Cheque Issued',
        amountPaise: 1850000, // -₹18,500.00 (Unmatched Ledger / Unpresented Cheque)
        direction: 'debit',
        signedAmountPaise: -1850000,
        currency: 'INR',
        rawRow: {},
      },
    ];

    const balances: ReconciliationOptions = {
      openingBankBalancePaise: 45000000, // ₹4,50,000.00
      closingBankBalancePaise: 45342000, // ₹4,53,420.00 (detected bank closing)
      openingLedgerBalancePaise: 45000000, // baseline
      hasBankOpeningAnchor: true,
      hasBankClosingAnchor: true,
      hasLedgerOpeningAnchor: false,
      hasLedgerClosingAnchor: false, // derived: 45000000 - 1850000 = 43150000
    };

    const result = runReconciliation(bankCanonical, ledgerCanonical, balances);

    expect(result.summary.hasBankClosingAnchor).toBe(true);
    expect(result.summary.hasLedgerClosingAnchor).toBe(false);
    expect(result.summary.closingBankBalancePaise).toBe(45342000);
    expect(result.summary.closingLedgerBalancePaise).toBe(43150000);

    // Closing variance = Bank (45342000) - Ledger (43150000) = +2192000 (+₹21,920.00)
    expect(result.summary.unresolvedVariancePaise).toBe(2192000);

    // Bridge verification
    const bridge = getReconciliationBridge(result.summary, result.exceptions);
    expect(bridge.isBalanced).toBe(true);
    expect(bridge.bridgedTotalPaise).toBe(2192000);
    expect(bridge.residualPaise).toBe(0);
    expect(bridge.formattedResidual).toBe('₹0.00');
    expect(bridge.closingBankBalancePaise - bridge.bridgedTotalPaise).toBe(bridge.closingLedgerBalancePaise);
  });
});
