// main.js — MemeDrop unified app (Main process)
const {
  app,
  BrowserWindow,
  screen,
  ipcMain,
  shell,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
} = require("electron");
const path = require("path");
const fs = require("fs");
const WebSocket = require("ws");
const crypto = require("crypto");
const { setupSettings } = require("./modules/settings");
const { setupUpdater } = require("./modules/updater");
const { setupHistory } = require("./modules/history");
const { setupMemes } = require("./modules/memes");
const { setupTags } = require("./modules/tags");
const { setupFavorites } = require("./modules/favorites");
const { setupAudio } = require("./modules/audio");
const {
  formatQuickDropPayload,
  getPreviewTarget,
  buildCollage,
  resolveMediaUrl,
  getMemeFolder,
} = require("./utils");
const store = require("./store");

// ── Helper: MIME type depuis extension ────────────────────────────────────
function getMimeFromExt(ext) {
  const map = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
  };
  return map[ext.toLowerCase()] || "image/png";
}

// ── Debounce: éviter les notifications en rafale ────────────────────────
let _libraryChangedTimer = null;
function notifyLibraryChanged() {
  if (_libraryChangedTimer) clearTimeout(_libraryChangedTimer);
  _libraryChangedTimer = setTimeout(() => {
    _libraryChangedTimer = null;
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) w.webContents.send("library:changed");
    }
  }, 500);
}

const DEFAULT_SERVER =
  process.env.DEFAULT_SERVER || "wss://memedrop-bot-production.up.railway.app";

// Isolate userData path for the unified agent app
app.name = "memedrop";
app.setPath(
  "userData",
  path.join(app.getPath("appData"), "MemeDrop-Unified-Agent"),
);

// Allow enabling hardware acceleration via config
// Must be read before electron-store initializes (config.json may not exist yet)
(function initGPU() {
  try {
    const configPath = path.join(app.getPath("userData"), "config.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (config.hardwareAcceleration) {
        console.log("[gpu] hardware acceleration enabled via config");
        return; // skip disableHardwareAcceleration
      }
    }
  } catch {}
  app.disableHardwareAcceleration();
})();
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-renderer-backgrounding");

function isMuted() {
  const until = store.get("muteUntil");
  if (!until) return false;
  if (until === -1 || until > Date.now()) return true;
  store.set("muteUntil", null);
  return false;
}

const { recordHistory } = setupHistory(store, {
  onHistoryUpdate: (history) => {
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) w.webContents.send("history-update", history);
    }
  },
});
setupMemes(store, app);
setupTags(store);
setupFavorites(store);
setupAudio(store, app);
let overlayWin = null;
let launcherWin = null;
let tray = null;
let topGuardTimer = null;

function iconPath() {
  return path.join(
    __dirname,
    "..",
    "renderer",
    "overlay",
    "assets",
    process.platform === "win32" ? "icon.ico" : "icon.png",
  );
}

function getTargetDisplay() {
  const displays = screen.getAllDisplays();
  const wantedId = store.get("overlayDisplayId");
  if (wantedId != null) {
    const found = displays.find((d) => d.id === wantedId);
    if (found) return found;
  }
  return screen.getPrimaryDisplay();
}

function enforceTop() {
  if (!overlayWin || overlayWin.isDestroyed()) return;
  try {
    if (!overlayWin.isAlwaysOnTop())
      overlayWin.setAlwaysOnTop(true, "screen-saver");
    overlayWin.moveTop();
  } catch (e) {}
}

function startTopGuard() {
  if (topGuardTimer) return;
  topGuardTimer = setInterval(() => {
    if (!overlayWin || overlayWin.isDestroyed()) return;
    if (!overlayWin.isAlwaysOnTop()) {
      overlayWin.setAlwaysOnTop(true, "screen-saver");
      overlayWin.moveTop();
    }
  }, 2000);
}

function stopTopGuard() {
  if (topGuardTimer) {
    clearInterval(topGuardTimer);
    topGuardTimer = null;
  }
}

function createOverlayWindow() {
  if (overlayWin && !overlayWin.isDestroyed()) return overlayWin;

  const display = getTargetDisplay();
  const { x, y, width, height } = display.bounds;

  overlayWin = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    hasShadow: false,
    show: false,
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "overlay.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      paintWhenInitiallyHidden: false,
    },
  });

  overlayWin.setAlwaysOnTop(true, "screen-saver");
  overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWin.setIgnoreMouseEvents(true, { forward: true });

  overlayWin.on("blur", () => {
    if (overlayWin && !overlayWin.isDestroyed() && !overlayWin.isAlwaysOnTop())
      enforceTop();
  });

  overlayWin.loadFile(
    path.join(__dirname, "..", "renderer", "overlay", "overlay.html"),
  );
  overlayWin.once("ready-to-show", () => {
    overlayWin.show();
    enforceTop();
  });

  screen.on("display-metrics-changed", () => {
    repositionOverlay();
    enforceTop();
  });
  screen.on("display-added", () => {
    repositionOverlay();
    enforceTop();
  });
  screen.on("display-removed", () => {
    repositionOverlay();
    enforceTop();
  });

  return overlayWin;
}

function repositionOverlay() {
  if (!overlayWin || overlayWin.isDestroyed()) return;
  overlayWin.setBounds(getTargetDisplay().bounds);
}

function createLauncherWindow() {
  if (launcherWin && !launcherWin.isDestroyed()) {
    launcherWin.show();
    launcherWin.focus();
    return launcherWin;
  }

  launcherWin = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "MemeDrop QuickLauncher",
    backgroundColor: "#0e0a1f",
    autoHideMenuBar: true,
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "launcher.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  launcherWin.loadFile(
    path.join(__dirname, "..", "renderer", "launcher", "index.html"),
  );

  launcherWin.on("close", (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      launcherWin.hide();
    }
  });

  return launcherWin;
}

// `minutes`: falsy → désactive, -1 → jusqu'à réactivation, sinon durée en minutes.
function setMute(minutes) {
  const until = !minutes
    ? null
    : minutes === -1
      ? -1
      : Date.now() + minutes * 60_000;
  store.set("muteUntil", until);
  setState({ muteUntil: until });
  rebuildTrayMenu();
}

