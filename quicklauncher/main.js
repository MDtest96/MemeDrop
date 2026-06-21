const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

// Isolate cache and user data to prevent conflicts with other Electron apps
app.name = "memedrop-quicklauncher";
app.setPath(
  "userData",
  path.join(app.getPath("appData"), "memedrop-quicklauncher"),
);

const fs = require("fs");
const WebSocket = require("ws");
const { shell } = require("electron");
const Store = require("electron-store");
const {
  formatQuickDropPayload,
  getPreviewTarget,
  buildCollage,
  resolveMediaUrl,
} = require("./utils");

const store = new Store({
  cwd: path.join(app.getPath("appData"), "memedrop-overlay"),
});

let mainWindow;
let ws;

// Connect to bot WebSocket
function connectWebSocket() {
  const url = store.get("serverUrl") || "ws://localhost:8765";
  ws = new WebSocket(url);

  ws.on("open", () => {
    if (mainWindow)
      mainWindow.webContents.send("bot:status", {
        status: "connected",
        message: "Connecté",
      });

    // Authenticate the QuickLauncher so the bot accepts quick_drop commands
    const identity = store.get("linkIdentity");
    if (identity && identity.userId) {
      try {
        ws.send(JSON.stringify({ type: "register", identity }));
      } catch (e) {
        console.error("Failed to register on ws open:", e);
      }
    }
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);
    } catch (e) {}
  });

  ws.on("close", () => {
    if (mainWindow)
      mainWindow.webContents.send("bot:status", { status: "disconnected" });
    setTimeout(connectWebSocket, 5000);
  });

  ws.on("error", () => {});
}

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, "../overlay/assets/icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  mainWindow.loadFile("index.html");

  connectWebSocket();
});

// Mocking the IPC Handlers so the UI loads without crashing
ipcMain.handle("memes:list", () => {
  const memeFolder = path.join(__dirname, "memes");
  if (!fs.existsSync(memeFolder)) return [];
  const files = fs.readdirSync(memeFolder);
  const validExts = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".mp4", ".webm"];
  return files
    .filter((f) => validExts.includes(path.extname(f).toLowerCase()))
    .map((f) => ({
      name: path.parse(f).name,
      path: path.join(memeFolder, f),
      kind: [".mp4", ".webm"].includes(path.extname(f).toLowerCase())
        ? "video"
        : path.extname(f).toLowerCase() === ".gif"
          ? "gif"
          : "image",
    }));
});
ipcMain.handle("memes:sort", () => {});
ipcMain.handle("memes:saveFile", async (_e, sourcePath) => {
  const memeFolder = path.join(__dirname, "memes");
  if (!fs.existsSync(memeFolder)) fs.mkdirSync(memeFolder, { recursive: true });

  const ext = path.extname(sourcePath).toLowerCase();
  const validExts = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".mp4", ".webm"];
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
      : ext === ".gif"
        ? "gif"
        : "image",
  };
});

ipcMain.handle("memes:saveBuffer", async (_e, { name, buffer, type }) => {
  const memeFolder = path.join(__dirname, "memes");
  if (!fs.existsSync(memeFolder)) fs.mkdirSync(memeFolder, { recursive: true });

  // Try to determine extension from name or mime type
  let ext = path.extname(name).toLowerCase();
  if (!ext && type) {
    if (type.includes("image/png")) ext = ".png";
    else if (type.includes("image/jpeg")) ext = ".jpg";
    else if (type.includes("image/gif")) ext = ".gif";
    else if (type.includes("image/webp")) ext = ".webp";
    else ext = ".png"; // default fallback
  }

  const validExts = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".mp4", ".webm"];
  if (!validExts.includes(ext)) ext = ".png";

  const baseName = path.parse(name).name || "webdrop";
  const newName = `${baseName}_${Date.now()}${ext}`;
  const destPath = path.join(memeFolder, newName);

  fs.writeFileSync(destPath, Buffer.from(buffer));

  return {
    name: path.parse(newName).name,
    path: destPath,
    kind: [".mp4", ".webm"].includes(ext)
      ? "video"
      : ext === ".gif"
        ? "gif"
        : "image",
  };
});

