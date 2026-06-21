// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('giphy infinite scroll - auto-load more', () => {
  let grid;

  function simulateScroll(gridEl) {
    const event = new Event('scroll');
    gridEl.dispatchEvent(event);
  }

  beforeEach(() => {
    document.body.innerHTML = '<div id="giphy-grid" class="giphy-grid" style="max-height:500px;overflow-y:auto"></div>';
    grid = document.getElementById('giphy-grid');
    // Fill grid with some items
    for (let i = 0; i < 24; i++) {
      const item = document.createElement('div');
      item.className = 'giphy-item';
      item.style.height = '30px';
      grid.appendChild(item);
    }
  });

  it('should have scrollbar when content exceeds container height', () => {
    // 24 items * 30px = 720px > 500px → should have scroll
    expect(grid.scrollHeight).toBeGreaterThan(grid.clientHeight);
  });

  it('should NOT have scrollbar when content is smaller than container', () => {
    grid.innerHTML = '';
    const small = document.createElement('div');
    small.style.height = '100px';
    grid.appendChild(small);
    // 100px < 500px → no scroll
    expect(grid.scrollHeight).toBe(grid.clientHeight);
  });

  it('should trigger scroll event when scrolled', () => {
    // Fill enough to have scroll
    grid.innerHTML = '';
    for (let i = 0; i < 100; i++) {
      const item = document.createElement('div');
      item.style.height = '30px';
      grid.appendChild(item);
    }

    const handler = vi.fn();
    grid.addEventListener('scroll', handler);
    grid.scrollTop = 100;
    simulateScroll(grid);

    expect(handler).toHaveBeenCalled();
  });
});