function rebuildTrayMenu() {
  if (!tray) return;
  const muted = isMuted();
  const muteSubmenu = muted
    ? [{ label: "🔊 Réactiver les drops", click: () => setMute(null) }]
    : [
        { label: "🔇 Mode tranquille — 30 min", click: () => setMute(30) },
        { label: "🔇 Mode tranquille — 2 h", click: () => setMute(120) },
        {
          label: "🔇 Mode tranquille — jusqu'à réactivation",
          click: () => setMute(-1),
        },
      ];

  const menu = Menu.buildFromTemplate([
    { label: "MemeDrop", enabled: false },
    { type: "separator" },
    { label: "Ouvrir les réglages…", click: () => createLauncherWindow() },
    {
      label: "Afficher / masquer l'overlay",
      click: () => {
        if (overlayWin && overlayWin.isVisible()) overlayWin.hide();
        else {
          createOverlayWindow();
          overlayWin.show();
        }
      },
    },
    { label: "Forcer au premier plan", click: enforceTop },
    { type: "separator" },
    ...muteSubmenu,
    { type: "separator" },
    { label: "Vérifier les mises à jour…", click: () => checkForUpdates(true) },
    {
      label: "Ouvrir les DevTools (overlay)",
      click: () => {
        if (overlayWin && !overlayWin.isDestroyed()) {
          overlayWin.webContents.openDevTools({ mode: "detach" });
        }
      },
    },
    { type: "separator" },
    {
      label: "Quitter",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
  tray.setToolTip(muted ? "MemeDrop — mode tranquille 🔇" : "MemeDrop");
}

function createTray() {
  const icon = nativeImage.createFromPath(iconPath());
  tray = new Tray(
    icon.isEmpty()
      ? nativeImage.createEmpty()
      : icon.resize({ width: 16, height: 16 }),
  );
  rebuildTrayMenu();
  tray.on("click", () => createLauncherWindow());
}

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket client
// ─────────────────────────────────────────────────────────────────────────────
let ws = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let unreadDrops = 0;
const dedupCache = new Map(); // sha256 -> path (OP-3)

// Track memes shared by each user
const sharedMemesByUser = new Map(); // username -> Set<memeName>

// Initialiser sharedMemesByUser depuis les tags persistes (from:username)
(function initSharedMemes() {
  try {
    const allTags = store.get("tags") || {};
    const unknownMemes = [];
    for (const [filePath, tags] of Object.entries(allTags)) {
      for (const tag of tags) {
        if (tag.startsWith("from:")) {
          const username = tag.substring(5);
          if (!sharedMemesByUser.has(username))
            sharedMemesByUser.set(username, new Set());
          sharedMemesByUser.get(username).add(path.basename(filePath));
        }
      }
    }
    // Fallback : scanner les fichiers shared_ sans tag from:
    try {
      const memeFolder = getMemeFolder(store, app);
      if (fs.existsSync(memeFolder)) {
        for (const f of fs.readdirSync(memeFolder)) {
          if (f.startsWith("shared_")) {
            // Verifier si ce fichier deja attribue a un utilisateur
            const tags = allTags[path.join(memeFolder, f)] || [];
            const hasFromTag = tags.some((t) => t.startsWith("from:"));
            if (!hasFromTag) {
              unknownMemes.push(f);
            }
          }
        }
      }
    } catch {}
    if (unknownMemes.length > 0) {
      sharedMemesByUser.set("Inconnu", new Set(unknownMemes));
    }
  } catch {}
})();

// Initialiser dedupCache en scannant le dossier au demarrage
function initDedupCache(folder) {
  dedupCache.clear();
  try {
    if (!fs.existsSync(folder)) return;
    for (const f of fs.readdirSync(folder)) {
      if (!f.startsWith("shared_")) continue;
      const filePath = path.join(folder, f);
      try {
        const raw = fs.readFileSync(filePath);
        const hash = crypto
          .createHash("sha256")
          .update(raw.slice(0, 4096))
          .digest("hex");
        dedupCache.set(hash, filePath);
      } catch {}
    }
  } catch {}
}
let connState = {
  status: "disconnected",
  code: null,
  user: null,
  links: null,
  muteUntil: store.get("muteUntil"),
};

function broadcastState() {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send("connection-state", connState);
  }
}

function setState(patch) {
  connState = { ...connState, ...patch };
  broadcastState();
}

function connectWS() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (store.get("paused")) {
    setState({ status: "paused", code: null, user: null, links: null });
    return;
  }
  // Clean old WebSocket to prevent its on("close") from firing after new one connects
  const oldWs = ws;
  ws = null;
  if (oldWs) {
    try {
      oldWs.onclose = null;
      oldWs.onerror = null;
      oldWs.onmessage = null;
      oldWs.close();
    } catch {}
  }
  const url = store.get("serverUrl");
  setState({ status: "connecting", code: null, user: null, links: null });

  try {
    ws = new WebSocket(url, { perMessageDeflate: true });
  } catch (err) {
    console.error("[ws] construct error:", err.message);
    scheduleReconnect();
    return;
  }

  ws.on("open", () => {
    reconnectAttempts = 0;
    console.log("[ws] connected to", url);
    // Ré-enregistrement automatique : on rejoue notre identité stockée (avec
    // son token de sécurité) pour que le bot rebuild le lien sans /link.
    // Marche même après un redeploy (tant que le token reste valide).
    const identity = store.get("linkIdentity");
    if (identity && identity.userId) {
      try {
        ws.send(JSON.stringify({ type: "register", identity }));
      } catch {}
    }
  });

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case "pairing_code":
        // If we're already linked, this is an extension code for adding more
        // guilds. Don't drop the linked state — just update the visible code.
        if (connState.status === "linked") {
          setState({ code: msg.code });
        } else if (store.get("linkIdentity")) {
          // On a une identité et on tente un ré-enregistrement silencieux —
          // on garde le code prêt mais on reste "connexion…" plutôt que de
          // flasher "en attente". Si ça échoue, le bot envoie register_failed.
          setState({
            status: "connecting",
            code: msg.code,
            user: null,
            links: null,
          });
        } else {
          setState({
            status: "awaiting_link",
            code: msg.code,
            user: null,
            links: null,
          });
        }
        break;
      case "linked": {
        // Mémorise l'identité (depuis l'utilisateur + le snapshot serveurs)
        // pour le ré-enregistrement automatique des prochaines connexions.
        const links = msg.links || {
          scope: "guild",
          guilds: [],
          guildIds: [],
          blocked: [],
          blockedIds: [],
        };
        if (msg.user?.id) {
          store.set("linkIdentity", {
            userId: msg.user.id,
            username: msg.user.username,
            scope: links.scope === "global" ? "global" : "guild",
            guildIds: Array.isArray(links.guildIds) ? links.guildIds : [],
            token: msg.token || null,
            blockedIds: Array.isArray(links.blockedIds) ? links.blockedIds : [],
          });
        }
        setState({ status: "linked", code: null, user: msg.user, links });
        break;
      }
      case "register_failed":
        // Identité invalide/obsolète — on l'oublie et on repasse en appairage.
        store.set("linkIdentity", null);
        setState({
          status: "awaiting_link",
          code: connState.code || null,
          user: null,
          links: null,
        });
        break;
      case "links_update": {
        // Mise à jour autoritaire des serveurs/blocages (ajout/retrait) → on
        // persiste les IDs côté overlay pour le prochain ré-enregistrement.
        const cur = store.get("linkIdentity");
        if (cur && msg.links) {
          cur.scope = msg.links.scope === "global" ? "global" : "guild";
          cur.guildIds = Array.isArray(msg.links.guildIds)
            ? msg.links.guildIds
            : cur.guildIds;
          cur.blockedIds = Array.isArray(msg.links.blockedIds)
            ? msg.links.blockedIds
            : cur.blockedIds;
          store.set("linkIdentity", cur);
        }
        setState({ links: msg.links });
        break;
      }
      case "unlinked":
        store.set("linkIdentity", null); // this overlay is no longer linked
        setState({ status: "connecting", code: null, user: null, links: null });
        break;
      case "users:list":
        store.set("cachedUsers", msg);
        if (launcherWin && !launcherWin.isDestroyed()) {
          launcherWin.webContents.send("users:list", msg);
        }
        break;
      case "drop":
        recordHistory(msg);
        unreadDrops++;
        if (launcherWin && !launcherWin.isDestroyed()) {
          launcherWin.webContents.send("drop:received");
          try {
            launcherWin.setBadgeCount(unreadDrops);
          } catch {}
        }
        if (isMuted()) break; // mode tranquille : on note le drop mais on ne l'affiche pas
        if (!overlayWin || overlayWin.isDestroyed()) createOverlayWindow();
        startTopGuard();
        enforceTop();
        overlayWin.webContents.send("drop", {
          ...msg,
          settings: {
            volume: store.get("volume"),
            musicVolume: store.get("musicVolume"),
            opacity: store.get("opacity"),
            duration: msg.duration || store.get("duration"),
            videoDuration: msg.duration || store.get("videoDuration"),
            soundOnArrival: store.get("soundOnArrival"),
            spotlightOnDrop: store.get("spotlightOnDrop"),
          },
        });
        break;
      case "meme_sync":
        try {
          const { data } = msg;
          if (!data || !data.name) {
            console.log("[ws] meme_sync ignored: no data/name");
            break;
          }
          console.log(
            "[ws] meme_sync received:",
            data.name,
            "from",
            msg.from?.username || "unknown",
          );

          // Vérifier si le meme a été préalablement supprimé (par nom)
          // Note: on ne bloque PAS l'import ici, le filtrage se fait dans memes:list
          // qui compare les chemins complets. Les shared_* ont un chemin différent
          // donc ils ne seront pas filtrés.
          const memeFolder = getMemeFolder(store, app);
          if (!fs.existsSync(memeFolder))
            fs.mkdirSync(memeFolder, { recursive: true });

          if (data.buffer) {
            // Compute hash FIRST (used for both dedup AND fallback name)
            let incomingHash = null;
            try {
              const incomingBuffer = Buffer.from(data.buffer, "base64");
              incomingHash = crypto
                .createHash("sha256")
                .update(incomingBuffer.slice(0, 4096))
                .digest("hex");
            } catch (e) {
              console.warn("[ws] hash compute failed:", e.message);
            }

            const safeName = path
              .basename(data.name)
              .replace(/[^a-zA-Z0-9._-]/g, "_");
            // Fallback si le nom nettoye est trop court
            const namePart =
              safeName === "_" || safeName === "."
                ? incomingHash
                  ? incomingHash.slice(0, 8)
                  : Date.now().toString(36)
                : safeName;
            let filename = "shared_" + namePart;
            let destPath = path.join(memeFolder, filename);
            let counter = 2;
            while (fs.existsSync(destPath)) {
              var dot = namePart.lastIndexOf(".");
              var base = dot >= 0 ? namePart.substring(0, dot) : namePart;
              var ext = dot >= 0 ? namePart.substring(dot) : "";
              filename = "shared_" + base + "_" + counter + ext;
              destPath = path.join(memeFolder, filename);
              counter++;
            }

            // Hash dedup
            if (incomingHash) {
              if (dedupCache.has(incomingHash)) {
                console.log(
                  "[ws] meme_sync skipped (duplicate hash):",
                  safeName,
                );
                break;
              }
              dedupCache.set(incomingHash, destPath);
            }

            fs.writeFileSync(destPath, Buffer.from(data.buffer, "base64"));

            try {
              var allTags = store.get("tags") || {};
              if (!allTags[destPath]) allTags[destPath] = [];
              if (!allTags[destPath].includes("importé"))
                allTags[destPath].push("importé");
              // Tag persistant avec le nom de l'envoyeur
              if (msg.from?.username) {
                var fromTag = "from:" + msg.from.username;
                if (!allTags[destPath].includes(fromTag))
                  allTags[destPath].push(fromTag);
              }
              store.set("tags", allTags);
            } catch (e) {
              console.error("[ws] failed to tag imported meme:", e.message);
            }

            for (var w of BrowserWindow.getAllWindows()) {
              if (!w.isDestroyed()) {
                w.webContents.send("meme:synced", {
                  name: path.parse(filename).name,
                  path: destPath,
                  kind: data.kind || "image",
                  from: msg.from,
                });
              }
            }
            // Track shared memes by user (stocke le nom complet avec extension)
            if (msg.from?.username) {
              const username = msg.from.username;
              if (!sharedMemesByUser.has(username))
                sharedMemesByUser.set(username, new Set());
              sharedMemesByUser.get(username).add(filename);
            }
            notifyLibraryChanged();
          } else if (data.url) {
            // URL seulement → laisser le renderer la downloader
            for (const w of BrowserWindow.getAllWindows()) {
              if (!w.isDestroyed()) {
                w.webContents.send("meme:synced", {
                  name: data.name,
                  url: data.url,
                  kind: data.kind || "image",
                  from: msg.from,
                });
              }
            }
          }
        } catch (err) {
          console.error("[ws] meme_sync error:", err.message);
        }
        break;
      case "library_sync_request":
        // Un autre utilisateur demande les memes → forcer un sync
        console.log("[ws] library_sync_request received, forcing sync");
        // Forcer syncAllMemes dans le renderer
        for (const w of BrowserWindow.getAllWindows()) {
          if (!w.isDestroyed()) {
            w.webContents.send("library:sync-requested");
          }
        }
        break;
      case "ping":
        ws.send(JSON.stringify({ type: "pong" }));
        break;
      case "meme_ref":
        try {
          const memeFolder = getMemeFolder(store, app);
          const foundPath = findLocalFileByHash(msg.hash, memeFolder);
          if (foundPath) {
            if (overlayWin && !overlayWin.isDestroyed()) {
              overlayWin.webContents.send("drop", {
                type: "drop",
                media: {
                  url: "file:///" + foundPath.replace(/\\/g, "/"),
                  kind: msg.kind || "image",
                  name: msg.name || "shared",
                },
                caption: msg.caption || null,
                from: msg.from || null,
                ts: Date.now(),
              });
            }
          } else {
            ws.send(JSON.stringify({ type: "meme_ref_miss", hash: msg.hash }));
          }
        } catch (err) {
          console.error("[ws] meme_ref error:", err.message);
        }
        break;
    }
  });

  ws.on("close", () => {
    if (store.get("paused")) {
      setState({ status: "paused", code: null, user: null, links: null });
      return;
    }
    setState({ status: "disconnected", code: null, links: null });
    scheduleReconnect();
  });
  ws.on("error", (err) => console.error("[ws] error:", err.message));
}

