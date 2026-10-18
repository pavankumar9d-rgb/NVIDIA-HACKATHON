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
    expect(() => parseToPaise('12.34.56')).toThrow('Invalid monetary format');
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
