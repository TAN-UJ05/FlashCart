import { describe, it, expect } from 'vitest';
import { formatCurrency, getPrimaryImageUrl, extractErrorMessage } from '../utils/format';

describe('format utilities', () => {
  it('formats INR currency properly', () => {
    expect(formatCurrency(1299)).toContain('1,299.00');
    expect(formatCurrency(0)).toContain('0.00');
    expect(formatCurrency(null)).toContain('0.00');
  });

  it('selects primary image or falls back gracefully', () => {
    expect(getPrimaryImageUrl([])).toContain('placehold.co');
    expect(
      getPrimaryImageUrl([
        { imageUrl: '/img/a.jpg', sortOrder: 2, isPrimary: false },
        { imageUrl: '/img/b.jpg', sortOrder: 1, isPrimary: true },
      ])
    ).toBe('/img/b.jpg');
  });

  it('extracts API error message cleanly', () => {
    expect(
      extractErrorMessage({ response: { data: { message: 'Out of stock' } } })
    ).toBe('Out of stock');
    expect(extractErrorMessage(new Error('Network error'))).toBe('Network error');
    expect(extractErrorMessage(null, 'Fallback')).toBe('Fallback');
  });
});
