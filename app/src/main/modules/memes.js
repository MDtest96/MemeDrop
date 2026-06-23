const { ipcMain, shell, clipboard, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { buildCollage, resolveMediaUrl, getMemeFolder } = require("../utils");

async function deleteMemes(paths, fileSystem, winRef) {
  const _fs = fileSystem || fs;
  const _BrowserWindow = winRef || BrowserWindow;
  if (!Array.isArray(paths)) paths = [paths];
  const results = [];
  for (const filePath of paths) {
    try {
      if (_fs.existsSync(filePath)) {
        _fs.unlinkSync(filePath);
      }
      results.push({ path: filePath, ok: true });
    } catch (err) {
      results.push({ path: filePath, ok: false, error: err.message });
    }
  }
  for (const w of _BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send("library:changed");
  }
  return results;
}

function setupMemes(store, app) {
  const memeFolder = () => getMemeFolder(store, app);
  const validExts = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".mp4",
    ".webm",
    ".mp3",
    ".wav",
    ".ogg",
  ];
  const kindMap = {};
  for (const e of [".mp4", ".webm"]) kindMap[e] = "video";
  for (const e of [".mp3", ".wav", ".ogg"]) kindMap[e] = "audio";
  kindMap[".gif"] = "gif";

  // ── Soft-delete: cache un meme pour l'utilisateur courant ──────────────
  ipcMain.handle("memes:delete", async (_e, paths) => {
    if (!Array.isArray(paths)) paths = [paths];
    const hidden = new Set(store.get("hiddenMemes") || []);
    const hiddenNames = new Set(store.get("hiddenMemeNames") || []);
    const results = [];
    for (const filePath of paths) {
      hidden.add(filePath);
      hiddenNames.add(path.basename(filePath));
      results.push({ path: filePath, ok: true });
    }
    store.set("hiddenMemes", Array.from(hidden));
    store.set("hiddenMemeNames", Array.from(hiddenNames));
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) w.webContents.send("library:changed");
    }
    return results;
  });

  ipcMain.handle("memes:list", () => {
    const folder = memeFolder();
    if (!fs.existsSync(folder)) return [];
    const hidden = new Set(store.get("hiddenMemes") || []);
    const hiddenNames = new Set(store.get("hiddenMemeNames") || []);
    return fs
      .readdirSync(folder)
      .filter((f) => validExts.includes(path.extname(f).toLowerCase()))
      .map((f) => ({
        name: path.parse(f).name,
        path: path.join(folder, f),
        kind: kindMap[path.extname(f).toLowerCase()] || "image",
      }))
      .filter((m) => !hidden.has(m.path) && !hiddenNames.has(path.basename(m.path)));
  });

  // ── Restaure un meme caché ──────────────────────────────────────────────
  ipcMain.handle("memes:restore", async (_e, filePath) => {
    const hidden = new Set(store.get("hiddenMemes") || []);
    hidden.delete(filePath);
    store.set("hiddenMemes", Array.from(hidden));
    // Nettoyer aussi le nom correspondant dans hiddenMemeNames
    const hiddenNames = new Set(store.get("hiddenMemeNames") || []);
    hiddenNames.delete(path.basename(filePath));
    store.set("hiddenMemeNames", Array.from(hiddenNames));
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) w.webContents.send("library:changed");
    }
    return { ok: true };
  });

  // ── Liste les memes cachés avec leurs métadonnées ───────────────────────
  ipcMain.handle("memes:listHidden", () => {
    const folder = memeFolder();
    const hidden = new Set(store.get("hiddenMemes") || []);
    if (!fs.existsSync(folder)) return [];
    return fs
      .readdirSync(folder)
      .filter((f) => validExts.includes(path.extname(f).toLowerCase()))
      .map((f) => ({
        name: path.parse(f).name,
        path: path.join(folder, f),
        kind: kindMap[path.extname(f).toLowerCase()] || "image",
      }))
      .filter((m) => hidden.has(m.path));
  });

  ipcMain.handle("memes:sort", () => {});

  ipcMain.handle("memes:saveFile", async (_e, sourcePath) => {
    const folder = memeFolder();
    const ext = path.extname(sourcePath).toLowerCase();
    if (!validExts.includes(ext)) return null;
    const baseName = path.parse(sourcePath).name;
    const newName = `${baseName}_${Date.now()}${ext}`;
    const destPath = path.join(folder, newName);
    fs.copyFileSync(sourcePath, destPath);
    return {
      name: path.parse(newName).name,
      path: destPath,
      kind: kindMap[ext] || "image",
    };
  });

  ipcMain.handle("memes:saveBuffer", async (_e, { name, buffer, type }) => {
    const folder = memeFolder();
    let ext = path.extname(name).toLowerCase();
    if (!ext && type) {
      const mimeMap = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "video/mp4": ".mp4",
        "video/webm": ".webm",
        "audio/mpeg": ".mp3",
        "audio/mp3": ".mp3",
        "audio/wav": ".wav",
        "audio/ogg": ".ogg",
      };
      ext = mimeMap[type] || ".png";
    }
    if (!ext) ext = ".png";
    if (!validExts.includes(ext)) return null;
    const baseName = path.parse(name || "pasted").name;
    const newName = `${baseName}_${Date.now()}${ext}`;
    const destPath = path.join(folder, newName);
    fs.writeFileSync(destPath, Buffer.from(buffer));
    return {
      name: path.parse(newName).name,
      path: destPath,
      kind: kindMap[ext] || "image",
    };
  });

  ipcMain.handle("memes:preview", (e, p) => `file:///${encodeURI(p.replace(/\\/g, "/"))}`);

  ipcMain.handle("memes:openFolder", () => {
    const folder = memeFolder();
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    shell.openPath(folder);
  });

  ipcMain.handle("memes:saveClipboard", async () => {
    // First try file path (preserves GIF/video format from Explorer)
    try {
      const filePath = clipboard.read("FileName");
      if (filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const validExts = [
          ".png",
          ".jpg",
          ".jpeg",
          ".gif",
          ".webp",
          ".mp4",
          ".webm",
          ".mp3",
          ".wav",
          ".ogg",
        ];
        if (validExts.includes(ext)) {
          const folder = memeFolder();
          const newName = `clipboard_${Date.now()}${ext}`;
          const destPath = path.join(folder, newName);
          fs.copyFileSync(filePath, destPath);
          const kind =
            ext === ".gif"
              ? "gif"
              : [".mp4", ".webm"].includes(ext)
                ? "video"
                : [".mp3", ".wav", ".ogg"].includes(ext)
                  ? "audio"
                  : "image";
          return { name: path.parse(newName).name, path: destPath, kind };
        }
      }
    } catch {}

    // Fallback: clipboard as static PNG (loses GIF/video animation)
    const image = clipboard.readImage();
    if (image.isEmpty()) return null;
    const folder = memeFolder();
    const newName = `clipboard_${Date.now()}.png`;
    const destPath = path.join(folder, newName);
    fs.writeFileSync(destPath, image.toPNG());
    return { name: path.parse(newName).name, path: destPath, kind: "image" };
  });

  ipcMain.handle("memes:rename", async (_e, oldPath, newName) => {
    try {
      const folder = path.dirname(oldPath);
      const ext = path.extname(oldPath);
      const newPath = path.join(folder, newName + ext);
      fs.renameSync(oldPath, newPath);
      return { ok: true, path: newPath, name: newName };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle("collage:build", async (_e, filePaths) => {
    try {
      const result = await buildCollage(filePaths);
      if (!result)
        return { ok: false, error: "Pas assez d'images valides (minimum 2)" };
      return { ok: true, ...result };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle("url:resolve", async (_e, url) => {
    try {
      return await resolveMediaUrl(url);
    } catch (e) {
      return { url, kind: "image", mime: "image/jpeg", unresolved: true };
    }
  });
}

module.exports = { setupMemes, deleteMemes };
