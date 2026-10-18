import { describe, it, expect } from 'vitest';
import { sanitizeNarration, buildMinimizedExceptionPayload } from '../src/lib/privacy';
import { sanitizeCellForCSV, exportToSafeCSV } from '../src/lib/csv';
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

  it('redacts 10-digit Indian phone numbers', () => {
    const raw = 'Immediate settlement to contact 9876543210';
    const { sanitized, redactedCategories } = sanitizeNarration(raw);
    expect(sanitized).toContain('[PHONE-REDACTED]');
    expect(sanitized).not.toContain('9876543210');
    expect(redactedCategories).toContain('PhoneNumber');
  });

  it('neutralizes spreadsheet formula injection prefixes in exported CSV cells (CWE-1236)', () => {
    // Dangerous formula prefixes: =, +, -, @
    // Quotes inside cells are doubled according to RFC 4180 CSV specifications
    expect(sanitizeCellForCSV('=cmd|"/C calc"!A0')).toBe("\"'=cmd|\"\"/C calc\"\"!A0\"");
    expect(sanitizeCellForCSV('+SUM(A1:A10)')).toBe("\"'+SUM(A1:A10)\"");
    expect(sanitizeCellForCSV('-123 malicious text')).toBe("\"'-123 malicious text\"");
    expect(sanitizeCellForCSV('@SUM(1+1)')).toBe("\"'@SUM(1+1)\"");
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