ipcMain.handle("memes:preview", (e, p) => `file:///${p.replace(/\\/g, "/")}`);
ipcMain.handle("memes:openFolder", () => {
  const memeFolder = path.join(__dirname, "memes");
  if (!fs.existsSync(memeFolder)) fs.mkdirSync(memeFolder, { recursive: true });
  shell.openPath(memeFolder);
});
ipcMain.handle("memes:saveClipboard", async () => {
  const { clipboard } = require("electron");
  const image = clipboard.readImage();
  if (image.isEmpty()) return null;

  const memeFolder = path.join(__dirname, "memes");
  if (!fs.existsSync(memeFolder)) fs.mkdirSync(memeFolder, { recursive: true });

  const newName = `clipboard_${Date.now()}.png`;
  const destPath = path.join(memeFolder, newName);

  fs.writeFileSync(destPath, image.toPNG());

  return {
    name: path.parse(newName).name,
    path: destPath,
    kind: "image",
  };
});
ipcMain.handle("discord:users", () => [
  { username: "fatima6848" },
  { username: "evanlegends" },
]);
ipcMain.handle(
  "targets:list",
  () =>
    store.get("recentTargets") || ["@fatima6848", "@evanlegends", "@elwen91"],
);
ipcMain.handle("drop:send", async (_e, payload) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    let formattedPayload;

    // Mode collage : plusieurs chemins fichiers
    if (Array.isArray(payload.filePaths) && payload.filePaths.length >= 2) {
      const collage = await buildCollage(payload.filePaths);
      if (!collage) return { ok: false, error: "Collage impossible" };
      formattedPayload = {
        type: "quick_drop",
        target: payload.target,
        caption: payload.caption || null,
        rain: payload.rain || null,
        media: {
          data: collage.base64,
          mime: collage.mime,
          kind: "image",
          name: `collage_${Date.now()}.jpg`,
          size: collage.buffer.length,
        },
      };
    } else {
      formattedPayload = await formatQuickDropPayload(payload);
    }

    ws.send(JSON.stringify(formattedPayload));
    // Persist target
    if (payload.target) {
      let list = store.get("recentTargets") || [];
      list = [
        payload.target,
        ...list.filter((t) => t !== payload.target),
      ].slice(0, 20);
      store.set("recentTargets", list);
    }
    return { ok: true };
  }
  return { ok: false, error: "Not connected" };
});

// Collage builder handler
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

// URL resolver handler
ipcMain.handle("url:resolve", async (_e, url) => {
  try {
    return await resolveMediaUrl(url);
  } catch (e) {
    return { url, kind: "image", mime: "image/jpeg", unresolved: true };
  }
});
ipcMain.handle("drop:sendUrl", async (_e, payload) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const { target, url, caption, rain } = payload;
    const resolved = await resolveMediaUrl(url);

    const msg = {
      type: "quick_drop",
      target,
      caption: caption || null,
      rain: rain || null,
      media: {
        url: resolved.url,
        kind: resolved.kind,
        mime: resolved.mime,
        name: resolved.url.split("/").pop()?.split("?")[0] || "media",
        size: 0,
      },
    };

    ws.send(JSON.stringify(msg));
    // Persist target
    if (target) {
      let list = store.get("recentTargets") || [];
      list = [target, ...list.filter((t) => t !== target)].slice(0, 20);
      store.set("recentTargets", list);
    }
    return { ok: true, resolved };
  }
  return { ok: false, error: "Not connected" };
});
ipcMain.handle("tags:get", () => []);
ipcMain.handle("tags:add", () => {});
ipcMain.handle("tags:remove", () => {});
ipcMain.handle("favs:get", () => []);
ipcMain.handle("favs:toggle", () => {});
ipcMain.handle("audio:library", () => {
  const memeFolder = path.join(__dirname, "memes");
  if (!fs.existsSync(memeFolder)) return [];
  const files = fs.readdirSync(memeFolder);
  const validExts = [".mp3", ".wav", ".ogg"];
  return files
    .filter((f) => validExts.includes(path.extname(f).toLowerCase()))
    .map((f) => ({
      name: path.parse(f).name,
      path: path.join(memeFolder, f),
      kind: "audio",
    }));
});
ipcMain.handle("audio:soundboard", () => []);
ipcMain.handle("audio:addSoundboard", () => {});
ipcMain.handle("history:get", () => []);
ipcMain.handle("streak:get", () => null);
ipcMain.handle("groups:get", () => []);
ipcMain.handle("groups:save", () => {});
ipcMain.handle("groups:drop", () => {});
ipcMain.handle("schedule:get", () => []);
ipcMain.handle("schedule:cancel", () => {});
ipcMain.handle("studio:templates", () => []);
ipcMain.handle("studio:generate", () => {});
ipcMain.handle("giphy:search", () => []);
ipcMain.handle("giphy:trending", () => []);
ipcMain.handle("giphy:download", () => null);
ipcMain.handle("tags:listAll", () => []);
ipcMain.handle("tags:set", () => {});
ipcMain.handle("audio:setPairing", () => {});
ipcMain.handle("audio:getPairings", () => ({}));
ipcMain.handle("history:add", () => {});
ipcMain.handle("streak:increment", () => {});
ipcMain.handle("tools:screenshot", () => null);
ipcMain.handle("drop:preview", async (_e, payload) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const target = getPreviewTarget(store);
    if (!target) return { ok: false, error: "Not linked" };

    const previewPayload = { ...payload, target };
    const formattedPayload = await formatQuickDropPayload(previewPayload);
    ws.send(JSON.stringify(formattedPayload));
    return { ok: true };
  }
  return { ok: false, error: "Not connected" };
});
ipcMain.handle("targets:add", (_e, target) => {
  if (!target) return;
  let list = store.get("recentTargets") || [];
  list = [target, ...list.filter((t) => t !== target)].slice(0, 20);
  store.set("recentTargets", list);
});
ipcMain.handle("history:setLast", () => {});
ipcMain.handle("history:getLast", () => null);
ipcMain.handle("tools:copyCommand", () => {});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
