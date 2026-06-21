import { describe, it, expect } from 'vitest';
import { formatQuickDropPayload } from '../utils.js';

import fs from 'fs';
import path from 'path';

describe('formatQuickDropPayload', () => {
  it('should format a payload correctly with base64 data', async () => {
    const dummyPath = path.join(__dirname, 'dummy_meme.jpg');
    await fs.promises.writeFile(dummyPath, 'dummy data');
    
    const inputPayload = {
      target: '@evanlegends',
      filePath: dummyPath,
      caption: 'hello',
      kind: 'image'
    };

    const result = await formatQuickDropPayload(inputPayload);
    await fs.promises.unlink(dummyPath);

    expect(result.type).toBe('quick_drop');
    expect(result.target).toBe('@evanlegends');
    expect(result.media).toBeDefined();
    expect(result.media.name).toBe('dummy_meme.jpg');
    expect(result.media.kind).toBe('image');
    expect(result.media.data).toBeDefined(); // Should be base64 string
    expect(result.caption).toBe('hello');
  });

  it('should include music if audioPath is provided', async () => {
    const dummyMedia = path.join(__dirname, 'dummy_meme.jpg');
    const dummyAudio = path.join(__dirname, 'dummy_audio.mp3');
    await fs.promises.writeFile(dummyMedia, 'dummy data');
    await fs.promises.writeFile(dummyAudio, 'dummy audio data');
    
    const inputPayload = {
      target: '@evanlegends',
      filePath: dummyMedia,
      audioPath: dummyAudio,
      caption: 'hello',
      kind: 'image',
      volume: 0.8
    };

    const result = await formatQuickDropPayload(inputPayload);
    await fs.promises.unlink(dummyMedia);
    await fs.promises.unlink(dummyAudio);

    expect(result.music).toBeDefined();
    expect(result.music.name).toBe('dummy_audio.mp3');
    expect(result.music.mime).toBe('audio/mpeg');
    expect(result.music.data).toBeDefined();
    expect(result.volume).toBe(0.8);
  });
});

describe('getPreviewTarget', () => {
  it('should return the username from linkIdentity', () => {
    const mockStore = {
      get: (key) => {
        if (key === 'linkIdentity') return { username: 'testuser' };
        return null;
      }
    };
    const target = require('../utils.js').getPreviewTarget(mockStore);
    expect(target).toBe('@testuser');
  });
});
