const { vi } = require('vitest');

const mockAutoUpdaterOnHandlers = {};

module.exports = {
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
