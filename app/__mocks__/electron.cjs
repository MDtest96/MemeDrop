const { vi } = require('vitest');

module.exports = {
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
  app: {
    setLoginItemSettings: vi.fn(),
    getVersion: vi.fn(() => '1.0.0'),
    isPackaged: true,
  },
  screen: {
    getAllDisplays: vi.fn(() => [
      { id: 1, label: 'Display 1', bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
      { id: 2, label: 'Display 2', bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }
    ]),
    getPrimaryDisplay: vi.fn(() => ({ id: 1 }))
  },
  clipboard: {
    readImage: vi.fn(() => ({ isEmpty: () => false, toPNG: () => Buffer.from('png') }))
  },
  shell: {
    openPath: vi.fn()
  }
};
