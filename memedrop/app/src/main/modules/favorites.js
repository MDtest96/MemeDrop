const { ipcMain } = require("electron");

function setupFavorites(store) {
  ipcMain.handle('favs:get', () => []);
  ipcMain.handle('favs:toggle', () => {});
}

module.exports = { setupFavorites };