function scheduleReconnect() {
  reconnectAttempts++;
  let delay = Math.min(
    30_000,
    1000 * Math.pow(1.6, Math.min(reconnectAttempts, 8)),
  );
  // Jitter aleatoire ±50% pour eviter le thundering herd
  delay = Math.floor(delay * (0.5 + Math.random() * 0.5));
  reconnectTimer = setTimeout(connectWS, delay);
}

// ── Download a file from URL to meme folder ───────────────────────────
async function downloadFileFromUrl(url, memeFolder) {
  if (!url) return null;
  const { net } = require("electron");
  const res = await net.fetch(url);
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") || "";
  const buffer = Buffer.from(await res.arrayBuffer());
  let ext = ".gif";
  let kind = "image";
  if (contentType.includes("png")) {
    ext = ".png";
    kind = "image";
  } else if (contentType.includes("jpeg") || contentType.includes("jpg")) {
    ext = ".jpg";
    kind = "image";
  } else if (contentType.includes("gif")) {
    ext = ".gif";
    kind = "gif";
  } else if (contentType.includes("webp")) {
    ext = ".webp";
    kind = "image";
  } else if (contentType.includes("mp4")) {
    ext = ".mp4";
    kind = "video";
  } else if (contentType.includes("mp3")) {
    ext = ".mp3";
    kind = "audio";
  }

  const name = "url_" + Date.now() + ext;
  const destPath = path.join(memeFolder, name);
  fs.writeFileSync(destPath, buffer);
  return { name, path: destPath, kind, mime: contentType };
}

