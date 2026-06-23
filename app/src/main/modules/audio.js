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

  // ── Obtenir la durée approximative d'un fichier audio ───────────────
  ipcMain.handle("audio:getDuration", async (_e, filePath) => {
    try {
      const stat = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const size = stat.size;
      // Estimation basée sur la taille et le format
      let durationSec = 0;
      if (ext === ".mp3") {
        // bitrate typique MP3: 128-320 kbps, moyenne ~192
        durationSec = size / (192 * 125);
      } else if (ext === ".wav") {
        // WAV 16-bit 44100Hz stéréo: ~176 KB/s
        durationSec = size / (176 * 1024);
      } else if (ext === ".ogg") {
        // OGG typique: ~160 kbps
        durationSec = size / (160 * 125);
      } else {
        durationSec = size / (192 * 125);
      }
      const mins = Math.floor(durationSec / 60);
      const secs = Math.floor(durationSec % 60);
      const label = mins > 0 ? mins + "m" + secs.toString().padStart(2, "0") : secs + "s";
      return { duration: Math.round(durationSec), label };
    } catch {
      return { duration: 0, label: "?" };
    }
  });
}

module.exports = { setupAudio };
