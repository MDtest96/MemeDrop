import { describe, it, expect } from 'vitest';

describe('Giphy pagination', () => {
  function hasMore(offset, limit, total) {
    // 🚩 RED: current code fails when total = 0 (trending) or null/undefined
    if (!total) return true; // trending API returns 0, null, or undefined → assume more
    return offset + limit < total;
  }

  it('should have more when total is 0 (trending API)', () => {
    expect(hasMore(0, 24, 0)).toBe(true);
    expect(hasMore(48, 24, 0)).toBe(true);
  });

  it('should have more when offset + limit < total', () => {
    expect(hasMore(0, 24, 100)).toBe(true);
    expect(hasMore(48, 24, 100)).toBe(true);
  });

  it('should NOT have more when offset + limit >= total', () => {
    expect(hasMore(96, 24, 100)).toBe(false);
    expect(hasMore(0, 24, 20)).toBe(false);
  });

  it('should handle undefined total gracefully', () => {
    expect(hasMore(0, 24, undefined)).toBe(true);
  });

  it('should handle null total gracefully', () => {
    expect(hasMore(0, 24, null)).toBe(true);
  });
});