// ── Find local file by SHA256 hash (OP-21) ────────────────────────────
function findLocalFileByHash(hash, folder) {
  try {
    for (const f of fs.readdirSync(folder)) {
      const filePath = path.join(folder, f);
      try {
        const raw = fs.readFileSync(filePath);
        const fileHash = crypto
          .createHash("sha256")
          .update(raw.slice(0, 4096))
          .digest("hex");
        if (fileHash === hash) return filePath;
      } catch {}
    }
  } catch {}
  // Fallback: check dedupCache
  if (dedupCache.has(hash)) {
    const cachedPath = dedupCache.get(hash);
    if (fs.existsSync(cachedPath)) return cachedPath;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-updater (GitHub Releases)
//
// Flow:
//   - Check 4 seconds after launch (give the UI time to settle).
//   - On `update-available` we DON'T auto-download. We let the user click
//     "Install & restart" from the settings window — feels less intrusive
//     than a forced background download.
//   - Periodic re-check every 30 min while the app is open.
// ─────────────────────────────────────────────────────────────────────────────
const { checkForUpdates } = setupUpdater({
  onStateChange: (state) => {
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) w.webContents.send("update-state", state);
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// IPC
// ─────────────────────────────────────────────────────────────────────────────
setupSettings(store, {
  onServerChanged: () => {
    try {
      ws && ws.close();
    } catch {}
    connectWS();
  },
  onPausedChanged: (paused) => {
    if (paused) {
      try {
        ws && ws.close();
      } catch {}
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      setState({ status: "paused", code: null, user: null, links: null });
    } else {
      connectWS();
    }
  },
  onDisplayChanged: () => {
    repositionOverlay();
    enforceTop();
  },
  onLivePatch: (livePatch) => {
    if (overlayWin && !overlayWin.isDestroyed()) {
      overlayWin.webContents.send("settings-update", livePatch);
    }
  },
});

ipcMain.handle("connection:get", () => connState);
ipcMain.handle("connection:reconnect", () => {
  try {
    ws && ws.close();
  } catch {}
  connectWS();
  return true;
});
ipcMain.handle("connection:unlink-guild", (_e, guildId) => {
  if (!ws || ws.readyState !== ws.OPEN) return false;
  try {
    ws.send(JSON.stringify({ type: "unlink_guild", guildId }));
    return true;
  } catch {
    return false;
  }
});
ipcMain.handle("connection:unblock-user", (_e, userId) => {
  if (!ws || ws.readyState !== ws.OPEN) return false;
  try {
    ws.send(JSON.stringify({ type: "unblock_user", userId }));
    return true;
  } catch {
    return false;
  }
});

// ── Mode tranquille ────────────────────────────────────────────────────
// `minutes` null/0 → désactive. -1 → tranquille jusqu'à réactivation.
ipcMain.handle("mute:set", (_e, minutes) => {
  setMute(minutes);
  return store.get("muteUntil");
});
ipcMain.handle("mute:get", () => (isMuted() ? store.get("muteUntil") : null));

// ── Programmateur de mute ────────────────────────────────────────────────
ipcMain.handle(
  "mute:getSchedule",
  () =>
    store.get("muteSchedule") || {
      enabled: false,
      startHour: 22,
      startMinute: 0,
      endHour: 8,
      endMinute: 0,
    },
);
ipcMain.handle("mute:setSchedule", (_e, schedule) => {
  store.set("muteSchedule", schedule);
  return { ok: true };
});

// Historique des drops géré par le module history

// App version + update IPC handled by updater module
ipcMain.on("test-drop", () => {
  if (!overlayWin || overlayWin.isDestroyed()) createOverlayWindow();
  startTopGuard();
  enforceTop();
  overlayWin.webContents.send("drop", {
    type: "drop",
    media: {
      url: "about:blank",
      kind: "test",
      mime: "test/test",
      name: "test.png",
      size: 0,
    },
    caption: "TEST DROP",
    from: { id: "0", username: "You (test)" },
    ts: Date.now(),
    settings: {
      volume: store.get("volume"),
      musicVolume: store.get("musicVolume"),
      opacity: store.get("opacity"),
      duration: store.get("duration"),
      videoDuration: store.get("videoDuration"),
      soundOnArrival: store.get("soundOnArrival"),
    },
  });
});

ipcMain.on("stage-empty", () => stopTopGuard());
ipcMain.on("open-external", (_e, url) => {
  if (/^https?:\/\//i.test(url)) shell.openExternal(url);
});

// ── Drag : sondage du curseur + bascule setIgnoreMouseEvents ─────────────
//
// Le renderer ne peut pas détecter le survol des drops via forward:true de
// façon fiable sur Windows. On sonde donc screen.getCursorScreenPoint() dans
// le main process (~60 fps) et on envoie la position au renderer.
// Le renderer demande à démarrer/arrêter le sondage selon qu'il y a des
// drops visuels à l'écran.
let _cursorPollTimer = null;

function startCursorPoll() {
  if (_cursorPollTimer) return;
  _cursorPollTimer = setInterval(() => {
    if (!overlayWin || overlayWin.isDestroyed()) return;
    const pt = screen.getCursorScreenPoint();
    const b = overlayWin.getBounds();
    overlayWin.webContents.send("overlay:cursor", {
      x: pt.x - b.x,
      y: pt.y - b.y,
    });
  }, 16);
}

function stopCursorPoll() {
  if (_cursorPollTimer) {
    clearInterval(_cursorPollTimer);
    _cursorPollTimer = null;
  }
}

ipcMain.on("overlay:watch-cursor", () => startCursorPoll());
ipcMain.on("overlay:unwatch-cursor", () => stopCursorPoll());

// Bascule setIgnoreMouseEvents à la demande du renderer.
//   ignore = true  → événements vers le jeu  (mode normal)
//   ignore = false → overlay capture la souris (mode drag)
ipcMain.on("overlay:set-ignore-mouse", (_e, ignore) => {
  if (!overlayWin || overlayWin.isDestroyed()) return;
  if (ignore) {
    overlayWin.setIgnoreMouseEvents(true, { forward: true });
  } else {
    overlayWin.setIgnoreMouseEvents(false);
  }
});

// ── Programmateur de mute (mode "Ne pas déranger") ─────────────────────
function initMuteScheduler() {
  const check = () => {
    const schedule = store.get("muteSchedule");
    if (!schedule || !schedule.enabled) return;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = schedule.startHour * 60 + schedule.startMinute;
    const endMinutes = schedule.endHour * 60 + schedule.endMinute;

    let shouldMute = false;
    if (startMinutes <= endMinutes) {
      shouldMute =
        currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Chevauchement minuit (ex: 22h → 6h)
      shouldMute =
        currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    const isMuted = !!store.get("muteUntil");
    if (shouldMute && !isMuted) {
      store.set("muteUntil", -1);
      console.log("[scheduler] auto-muted");
      for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed()) w.webContents.send("mute:toggle", true);
      }
    } else if (!shouldMute && isMuted && store.get("muteUntil") === -1) {
      store.set("muteUntil", null);
      console.log("[scheduler] auto-unmuted");
      for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed()) w.webContents.send("mute:toggle", false);
      }
    }
  };
  check();
  setInterval(check, 30000); // Vérifier toutes les 30s
}

// ─────────────────────────────────────────────────────────────────────────────
// App lifecycle
// ─────────────────────────────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => createLauncherWindow());

  if (process.platform === "win32")
    app.setAppUserModelId("com.memedrop.overlay");

  // The OS launches us with --hidden when starting at login (see the args we
  // register below). In that case we boot straight to the tray + overlay and
  // skip the settings window so the user can troll immediately, no clicks.
  const startedHidden =
    process.argv.includes("--hidden") ||
    app.getLoginItemSettings().wasOpenedAtLogin;

  // ── Notification badge (unread drops count) ────────────────────────────
  ipcMain.handle("drops:getUnread", () => unreadDrops);
  ipcMain.handle("drops:resetUnread", () => {
    unreadDrops = 0;
    return true;
  });

  // ── History search ─────────────────────────────────────────────────────
  ipcMain.handle("history:search", (_e, query, targetFilter) => {
    try {
      const history = store.get("dropHistory") || [];
      let filtered = history;
      if (query) {
        const q = query.toLowerCase();
        filtered = filtered.filter((h) =>
          (h.caption || "").toLowerCase().includes(q),
        );
      }
      if (targetFilter) {
        filtered = filtered.filter((h) => h.target === targetFilter);
      }
      return { ok: true, history: filtered };
    } catch (err) {
      return { ok: false, error: err.message, history: [] };
    }
  });

  // ── Custom CSS import ───────────────────────────────────────────────────
  ipcMain.handle("tools:importCSS", async (_e, cssContent) => {
    try {
      store.set("customCSS", cssContent);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ── Drop to all users ───────────────────────────────────────────────────
  ipcMain.handle("drop:sendToAll", async (_e, payload) => {
    try {
      // Reuse the sendDrop logic but target "@everyone"
      const { sendDrop } = require("./modules/drops");
      // Fallback: just send to each connected user
      const users = store.get("cachedUsers");
      if (users?.users) {
        for (const user of users.users) {
          await sendDrop({ ...payload, target: `@${user.username}` });
        }
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ── Stats ───────────────────────────────────────────────────────────────
  ipcMain.handle("stats:get", () => {
    try {
      const history = store.get("dropHistory") || [];
      const totalSent = history.length;
      const memes = store.get("tags") || {};
      const totalMemes = Object.keys(memes).length;
      const favorites = store.get("favorites") || [];
      return {
        ok: true,
        stats: {
          totalSent,
          totalMemes,
          totalFavorites: favorites.length,
          uptime: Math.floor(process.uptime()),
        },
      };
    } catch {
      return { ok: false, stats: null };
    }
  });

  // ── List synced memes by user ─────────────────────────────────────────
  ipcMain.handle("synced:list", () => {
    try {
      const result = [];
      for (const [username, memes] of sharedMemesByUser) {
        result.push({ username, count: memes.size, memes: Array.from(memes) });
      }
      return { ok: true, users: result, memeFolder: getMemeFolder(store, app) };
    } catch (err) {
      return { ok: false, error: err.message, users: [] };
    }
  });

  // ── Increment unread on each received drop ─────────────────────────────
  // (handled directly in the ws.on("message") handler inside connectWS)

  app.whenReady().then(() => {
    // Initialiser le cache de deduplication
    try {
      const { getMemeFolder } = require("./utils");
      initDedupCache(getMemeFolder(store, app));
    } catch {}

    // Reconcile the OS login item with the stored setting on every launch, so
    // autostart actually takes effect even if the user never opened settings.
    app.setLoginItemSettings({
      openAtLogin: !!store.get("autostart"),
      openAsHidden: true,
      args: ["--hidden"],
    });

    createOverlayWindow();
    if (!startedHidden) createLauncherWindow();
    createTray();
    connectWS();

    // Nettoyer les doublons shared_* au démarrage
    cleanupDuplicateSharedMemes();
    // Migrer les noms des anciens hiddenMemes vers hiddenMemeNames
    migrateHiddenMemeNames();
    // Renommer les anciens fichiers shared_ avec noms spéciaux
    sanitizeOldSharedFilenames();
    // Programmateur de mute
    initMuteScheduler();

    // Debug shortcuts — work even when the overlay (which is non-focusable)
    // can't receive keyboard events normally. We use Ctrl+Alt+X combos so we
    // don't collide with GPU monitor overlays (NZXT CAM, MSI Afterburner, etc.)
    // which often grab Ctrl+Shift+X.
    //   Ctrl+Alt+S → DevTools on the Settings window
    //   Ctrl+Alt+M → DevTools on the overlay window (the transparent one
    //                that actually plays the videos)
    globalShortcut.register("Control+Alt+S", () => {
      if (launcherWin && !launcherWin.isDestroyed()) {
        launcherWin.webContents.openDevTools({ mode: "detach" });
      }
    });
    globalShortcut.register("Control+Alt+M", () => {
      if (overlayWin && !overlayWin.isDestroyed()) {
        overlayWin.webContents.openDevTools({ mode: "detach" });
      }
    });
    // Ctrl+M → toggle mute
    globalShortcut.register("CommandOrControl+M", () => {
      const isMuted = !!store.get("muteUntil");
      if (isMuted) {
        store.set("muteUntil", null);
        console.log("[shortcut] unmuted");
      } else {
        store.set("muteUntil", -1); // Mute until reactivation
        console.log("[shortcut] muted");
      }
      for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed()) w.webContents.send("mute:toggle", !isMuted);
      }
    });

    // Auto-update: check shortly after launch + every 30 min
    setTimeout(() => checkForUpdates(false), 4000);
    setInterval(() => checkForUpdates(false), 30 * 60 * 1000);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createLauncherWindow();
        createOverlayWindow();
      }
    });
  });

  app.on("window-all-closed", (e) => {
    e.preventDefault?.();
  });
  app.on("will-quit", () => globalShortcut.unregisterAll());
  app.on("before-quit", () => {
    app.isQuitting = true;
    stopTopGuard();
  });
}

// Meme handlers are managed by memes module
ipcMain.handle("discord:users", () => [
  { username: "fatima6848" },
  { username: "evanlegends" },
]);

ipcMain.handle("memes:sync", async (_e, memeData) => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return { ok: false, error: "Not connected" };
  }
  try {
    const data = { ...memeData };
    if (memeData.path && !memeData.buffer) {
      const raw = await fs.promises.readFile(memeData.path);
      data.buffer = raw.toString("base64");
      data.mime = getMimeFromExt(path.extname(memeData.path));
    }
    console.log(
      "[memes:sync] sending",
      data.name,
      "(" +
        (data.buffer ? data.buffer.length + " bytes base64" : "URL only") +
        ")",
    );
    ws.send(JSON.stringify({ type: "meme_sync", data }));
    return { ok: true };
  } catch (err) {
    console.error("[memes:sync] error:", err.message);
    return { ok: false, error: err.message };
  }
});

// ── Sync All: envoie tous les memes locaux aux autres utilisateurs ─────
const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes entre deux sync

ipcMain.handle("memes:syncAll", async (_e, force) => {
  const lastSync = store.get("lastSyncTimestamp") || 0;
  const now = Date.now();

  if (!force && now - lastSync < SYNC_COOLDOWN_MS) {
    const remaining = Math.ceil((SYNC_COOLDOWN_MS - (now - lastSync)) / 1000);
    console.log("[memes:syncAll] cooldown active, retry in", remaining, "s");
    return { ok: true, count: 0, skipped: true, cooldown: remaining };
  }
  store.set("lastSyncTimestamp", now);

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return { ok: false, error: "Not connected" };
  }
  try {
    const memeFolder = getMemeFolder(store, app);
    if (!fs.existsSync(memeFolder)) return { ok: true, count: 0 };

    const hidden = new Set(store.get("hiddenMemes") || []);
    const files = fs.readdirSync(memeFolder);
    let synced = 0;

    for (const file of files) {
      // Ne pas partager les fichiers déjà importés (prefix shared_)
      if (file.startsWith("shared_")) continue;

      const filePath = path.join(memeFolder, file);
      if (hidden.has(filePath)) continue; // Ne pas partager les memes cachés

      const ext = path.extname(file).toLowerCase();
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
      if (!validExts.includes(ext)) continue;

      const raw = await fs.promises.readFile(filePath);
      const data = {
        name: file,
        kind:
          ext === ".gif"
            ? "gif"
            : [".mp4", ".webm"].includes(ext)
              ? "video"
              : [".mp3", ".wav", ".ogg"].includes(ext)
                ? "audio"
                : "image",
        buffer: raw.toString("base64"),
        mime: getMimeFromExt(ext),
      };
      ws.send(JSON.stringify({ type: "meme_sync", data }));
      synced++;
      // Delai entre chaque envoi pour respecter le rate limit du bot (60/min = 1s d'intervalle)
      await new Promise((r) => setTimeout(r, 1500));
    }

    console.log("[memes:syncAll] synced", synced, "memes");
    return { ok: true, count: synced };
  } catch (err) {
    console.error("[memes:syncAll] error:", err.message);
    return { ok: false, error: err.message };
  }
});

