import { describe, it, expect } from 'vitest';
import { sanitizeNarration, buildMinimizedExceptionPayload } from '../src/lib/privacy';
import { sanitizeCellForCSV, exportToSafeCSV, parseCSVString } from '../src/lib/csv';
import fs from 'fs';
import path from 'path';

describe('Privacy, Redaction & Security Enforcement', () => {
  it('redacts bank account numbers from narrations', () => {
    const raw = 'Salary transfer to AC 918273645102 IFSC HDFC0001234';
    const { sanitized, redactedCategories } = sanitizeNarration(raw);
    expect(sanitized).toContain('[ACCT-REDACTED]');
    expect(sanitized).not.toContain('918273645102');
    expect(redactedCategories).toContain('BankAccount');
  });

  it('redacts Indian UPI handles from narrations', () => {
    const raw = 'Payment received from merchant@oksbi and client@icici';
    const { sanitized, redactedCategories } = sanitizeNarration(raw);
    expect(sanitized).toContain('[UPI-REDACTED]');
    expect(sanitized).not.toContain('merchant@oksbi');
    expect(redactedCategories).toContain('UPI_ID');
  });

  it('redacts 10-digit Indian phone numbers with prefixes, spaces, and hyphens', () => {
    const raw1 = 'Immediate settlement to contact 9876543210';
    expect(sanitizeNarration(raw1).sanitized).toContain('[PHONE-REDACTED]');

    const raw2 = 'Call vendor on +91 98765 43210 for GST invoice';
    expect(sanitizeNarration(raw2).sanitized).toContain('[PHONE-REDACTED]');

    const raw3 = 'Support hotline: +91-98765-43210';
    expect(sanitizeNarration(raw3).sanitized).toContain('[PHONE-REDACTED]');
  });

  it('redacts Indian PAN card identifiers', () => {
    const raw = 'TDS deducted under PAN ABCDE1234F for vendor';
    const { sanitized, redactedCategories } = sanitizeNarration(raw);
    expect(sanitized).toContain('[PAN-REDACTED]');
    expect(sanitized).not.toContain('ABCDE1234F');
    expect(redactedCategories).toContain('PAN_Card');
  });

  it('redacts Indian Aadhaar card numbers with spaces', () => {
    const raw = 'Beneficiary KYC Aadhaar 1234 5678 9012 verified';
    const { sanitized, redactedCategories } = sanitizeNarration(raw);
    expect(sanitized).toContain('[AADHAAR-REDACTED]');
    expect(sanitized).not.toContain('1234 5678 9012');
    expect(redactedCategories).toContain('Aadhaar');
  });

  it('redacts bank account numbers formatted with spaces or hyphens', () => {
    const raw = 'Direct deposit to A/C 1234-5678-9012';
    const { sanitized, redactedCategories } = sanitizeNarration(raw);
    expect(sanitized).toContain('[ACCT-REDACTED]');
    expect(sanitized).not.toContain('1234-5678-9012');
    expect(redactedCategories).toContain('BankAccount');
  });

  it('normalizes fullwidth Unicode numbers and redacts them', () => {
    // Fullwidth digits "１２３４５６７８９０１２" (12 digits)
    const raw = 'Payment to １２３４５６７８９０１２';
    const { sanitized } = sanitizeNarration(raw);
    expect(sanitized).toContain('[ACCT-REDACTED]');
  });

  it('strips zero-width evasion characters before applying redactions', () => {
    // Injected zero-width space \u200B inside phone number
    const raw = 'Call +91\u200B9876543210';
    const { sanitized } = sanitizeNarration(raw);
    expect(sanitized).toContain('[PHONE-REDACTED]');
  });

  it('caps excessively long transaction descriptions to prevent prompt bloat', () => {
    const veryLong = 'Invoice details for September: ' + 'A'.repeat(300);
    const { sanitized } = sanitizeNarration(veryLong);
    expect(sanitized.length).toBeLessThanOrEqual(200);
    expect(sanitized.endsWith('...')).toBe(true);
  });

  it('neutralizes spreadsheet formula injection prefixes in exported CSV cells (CWE-1236)', () => {
    // Dangerous formula prefixes: =, +, -, @
    // Quotes inside cells are doubled according to RFC 4180 CSV specifications
    expect(sanitizeCellForCSV('=cmd|"/C calc"!A0')).toBe("\"'=cmd|\"\"/C calc\"\"!A0\"");
    expect(sanitizeCellForCSV('+SUM(A1:A10)')).toBe("\"'+SUM(A1:A10)\"");
    expect(sanitizeCellForCSV('-123 malicious text')).toBe("\"'-123 malicious text\"");
    expect(sanitizeCellForCSV('@SUM(1+1)')).toBe("\"'@SUM(1+1)\"");
  });

  it('neutralizes formula injection with leading whitespace, tabs, and pipes', () => {
    // Attackers pad formulas with spaces or tabs to evade naive prefix checks
    expect(sanitizeCellForCSV('   =SUM(1+1)')).toBe("\"'   =SUM(1+1)\"");
    expect(sanitizeCellForCSV('\t@SUM(100,200)')).toBe("\"'\t@SUM(100,200)\"");
    expect(sanitizeCellForCSV('|calc.exe')).toBe("\"'|calc.exe\"");
    expect(sanitizeCellForCSV('%windir%\\system32')).toBe("\"'%windir%\\system32\"");
  });

  it('escapes user auditor notes and explanations in exportToSafeCSV', () => {
    const records = [
      {
        id: 'EXP-001',
        note: '=cmd|"/C calc"!A0',
        description: 'Vendor payment +SUM(A1)',
        amount: '-500.00',
      },
    ];
    const csv = exportToSafeCSV(records, [
      { key: 'id', label: 'ID' },
      { key: 'note', label: 'Reviewer Note' },
      { key: 'description', label: 'Description' },
      { key: 'amount', label: 'Amount', isNumeric: true },
    ]);

    expect(csv).toContain("\"'=cmd|\"\"/C calc\"\"!A0\"");
    expect(csv).toContain("\"Vendor payment +SUM(A1)\"");
    expect(csv).toContain('-500.00'); // Preserved as numeric
  });

  it('strips UTF-8 BOM from CSV text before parsing', async () => {
    const bomCSV = '\uFEFFDate,Description,Amount\n2026-09-01,Test Entry,1000.00';
    const parsed = await parseCSVString(bomCSV);
    expect(parsed.headers[0]).toBe('Date'); // Not '\uFEFFDate'
    expect(parsed.errors.length).toBe(0);
    expect(parsed.rows.length).toBe(1);
  });

  it('gracefully rejects empty CSV inputs', async () => {
    const parsed = await parseCSVString('   \n  \n');
    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(parsed.errors[0]).toContain('CSV input is empty');
  });

  it('gracefully rejects CSV files exceeding maximum size limit (5 MB)', async () => {
    const oversizedCSV = 'Date,Description,Amount\n' + '2026-09-01,Test,10.00\n'.repeat(250000);
    const parsed = await parseCSVString(oversizedCSV);
    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(parsed.errors[0]).toContain('exceeds maximum size limit of 5 MB');
  });

  it('preserves legitimate negative and positive numbers in numeric columns', () => {
    // In a numeric column, a valid negative number like -500.00 must remain numeric for accounting
    expect(sanitizeCellForCSV('-500.00', true)).toBe('-500.00');
    expect(sanitizeCellForCSV('12500.50', true)).toBe('12500.50');
  });

  it('verifies .env.example contains only blank or safe placeholders', () => {
    const envExamplePath = path.resolve(__dirname, '../.env.example');
    expect(fs.existsSync(envExamplePath)).toBe(true);

    const envContent = fs.readFileSync(envExamplePath, 'utf-8');
    expect(envContent).toContain('NEBIUS_API_KEY=');
    // Ensure no real API key is committed
    expect(envContent).not.toMatch(/NEBIUS_API_KEY=\S{15,}/);
    expect(envContent).toContain('ALLOW_LIVE_AI=false');
  });
});
