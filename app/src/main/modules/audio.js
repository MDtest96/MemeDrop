const { ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { getMemeFolder } = require("../utils");

function setupAudio(store, app) {
  ipcMain.handle("audio:library", () => {
    const folder = getMemeFolder(store, app);
    if (!fs.existsSync(folder)) return [];
    const files = fs.readdirSync(folder);
    const validExts = [".mp3", ".wav", ".ogg"];
    return files
      .filter((f) => validExts.includes(path.extname(f).toLowerCase()))
      .map((f) => ({
        name: path.parse(f).name,
        path: path.join(folder, f),
        kind: "audio",
      }));
  });

  ipcMain.handle("audio:soundboard", () => store.get("soundboardEntries") || []);
  ipcMain.handle("audio:addSoundboard", (_e, entry) => {
    const list = store.get("soundboardEntries") || [];
    if (!list.some((a) => a.path === entry.path)) {
      list.push(entry);
      store.set("soundboardEntries", list);
    }
  });
  ipcMain.handle("audio:removeSoundboard", (_e, path) => {
    const list = store.get("soundboardEntries") || [];
    store.set("soundboardEntries", list.filter((a) => a.path !== path));
  });
  ipcMain.handle("audio:setPairing", (_e, memePath, audioPath) => {
    const pairings = store.get("audioPairings") || {};
    pairings[memePath] = audioPath;
    store.set("audioPairings", pairings);
  });
  ipcMain.handle("audio:getPairings", () => store.get("audioPairings") || {});
}

module.exports = { setupAudio };