// ── Demander aux autres d'envoyer leurs memes ─────────────────────────
ipcMain.handle("library:requestSync", async () => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return { ok: false, error: "Not connected" };
  }
  try {
    ws.send(JSON.stringify({ type: "library_sync_request" }));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── Cleanup: supprime les doublons shared_* (garder le plus récent) ───
function cleanupDuplicateSharedMemes() {
  try {
    const memeFolder = getMemeFolder(store, app);
    console.log("[cleanup] checking folder:", memeFolder);
    if (!fs.existsSync(memeFolder)) {
      console.log("[cleanup] folder does not exist");
      return;
    }

    const files = fs.readdirSync(memeFolder);
    const byName = {}; // originalName -> [{file, path, mtime}]

    for (const file of files) {
      // Nouveau format: shared_NOM.ext, Ancien format: shared_TIMESTAMP_NOM.ext
      var baseName = file.startsWith("shared_") ? file.substring(7) : null;
      if (!baseName) continue;
      // Enlever le timestamp pour l'ancien format
      var originalName = baseName.replace(/^\d+_/, "");

      if (!byName[originalName]) byName[originalName] = [];
      byName[originalName].push({
        file,
        path: path.join(memeFolder, file),
      });
    }

    let removed = 0;
    for (var orig in byName) {
      var entries = byName[orig];
      if (entries.length <= 1) continue;
      // Garder le premier, supprimer les autres
      for (var i = 1; i < entries.length; i++) {
        try {
          fs.unlinkSync(entries[i].path);
          removed++;
          console.log("[cleanup] removed duplicate:", entries[i].file);
        } catch (e) {
          console.error(
            "[cleanup] failed to remove",
            entries[i].file,
            e.message,
          );
        }
      }
    }

    if (removed > 0)
      console.log("[cleanup] removed", removed, "duplicate shared memes");
  } catch (err) {
    console.error("[cleanup] error:", err.message);
  }
}

// ── Migration: extraire les noms des anciens hiddenMemes ──────────────
function migrateHiddenMemeNames() {
  try {
    const hiddenMemes = store.get("hiddenMemes") || [];
    const hiddenNames = new Set(store.get("hiddenMemeNames") || []);

    let changed = false;
    for (const fullPath of hiddenMemes) {
      const name = path.basename(fullPath);
      if (!hiddenNames.has(name)) {
        hiddenNames.add(name);
        changed = true;
      }
    }

    if (changed) {
      store.set("hiddenMemeNames", Array.from(hiddenNames));
      console.log(
        "[migrate] hiddenMemeNames migrated:",
        hiddenNames.size,
        "names",
      );
    }
  } catch (err) {
    console.error("[migrate] hiddenMemeNames error:", err.message);
  }
}

// ── Renommer les anciens fichiers shared_ avec noms non sanitizés ─────
function sanitizeOldSharedFilenames() {
  try {
    const memeFolder = getMemeFolder(store, app);
    if (!fs.existsSync(memeFolder)) return;
    const files = fs.readdirSync(memeFolder);
    for (const file of files) {
      if (!file.startsWith("shared_")) continue;
      // Extraire la partie apres shared_
      var rest = file.substring(7);
      // Enlever l'eventuel timestamp numerique au debut (ancien format)
      var noTimestamp = rest.replace(/^\d+_/, "");
      // Sanitizer: remplacer TOUS les caracteres non autorises par _
      var sanitized = noTimestamp.replace(/[^a-zA-Z0-9._-]/g, "_");
      if (!sanitized || sanitized === "_") continue;
      if (sanitized === noTimestamp) continue; // Deja propre
      var oldPath = path.join(memeFolder, file);
      var newFilename = "shared_" + sanitized;
      var newPath = path.join(memeFolder, newFilename);
      // Gerer les collisions
      var counter = 2;
      while (fs.existsSync(newPath)) {
        var dot = sanitized.lastIndexOf(".");
        var base = dot >= 0 ? sanitized.substring(0, dot) : sanitized;
        var ext = dot >= 0 ? sanitized.substring(dot) : "";
        newPath = path.join(memeFolder, "shared_" + base + "_" + counter + ext);
        counter++;
      }
      fs.renameSync(oldPath, newPath);
      console.log("[cleanup] sanitized:", file, "->", path.basename(newPath));
    }
  } catch (err) {
    console.error("[cleanup] sanitize error:", err.message);
  }
}

// Collage and URL resolvers are handled by memes module
// ── Unified drop send handler (fusionne drop:send + drop:sendUrl) ─────
async function handleDropSend(payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return { ok: false, error: "Not connected" };
  }

  // 1. Build the quick_drop message with ALL fields
  const msg = {
    type: "quick_drop",
    target: payload.target,
    caption: payload.caption || null,
    captionBelow: payload.captionBelow || false,
    duration: payload.duration || null,
    rain: payload.rain || null,
    music: null,
    media: null,
  };

  // Detect mode: URL first, then collage, then file
  if (payload.url) {
    // --- URL mode (Giphy, web links) ---
    // Essayer de downloader d'abord (plus fiable, URLs Discord expires)
    let downloadedLocally = null;
    try {
      const memeFolder = getMemeFolder(store, app);
      downloadedLocally = await downloadFileFromUrl(payload.url, memeFolder);
    } catch {}

    if (downloadedLocally) {
      // Download reussi → envoyer comme fichier (buffer)
      try {
        const raw = await fs.promises.readFile(downloadedLocally.path);
        msg.media = {
          data: raw.toString("base64"),
          mime: downloadedLocally.mime || "image/gif",
          kind: downloadedLocally.kind || "gif",
          name: downloadedLocally.name || "media.gif",
          size: raw.length,
        };
      } catch {
        // Fallback: URL si fichier illisible
        const resolved = await resolveMediaUrl(payload.url);
        msg.media = {
          url: resolved.url,
          kind: resolved.kind,
          mime: resolved.mime,
          name: "media",
          size: 0,
        };
      }
    } else {
      // Download echoue → envoyer comme URL (fallback)
      const resolved = await resolveMediaUrl(payload.url);
      msg.media = {
        url: resolved.url,
        kind: resolved.kind,
        mime: resolved.mime,
        name: resolved.url.split("/").pop()?.split("?")[0] || "media",
        size: 0,
      };
    }
    // Build audio if provided
    if (payload.audioPath) {
      try {
        const ext = path.extname(payload.audioPath).toLowerCase();
        let mime = "audio/mpeg";
        if (ext === ".wav") mime = "audio/wav";
        else if (ext === ".ogg") mime = "audio/ogg";
        const data = await fs.promises.readFile(payload.audioPath, "base64");
        msg.music = {
          name: path.basename(payload.audioPath),
          kind: "audio",
          mime,
          data,
        };
      } catch (err) {
        console.error("[drop:send] audio error:", err.message);
      }
    }
  } else if (
    Array.isArray(payload.filePaths) &&
    payload.filePaths.length >= 2
  ) {
    // --- Collage mode ---
    const collage = await buildCollage(payload.filePaths);
    if (!collage) return { ok: false, error: "Collage impossible" };
    msg.media = {
      data: collage.base64,
      mime: collage.mime,
      kind: "image",
      name: `collage_${Date.now()}.jpg`,
      size: collage.buffer.length,
    };
    // Handle audio for collage too
    if (payload.audioPath) {
      try {
        const ext = path.extname(payload.audioPath).toLowerCase();
        let mime = "audio/mpeg";
        if (ext === ".wav") mime = "audio/wav";
        else if (ext === ".ogg") mime = "audio/ogg";
        const data = await fs.promises.readFile(payload.audioPath, "base64");
        msg.music = { name: path.basename(payload.audioPath), kind: "audio", mime, data };
      } catch (err) {
        console.error("[drop:send] audio error:", err.message);
      }
    }
  } else {
    // --- File mode (local memes) ---
    const fp = await formatQuickDropPayload(payload);
    msg.media = fp.media;
    msg.music = fp.music;
    if (fp.duration) msg.duration = fp.duration;
    if (fp.warning) msg.warning = fp.warning;
  }

  // 2. Send via WebSocket
  ws.send(JSON.stringify(msg));

  // 3. Local playback (unless disabled)
  if (payload.showLocalPreview !== false) {
    const localDrop = {
      type: "drop",
      media: msg.media
        ? {
            url: msg.media.data
              ? msg.media.data.startsWith("data:")
                ? msg.media.data
                : `data:${msg.media.mime};base64,${msg.media.data}`
              : msg.media.url,
            kind: msg.media.kind,
            mime: msg.media.mime,
            name: msg.media.name,
            size: msg.media.size,
          }
        : null,
      music: msg.music
        ? {
            url: msg.music.data
              ? msg.music.data.startsWith("data:")
                ? msg.music.data
                : `data:${msg.music.mime};base64,${msg.music.data}`
              : msg.music.url,
            name: msg.music.name || "audio.mp3",
          }
        : null,
      caption: msg.caption,
      captionBelow: msg.captionBelow,
      rain: msg.rain,
      from: { id: "me", username: "Moi" },
      ts: Date.now(),
    };

    if (!overlayWin || overlayWin.isDestroyed()) createOverlayWindow();
    startTopGuard();
    enforceTop();
    overlayWin.webContents.send("drop", {
      ...localDrop,
      settings: {
        volume: store.get("volume"),
        musicVolume: store.get("musicVolume"),
        duration: payload.duration || store.get("duration") || 4,
        videoDuration: payload.duration || store.get("videoDuration") || 30,
      },
    });
  }

  // 4. Persist target
  if (payload.target) {
    let list = store.get("recentTargets") || [];
    list = [payload.target, ...list.filter((t) => t !== payload.target)].slice(
      0,
      20,
    );
    store.set("recentTargets", list);
  }

  return { ok: true };
}

