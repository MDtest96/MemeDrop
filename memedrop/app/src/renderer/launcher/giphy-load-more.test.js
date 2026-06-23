// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('giphy load more button', () => {
  let grid;
  let loadMoreFn;
  let btn;

  function renderGiphyGridWithButton(items, hasMore, onLoadMore) {
    grid.innerHTML = '';
    if (items.length === 0) {
      grid.innerHTML = '<p>Aucun résultat</p>';
      return;
    }
    for (const gif of items) {
      const item = document.createElement('div');
      item.className = 'giphy-item';
      item.textContent = gif.title || 'GIF';
      grid.appendChild(item);
    }
    // Add "load more" button if there are more results
    if (hasMore) {
      const btn = document.createElement('button');
      btn.className = 'giphy-load-more';
      btn.textContent = 'Afficher plus';
      btn.addEventListener('click', onLoadMore);
      grid.appendChild(btn);
    }
  }

  beforeEach(() => {
    document.body.innerHTML = '<div id="giphy-grid"></div>';
    grid = document.getElementById('giphy-grid');
    loadMoreFn = vi.fn();
  });

  it('should show "Afficher plus" button when there are more results', () => {
    renderGiphyGridWithButton(
      [{ title: 'cat' }, { title: 'dog' }],
      true,
      loadMoreFn
    );
    const button = grid.querySelector('.giphy-load-more');
    expect(button).not.toBeNull();
    expect(button.textContent).toBe('Afficher plus');
  });

  it('should NOT show button when there are no more results', () => {
    renderGiphyGridWithButton(
      [{ title: 'cat' }],
      false,
      loadMoreFn
    );
    const button = grid.querySelector('.giphy-load-more');
    expect(button).toBeNull();
  });

  it('should call loadMoreFn when button is clicked', () => {
    renderGiphyGridWithButton(
      [{ title: 'cat' }, { title: 'dog' }],
      true,
      loadMoreFn
    );
    grid.querySelector('.giphy-load-more').click();
    expect(loadMoreFn).toHaveBeenCalled();
  });

  it('should append new items after button when loading more', () => {
    renderGiphyGridWithButton(
      [{ title: 'cat' }, { title: 'dog' }],
      true,
      () => {
        // Simulate loading more: add 2 more items before the button
        const button = grid.querySelector('.giphy-load-more');
        const items = [{ title: 'bird' }, { title: 'fish' }];
        for (const gif of items) {
          const item = document.createElement('div');
          item.className = 'giphy-item';
          item.textContent = gif.title;
          grid.insertBefore(item, button);
        }
      }
    );
    grid.querySelector('.giphy-load-more').click();

    const items = grid.querySelectorAll('.giphy-item');
    expect(items.length).toBe(4);
    expect(items[2].textContent).toBe('bird');
    expect(items[3].textContent).toBe('fish');
  });
});
