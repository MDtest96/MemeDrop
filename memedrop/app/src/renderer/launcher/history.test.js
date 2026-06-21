// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('history render', () => {
  let historyList;

  function renderHistory(entries) {
      historyList.innerHTML = '';
      if (entries.length === 0) {
        historyList.innerHTML = '<p>Aucun historique</p>';
        return;
      }
      for (const entry of entries.slice(-50).reverse()) {
        const item = document.createElement('div');
        item.className = 'history-item';
        // 🚩 RED: currently only shows entry.target, NOT entry.from
        item.innerHTML = `
          <div class="history-info">
            <div class="history-target">${entry.from || entry.target || ''}</div>
            <div class="history-meme">${entry.name || entry.fileName || entry.caption || ''}</div>
          </div>
          <span class="history-time">${entry.ts ? 'récent' : ''}</span>
        `;
        historyList.appendChild(item);
      }
    }

  beforeEach(() => {
    document.body.innerHTML = '<div id="history-list"></div>';
    historyList = document.getElementById('history-list');
  });

  it('should show sender name (from) for received drops', () => {
    const entries = [
      { from: 'fatima6848', kind: 'image', ts: Date.now() },
    ];
    renderHistory(entries);
    const target = historyList.querySelector('.history-target');
    expect(target.textContent).toBe('fatima6848');
  });

  it('should show target for sent drops when from is missing', () => {
    const entries = [
      { target: '@evanlegends', name: 'cat.gif', ts: Date.now() },
    ];
    renderHistory(entries);
    const target = historyList.querySelector('.history-target');
    expect(target.textContent).toBe('@evanlegends');
  });

  it('should use caption as meme name when name/fileName missing', () => {
    const entries = [
      { from: 'alice', caption: 'hello!', ts: Date.now() },
    ];
    renderHistory(entries);
    const meme = historyList.querySelector('.history-meme');
    expect(meme.textContent).toBe('hello!');
  });
});
