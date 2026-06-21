const { ipcMain, shell, clipboard, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { buildCollage, resolveMediaUrl } = require("../utils");

/**
 * Delete one or more meme files from disk and notify all windows.
 * @param {string[]} paths - File paths to delete
 * @param {object} [fileSystem=fs] - File system module (for DI in tests)
 * @param {object} [winRef=BrowserWindow] - BrowserWindow reference (for DI in tests)
 * @returns {Promise<Array<{path: string, ok: boolean, error?: string}>>}
 */
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
  // Notify all windows that the library changed
  for (const w of _BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send("library:changed");
  }
  return results;
}

function setupMemes() {
  ipcMain.handle("memes:delete", async (_e, paths) => {
    return await deleteMemes(paths, fs, BrowserWindow);
  });
  ipcMain.handle("memes:list", () => {
    const memeFolder = path.join(__dirname, "..", "memes"); // __dirname is src/main/modules
    if (!fs.existsSync(memeFolder)) return [];
    const files = fs.readdirSync(memeFolder);
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
    return files
      .filter((f) => validExts.includes(path.extname(f).toLowerCase()))
      .map((f) => {
        const ext = path.extname(f).toLowerCase();
        return {
          name: path.parse(f).name,
          path: path.join(memeFolder, f),
          kind: [".mp4", ".webm"].includes(ext)
            ? "video"
            : [".mp3", ".wav", ".ogg"].includes(ext)
              ? "audio"
              : ext === ".gif"
                ? "gif"
                : "image",
        };
      });
  });

  ipcMain.handle("memes:sort", () => {});

  ipcMain.handle("memes:saveFile", async (_e, sourcePath) => {
    const memeFolder = path.join(__dirname, "..", "memes");
    if (!fs.existsSync(memeFolder))
      fs.mkdirSync(memeFolder, { recursive: true });

    const ext = path.extname(sourcePath).toLowerCase();
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
    if (!validExts.includes(ext)) return null;

    const baseName = path.parse(sourcePath).name;
    const newName = `${baseName}_${Date.now()}${ext}`;
    const destPath = path.join(memeFolder, newName);

    fs.copyFileSync(sourcePath, destPath);

    return {
      name: path.parse(newName).name,
      path: destPath,
      kind: [".mp4", ".webm"].includes(ext)
        ? "video"
        : [".mp3", ".wav", ".ogg"].includes(ext)
          ? "audio"
          : ext === ".gif"
            ? "gif"
            : "image",
    };
  });

  ipcMain.handle("memes:saveBuffer", async (_e, { name, buffer, type }) => {
    const memeFolder = path.join(__dirname, "..", "memes");
    if (!fs.existsSync(memeFolder))
      fs.mkdirSync(memeFolder, { recursive: true });

    let ext = path.extname(name).toLowerCase();
    if (!ext && type) {
      if (type.includes("image/png")) ext = ".png";
      else if (type.includes("image/jpeg")) ext = ".jpg";
      else if (type.includes("image/gif")) ext = ".gif";
      else if (type.includes("image/webp")) ext = ".webp";
      else if (type.includes("video/mp4")) ext = ".mp4";
      else if (type.includes("video/webm")) ext = ".webm";
      else if (type.includes("audio/mpeg") || type.includes("audio/mp3"))
        ext = ".mp3";
      else if (type.includes("audio/wav")) ext = ".wav";
      else if (type.includes("audio/ogg")) ext = ".ogg";
    }
    if (!ext) ext = ".png";

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
    if (!validExts.includes(ext)) return null;

    const baseName = path.parse(name || "pasted").name;
    const newName = `${baseName}_${Date.now()}${ext}`;
    const destPath = path.join(memeFolder, newName);

    fs.writeFileSync(destPath, Buffer.from(buffer));

    return {
      name: path.parse(newName).name,
      path: destPath,
      kind: [".mp4", ".webm"].includes(ext)
        ? "video"
        : [".mp3", ".wav", ".ogg"].includes(ext)
          ? "audio"
          : ext === ".gif"
            ? "gif"
            : "image",
    };
  });

  ipcMain.handle("memes:preview", (e, p) => `file:///${p.replace(/\\/g, "/")}`);

  ipcMain.handle("memes:openFolder", () => {
    const memeFolder = path.join(__dirname, "..", "memes");
    if (!fs.existsSync(memeFolder))
      fs.mkdirSync(memeFolder, { recursive: true });
    shell.openPath(memeFolder);
  });

  ipcMain.handle("memes:saveClipboard", async () => {
    const image = clipboard.readImage();
    if (image.isEmpty()) return null;

    const memeFolder = path.join(__dirname, "..", "memes");
    if (!fs.existsSync(memeFolder))
      fs.mkdirSync(memeFolder, { recursive: true });

    const newName = `clipboard_${Date.now()}.png`;
    const destPath = path.join(memeFolder, newName);

    fs.writeFileSync(destPath, image.toPNG());

    return {
      name: path.parse(newName).name,
      path: destPath,
      kind: "image",
    };
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
