import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupSettings } from './settings';
const mockIpcMain = {
  handle: vi.fn(),
};
const mockApp = {
  setLoginItemSettings: vi.fn(),
  getVersion: vi.fn(() => '1.0.0'),
  isPackaged: true
};
const mockScreen = {
  getAllDisplays: vi.fn(() => [
    { id: 1, label: 'Display 1', bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    { id: 2, label: 'Display 2', bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }
  ]),
  getPrimaryDisplay: vi.fn(() => ({ id: 1 }))
};

describe('Settings Module', () => {
  let mockStore;
  let mockCallbacks;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockStore = {
      store: {},
      get: vi.fn((key) => mockStore.store[key]),
      set: vi.fn((key, value) => {
        mockStore.store[key] = value;
      })
    };

    mockCallbacks = {
      onServerChanged: vi.fn(),
      onPausedChanged: vi.fn(),
      onDisplayChanged: vi.fn(),
      onLivePatch: vi.fn()
    };
  });

  it('should register all IPC handlers', () => {
    setupSettings(mockStore, mockCallbacks, { ipcMain: mockIpcMain, app: mockApp, screen: mockScreen });
    
    expect(mockIpcMain.handle).toHaveBeenCalledWith('settings:get', expect.any(Function));
    expect(mockIpcMain.handle).toHaveBeenCalledWith('settings:set', expect.any(Function));
    expect(mockIpcMain.handle).toHaveBeenCalledWith('displays:list', expect.any(Function));
  });

  it('settings:get should return all settings from store', async () => {
    mockStore.store = {
      serverUrl: 'http://test',
      volume: 50,
      autostart: true
    };
    setupSettings(mockStore, mockCallbacks, { ipcMain: mockIpcMain, app: mockApp, screen: mockScreen });
    
    const getHandler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'settings:get')[1];
    const settings = await getHandler();
    
    expect(settings.serverUrl).toBe('http://test');
    expect(settings.volume).toBe(50);
    expect(settings.autostart).toBe(true);
  });

  it('settings:set should update store and trigger specific callbacks', async () => {
    setupSettings(mockStore, mockCallbacks, { ipcMain: mockIpcMain, app: mockApp, screen: mockScreen });
    
    const setHandler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'settings:set')[1];
    
    await setHandler(null, { serverUrl: 'http://new', volume: 80, autostart: true, paused: true, overlayDisplayId: 2 });
    
    expect(mockStore.set).toHaveBeenCalledWith('serverUrl', 'http://new');
    expect(mockStore.set).toHaveBeenCalledWith('volume', 80);
    
    // Check autostart login items
    expect(mockApp.setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: true,
      openAsHidden: true,
      args: ["--hidden"]
    });
    
    // Check callbacks
    expect(mockCallbacks.onServerChanged).toHaveBeenCalled();
    expect(mockCallbacks.onPausedChanged).toHaveBeenCalledWith(true);
    expect(mockCallbacks.onDisplayChanged).toHaveBeenCalled();
    expect(mockCallbacks.onLivePatch).toHaveBeenCalledWith({ volume: 80 });
  });

  it('displays:list should return formatted displays', async () => {
    setupSettings(mockStore, mockCallbacks, { ipcMain: mockIpcMain, app: mockApp, screen: mockScreen });
    
    const listHandler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'displays:list')[1];
    const displays = await listHandler();
    
    expect(displays).toHaveLength(2);
    expect(displays[0].primary).toBe(true);
    expect(displays[1].primary).toBe(false);
  });
});
