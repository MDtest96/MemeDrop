import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupUpdater } from './updater';

const mockIpcMain = {
  handle: vi.fn(),
};
const mockApp = {
  getVersion: vi.fn(() => '1.0.0'),
  isPackaged: true
};

const mockAutoUpdaterOnHandlers = {};
const mockAutoUpdater = {
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
};

const mockDeps = {
  electron: { ipcMain: mockIpcMain, app: mockApp },
  autoUpdater: mockAutoUpdater
};

describe('Updater Module', () => {
  let mockCallbacks;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCallbacks = {
      onStateChange: vi.fn()
    };
  });

  it('should setup autoUpdater and register IPC handlers', () => {
    setupUpdater(mockCallbacks, mockDeps);
    
    expect(mockAutoUpdater.on).toHaveBeenCalledWith('checking-for-update', expect.any(Function));
    expect(mockAutoUpdater.on).toHaveBeenCalledWith('update-available', expect.any(Function));
    expect(mockAutoUpdater.on).toHaveBeenCalledWith('update-not-available', expect.any(Function));
    
    expect(mockIpcMain.handle).toHaveBeenCalledWith('app:get-version', expect.any(Function));
    expect(mockIpcMain.handle).toHaveBeenCalledWith('update:get-state', expect.any(Function));
    expect(mockIpcMain.handle).toHaveBeenCalledWith('update:check', expect.any(Function));
    expect(mockIpcMain.handle).toHaveBeenCalledWith('update:download', expect.any(Function));
    expect(mockIpcMain.handle).toHaveBeenCalledWith('update:install', expect.any(Function));
  });

  it('checkForUpdates should call autoUpdater when packaged', () => {
    const { checkForUpdates } = setupUpdater(mockCallbacks, mockDeps);
    
    checkForUpdates();
    
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalled();
  });

  it('checkForUpdates should set dev-mode state when not packaged', () => {
    mockApp.isPackaged = false;
    const { checkForUpdates } = setupUpdater(mockCallbacks, mockDeps);
    
    checkForUpdates(true); // manual check
    
    expect(mockCallbacks.onStateChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'dev-mode' }));
    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();
    mockApp.isPackaged = true; // reset
  });

  it('should update state on update-available event', () => {
    setupUpdater(mockCallbacks, mockDeps);
    
    mockAutoUpdater._trigger('update-available', { version: '1.2.3' });
    
    expect(mockCallbacks.onStateChange).toHaveBeenCalledWith(expect.objectContaining({
      status: 'available',
      version: '1.2.3'
    }));
  });

  it('update:install should call quitAndInstall if downloaded', async () => {
    setupUpdater(mockCallbacks, mockDeps);
    
    // simulate download
    mockAutoUpdater._trigger('update-downloaded', { version: '1.2.3' });
    
    const installHandler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'update:install')[1];
    await installHandler();
    
    expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalledWith(true, true);
  });
});
