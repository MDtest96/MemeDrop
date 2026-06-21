const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');

let mainWindow;
let ws;

// Connect to bot WebSocket
function connectWebSocket() {
  // Assuming default connection to the bot
  ws = new WebSocket('ws://localhost:3000');
  
  ws.on('open', () => {
    if(mainWindow) mainWindow.webContents.send('bot:status', { status: 'connected', message: 'Connecté' });
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
    } catch(e) {}
  });

  ws.on('close', () => {
    if(mainWindow) mainWindow.webContents.send('bot:status', { status: 'disconnected' });
    setTimeout(connectWebSocket, 5000);
  });
  
  ws.on('error', () => {});
}

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadURL('http://localhost:5173').catch(() => {
    mainWindow.loadFile('index.html');
  });

  connectWebSocket();
});

// Mocking the IPC Handlers so the UI loads without crashing
ipcMain.handle('memes:list', () => []);
ipcMain.handle('memes:sort', () => {});
ipcMain.handle('memes:saveFile', () => {});
ipcMain.handle('memes:openFolder', () => {});
ipcMain.handle('memes:saveClipboard', () => {});
ipcMain.handle('discord:users', () => [{username: 'fatima6848'}, {username: 'evanlegends'}]);
ipcMain.handle('drop:send', async (_e, payload) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'drop', ...payload }));
    return { ok: true };
  }
  return { ok: false, error: 'Not connected' };
});
ipcMain.handle('drop:sendUrl', async (_e, payload) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'drop_url', ...payload }));
    return { ok: true };
  }
  return { ok: false, error: 'Not connected' };
});
ipcMain.handle('tags:get', () => []);
ipcMain.handle('tags:add', () => {});
ipcMain.handle('tags:remove', () => {});
ipcMain.handle('favs:get', () => []);
ipcMain.handle('favs:toggle', () => {});
ipcMain.handle('audio:library', () => []);
ipcMain.handle('audio:soundboard', () => []);
ipcMain.handle('audio:addSoundboard', () => {});
ipcMain.handle('history:get', () => []);
ipcMain.handle('streak:get', () => null);
ipcMain.handle('groups:get', () => []);
ipcMain.handle('groups:save', () => {});
ipcMain.handle('groups:drop', () => {});
ipcMain.handle('schedule:get', () => []);
ipcMain.handle('studio:templates', () => []);
ipcMain.handle('studio:generate', () => {});
ipcMain.handle('giphy:search', () => []);
ipcMain.handle('giphy:trending', () => []);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
