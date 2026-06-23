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

// ── Magic byte detection for extensionless files ──────────────────────
// Detects file type from the first bytes of a binary buffer.
// Returns { ext, kind } or null if unknown.
function detectKindFromBuffer(buffer) {
  if (!buffer || buffer.length === 0) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { ext: ".png", kind: "image" };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: ".jpg", kind: "image" };
  }

  // GIF: 47 49 46 38 37|39 61
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return { ext: ".gif", kind: "gif" };
  }

  // RIFF container (WebP or WAV)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer.length >= 12
  ) {
    // WebP: bytes 8-11 = "WEBP"
    if (
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return { ext: ".webp", kind: "image" };
    }
    // WAV: bytes 8-11 = "WAVE"
    if (
      buffer[8] === 0x57 &&
      buffer[9] === 0x41 &&
      buffer[10] === 0x56 &&
      buffer[11] === 0x45
    ) {
      return { ext: ".wav", kind: "audio" };
    }
  }

  // MP4 / MOV: bytes 4-7 = "ftyp"
  if (
    buffer.length >= 8 &&
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  ) {
    return { ext: ".mp4", kind: "video" };
  }

  // WebM / MKV: EBML header
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return { ext: ".webm", kind: "video" };
  }

  // MP3 with ID3 tag
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    return { ext: ".mp3", kind: "audio" };
  }

  // MP3 without ID3 (MPEG sync)
  if (buffer[0] === 0xff && (buffer[1] === 0xfb || buffer[1] === 0xf3 || buffer[1] === 0xf2)) {
    return { ext: ".mp3", kind: "audio" };
  }

  // OGG: 4F 67 67 53
  if (buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
    return { ext: ".ogg", kind: "audio" };
  }

  return null;
}

// ── Probe file kind for extensionless files ────────────────────────────
// Reads the first bytes of a file to detect its type via magic bytes.
function probeFileKind(filePath) {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(12);
    const bytesRead = fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);
    if (bytesRead === 0) return null;
    return detectKindFromBuffer(buf.subarray(0, bytesRead));
  } catch {
    return null;
  }
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

  // ── Scanne le dossier et retourne tous les fichiers détectés ──────────
  function scanMemeFolder(folder) {
    if (!fs.existsSync(folder)) return [];
    return fs
      .readdirSync(folder)
      .map((f) => {
        const ext = path.extname(f).toLowerCase();
        if (validExts.includes(ext)) {
          return {
            name: path.parse(f).name,
            path: path.join(folder, f),
            kind: kindMap[ext] || "image",
          };
        }
        // Extensionless file — try magic byte detection
        if (!ext) {
          const detected = probeFileKind(path.join(folder, f));
          if (detected) {
            return {
              name: path.parse(f).name,
              path: path.join(folder, f),
              kind: detected.kind,
            };
          }
        }
        return null; // Unknown / unsupported type
      });
  }

  ipcMain.handle("memes:list", () => {
    const folder = memeFolder();
    const hidden = new Set(store.get("hiddenMemes") || []);
    const hiddenNames = new Set(store.get("hiddenMemeNames") || []);
    return scanMemeFolder(folder)
      .filter((m) => m !== null && !hidden.has(m.path) && !hiddenNames.has(path.basename(m.path)));
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
    return scanMemeFolder(folder)
      .filter((m) => m !== null && hidden.has(m.path));
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

module.exports = { setupMemes, deleteMemes, detectKindFromBuffer };
