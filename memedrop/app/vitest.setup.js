import { vi } from 'vitest';

const mockIpcMain = {
  handle: vi.fn(),
  on: vi.fn(),
};

const mockApp = {
  setLoginItemSettings: vi.fn(),
  getVersion: vi.fn(() => '1.0.0'),
  isPackaged: true,
};

const mockScreen = {
  getAllDisplays: vi.fn(() => [
    { id: 1, label: 'Display 1', bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    { id: 2, label: 'Display 2', bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }
  ]),
  getPrimaryDisplay: vi.fn(() => ({ id: 1 }))
};

vi.mock('electron', () => {
  return {
    default: {
      ipcMain: mockIpcMain,
      app: mockApp,
      screen: mockScreen,
      clipboard: {
        readImage: vi.fn(() => ({ isEmpty: () => false, toPNG: () => Buffer.from('png') }))
      },
      shell: {
        openPath: vi.fn()
      }
    },
    ipcMain: mockIpcMain,
    app: mockApp,
    screen: mockScreen,
    clipboard: {
      readImage: vi.fn(() => ({ isEmpty: () => false, toPNG: () => Buffer.from('png') }))
    },
    shell: {
      openPath: vi.fn()
    }
  };
});

const mockAutoUpdaterOnHandlers = {};

vi.mock('electron-updater', () => {
  return {
    default: {
      autoUpdater: {
        on: vi.fn((event, handler) => {
          mockAutoUpdaterOnHandlers[event] = handler;
        }),
        checkForUpdates: vi.fn(() => Promise.resolve()),
        downloadUpdate: vi.fn(() => Promise.resolve()),
        quitAndInstall: vi.fn(),
        _trigger: (event, ...args) => {
          if (mockAutoUpdaterOnHandlers[event]) {
            mockAutoUpdaterOnHandlers[event](...args);
          }
        }
      }
    },
    autoUpdater: {
      on: vi.fn((event, handler) => {
        mockAutoUpdaterOnHandlers[event] = handler;
      }),
      checkForUpdates: vi.fn(() => Promise.resolve()),
      downloadUpdate: vi.fn(() => Promise.resolve()),
      quitAndInstall: vi.fn(),
      _trigger: (event, ...args) => {
        if (mockAutoUpdaterOnHandlers[event]) {
          mockAutoUpdaterOnHandlers[event](...args);
        }
      }
    }
  };
});