ipcMain.handle("drop:send", async (_e, payload) => handleDropSend(payload));
ipcMain.handle("drop:sendUrl", async (_e, payload) => handleDropSend(payload));
// Tags and favs handled by modules
// Audio handlers are managed by audio module

ipcMain.handle("streak:get", () => null);
ipcMain.handle("users:getCached", () => store.get("cachedUsers") || null);
ipcMain.handle("schedule:get", () => []);
ipcMain.handle("schedule:cancel", () => {});
ipcMain.handle("studio:templates", () => []);
ipcMain.handle("studio:generate", () => {});
ipcMain.handle("giphy:search", async (e, query, offset = 0) => {
  const apiKey = store.get("giphyApiKey") || "A7Su0Alx0oH5dgrDaOicRiEBYqeZGWdX";
  if (!apiKey) return { data: [], pagination: { total_count: 0 } };
  try {
    const { net } = require("electron");
    const res = await net.fetch(
      `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=24&offset=${offset}`,
    );
    const json = await res.json();
    return {
      data: json.data || [],
      pagination: json.pagination || { total_count: 0 },
    };
  } catch (err) {
    console.error("Giphy Search error:", err);
    return { data: [], pagination: { total_count: 0 } };
  }
});

ipcMain.handle("giphy:trending", async (e, offset = 0) => {
  const apiKey = store.get("giphyApiKey") || "A7Su0Alx0oH5dgrDaOicRiEBYqeZGWdX";
  if (!apiKey) return { data: [], pagination: { total_count: 0 } };
  try {
    const { net } = require("electron");
    const res = await net.fetch(
      `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=24&offset=${offset}`,
    );
    const json = await res.json();
    return {
      data: json.data || [],
      pagination: json.pagination || { total_count: 0 },
    };
  } catch (err) {
    console.error("Giphy Trending error:", err);
    return { data: [], pagination: { total_count: 0 } };
  }
});

