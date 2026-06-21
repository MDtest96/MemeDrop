import { describe, it, expect } from 'vitest';

describe('Giphy createGiphyItem - empty URL handling', () => {
  function createGiphyItemSafe(gif) {
    const gifUrl = gif?.images?.fixed_height?.url || gif?.images?.original?.url || '';
    // 🚩 RED: When gifUrl is empty string, fetchAsDataUrl will try to fetch('')
    // which causes a network error that could crash or hang
    if (!gifUrl) return null;
    return { url: gifUrl };
  }

  it('should return null when gif has no images', () => {
    const result = createGiphyItemSafe({ title: 'test' });
    expect(result).toBeNull();
  });

  it('should return null when images object is empty', () => {
    const result = createGiphyItemSafe({ images: {} });
    expect(result).toBeNull();
  });

  it('should return url when fixed_height is available', () => {
    const gif = { images: { fixed_height: { url: 'https://giphy.com/test.gif' } } };
    const result = createGiphyItemSafe(gif);
    expect(result.url).toBe('https://giphy.com/test.gif');
  });

  it('should fallback to original when fixed_height is missing', () => {
    const gif = { images: { original: { url: 'https://giphy.com/original.gif' } } };
    const result = createGiphyItemSafe(gif);
    expect(result.url).toBe('https://giphy.com/original.gif');
  });

  it('should handle null gif gracefully', () => {
    const result = createGiphyItemSafe(null);
    expect(result).toBeNull();
  });
});
