import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildCollage } from '../utils.js';
import path from 'path';
import fs from 'fs';

// __dirname equivalent in ESM on Windows
const __dirname = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');

// Import Jimp to generate valid test images
import { Jimp } from 'jimp';

const TEST_FILES = [1, 2, 3, 4, 5].map(i => path.join(__dirname, `__collage_test_${i}.jpg`));
const COLORS = [0xff0000ff, 0x00ff00ff, 0x0000ffff, 0xffff00ff, 0xff00ffff];

beforeAll(async () => {
  // Create 5 valid 100x100 JPEG test images using Jimp
  await Promise.all(TEST_FILES.map(async (f, i) => {
    const img = new Jimp({ width: 100, height: 100, color: COLORS[i] });
    const buffer = await img.getBuffer('image/jpeg');
    fs.writeFileSync(f, buffer);
  }));
});

afterAll(() => {
  TEST_FILES.forEach(f => { try { fs.unlinkSync(f); } catch {} });
});

describe('buildCollage', () => {
  it('retourne null si tableau vide', async () => {
    const result = await buildCollage([]);
    expect(result).toBeNull();
  });

  it('retourne null si 1 seule image', async () => {
    const result = await buildCollage([TEST_FILES[0]]);
    expect(result).toBeNull();
  });

  it('retourne un collage valide pour 2 images', async () => {
    const result = await buildCollage([TEST_FILES[0], TEST_FILES[1]]);
    expect(result).not.toBeNull();
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(result.base64).toBeTruthy();
    expect(result.mime).toBe('image/jpeg');
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.count).toBe(2);
    expect(result.layout).toBe('2x1');
  });

  it('retourne layout 2x2 pour 4 images', async () => {
    const result = await buildCollage([TEST_FILES[0], TEST_FILES[1], TEST_FILES[2], TEST_FILES[3]]);
    expect(result).not.toBeNull();
    expect(result.layout).toBe('2x2');
    expect(result.count).toBe(4);
  });

  it('cap à 4 images si plus de 4 fournies', async () => {
    const result = await buildCollage(TEST_FILES); // 5 images
    expect(result).not.toBeNull();
    expect(result.count).toBe(4);
  });

  it('ignore les chemins de fichiers invalides', async () => {
    // 1 bon + 1 mauvais = 1 valide total → null
    const result = await buildCollage([TEST_FILES[0], '/chemin/inexistant/image.jpg']);
    expect(result).toBeNull();
  });

  it('retourne layout 2x2 pour 3 images (cellule vide en bas droite)', async () => {
    const result = await buildCollage([TEST_FILES[0], TEST_FILES[1], TEST_FILES[2]]);
    expect(result).not.toBeNull();
    expect(result.layout).toBe('2x2');
    expect(result.count).toBe(3);
  });
});
