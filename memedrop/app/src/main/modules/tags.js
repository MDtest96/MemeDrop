const { ipcMain } = require("electron");

function setupTags(store) {
  ipcMain.handle('tags:get', () => []);
  ipcMain.handle('tags:add', () => {});
  ipcMain.handle('tags:remove', () => {});
  ipcMain.handle('tags:listAll', () => []);
  ipcMain.handle('tags:set', () => {});
}

module.exports = { setupTags };
