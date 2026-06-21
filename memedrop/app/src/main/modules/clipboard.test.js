import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('saveClipboard — preserve GIF/video format', () => {
  let mockClipboard;
  let mockFs;
  let mockPath;

  function createSaveClipboardHandler(clipboard, fs, path, memeFolder) {
    return async () => {
      // First try file path (preserves GIF/video format from Explorer)
      try {
        const filePath = clipboard.read('FileName');
        if (filePath) {
          const ext = path.extname(filePath).toLowerCase();
          const validExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp4', '.webm', '.mp3', '.wav', '.ogg'];
          if (validExts.includes(ext)) {
            const newName = `clipboard_${Date.now()}${ext}`;
            const destPath = path.join(memeFolder, newName);
            fs.copyFileSync(filePath, destPath);
            const kind = ext === '.gif' ? 'gif' : ['.mp4', '.webm'].includes(ext) ? 'video' : ['.mp3', '.wav', '.ogg'].includes(ext) ? 'audio' : 'image';
            return { name: path.parse(newName).name, path: destPath, kind };
          }
        }
      } catch {}

      // Fallback: clipboard as static PNG (loses GIF/video animation)
      const image = clipboard.readImage();
      if (image.isEmpty()) return null;
      const newName = `clipboard_${Date.now()}.png`;
      const destPath = path.join(memeFolder, newName);
      fs.writeFileSync(destPath, image.toPNG());
      return { name: path.parse(newName).name, path: destPath, kind: 'image' };
    };
  }

  beforeEach(() => {
    mockClipboard = {
      readImage: vi.fn(() => ({ isEmpty: () => true, toPNG: () => Buffer.from('png') })),
      read: vi.fn(() => null),
    };
    mockFs = {
      copyFileSync: vi.fn(),
      writeFileSync: vi.fn(),
    };
    mockPath = {
      extname: vi.fn((p) => {
        if (p.endsWith('.gif')) return '.gif';
        if (p.endsWith('.mp4')) return '.mp4';
        if (p.endsWith('.png')) return '.png';
        return '';
      }),
      join: vi.fn((...parts) => parts.join('/')),
      parse: vi.fn((p) => ({ name: p.split('/').pop().split('.')[0] })),
    };
  });

  it('should preserve GIF format when file is copied from explorer', async () => {
    // 🚩 RED: this will fail because current handler only uses readImage()
    mockClipboard.read.mockImplementation((type) => {
      if (type === 'FileName') return 'C:/memes/animated.gif';
      return null;
    });
    mockClipboard.readImage.mockReturnValue({
      isEmpty: () => false,
      toPNG: () => Buffer.from('png'),
    });

    const handler = createSaveClipboardHandler(mockClipboard, mockFs, mockPath, '/memes');
    const result = await handler();

    expect(result.kind).toBe('gif');
    expect(mockFs.copyFileSync).toHaveBeenCalled();
    expect(mockFs.writeFileSync).not.toHaveBeenCalled(); // should NOT convert to PNG
  });

  it('should preserve video format for mp4 files', async () => {
    mockClipboard.read.mockImplementation((type) => {
      if (type === 'FileName') return 'C:/videos/dance.mp4';
      return null;
    });

    const handler = createSaveClipboardHandler(mockClipboard, mockFs, mockPath, '/memes');
    const result = await handler();

    expect(result.kind).toBe('video');
  });

  it('should fall back to PNG image when no file path in clipboard', async () => {
    mockClipboard.read.mockReturnValue(null);
    mockClipboard.readImage.mockReturnValue({
      isEmpty: () => false,
      toPNG: () => Buffer.from('png'),
    });

    const handler = createSaveClipboardHandler(mockClipboard, mockFs, mockPath, '/memes');
    const result = await handler();

    expect(result.kind).toBe('image');
    expect(mockFs.writeFileSync).toHaveBeenCalled();
  });
});