ipcMain.handle("giphy:download", async (e, url) => {
  try {
    const fs = require("fs");
    const path = require("path");
    const memeFolder = getMemeFolder(store, app);
    if (!fs.existsSync(memeFolder))
      fs.mkdirSync(memeFolder, { recursive: true });

    const { net } = require("electron");
    const res = await net.fetch(url);
    const contentType = res.headers.get("content-type") || "";
    const buffer = Buffer.from(await res.arrayBuffer());
    let ext = ".gif";
    if (contentType.includes("video/mp4")) ext = ".mp4";
    else if (contentType.includes("video/webm")) ext = ".webm";
    else if (contentType.includes("image/png")) ext = ".png";
    else if (contentType.includes("image/jpeg")) ext = ".jpg";
    else if (contentType.includes("image/webp")) ext = ".webp";
    const filename = `giphy_${Date.now()}${ext}`;
    const destPath = path.join(memeFolder, filename);
    fs.writeFileSync(destPath, buffer);
    return {
      name: `giphy_${Date.now()}`,
      path: destPath,
      kind: "gif",
    };
  } catch (err) {
    console.error("Giphy download error:", err);
    return null;
  }
});

// ── Generic URL download to memes folder ──────────────────────────────────
ipcMain.handle("memes:downloadUrl", async (e, url) => {
  try {
    const fs = require("fs");
    const path = require("path");
    const { net } = require("electron");
    const memeFolder = getMemeFolder(store, app);
    if (!fs.existsSync(memeFolder))
      fs.mkdirSync(memeFolder, { recursive: true });

    const res = await net.fetch(url);
    const contentType = res.headers.get("content-type") || "";
    const buffer = Buffer.from(await res.arrayBuffer());

    // Determine extension
    let ext = ".gif";
    if (contentType.includes("video/mp4")) ext = ".mp4";
    else if (contentType.includes("video/webm")) ext = ".webm";
    else if (contentType.includes("image/png")) ext = ".png";
    else if (contentType.includes("image/jpeg")) ext = ".jpg";
    else if (contentType.includes("image/webp")) ext = ".webp";
    else if (contentType.includes("image/gif")) ext = ".gif";
    else if (contentType.includes("audio")) ext = ".mp3";

    const filename = `web_${Date.now()}${ext}`;
    const destPath = path.join(memeFolder, filename);
    fs.writeFileSync(destPath, buffer);

    const kind =
      ext === ".mp4" || ext === ".webm"
        ? "video"
        : ext === ".gif"
          ? "gif"
          : [".mp3", ".wav", ".ogg"].includes(ext)
            ? "audio"
            : "image";

    return { name: path.parse(filename).name, path: destPath, kind };
  } catch (err) {
    console.error("URL download error:", err);
    return null;
  }
});

