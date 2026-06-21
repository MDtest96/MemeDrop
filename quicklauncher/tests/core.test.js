// tests/core.test.js — Tests for MemeDrop QuickLauncher core utilities
import { describe, it, expect } from 'vitest';

// ── MIME mapping logic (extracted from main.js pattern) ────────────────
const MIME_MAP = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp',
  mp4: 'video/mp4', webm: 'video/webm',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
};

function getMime(ext) {
  return MIME_MAP[ext] || 'application/octet-stream';
}

function classifyFile(ext) {
  if (/^(mp4|webm)$/i.test(ext)) return 'video';
  if (/^(mp3|wav|ogg|m4a|flac|aac)$/i.test(ext)) return 'audio';
  if (/^gif$/i.test(ext)) return 'gif';
  return 'image';
}

const ACCEPTED_EXT = /\.(png|jpe?g|gif|webp|mp4|webm|mp3|wav|ogg)$/i;

function isValidMemeFile(filename) {
  return ACCEPTED_EXT.test(filename);
}

// ── Cooldown logic (mirrored from bot/index.js) ────────────────────────
function cooldownRemaining(map, key, cooldownMs) {
  const now = Date.now();
  const prev = map.get(key) || 0;
  const remaining = cooldownMs - (now - prev);
  return remaining > 0 ? remaining : 0;
}

function markCooldown(map, key) {
  map.set(key, Date.now());
}

// ── Emoji extraction (mirrored from bot overlay.js) ────────────────────
const MAX_RAIN_EMOJIS = 5;
function extractEmojis(str) {
  if (!str) return null;
  const matches = String(str).match(/\p{Extended_Pictographic}/gu);
  if (!matches) return null;
  const unique = [...new Set(matches)].slice(0, MAX_RAIN_EMOJIS);
  return unique.length ? unique : null;
}

// ── Size formatting ────────────────────────────────────────────────────
function formatSize(bytes) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

// ═══════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════

describe('MIME mapping', () => {
  it('returns correct MIME for png', () => expect(getMime('png')).toBe('image/png'));
  it('returns correct MIME for mp4', () => expect(getMime('mp4')).toBe('video/mp4'));
  it('returns correct MIME for mp3', () => expect(getMime('mp3')).toBe('audio/mpeg'));
  it('falls back for unknown ext', () => expect(getMime('xyz')).toBe('application/octet-stream'));
});

describe('File classification', () => {
  it('classifies png as image', () => expect(classifyFile('png')).toBe('image'));
  it('classifies gif as gif', () => expect(classifyFile('gif')).toBe('gif'));
  it('classifies mp4 as video', () => expect(classifyFile('mp4')).toBe('video'));
  it('classifies webm as video', () => expect(classifyFile('webm')).toBe('video'));
  it('classifies mp3 as audio', () => expect(classifyFile('mp3')).toBe('audio'));
  it('classifies wav as audio', () => expect(classifyFile('wav')).toBe('audio'));
  it('classifies ogg as audio', () => expect(classifyFile('ogg')).toBe('audio'));
  it('classifies m4a as audio', () => expect(classifyFile('m4a')).toBe('audio'));
  it('classifies flac as audio', () => expect(classifyFile('flac')).toBe('audio'));
  it('classifies aac as audio', () => expect(classifyFile('aac')).toBe('audio'));
});

describe('ACCEPTED_EXT validation', () => {
  it('accepts .png', () => expect(isValidMemeFile('meme.png')).toBe(true));
  it('accepts .jpg', () => expect(isValidMemeFile('meme.jpg')).toBe(true));
  it('accepts .jpeg', () => expect(isValidMemeFile('meme.jpeg')).toBe(true));
  it('accepts .gif', () => expect(isValidMemeFile('meme.gif')).toBe(true));
  it('accepts .webp', () => expect(isValidMemeFile('meme.webp')).toBe(true));
  it('accepts .mp4', () => expect(isValidMemeFile('meme.mp4')).toBe(true));
  it('accepts .mp3', () => expect(isValidMemeFile('meme.mp3')).toBe(true));
  it('rejects .txt', () => expect(isValidMemeFile('meme.txt')).toBe(false));
  it('rejects .exe', () => expect(isValidMemeFile('virus.exe')).toBe(false));
  it('rejects no extension', () => expect(isValidMemeFile('meme')).toBe(false));
  it('is case insensitive', () => expect(isValidMemeFile('MEME.PNG')).toBe(true));
});

describe('Cooldown system', () => {
  it('returns 0 when no cooldown active', () => {
    const map = new Map();
    expect(cooldownRemaining(map, 'user1', 2000)).toBe(0);
  });

  it('returns remaining time during cooldown', () => {
    const map = new Map();
    map.set('user1', Date.now());
    const remaining = cooldownRemaining(map, 'user1', 5000);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(5000);
  });

  it('marks cooldown timestamp', () => {
    const map = new Map();
    markCooldown(map, 'user1');
    expect(map.has('user1')).toBe(true);
    expect(map.get('user1')).toBeGreaterThan(0);
  });

  it('allows independent cooldowns per user', () => {
    const map = new Map();
    markCooldown(map, 'user1');
    expect(cooldownRemaining(map, 'user2', 2000)).toBe(0);
  });
});

describe('Emoji extraction', () => {
  it('extracts emojis from string', () => {
    const result = extractEmojis('🔥💀🤣');
    expect(result).toEqual(['🔥', '💀', '🤣']);
  });

  it('returns null for empty input', () => {
    expect(extractEmojis('')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(extractEmojis(null)).toBeNull();
  });

  it('limits to MAX_RAIN_EMOJIS emojis', () => {
    const result = extractEmojis('🔥💀🤣👀😭⭐❤️🎉');
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('deduplicates emojis', () => {
    const result = extractEmojis('🔥🔥🔥💀💀');
    expect(result.length).toBe(2);
  });

  it('returns null for text without emojis', () => {
    expect(extractEmojis('hello world')).toBeNull();
  });
});

describe('Size formatting', () => {
  it('formats bytes', () => expect(formatSize(500)).toBe('500 B'));
  it('formats KB', () => expect(formatSize(2048)).toBe('2 KB'));
  it('formats MB', () => expect(formatSize(2.5 * 1024 * 1024)).toBe('2.5 MB'));
  it('formats edge case 1 byte', () => expect(formatSize(1)).toBe('1 B'));
});
