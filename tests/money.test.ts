import { describe, it, expect } from 'vitest';
import { 
  parseToPaise, 
  formatPaise, 
  sumPaise, 
  validateSameCurrency 
} from '../src/lib/money';

describe('Monetary Arithmetic Engine (Decimal-Safe Integer Paise)', () => {
  it('parses standard Indian Rupee notation into exact integer paise', () => {
    expect(parseToPaise('₹12,450.50')).toBe(1245050);
    expect(parseToPaise('₹0.50')).toBe(50);
    expect(parseToPaise('₹1,00,000.00')).toBe(10000000);
  });

  it('correctly handles negative debits and accounting parentheses', () => {
    expect(parseToPaise('-₹1,200.00')).toBe(-120000);
    expect(parseToPaise('(250.00)')).toBe(-25000);
    expect(parseToPaise('450.75 Dr')).toBe(-45075);
    expect(parseToPaise('1500.00 Cr')).toBe(150000);
  });

  it('parses raw numbers without IEEE-754 binary floating-point drift', () => {
    // In standard float math: 0.1 + 0.2 = 0.30000000000000004
    const a = parseToPaise(0.1);
    const b = parseToPaise(0.2);
    expect(a + b).toBe(30); // 30 paise = exactly 0.30 INR
  });

  it('rejects invalid monetary strings with multiple decimals', () => {
    expect(() => parseToPaise('12.34.56')).toThrow('Invalid monetary format with multiple decimal');
  });

  it('rejects malformed strings with invalid characters (Codex finding regression: "12x3.456")', () => {
    expect(() => parseToPaise('12x3.456')).toThrow('Malformed monetary amount');
    expect(() => parseToPaise('₹100abc')).toThrow('Malformed monetary amount');
    expect(() => parseToPaise('123#45')).toThrow('Malformed monetary amount');
  });

  it('rejects unsupported precision beyond 2 decimal places for INR', () => {
    expect(() => parseToPaise('12.345')).toThrow('Unsupported monetary precision');
    expect(() => parseToPaise('₹100.456')).toThrow('Unsupported monetary precision');
    expect(() => parseToPaise('0.001')).toThrow('Unsupported monetary precision');
  });

  it('rejects malformed comma grouping in integer numbers', () => {
    expect(() => parseToPaise('1,2,34.00')).toThrow('Malformed number grouping');
    expect(() => parseToPaise(',100.00')).toThrow('Malformed number grouping');
    expect(() => parseToPaise('100,00.00')).toThrow('Malformed number grouping');
  });

  it('parses valid Indian and international comma groupings correctly', () => {
    expect(parseToPaise('₹1,25,000.50')).toBe(12500050); // Indian format: 1,25,000
    expect(parseToPaise('₹12,34,567.80')).toBe(123456780);
    expect(parseToPaise('125,000.50')).toBe(12500050); // Western format: 125,000
    expect(parseToPaise('1,000,000.00')).toBe(100000000);
  });

  it('rejects numbers that exceed safe integer limits', () => {
    expect(() => parseToPaise('9999999999999999.00')).toThrow('exceeds safe integer limit');
  });

  it('enforces safe integer boundary during summation', () => {
    expect(() => sumPaise([Number.MAX_SAFE_INTEGER, 100])).toThrow('exceeded safe integer limit');
  });

  it('formats integer paise into clean Indian currency strings', () => {
    expect(formatPaise(1245050)).toBe('₹12,450.50');
    expect(formatPaise(-50000)).toBe('-₹500.00');
    expect(formatPaise(7500000)).toBe('₹75,000.00');
    expect(formatPaise(25000, { showSign: true })).toBe('+₹250.00');
  });

  it('accurately computes sum of paise array', () => {
    const list = [1245050, 6500000, 1840000];
    expect(sumPaise(list)).toBe(9585050);
  });

  it('rejects mixed currencies without verified exchange rates', () => {
    expect(() => validateSameCurrency('INR', 'USD')).toThrow('Cross-currency reconciliation blocked');
    expect(() => validateSameCurrency('INR', 'INR')).not.toThrow();
  });
});