// ── Fetch URL as data URL (bypass CSP/CORS) ─────────────────────────────────
ipcMain.handle("fetch:asDataUrl", async (e, url) => {
  try {
    const { net } = require("electron");
    const res = await net.fetch(url);
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/gif";
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch (err) {
    console.error("Fetch proxy error:", err);
    return null;
  }
});

// ── Export/import config ────────────────────────────────────────────────────
ipcMain.handle("tools:exportConfig", async () => {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: {
      serverUrl: store.get("serverUrl"),
      volume: store.get("volume"),
      duration: store.get("duration"),
      videoDuration: store.get("videoDuration"),
      giphyApiKey: store.get("giphyApiKey"),
      memeFolderPath: store.get("memeFolderPath"),
      theme: store.get("theme"),
    },
    tags: store.get("tags"),
    favorites: store.get("favorites"),
    groups: store.get("groups"),
    audioPairings: store.get("audioPairings"),
  };
  return data;
});

ipcMain.handle("tools:importConfig", async (_e, data) => {
  try {
    if (!data || !data.version) return { ok: false, error: "Format invalide" };
    if (data.settings) {
      for (const [k, v] of Object.entries(data.settings)) store.set(k, v);
    }
    if (data.tags) store.set("tags", data.tags);
    if (data.favorites) store.set("favorites", data.favorites);
    if (data.groups) store.set("groups", data.groups);
    if (data.audioPairings) store.set("audioPairings", data.audioPairings);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── Reset complet de l'app ───────────────────────────────────────────────
ipcMain.handle("tools:resetApp", async () => {
  try {
    store.clear();
    // Re-set les valeurs par défaut après le clear
    const defaults = {
      serverUrl: "wss://memedrop-bot-production.up.railway.app",
      volume: 0.75,
      musicVolume: 0.75,
      duration: 4,
      videoDuration: 30,
      soundOnArrival: true,
      autostart: false,
      hiddenMemes: [],
      hiddenMemeNames: [],
      triageState: {
        typeFilters: [],
        tag: null,
        favFilter: "all",
        sort: "name",
        query: "",
      },
    };
    for (const [k, v] of Object.entries(defaults)) store.set(k, v);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── Dialog: select folder ────────────────────────────────────────────────
ipcMain.handle("dialog:selectFolder", async () => {
  const { dialog } = require("electron");
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// ── Groups ────────────────────────────────────────────────────────────────
ipcMain.handle("groups:get", () => store.get("groups") || []);
ipcMain.handle("groups:save", (_e, name, members) => {
  const groups = store.get("groups") || [];
  const idx = groups.findIndex((g) => g.name === name);
  if (idx >= 0) groups[idx] = { name, members };
  else groups.push({ name, members });
  store.set("groups", groups);
});

// ── Audio: play sound ─────────────────────────────────────────────────────
ipcMain.handle("audio:playSound", async (_e, filePath) => {
  const wins = BrowserWindow.getAllWindows();
  for (const w of wins) {
    if (!w.isDestroyed()) w.webContents.send("audio:play", filePath);
  }
});

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

ipcMain.handle("tools:copyCommand", () => {});
