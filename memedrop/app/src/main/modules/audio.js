const { ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

function setupAudio(store) {
  ipcMain.handle('audio:library', () => {
    const memeFolder = path.join(__dirname, '..', 'memes');
    if (!fs.existsSync(memeFolder)) return [];
    const files = fs.readdirSync(memeFolder);
    const validExts = ['.mp3', '.wav', '.ogg'];
    return files.filter(f => validExts.includes(path.extname(f).toLowerCase())).map(f => ({
      name: path.parse(f).name,
      path: path.join(memeFolder, f),
      kind: 'audio'
    }));
  });

  ipcMain.handle('audio:soundboard', () => []);
  ipcMain.handle('audio:addSoundboard', () => {});
  ipcMain.handle('audio:setPairing', () => {});
  ipcMain.handle('audio:getPairings', () => ({}));
}

module.exports = { setupAudio };
