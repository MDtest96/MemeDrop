// app.js — MemeDrop QuickLauncher renderer (Phases 2-7)

// ── State ────────────────────────────────────────────────────────────────
if (!window.memedrop) {
  console.warn("Running outside Electron. Mocking window.memedrop");
  window.memedrop = {
    onConnection: () => () => {},
    onUsersList: () => () => {},
    listMemes: async () => [],
    listTargets: async () => [],
    getPreview: async (path, kind) => null,
    getTags: async () => [],
    listAllTags: async () => [],
    getAllTags: async () => ({}),
    setTags: async () => {},
    getFavorites: async () => [],
    getAudioLibrary: async () => [],
    scanAudio: async () => [],
    setAudioPairing: async () => {},
    getAudioPairings: async () => ({}),
    getHistory: async () => [],
    addHistory: async () => {},
    getStreak: async () => null,
    incrementStreak: async () => {},
    getGroups: async () => [],
    groupList: async () => [],
    groupSave: async () => {},
    getScheduled: async () => [],
    scheduleList: async () => [],
    scheduleCancel: async () => {},
    getTemplates: async () => [],
    generateMeme: async () => null,
    getUsers: async () => [],
    getSoundboard: async () => [],
    searchGiphy: async () => ({ data: [], pagination: {} }),
    trendingGiphy: async () => ({ data: [], pagination: {} }),
    downloadGiphy: async () => null,
    sendDropUrl: async () => ({ ok: true }),
    sendDrop: async () => ({ ok: true }),
    previewDrop: async () => {},
    addTarget: async () => {},
    setLastDrop: async () => {},
    getLastDrop: async () => null,
    copyCommand: () => {},
    saveFromFile: async () => null,
    saveFromClipboard: async () => null,
    captureScreenshot: async () => null,
    openMemeFolder: () => {},
    onShortcut: () => () => {},
    onLibraryChanged: () => () => {},
    onAudioPlay: () => () => {},
    getSettings: async () => ({}),
    updateSettings: async () => {},
    onUpdateState: () => () => {},
    checkForUpdates: async () => {},
    downloadUpdate: async () => {},
    installUpdate: async () => {},
    deleteMemes: async () => [],
    downloadUrl: async () => null,
    fetchAsDataUrl: async () => null,
    selectFolder: async () => null,
    playSound: async () => {},
    toggleFavorite: async () => [],
    addSoundboard: async () => {},
    removeSoundboard: async () => {},
  };
}

// ── Preview cache ──────────────────────────────────────────────────────────
const previewCache = new Map();
// Helper: cached version of getPreview (contextBridge properties are read-only,
// so we can't override window.memedrop.getPreview directly)
function getCachedPreview(path, kind) {
  const key = path + "::" + (kind || "");
  if (previewCache.has(key)) return Promise.resolve(previewCache.get(key));
  return window.memedrop.getPreview(path, kind).then((result) => {
    if (result) previewCache.set(key, result);
    return result;
  });
}

let allMemes = [];
let selectedPaths = new Set();
let currentFilter = "all";
let currentQuery = "";
let selectedMeme = null;
let allTags = [];
let activeTagFilter = null;
let allTagsMap = {}; // { path: [tag1, tag2] }
let favorites = [];
let audioLibrary = [];
let soundboard = [];
let history = [];
let scheduledDrops = [];
let streakData = null;
let groups = [];
let currentSort = "name";
let currentVolume = 100;
let currentDuration = 4;
let lastDropData = null;
let isGiphyLoading = false;
let searchTimeout = null;
let collageMode = false;
let collagePaths = [];

// ── DOM refs ────────────────────────────────────────────────────────────
const grid = document.getElementById("grid");
const gridEmpty = document.getElementById("grid-empty");
const searchInput = document.getElementById("search");
const memeCount = document.getElementById("meme-count");
const connStatus = document.getElementById("conn-status");
const dropzone = document.getElementById("dropzone");
const dropPanel = document.getElementById("drop-panel");
const panelPreview = document.getElementById("panel-preview");
const panelName = document.getElementById("panel-name");
const panelMeta = document.getElementById("panel-meta");
const panelTarget = document.getElementById("panel-target");
const panelCaption = document.getElementById("panel-caption");
const panelRain = document.getElementById("panel-rain");
const panelStatus = document.getElementById("panel-status");
const targetSuggestions = document.getElementById("target-suggestions");
const toastContainer = document.getElementById("toast-container");
const sidePanel = document.getElementById("side-panel");
const tagList = document.getElementById("tag-list");
const tagInput = document.getElementById("tag-input");
const btnTagAdd = document.getElementById("btn-tag-add");
const favoritesList = document.getElementById("favorites-list");
const audioLibraryEl = document.getElementById("audio-library");
const soundboardList = document.getElementById("soundboard-list");
const btnSoundboardAdd = document.getElementById("btn-soundboard-add");
const historyList = document.getElementById("history-list");
const scheduledList = document.getElementById("scheduled-list");
const streakCounter = document.getElementById("streak-counter");
const panelAudioSelect = document.getElementById("panel-audio-select");
const panelVolume = document.getElementById("panel-volume");
const groupSelect = document.getElementById("group-select");
const btnSaveGroup = document.getElementById("btn-save-group");
const btnDropGroup = document.getElementById("btn-drop-group");
const studioTemplate = document.getElementById("studio-template");
const studioTopText = document.getElementById("studio-top-text");
const studioBottomText = document.getElementById("studio-bottom-text");
const studioPreview = document.getElementById("studio-preview");
const btnStudioGenerate = document.getElementById("btn-studio-generate");
const giphySearch = document.getElementById("giphy-search");
const btnGiphySearch = document.getElementById("btn-giphy-search");
const btnGiphyTrending = document.getElementById("btn-giphy-trending");
const giphyGrid = document.getElementById("giphy-grid");

// ── Utility ──────────────────────────────────────────────────────────────
function toast(msg, type = "") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  toastContainer.appendChild(el);
  setTimeout(() => {
    if (el.isConnected) el.remove();
  }, 2500);
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `il y a ${days}j`;
}

// ── Connection ──────────────────────────────────────────────────────────// 🔹 Connection 🔹
const unsubConn = window.memedrop.onConnection((state) => {
  const statusMap = {
    disconnected: { cls: "conn--disconnected", label: "● Déconnecté" },
    connected: { cls: "conn--connected", label: "● Connecté" },
    linked: { cls: "conn--linked", label: "🟢 Lié à Discord" },
    awaiting_link: {
      cls: "conn--pairing",
      label: `🔵 Code: ${state.code || "En attente"}`,
    },
    pairing: {
      cls: "conn--pairing",
      label: `🔵 Code: ${state.code || "En attente"}`,
    },
  };
  const s = statusMap[state.status] || statusMap.disconnected;
  connStatus.className = `conn-badge ${s.cls}`;
  connStatus.textContent = s.label;

  const pairingDisplay = document.getElementById("pairing-code-display");
  if (pairingDisplay) {
    if (state.status === "awaiting_link" || state.status === "pairing") {
      pairingDisplay.textContent = state.code || "------";
    } else if (state.status === "linked") {
      pairingDisplay.textContent = `Lié à ${state.user?.username || "inconnu"}`;
    } else {
      pairingDisplay.textContent = "------";
    }
  }
});

if (window.memedrop.onUsersList) {
  window.memedrop.onUsersList((msg) => {
    const el = document.getElementById("users-count");
    if (el) {
      el.textContent = `${msg.count} connectés`;
      el.title =
        msg.users.map((u) => u.username).join("\n") || "Aucun utilisateur";
    }
  });
}

// ── Section A: Tabs ────────────────────────────────────────────────────
document.querySelectorAll(".studio-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document
      .querySelectorAll(".studio-tab")
      .forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    document
      .querySelectorAll(".tab-content")
      .forEach((c) => c.classList.add("hidden"));
    const content = document.getElementById("tab-" + tab.dataset.tab);
    if (content) content.classList.remove("hidden");
    if (tab.dataset.tab === "giphy") loadTrending();
    if (tab.dataset.tab === "studio") updateStudioPreview();
    if (tab.dataset.tab === "weblink") loadWeblinkTargets();
  });
});

async function loadWeblinkTargets() {
  try {
    const targets = await window.memedrop.listTargets();
    const dl = document.getElementById("weblink-target-suggestions");
    if (dl) {
      dl.innerHTML = targets.map((t) => `<option value="${t}">`).join("");
    }
  } catch (e) {
    /* silent */
  }
}

// ── Weblink send button ──────────────────────────────────────────────────
document
  .getElementById("btn-weblink-send")
  ?.addEventListener("click", async () => {
    const url = document.getElementById("weblink-url")?.value?.trim();

    if (!url) return toast("Entre une URL", "error");

    const btn = document.getElementById("btn-weblink-send");
    btn.disabled = true;
    btn.textContent = "⏳ Préparation…";

    try {
      const statusEl = document.getElementById("weblink-resolve-status");
      if (statusEl) statusEl.textContent = "🔍 Résolution du lien...";

      let isUnresolved = false;
      let resolvedUrl = url;
      let resolvedKind = url.match(/\.mp4$|\.webm$/i)
        ? "video"
        : url.match(/\.gif$/i)
          ? "gif"
          : "image";

      if (window.memedrop.resolveUrl) {
        const resolved = await window.memedrop.resolveUrl(url);
        if (resolved.unresolved) {
          if (statusEl)
            statusEl.textContent = "⚠️ Lien non résolu, envoi brut...";
          isUnresolved = true;
        } else {
          if (statusEl)
            statusEl.textContent = `✅ ${resolved.kind.toUpperCase()} détecté`;
          resolvedKind = resolved.kind;
          resolvedUrl = resolved.url; // Use thumbnail/actual media URL for download
        }
      }

      const pseudoMeme = {
        name: url.split("/").pop()?.split("?")[0] || "Lien Web",
        url,
        kind: resolvedKind,
        size: 0,
        isWeblink: true,
      };

      // Download media to memes folder
      let downloaded = null;
      try {
        downloaded = await window.memedrop.downloadUrl(url);
        if (downloaded) {
          allMemes.unshift(downloaded);
          renderGrid();
          toast(`📥 ${downloaded.name} ajouté à la grille`);
        }
      } catch (e) {
        console.warn("Could not download weblink media locally:", e);
      }

      if (downloaded) {
        // Open drop panel with the DOWNLOADED file (not the URL)
        openDropPanel(downloaded);
      } else {
        // Fallback: use URL as weblink
        openDropPanel(pseudoMeme);
      }

      document.getElementById("weblink-url").value = "";
      if (statusEl) statusEl.textContent = "";

      // We target inputs are removed from DOM so we don't clear them here
    } catch (e) {
      toast("❌ Erreur réseau", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "➡️ Configurer le Drop";
    }
  });

// ── Section D/R: Sort ──────────────────────────────────────────────────
function createSortUI() {
  const sep = document.querySelector(".filter-group + .tb-sep");
  if (!sep) return;
  const sortWrap = document.createElement("div");
  sortWrap.style.cssText = "display:flex;gap:2px;align-items:center";

  const sortOptions = [
    { value: "name", label: "A-Z" },
    { value: "date", label: "📅" },
    { value: "usage", label: "📊" },
    { value: "favorites", label: "⭐" },
  ];

  sortOptions.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "filter-btn sort-btn";
    btn.dataset.sort = opt.value;
    btn.textContent = opt.label;
    if (opt.value === currentSort) btn.classList.add("active");
    btn.title = `Trier par ${opt.value}`;
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".sort-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentSort = opt.value;
      window.memedrop.sortMemes(currentSort);
      loadMemes();
    });
    sortWrap.appendChild(btn);
  });

  sep.parentNode.insertBefore(sortWrap, sep.nextSibling);
}

// ── Selection helpers ─────────────────────────────────────────────────────
function toggleSelection(path) {
  if (selectedPaths.has(path)) {
    selectedPaths.delete(path);
  } else {
    selectedPaths.add(path);
  }
  updateSelectionUI();
}

function clearSelection() {
  selectedPaths.clear();
  updateSelectionUI();
}

function updateSelectionUI() {
  const bar = document.getElementById("selection-action-bar");
  const countEl = document.getElementById("selected-count");
  if (!bar || !countEl) return;
  const count = selectedPaths.size;
  if (count > 0) {
    countEl.textContent = `${count} sélectionné${count > 1 ? "s" : ""}`;
    bar.classList.remove("hidden");
  } else {
    bar.classList.add("hidden");
  }
  // Update visual state on cards
  document.querySelectorAll("#grid .meme-card").forEach((card) => {
    const path = card.dataset.path;
    const check = card.querySelector(".meme-check");
    if (selectedPaths.has(path)) {
      card.classList.add("selected");
      if (check) check.style.display = "flex";
    } else {
      card.classList.remove("selected");
      if (check) check.style.display = "none";
    }
  });
}

async function deleteSelected() {
  if (selectedPaths.size === 0) return;
  // Confirmation for multi-delete
  if (selectedPaths.size > 3) {
    if (!confirm(`Supprimer ${selectedPaths.size} memes définitivement ?`))
      return;
  }
  const paths = Array.from(selectedPaths);
  try {
    const results = await window.memedrop.deleteMemes(paths);
    const allOk = results.every((r) => r.ok);
    if (allOk) {
      // Remove from local array
      allMemes = allMemes.filter((m) => !selectedPaths.has(m.path));
      clearSelection();
      renderGrid();
      toast(
        `🗑 ${results.length} fichier${results.length > 1 ? "s" : ""} supprimé${results.length > 1 ? "s" : ""}`,
      );
    } else {
      const errors = results.filter((r) => !r.ok).length;
      toast(`Erreur lors de la suppression de ${errors} fichier(s)`, "error");
    }
  } catch (e) {
    toast("Erreur de suppression", "error");
  }
}

// ── Load memes ──────────────────────────────────────────────────────────
async function loadMemes() {
  try {
    allMemes = await window.memedrop.listMemes();
  } catch (e) {
    console.error("Failed to load memes", e);
  }
  renderGrid();
}

let currentRenderId = 0;
async function renderGrid() {
  const renderId = ++currentRenderId;

  // Filter
  let filtered = allMemes;
  if (currentFilter !== "all") {
    filtered = filtered.filter((m) => m.kind === currentFilter);
  }
  if (activeTagFilter) {
    filtered = filtered.filter(
      (m) => m.tags && m.tags.includes(activeTagFilter),
    );
  }
  if (currentQuery) {
    const q = currentQuery.toLowerCase();
    filtered = filtered.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (allTagsMap[m.path] &&
          allTagsMap[m.path].some((t) => t.toLowerCase().includes(q))),
    );
  }

  // Clear grid
  const cards = grid.querySelectorAll(".meme-card");
  cards.forEach((c) => c.remove());
  gridEmpty.classList.add("hidden");

  if (filtered.length === 0) {
    gridEmpty.classList.remove("hidden");
    if (allMemes.length === 0) {
      gridEmpty.innerHTML = `
        <p>Aucun meme trouvé</p>
        <p style="font-size:12px;color:var(--text-dim);margin-top:-4px">
          Ajoute des images dans le dossier Memes
        </p>
        <button id="btn-create-folder" class="primary" style="margin-top:8px">
          📂 Ouvrir le dossier Memes
        </button>
      `;
      gridEmpty
        .querySelector("#btn-create-folder")
        ?.addEventListener("click", () => {
          window.memedrop.openMemeFolder();
        });
    } else {
      gridEmpty.innerHTML = `<p>Aucun résultat pour "${currentQuery}"</p>`;
    }
    memeCount.textContent = "0 memes";
    return;
  }

  // Render cards
  const fragment = document.createDocumentFragment();
  for (const meme of filtered) {
    if (renderId !== currentRenderId) return; // Abort if a new render started

    const card = document.createElement("div");
    card.className = "meme-card";
    card.dataset.path = meme.path;
    card.dataset.kind = meme.kind;
    card.dataset.name = meme.name;

    // Badge (kind)
    const badge = document.createElement("span");
    badge.className = "meme-card-badge";
    const kindLabel = { image: "IMG", gif: "GIF", video: "VID", audio: "AUD" };
    badge.textContent = kindLabel[meme.kind] || meme.kind;
    card.appendChild(badge);

    // Selection checkmark overlay
    const check = document.createElement("div");
    check.className = "meme-check";
    check.textContent = "✓";
    card.appendChild(check);

    // Section C: Favorites toggle button
    const favBtn = document.createElement("button");
    favBtn.className = "meme-card-fav-btn";
    const isFav = favorites.includes(meme.path);
    favBtn.textContent = isFav ? "⭐" : "☆";
    favBtn.title = isFav ? "Retirer des favoris" : "Ajouter aux favoris";
    favBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const newFavs = await window.memedrop.toggleFavorite(meme.path, {
        name: meme.name,
        kind: meme.kind,
      });
      favorites = newFavs.map((f) => f.path);
      renderFavorites();
      renderGrid(); // Refresh to show updated star
      toast(isFav ? "☆ Retiré des favoris" : "⭐ Ajouté aux favoris");
    });
    card.appendChild(favBtn);

    // Preview
    if (meme.kind === "audio") {
      const icon = document.createElement("div");
      icon.className = "audio-icon";
      icon.textContent = "🎵";
      card.appendChild(icon);
    } else {
      try {
        const preview = await getCachedPreview(meme.path, meme.kind);
        if (renderId !== currentRenderId) return; // Check again after await
        if (preview) {
          const el =
            meme.kind === "video"
              ? document.createElement("video")
              : document.createElement("img");
          el.src = preview;
          if (meme.kind === "video") {
            el.muted = true;
            el.loop = true;
          }
          el.loading = "lazy";
          card.appendChild(el);
        }
      } catch (e) {
        // silent
      }
    }

    // Name
    const name = document.createElement("div");
    name.className = "meme-card-name";
    name.textContent = meme.name;
    // Double-click to rename
    name.addEventListener("dblclick", async (e) => {
      e.stopPropagation();
      const input = document.createElement("input");
      input.className = "input";
      input.value = meme.name;
      input.style.cssText = "width:100%;font-size:10px;padding:2px 4px;";
      name.textContent = "";
      name.appendChild(input);
      input.focus();
      input.select();
      const save = async () => {
        const newName = input.value.trim();
        if (newName && newName !== meme.name) {
          const result = await window.memedrop.renameMeme(meme.path, newName);
          if (result && result.ok) {
            meme.name = newName;
            meme.path = result.path;
            renderGrid();
            toast(`✏️ Renommé en ${newName}`);
          } else {
            toast("Erreur de renommage", "error");
          }
        } else {
          name.textContent = meme.name;
        }
      };
      input.addEventListener("blur", save);
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          input.blur();
        }
        if (ev.key === "Escape") {
          name.textContent = meme.name;
        }
      });
    });
    card.appendChild(name);

    // Section B: Tags display on card
    if (meme.tags && meme.tags.length > 0) {
      const tagRow = document.createElement("div");
      tagRow.style.cssText =
        "position:absolute;bottom:22px;left:6px;right:6px;display:flex;gap:2px;flex-wrap:wrap;pointer-events:none;";
      const maxTags = Math.min(meme.tags.length, 3);
      for (let i = 0; i < maxTags; i++) {
        const t = document.createElement("span");
        t.style.cssText =
          "padding:1px 4px;border-radius:3px;font-size:8px;background:rgba(0,0,0,0.6);color:rgba(255,255,255,0.7);";
        t.textContent = meme.tags[i];
        tagRow.appendChild(t);
      }
      if (meme.tags.length > 3) {
        const more = document.createElement("span");
        more.style.cssText =
          "padding:1px 4px;border-radius:3px;font-size:8px;background:rgba(0,0,0,0.6);color:rgba(255,255,255,0.5);";
        more.textContent = `+${meme.tags.length - 3}`;
        tagRow.appendChild(more);
      }
      card.appendChild(tagRow);
    }

    card.addEventListener("click", (e) => {
      if (collageMode) {
        if (collagePaths.length < 4 && !collagePaths.includes(meme.path)) {
          collagePaths.push(meme.path);
          card.classList.add("selected-collage");
          const lbl = document.getElementById("btn-collage-mode");
          if (lbl) lbl.textContent = `🖼️ Collage (${collagePaths.length}/4)`;
          const cnt = document.getElementById("collage-count-label");
          if (cnt) cnt.textContent = `${collagePaths.length}/4 images`;
        }
        return;
      }
      // Ctrl/Meta+Click toggles selection, regular click opens drop panel
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        toggleSelection(meme.path);
        return;
      }
      openDropPanel(meme);
    });
    fragment.appendChild(card);
  }

  grid.appendChild(fragment);
  memeCount.textContent = `${filtered.length} meme${filtered.length > 1 ? "s" : ""}`;
}

// ── Search (debounced 300ms) ──────────────────────────────────────────
searchInput.addEventListener("input", () => {
  currentQuery = searchInput.value;
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    renderGrid();
  }, 300);
});

// ── Filter buttons ──────────────────────────────────────────────────────
document.querySelectorAll(".filter-btn").forEach((btn) => {
  if (btn.classList.contains("sort-btn")) return; // skip sort buttons
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".filter-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    activeTagFilter = null;
    renderGrid();
  });
});

// ── Toolbar buttons ─────────────────────────────────────────────────────
document.getElementById("btn-refresh")?.addEventListener("click", loadMemes);
document
  .getElementById("btn-open-folder")
  ?.addEventListener("click", () => window.memedrop.openMemeFolder());

document
  .getElementById("btn-clipboard")
  ?.addEventListener("click", async () => {
    const result = await window.memedrop.saveFromClipboard();
    if (result) {
      allMemes.unshift(result);
      renderGrid();
      toast("📋 Image collée depuis le presse-papier");
    } else {
      toast("Aucune image dans le presse-papier", "error");
    }
  });

document
  .getElementById("btn-screenshot")
  ?.addEventListener("click", async () => {
    toast("📷 Capture d'écran en cours…");
    const result = await window.memedrop.captureScreenshot();
    if (result && result.path) {
      allMemes.unshift(result);
      renderGrid();
      toast("📷 Capture ajoutée !");
    } else {
      toast("Capture annulée", "error");
    }
  });

// ── Section P: Side panel toggle ───────────────────────────────────────
document.getElementById("btn-side-panel")?.addEventListener("click", () => {
  sidePanel.classList.toggle("hidden");
});

// ── Section B: Tags ────────────────────────────────────────────────────
async function loadTags() {
  try {
    allTags = (await window.memedrop.listAllTags()) || [];
    allTagsMap = (await window.memedrop.getAllTags()) || {};
  } catch (e) {
    allTags = [];
    allTagsMap = {};
  }
  renderTags();
}

function renderTags() {
  if (!tagList) return;
  tagList.innerHTML = "";
  if (activeTagFilter) {
    const clear = document.createElement("span");
    clear.className = "tag-pill";
    clear.textContent = "✕ Tous";
    clear.addEventListener("click", () => {
      activeTagFilter = null;
      renderTags();
      renderGrid();
    });
    tagList.appendChild(clear);
  }
  for (const tag of allTags) {
    const pill = document.createElement("span");
    pill.className = "tag-pill" + (activeTagFilter === tag ? " active" : "");
    pill.textContent = tag;
    pill.addEventListener("click", () => {
      activeTagFilter = activeTagFilter === tag ? null : tag;
      renderTags();
      renderGrid();
    });
    tagList.appendChild(pill);
  }
}

btnTagAdd?.addEventListener("click", async () => {
  if (!selectedMeme) return toast("Sélectionne d'abord un meme", "error");
  const tag = tagInput.value.trim();
  if (!tag) return;
  try {
    const currentTags = selectedMeme.tags || [];
    if (currentTags.includes(tag)) {
      toast("Tag déjà ajouté", "error");
      return;
    }
    currentTags.push(tag);
    await window.memedrop.setTags(selectedMeme.path, currentTags);
    selectedMeme.tags = currentTags;
    tagInput.value = "";
    await loadTags();
    renderGrid();
    toast(`🏷️ Tag "${tag}" ajouté`);
  } catch (e) {
    toast("Erreur lors de l'ajout du tag", "error");
  }
});

tagInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnTagAdd?.click();
});

// ── Section C: Favorites ───────────────────────────────────────────────
async function loadFavorites() {
  try {
    const raw = (await window.memedrop.getFavorites()) || [];
    // Normalize: backend returns [{ path, name, kind, ts }], keep paths for lookup
    favorites = raw.map((f) => f.path);
  } catch (e) {
    favorites = [];
  }
  renderFavorites();
}

function renderFavorites() {
  if (!favoritesList) return;
  favoritesList.innerHTML = "";
  const favPaths = new Set(favorites);
  const favMemes = allMemes.filter((m) => favPaths.has(m.path));
  if (favMemes.length === 0) {
    favoritesList.innerHTML =
      '<p style="font-size:11px;color:var(--text-dim);">Aucun favori</p>';
    return;
  }
  for (const meme of favMemes.slice(0, 20)) {
    const item = document.createElement("div");
    item.className = "fav-item";
    item.innerHTML = `
      <span class="fav-thumb" style="display:flex;align-items:center;justify-content:center;font-size:16px;">${meme.kind === "audio" ? "🎵" : "🖼️"}</span>
      <span class="fav-name">${meme.name}</span>
    `;
    item.addEventListener("click", () => openDropPanel(meme));
    favoritesList.appendChild(item);
  }
}

// ── Section E: Audio Library + Soundboard ─────────────────────────────
async function loadAudioLibrary() {
  try {
    audioLibrary = (await window.memedrop.scanAudio()) || [];
  } catch (e) {
    audioLibrary = [];
  }
  renderAudioLibrary();
  renderAudioSelect();
}

function renderAudioLibrary() {
  if (!audioLibraryEl) return;
  audioLibraryEl.innerHTML = "";
  if (audioLibrary.length === 0) {
    audioLibraryEl.innerHTML =
      '<p style="font-size:11px;color:var(--text-dim);">Aucun son trouvé</p>';
    return;
  }
  for (const audio of audioLibrary) {
    const card = document.createElement("div");
    card.className = "audio-card";
    card.dataset.path = audio.path;

    const playBtn = document.createElement("button");
    playBtn.className = "play-btn";
    playBtn.textContent = "▶";
    playBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      playAudio(audio.path);
    });

    const name = document.createElement("span");
    name.className = "audio-name";
    name.textContent = audio.name;

    const assocBtn = document.createElement("button");
    assocBtn.className = "assoc-btn";
    assocBtn.textContent = "🔗 Associer";
    assocBtn.title = "Associer ce son au meme sélectionné";
    assocBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!selectedMeme) return toast("Sélectionne d'abord un meme", "error");
      window.memedrop.setAudioPairing(selectedMeme.path, audio.path);
      toast(`🔗 Son associé à ${selectedMeme.name}`);
    });

    card.appendChild(playBtn);
    card.appendChild(name);
    card.appendChild(assocBtn);
    audioLibraryEl.appendChild(card);
  }
}

// Soundboard state (persisted in localStorage)
function loadSoundboard() {
  try {
    soundboard = JSON.parse(
      localStorage.getItem("memedrop_soundboard") || "[]",
    );
  } catch (e) {
    soundboard = [];
  }
  renderSoundboard();
}

function saveSoundboard() {
  localStorage.setItem("memedrop_soundboard", JSON.stringify(soundboard));
  renderSoundboard();
}

function renderSoundboard() {
  if (!soundboardList) return;
  soundboardList.innerHTML = "";
  if (soundboard.length === 0) {
    soundboardList.innerHTML =
      '<p style="font-size:11px;color:var(--text-dim);">Aucun son dans le soundboard</p>';
    return;
  }
  for (const audio of soundboard) {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:4px;align-items:center;width:100%;";

    const playBtn = document.createElement("button");
    playBtn.className = "ghost";
    playBtn.textContent = "▶";
    playBtn.title = "Jouer le son";
    playBtn.style.cssText = "padding:4px 8px;font-size:11px;flex-shrink:0;";
    playBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      window.memedrop.playSound(audio.path);
    });
    row.appendChild(playBtn);

    const btn = document.createElement("button");
    btn.className = "ghost";
    btn.style.cssText =
      "width:100%;text-align:left;padding:8px;font-size:12px;";
    btn.textContent = `🔊 ${audio.name}`;
    btn.title = "Envoyer ce son comme drop audio";
    btn.addEventListener("click", async () => {
      const target = prompt("Cible (@utilisateur) :");
      if (!target) return;
      const result = await window.memedrop.sendDrop({
        target,
        filePath: audio.path,
        caption: null,
        rain: null,
        kind: "audio",
      });
      if (result && result.ok) {
        toast(`🔊 Son envoyé à ${target}`);
      } else {
        toast("Erreur d'envoi", "error");
      }
    });
    row.appendChild(btn);
    soundboardList.appendChild(row);
  }
}

btnSoundboardAdd?.addEventListener("click", () => {
  if (!selectedMeme) return toast("Sélectionne d'abord un meme", "error");
  if (selectedMeme.kind !== "audio")
    return toast("Le meme sélectionné n'est pas un audio", "error");
  if (soundboard.some((a) => a.path === selectedMeme.path)) {
    toast("Déjà dans le soundboard", "error");
    return;
  }
  soundboard.push({ name: selectedMeme.name, path: selectedMeme.path });
  saveSoundboard();
  toast("🔊 Son ajouté au soundboard");
});

// Audio playback
const audioElements = {};
function playAudio(path) {
  try {
    if (audioElements[path]) {
      audioElements[path].pause();
      audioElements[path].currentTime = 0;
      delete audioElements[path];
      return;
    }
    window.memedrop
      .getAudioPreview(path)
      .then((previewUrl) => {
        if (!previewUrl) return;
        const audio = new Audio(previewUrl);
        audioElements[path] = audio;
        audio.play().catch(() => {});
        audio.addEventListener("ended", () => {
          delete audioElements[path];
        });
      })
      .catch(() => {});
  } catch (e) {
    // silent
  }
}

// ── Section F: Audio Pairing + Volume in Drop Panel ─────────────────────
async function renderAudioSelect(selectedPath) {
  if (!panelAudioSelect) return;
  panelAudioSelect.innerHTML = '<option value="">Aucun son</option>';
  for (const audio of audioLibrary) {
    const opt = document.createElement("option");
    opt.value = audio.path;
    opt.textContent = audio.name;
    if (audio.path === selectedPath) opt.selected = true;
    panelAudioSelect.appendChild(opt);
  }
}

// Section G: Volume
panelVolume?.addEventListener("input", () => {
  currentVolume = parseInt(panelVolume.value, 10) || 100;
});

// Duration slider
const panelDuration = document.getElementById("panel-duration");
const panelDurationOut = document.getElementById("panel-duration-out");
panelDuration?.addEventListener("input", () => {
  currentDuration = parseInt(panelDuration.value, 10) || 4;
  if (panelDurationOut) panelDurationOut.textContent = `${currentDuration}s`;
});

// ── Section H: History ─────────────────────────────────────────────────
async function loadHistory() {
  try {
    history = (await window.memedrop.getHistory()) || [];
  } catch (e) {
    history = [];
  }
  renderHistory();
}

function renderHistory() {
  if (!historyList) return;
  historyList.innerHTML = "";
  if (history.length === 0) {
    historyList.innerHTML =
      '<p style="font-size:11px;color:var(--text-dim);">Aucun historique</p>';
    return;
  }
  for (const entry of history.slice(-50).reverse()) {
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <div class="history-info">
        <div class="history-target">${entry.from || entry.target || ""}</div>
        <div class="history-meme">${entry.name || entry.fileName || entry.caption || ""}</div>
      </div>
      <span class="history-time">${entry.ts ? timeAgo(entry.ts) : ""}</span>
    `;
    item.addEventListener("click", () => {
      const meme = allMemes.find(
        (m) => m.name === entry.name || m.path === entry.filePath,
      );
      if (meme) openDropPanel(meme);
    });
    historyList.appendChild(item);
  }
}

// ── Drag & drop files from explorer ───────────────────────────────────────
// grid is already declared in DOM refs section
if (grid) {
  grid.addEventListener("dragover", (e) => {
    e.preventDefault();
    grid.classList.add("drag-over");
  });
  grid.addEventListener("dragleave", () => {
    grid.classList.remove("drag-over");
  });
  grid.addEventListener("drop", async (e) => {
    e.preventDefault();
    grid.classList.remove("drag-over");
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    let imported = 0;
    for (const file of files) {
      try {
        const result = await window.memedrop.saveFromFile(file.path);
        if (result) {
          allMemes.unshift(result);
          imported++;
        }
      } catch {}
    }
    if (imported > 0) {
      renderGrid();
      toast(`📦 ${imported} fichier(s) importé(s)`);
    }
  });
}

// ── Side panel toggle ─────────────────────────────────────────────────
async function openDropPanel(meme) {
  selectedMeme = meme;
  panelName.textContent = meme.name;

  const sizeStr =
    meme.size > 1024 * 1024
      ? `${(meme.size / 1024 / 1024).toFixed(1)} MB`
      : `${(meme.size / 1024).toFixed(0)} KB`;
  panelMeta.textContent = `${meme.kind.toUpperCase()} · ${sizeStr}`;

  // Preview
  panelPreview.innerHTML = "";
  if (meme.isCollage) {
    const el = document.createElement("img");
    el.src = `data:${meme.mime || "image/jpeg"};base64,${meme.base64}`;
    panelPreview.appendChild(el);
  } else if (meme.isWeblink) {
    const el =
      meme.kind === "video"
        ? document.createElement("video")
        : document.createElement("img");
    el.src = meme.url;
    if (meme.kind === "video") el.muted = true;
    panelPreview.appendChild(el);
  } else if (meme.kind === "audio") {
    const d = document.createElement("div");
    d.className = "audio-icon-tn";
    d.textContent = "🎵";
    panelPreview.appendChild(d);
  } else {
    try {
      const preview = await getCachedPreview(meme.path, meme.kind);
      if (preview) {
        const el =
          meme.kind === "video"
            ? document.createElement("video")
            : document.createElement("img");
        el.src = preview;
        if (meme.kind === "video") el.muted = true;
        panelPreview.appendChild(el);
      }
    } catch (e) {
      // silent
    }
  }

  // Load recent targets
  const targets = await window.memedrop.listTargets();
  if (targetSuggestions) {
    targetSuggestions.innerHTML = targets
      .map((t) => `<option value="${t}">`)
      .join("");
  }
  panelTarget.selectedIndex = -1; // Deselect all in multi-select
  const panelTargetAdd = document.getElementById("panel-target-add");
  if (panelTargetAdd) panelTargetAdd.value = "";
  panelCaption.value = "";
  panelRain.value = "";
  panelStatus.textContent = "";
  panelStatus.className = "panel-status";

  // Section B: Load tags for this meme
  try {
    const memeTags =
      meme.tags ||
      ((await window.memedrop.getTags)
        ? await window.memedrop.getTags(meme.path)
        : []);
    meme.tags = memeTags;
    if (tagList) {
      tagList.innerHTML = "";
      if (memeTags.length === 0) {
        const none = document.createElement("span");
        none.style.cssText = "font-size:11px;color:var(--text-dim);";
        none.textContent = "Aucun tag";
        tagList.appendChild(none);
      } else {
        for (const tag of memeTags) {
          const pill = document.createElement("span");
          pill.className = "tag-pill";
          pill.textContent = tag;
          pill.addEventListener("click", () => {
            activeTagFilter = tag;
            closeDropPanel();
            renderTags();
            renderGrid();
          });
          tagList.appendChild(pill);
        }
      }
    }
  } catch (e) {
    // silent
  }

  // Section F: Load audio pairing for this meme
  try {
    const pairings = (await window.memedrop.getAudioPairings()) || {};
    const pairedAudio = pairings[meme.path];
    await renderAudioSelect(pairedAudio || null);
  } catch (e) {
    await renderAudioSelect();
  }

  // Section G: Reset volume slider
  if (panelVolume) panelVolume.value = currentVolume;
  if (panelDuration) panelDuration.value = currentDuration;
  if (panelDurationOut) panelDurationOut.textContent = `${currentDuration}s`;

  dropPanel.classList.remove("hidden");
}

function closeDropPanel() {
  dropPanel.classList.add("hidden");
  selectedMeme = null;
}

document
  .getElementById("panel-backdrop")
  ?.addEventListener("click", closeDropPanel);
document
  .getElementById("panel-close")
  ?.addEventListener("click", closeDropPanel);
document
  .getElementById("btn-panel-close")
  ?.addEventListener("click", closeDropPanel);

// Rain presets
document.querySelectorAll(".rain-pill").forEach((btn) => {
  btn.addEventListener("click", () => {
    panelRain.value = btn.dataset.rain;
  });
});

// Preview Local
document.getElementById("btn-preview")?.addEventListener("click", async () => {
  if (!selectedMeme) return;
  const caption = panelCaption.value.trim() || null;
  const rain = panelRain.value.trim() || null;
  const volume = currentVolume;
  const audioPath = panelAudioSelect ? panelAudioSelect.value : null;

  await window.memedrop.previewDrop({
    filePath: selectedMeme.path,
    audioPath,
    caption,
    rain,
    kind: selectedMeme.kind,
    volume,
  });
});

// Send
document.getElementById("btn-send")?.addEventListener("click", async () => {
  if (!selectedMeme) return;
  // Get selected targets from multi-select
  const targets = Array.from(panelTarget?.selectedOptions || [])
    .map((o) => o.value.trim())
    .filter(Boolean);
  if (targets.length === 0) {
    panelStatus.textContent = "❌ Sélectionne au moins une cible";
    panelStatus.className = "panel-status error";
    return;
  }

  const caption = panelCaption.value.trim() || null;
  const rain = panelRain.value.trim() || null;
  const sendBtn = document.getElementById("btn-send");
  sendBtn.disabled = true;
  sendBtn.textContent = "⏳ Envoi…";
  panelStatus.textContent = "";

  // Section F: Get selected audio pairing
  const audioPath = panelAudioSelect ? panelAudioSelect.value : null;

  // Section G: Get volume
  const volume = currentVolume;

  // Send to all selected targets
  let successCount = 0;
  let lastTarget = "";
  const localPreview =
    document.getElementById("panel-local-preview")?.checked ?? true;
  for (const [idx, target] of targets.entries()) {
    lastTarget = target;
    let result;
    if (selectedMeme.isWeblink) {
      result = await window.memedrop.sendDropUrl({
        target,
        url: selectedMeme.url,
        caption,
        rain,
        kind: selectedMeme.kind,
      });
    } else if (selectedMeme.isCollage) {
      // Send each file individually to preserve GIF animation / video
      let sentCount = 0;
      for (const fp of selectedMeme.collagePaths) {
        const r = await window.memedrop.sendDrop({
          target,
          filePath: fp,
          caption: null,
          rain: null,
          kind: "image",
          volume,
          showLocalPreview: false,
        });
        if (r && r.ok) sentCount++;
      }
      result = { ok: sentCount > 0, count: sentCount };
    } else {
      result = await window.memedrop.sendDrop({
        target,
        filePath: selectedMeme.path,
        audioPath,
        caption,
        rain,
        kind: selectedMeme.kind,
        volume,
        duration: currentDuration,
        showLocalPreview: idx === 0 ? localPreview : false,
      });
    }

    if (result && result.ok) {
      successCount++;
      await window.memedrop.addTarget(target);
      await window.memedrop.addHistory({
        target,
        name: selectedMeme.name,
        ts: Date.now(),
      });
    }
  }

  sendBtn.disabled = false;
  sendBtn.textContent = "🚀 Envoyer";

  if (successCount > 0) {
    panelStatus.textContent = `✅ Drop envoyé à ${successCount}/${targets.length} cible(s)`;
    panelStatus.className = "panel-status success";

    // Section F: Persist audio pairing if selected
    if (audioPath) {
      try {
        await window.memedrop.setAudioPairing(selectedMeme.path, audioPath);
      } catch (e) {
        // silent
      }
    }

    // Section I: Set last drop
    lastDropData = {
      target: targets[0],
      filePath: selectedMeme.path,
      caption,
      rain,
      kind: selectedMeme.kind,
      volume,
    };
    try {
      await window.memedrop.setLastDrop(lastDropData);
    } catch (e) {
      // silent
    }

    // Section N: Increment streak
    try {
      await window.memedrop.incrementStreak();
      await loadStreak();
    } catch (e) {
      // silent
    }

    // Section H: Refresh history
    await loadHistory();

    toast(
      `✅ Drop envoyé à ${targets.length} cible${targets.length > 1 ? "s" : ""}`,
    );
    closeDropPanel();
  } else {
    panelStatus.textContent = `❌ Échec de l'envoi`;
    panelStatus.className = "panel-status error";
  }
});

// Copy command
document.getElementById("btn-copy-cmd")?.addEventListener("click", () => {
  if (!selectedMeme) return;
  const targets = Array.from(panelTarget?.selectedOptions || [])
    .map((o) => o.value.trim())
    .filter(Boolean);
  const target = targets[0] || "@pote";
  const caption = panelCaption.value.trim() || null;
  const rain = panelRain.value.trim() || null;
  window.memedrop.copyCommand({
    target,
    fileName: selectedMeme.name,
    caption,
    rain,
  });
  toast("📋 Commande copiée dans le presse-papier");
});

// Enter to send in target field
panelTarget?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("btn-send")?.click();
});

// ── Section I: Last Drop + Hotkey re-send ─────────────────────────────
async function setupShortcutListener() {
  try {
    const unsub = window.memedrop.onShortcut((action) => {
      if (action === "resend") {
        handleResend();
      } else if (action === "capture") {
        triggerScreenshot();
      }
    });
  } catch (e) {
    console.warn("onShortcut not available", e);
  }
}

async function handleResend() {
  try {
    const lastDrop = await window.memedrop.getLastDrop();
    if (!lastDrop) {
      toast("Aucun dernier drop", "error");
      return;
    }
    const result = await window.memedrop.sendDrop(lastDrop);
    if (result && result.ok) {
      toast("🔄 Dernier drop renvoyé !");
      // Refresh history + streak
      await loadHistory();
      try {
        await window.memedrop.incrementStreak();
        await loadStreak();
      } catch (e) {
        /* silent */
      }
    } else {
      toast("Échec du renvoi", "error");
    }
  } catch (e) {
    toast("Erreur lors du renvoi", "error");
  }
}

async function triggerScreenshot() {
  try {
    const result = await window.memedrop.captureScreenshot();
    if (result && result.path) {
      allMemes.unshift(result);
      renderGrid();
      toast("📷 Capture d'écran effectuée");
    }
  } catch (e) {
    toast("Capture annulée", "error");
  }
}

// ── Section K: Studio ─────────────────────────────────────────────────
async function loadTemplates() {
  if (!studioTemplate) return;
  try {
    const templates = (await window.memedrop.getTemplates()) || [];
    studioTemplate.innerHTML =
      '<option value="">Sélectionner un template...</option>';
    for (const tpl of templates) {
      const opt = document.createElement("option");
      opt.value = tpl.path;
      opt.textContent = tpl.name;
      studioTemplate.appendChild(opt);
    }
  } catch (e) {
    studioTemplate.innerHTML =
      '<option value="">Aucun template disponible</option>';
  }
}

function updateStudioPreview() {
  // Preview is handled by canvas drawing when template + texts are filled
  const ctx = studioPreview?.getContext("2d");
  if (!ctx) return;
  const tplPath = studioTemplate?.value;
  if (!tplPath) {
    ctx.clearRect(0, 0, studioPreview.width, studioPreview.height);
    ctx.fillStyle = "#1a1230";
    ctx.fillRect(0, 0, studioPreview.width, studioPreview.height);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      "Sélectionne un template",
      studioPreview.width / 2,
      studioPreview.height / 2,
    );
    return;
  }
  // Draw template preview
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    window.memedrop
      .getPreview(tplPath, "image")
      .then((src) => {
        if (!src) return;
        img.onload = () => {
          const w = studioPreview.width;
          const h = studioPreview.height;
          ctx.clearRect(0, 0, w, h);
          // Draw image fitting canvas
          const scale = Math.min(w / img.width, h / img.height);
          const x = (w - img.width * scale) / 2;
          const y = (h - img.height * scale) / 2;
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

          // Draw top text
          const topText = studioTopText?.value || "";
          const bottomText = studioBottomText?.value || "";
          ctx.fillStyle = "white";
          ctx.strokeStyle = "black";
          ctx.lineWidth = 3;
          ctx.font = `bold ${Math.round(32 * scale)}px Impact, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          if (topText) {
            ctx.strokeText(topText, w / 2, 10);
            ctx.fillText(topText, w / 2, 10);
          }
          if (bottomText) {
            ctx.textBaseline = "bottom";
            ctx.strokeText(bottomText, w / 2, h - 10);
            ctx.fillText(bottomText, w / 2, h - 10);
          }
        };
        img.src = src;
      })
      .catch(() => {});
  } catch (e) {
    // silent
  }
}

studioTemplate?.addEventListener("change", updateStudioPreview);
studioTopText?.addEventListener("input", updateStudioPreview);
studioBottomText?.addEventListener("input", updateStudioPreview);

btnStudioGenerate?.addEventListener("click", async () => {
  if (!studioTemplate?.value) return toast("Sélectionne un template", "error");
  const topText = studioTopText?.value || "";
  const bottomText = studioBottomText?.value || "";
  if (!topText && !bottomText)
    return toast("Ajoute au moins un texte", "error");

  try {
    const outputName = `studio_${Date.now()}`;
    const result = await window.memedrop.generateMeme({
      templatePath: studioTemplate.value,
      topText,
      bottomText,
      outputName,
    });
    if (result) {
      allMemes.unshift(result);
      renderGrid();
      openDropPanel(result);
      toast("✨ Meme généré et prêt à être envoyé");
    } else {
      toast("Erreur de génération", "error");
    }
  } catch (e) {
    toast("Erreur de génération", "error");
  }
});

// ── Section L: GIPHY ──────────────────────────────────────────────────
let giphyOffset = 0;
let giphyQuery = null;
let giphyHasMore = true;
const GIPHY_LIMIT = 24;

async function loadGiphy(query, reset = true) {
  if (isGiphyLoading) return;
  if (reset) {
    giphyOffset = 0;
    giphyQuery = query;
    giphyHasMore = true;
    giphyGrid.innerHTML =
      '<p style="grid-column:1/-1;text-align:center;color:var(--text-dim);">Recherche…</p>';
  }
  try {
    isGiphyLoading = true;
    let result;
    if (query) {
      result = (await window.memedrop.searchGiphy(query, giphyOffset)) || {
        data: [],
        pagination: {},
      };
    } else {
      result = (await window.memedrop.trendingGiphy(giphyOffset)) || {
        data: [],
        pagination: {},
      };
    }
    const items = result.data || [];
    const total = result.pagination?.total_count || 0;
    // Giphy trending API returns total_count=0, assume there's always more
    giphyHasMore = total === 0 || giphyOffset + GIPHY_LIMIT < total;

    if (reset) {
      renderGiphyGrid(items);
    } else {
      appendGiphyGrid(items);
    }

    if (reset && items.length === 0) {
      giphyGrid.innerHTML =
        '<p style="grid-column:1/-1;text-align:center;color:var(--text-dim);">Aucun résultat</p>';
    }
  } catch (e) {
    if (reset)
      giphyGrid.innerHTML =
        '<p style="grid-column:1/-1;text-align:center;color:var(--text-dim);">Erreur de chargement</p>';
  } finally {
    isGiphyLoading = false;
  }
}

btnGiphySearch?.addEventListener("click", () => {
  const query = giphySearch?.value.trim();
  if (!query) return;
  loadGiphy(query, true);
});

async function loadTrending() {
  loadGiphy(null, true);
}

btnGiphyTrending?.addEventListener("click", loadTrending);

giphySearch?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnGiphySearch?.click();
});

// Infinite scroll
let giphyScrollTimer = null;
giphyGrid?.addEventListener("scroll", () => {
  clearTimeout(giphyScrollTimer);
  giphyScrollTimer = setTimeout(() => {
    if (isGiphyLoading || !giphyHasMore) return;
    const { scrollTop, scrollHeight, clientHeight } = giphyGrid;
    if (scrollTop + clientHeight >= scrollHeight - 200) {
      giphyOffset += GIPHY_LIMIT;
      loadGiphy(giphyQuery, false);
    }
  }, 200);
});

function appendGiphyGrid(items) {
  if (!giphyGrid) return;
  // Remove "loading..." indicator if present
  const loadingEl = giphyGrid.querySelector(".giphy-loading");
  if (loadingEl) loadingEl.remove();

  for (const gif of items) {
    const item = createGiphyItem(gif);
    if (item) giphyGrid.appendChild(item);
  }

  if (!giphyHasMore) {
    const end = document.createElement("p");
    end.className = "giphy-loading";
    end.style.cssText =
      "grid-column:1/-1;text-align:center;color:var(--text-dim);font-size:11px;padding:8px";
    end.textContent = "— Plus de résultats —";
    giphyGrid.appendChild(end);
  }
}

function createGiphyItem(gif) {
  const item = document.createElement("div");
  item.className = "giphy-item";

  const img = document.createElement("img");
  const gifUrl =
    gif?.images?.fixed_height?.url || gif?.images?.original?.url || "";
  if (!gifUrl) return null; // Skip invalid GIFs
  (async () => {
    try {
      const dataUrl = await window.memedrop.fetchAsDataUrl(gifUrl);
      if (dataUrl) {
        img.src = dataUrl;
      } else {
        // Fallback: try direct URL (might be blocked by CSP)
        img.src = gifUrl;
      }
    } catch {
      // Direct URL as last resort
      img.src = gifUrl;
    }
  })();
  img.loading = "lazy";
  img.alt = gif.title || "GIF";
  // Progress bar for download
  const progress = document.createElement("div");
  progress.className = "giphy-progress";
  progress.style.cssText =
    "position:absolute;bottom:32px;left:4px;right:4px;height:3px;background:rgba(255,255,255,0.2);border-radius:2px;display:none";
  const progressFill = document.createElement("div");
  progressFill.style.cssText =
    "width:0%;height:100%;background:var(--accent-a);border-radius:2px;transition:width 0.3s";
  progress.appendChild(progressFill);
  item.appendChild(progress);

  const dropBtn = document.createElement("button");
  dropBtn.className = "drop-btn";
  dropBtn.textContent = "⬇ Drop";
  const handleGiphyDownload = async () => {
    progress.style.display = "block";
    progressFill.style.width = "30%";
    try {
      const downloaded = await window.memedrop.downloadGiphy(
        gif.images?.original?.url || gif.images?.fixed_height?.url,
      );
      progressFill.style.width = "100%";
      setTimeout(() => {
        progress.style.display = "none";
        progressFill.style.width = "0%";
      }, 500);
      if (downloaded) {
        allMemes.unshift(downloaded);
        renderGrid();
        openDropPanel(downloaded);
        toast("🌐 GIF importé !");
      } else {
        toast("Erreur d'import GIF", "error");
      }
    } catch (err) {
      toast("Erreur d'import GIF", "error");
    }
  };
  dropBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    await handleGiphyDownload();
  });
  item.appendChild(dropBtn);
  item.addEventListener("click", handleGiphyDownload);

  return item;
}

function renderGiphyGrid(items) {
  if (!giphyGrid) return;
  giphyGrid.innerHTML = "";
  if (items.length === 0) {
    giphyGrid.innerHTML =
      '<p style="grid-column:1/-1;text-align:center;color:var(--text-dim);">Aucun résultat</p>';
    return;
  }
  for (const gif of items) {
    const item = createGiphyItem(gif);
    if (item) giphyGrid.appendChild(item);
  }
  if (items.length >= GIPHY_LIMIT) {
    const loader = document.createElement("p");
    loader.className = "giphy-loading";
    loader.style.cssText =
      "grid-column:1/-1;text-align:center;color:var(--text-dim);font-size:12px;padding:12px";
    loader.textContent = "⬇ Scrollez pour plus de résultats";
    giphyGrid.appendChild(loader);
  }
}

// ── Section M: Groups ─────────────────────────────────────────────────
async function loadGroups() {
  if (!groupSelect) return;
  try {
    groups = (await window.memedrop.groupList()) || [];
    groupSelect.innerHTML = '<option value="">Groupes…</option>';
    for (const g of groups) {
      const opt = document.createElement("option");
      opt.value = typeof g === "string" ? g : g.name;
      opt.textContent = typeof g === "string" ? g : g.name;
      groupSelect.appendChild(opt);
    }
  } catch (e) {
    groupSelect.innerHTML = '<option value="">Groupes…</option>';
  }
}

document
  .getElementById("btn-select-all-targets")
  ?.addEventListener("click", () => {
    const sel = panelTarget;
    if (sel) Array.from(sel.options).forEach((o) => (o.selected = true));
  });
document.getElementById("btn-clear-targets")?.addEventListener("click", () => {
  const sel = panelTarget;
  if (sel) sel.selectedIndex = -1;
});

// ── Custom targets ────────────────────────────────────────────────────────
let customTargets = new Set();
try {
  const saved = JSON.parse(
    localStorage.getItem("memedrop_custom_targets") || "[]",
  );
  customTargets = new Set(saved);
} catch {}

function saveCustomTargets() {
  localStorage.setItem(
    "memedrop_custom_targets",
    JSON.stringify([...customTargets]),
  );
}

// Add custom target
const panelTargetAdd = document.getElementById("panel-target-add");
const addTargetBtn = document.getElementById("btn-add-target");
function addCustomTarget() {
  if (!panelTargetAdd || !panelTarget) return;
  const val = panelTargetAdd.value.trim();
  if (!val) return;
  customTargets.add(val);
  saveCustomTargets();
  // Check if already exists in select
  const exists = Array.from(panelTarget.options).some((o) => o.value === val);
  if (exists) {
    const opt = Array.from(panelTarget.options).find((o) => o.value === val);
    if (opt) opt.selected = true;
    panelTargetAdd.value = "";
    return;
  }
  const opt = document.createElement("option");
  opt.value = val;
  opt.textContent = val;
  opt.selected = true;
  panelTarget.appendChild(opt);
  panelTargetAdd.value = "";
}
addTargetBtn?.addEventListener("click", addCustomTarget);
panelTargetAdd?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addCustomTarget();
});

btnSaveGroup?.addEventListener("click", async () => {
  const name = prompt("Nom du groupe :");
  if (!name) return;
  const membersStr = prompt("Membres (séparés par des virgules) :");
  if (!membersStr) return;
  const members = membersStr
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  try {
    await window.memedrop.groupSave(name, members);
    await loadGroups();
    toast(`💾 Groupe "${name}" sauvegardé`);
  } catch (e) {
    toast("Erreur de sauvegarde du groupe", "error");
  }
});

btnDropGroup?.addEventListener("click", async () => {
  const groupName = groupSelect?.value;
  if (!groupName) return toast("Sélectionne un groupe", "error");
  if (!selectedMeme) return toast("Sélectionne d'abord un meme", "error");

  try {
    const group = groups.find(
      (g) => (typeof g === "string" ? g : g.name) === groupName,
    );
    const members = typeof group === "string" ? [] : group.members || [];
    if (members.length === 0) {
      toast("Groupe vide", "error");
      return;
    }
    const target = members.join(",");
    const result = await window.memedrop.sendDrop({
      target,
      filePath: selectedMeme.path,
      caption: panelCaption?.value?.trim() || null,
      rain: panelRain?.value?.trim() || null,
      kind: selectedMeme.kind,
    });
    if (result && result.ok) {
      toast(`👥 Drop envoyé au groupe "${groupName}"`);
      await window.memedrop.addHistory({
        target,
        name: selectedMeme.name,
        ts: Date.now(),
      });
      await loadHistory();
    } else {
      toast("Erreur d'envoi au groupe", "error");
    }
  } catch (e) {
    toast("Erreur d'envoi au groupe", "error");
  }
});

// Drop à tous les connectés
document.getElementById("btn-drop-all")?.addEventListener("click", async () => {
  if (!selectedMeme) return toast("Sélectionne d'abord un meme", "error");
  if (!confirm(`Envoyer "${selectedMeme.name}" à TOUS les connectés ?`)) return;
  try {
    const result = await window.memedrop.sendDrop({
      target: "@everyone",
      filePath: selectedMeme.path,
      kind: selectedMeme.kind,
      caption: null,
      rain: null,
    });
    if (result && result.ok) {
      toast(`📤 Envoyé à tous !`);
    } else {
      toast("Erreur d'envoi", "error");
    }
  } catch (e) {
    toast("Erreur d'envoi", "error");
  }
});

// ── Section N: Streak ─────────────────────────────────────────────────
async function loadStreak() {
  if (!streakCounter) return;
  try {
    streakData = await window.memedrop.getStreak();
    const count =
      streakData && streakData.count !== undefined
        ? streakData.count
        : streakData || 0;
    streakCounter.textContent = `🔥 ${count}`;
  } catch (e) {
    streakCounter.textContent = "🔥 0";
  }
}

// ── Section O: Scheduled drops ─────────────────────────────────────────
async function loadScheduled() {
  if (!scheduledList) return;
  try {
    scheduledDrops = (await window.memedrop.scheduleList()) || [];
  } catch (e) {
    scheduledDrops = [];
  }
  renderScheduled();
}

function renderScheduled() {
  if (!scheduledList) return;
  scheduledList.innerHTML = "";
  if (scheduledDrops.length === 0) {
    scheduledList.innerHTML =
      '<p style="font-size:11px;color:var(--text-dim);">Aucun drop planifié</p>';
    return;
  }
  for (const sched of scheduledDrops) {
    const item = document.createElement("div");
    item.className = "scheduled-item";

    const info = document.createElement("div");
    info.className = "sched-info";
    info.innerHTML = `
      <div class="sched-meme">${sched.name || sched.fileName || "Meme"}</div>
      <div class="sched-time">${sched.target} · ${sched.when ? new Date(sched.when).toLocaleString() : ""}</div>
    `;

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "ghost";
    cancelBtn.style.cssText = "padding:2px 6px;font-size:10px;";
    cancelBtn.textContent = "✕";
    cancelBtn.title = "Annuler";
    cancelBtn.addEventListener("click", async () => {
      try {
        await window.memedrop.scheduleCancel(sched.id);
        await loadScheduled();
        toast("⏰ Drop planifié annulé");
      } catch (e) {
        toast("Erreur d'annulation", "error");
      }
    });

    item.appendChild(info);
    item.appendChild(cancelBtn);
    scheduledList.appendChild(item);
  }
}

// ── Section Q: File watcher ────────────────────────────────────────────
async function setupFileWatcher() {
  try {
    const unsub = window.memedrop.onLibraryChanged(() => {
      loadMemes();
      loadAudioLibrary();
      toast("📂 Bibliothèque mise à jour");
    });
  } catch (e) {
    console.warn("onLibraryChanged not available", e);
  }
}

// ── Collage Mode ────────────────────────────────────────────────────────
document.getElementById("btn-collage-mode")?.addEventListener("click", () => {
  collageMode = !collageMode;
  collagePaths = [];
  document.getElementById("btn-collage-mode").textContent = collageMode
    ? "🖼️ Collage (0)"
    : "🖼️ Collage";
  document
    .getElementById("collage-bar")
    ?.classList.toggle("hidden", !collageMode);

  // Clear visual selection
  document
    .querySelectorAll(".selected-collage")
    .forEach((el) => el.classList.remove("selected-collage"));
  if (collageMode) {
    document.getElementById("collage-count-label").textContent = "0/4 images";
  }
});

document.getElementById("btn-clear-collage")?.addEventListener("click", () => {
  collageMode = false;
  collagePaths = [];
  document.getElementById("btn-collage-mode").textContent = "🖼️ Collage";
  document.getElementById("collage-bar")?.classList.add("hidden");
  document
    .querySelectorAll(".selected-collage")
    .forEach((el) => el.classList.remove("selected-collage"));
});

document
  .getElementById("btn-send-collage")
  ?.addEventListener("click", async () => {
    if (collagePaths.length < 2)
      return toast("Sélectionne au moins 2 images", "error");

    const btn = document.getElementById("btn-send-collage");
    const originalText = btn.textContent;
    btn.textContent = "⏳ Préparation...";
    btn.disabled = true;

    try {
      const result = await window.memedrop.buildCollage(collagePaths);
      if (result && result.ok) {
        const pseudoMeme = {
          name: `Collage (${collagePaths.length} images)`,
          collagePaths: [...collagePaths],
          base64: result.base64,
          mime: result.mime,
          kind: "image",
          size: result.buffer?.length || 0,
          isCollage: true,
        };
        document.getElementById("btn-clear-collage")?.click();
        openDropPanel(pseudoMeme);
      } else {
        toast(`❌ ${result?.error || "Erreur collage"}`, "error");
      }
    } catch (e) {
      toast("❌ Erreur réseau", "error");
    } finally {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  });

// ── Drag & Drop ─────────────────────────────────────────────────────────
let dragCounter = 0;

document.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.remove("hidden");
});
document.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dragCounter++;
});

document.addEventListener("dragleave", (e) => {
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    dropzone.classList.add("hidden");
  }
});
document.addEventListener("drop", async (e) => {
  e.preventDefault();
  dropzone.classList.add("hidden");
  dragCounter = 0;

  for (const file of e.dataTransfer.files) {
    let result;
    if (file.path) {
      // Local file
      result = await window.memedrop.saveFromFile(file.path);
    } else {
      // Web file (dragged from a browser)
      const buffer = await file.arrayBuffer();
      result = await window.memedrop.saveFromBuffer({
        name: file.name,
        buffer,
        type: file.type,
      });
    }
    if (result) {
      allMemes.unshift(result);
      if (result.kind === "audio") {
        audioLibrary.unshift(result);
        renderAudioLibrary();
        renderAudioSelect();
      }
    }
  }
  renderGrid();
  if (e.dataTransfer.files.length > 0) {
    toast(`📦 ${e.dataTransfer.files.length} fichier(s) importé(s)`);
  }
});

// ── Toast ───────────────────────────────────────────────────────────────
// (declared at top)

// ── Settings & Auto-Update ──────────────────────────────────────────────
async function initSettings() {
  const settingVolume = document.getElementById("setting-volume");
  const volumeOut = document.getElementById("volume-out");
  const settingMusicVolume = document.getElementById("setting-music-volume");
  const musicVolumeOut = document.getElementById("music-volume-out");
  const settingServer = document.getElementById("setting-server");
  const settingAutostart = document.getElementById("setting-autostart");
  const settingMuteMode = document.getElementById("setting-mute-mode");
  const settingGiphy = document.getElementById("setting-giphy");

  const settingOpacity = document.getElementById("setting-opacity");
  const opacityOut = document.getElementById("opacity-out");
  const settingDuration = document.getElementById("setting-duration");
  const durationOut = document.getElementById("duration-out");
  const settingVideoDuration = document.getElementById(
    "setting-video-duration",
  );
  const videoDurationOut = document.getElementById("video-duration-out");
  const settingSoundOnArrival = document.getElementById(
    "setting-soundOnArrival",
  );
  const settingSpotlightOnDrop = document.getElementById(
    "setting-spotlightOnDrop",
  );
  const settingTheme = document.getElementById("setting-theme");
  const settingOverlayDisplayId = document.getElementById(
    "setting-overlayDisplayId",
  );

  const updateTitle = document.getElementById("update-title");
  const updateMsg = document.getElementById("update-msg");
  const updateProgress = document.getElementById("update-progress");
  const updateProgressFill = document.getElementById("update-progress-fill");
  const updateCheckBtn = document.getElementById("update-check-btn");
  const updateDownloadBtn = document.getElementById("update-download-btn");
  const updateInstallBtn = document.getElementById("update-install-btn");

  const pairingCodeDisplay = document.getElementById("pairing-code-display");
  const copyCodeBtn = document.getElementById("copy-code-btn");
  const serversListDisplay = document.getElementById("servers-list-display");

  const settings = await window.memedrop.getSettings();

  if (settingVolume) {
    settingVolume.value = settings.volume ?? 75;
    volumeOut.textContent = `${settingVolume.value}%`;
    settingVolume.addEventListener("input", (e) => {
      volumeOut.textContent = `${e.target.value}%`;
    });
    settingVolume.addEventListener("change", (e) => {
      window.memedrop.updateSettings({ volume: parseInt(e.target.value, 10) });
    });
  }

  if (settingMusicVolume) {
    settingMusicVolume.value = settings.musicVolume ?? 75;
    musicVolumeOut.textContent = `${settingMusicVolume.value}%`;
    settingMusicVolume.addEventListener("input", (e) => {
      musicVolumeOut.textContent = `${e.target.value}%`;
    });
    settingMusicVolume.addEventListener("change", (e) => {
      window.memedrop.updateSettings({
        musicVolume: parseInt(e.target.value, 10),
      });
    });
  }

  if (settingServer) {
    settingServer.value = settings.serverUrl || "";
    settingServer.addEventListener("change", (e) => {
      window.memedrop.updateSettings({ serverUrl: e.target.value.trim() });
    });
  }

  if (settingAutostart) {
    settingAutostart.checked = !!settings.autostart;
    settingAutostart.addEventListener("change", (e) => {
      window.memedrop.updateSettings({ autostart: e.target.checked });
    });
  }

  if (settingMuteMode) {
    if (settings.paused) {
      settingMuteMode.value = "pause";
    } else if (settings.muteUntil === -1) {
      settingMuteMode.value = "mute-inf";
    } else if (settings.muteUntil && settings.muteUntil > Date.now()) {
      settingMuteMode.value = "mute-30"; // Approximatif
    } else {
      settingMuteMode.value = "active";
    }

    settingMuteMode.addEventListener("change", (e) => {
      const val = e.target.value;
      if (val === "active") {
        window.memedrop.updateSettings({ paused: false, muteUntil: null });
      } else if (val === "pause") {
        window.memedrop.updateSettings({ paused: true, muteUntil: null });
      } else if (val === "mute-30") {
        window.memedrop.updateSettings({
          paused: false,
          muteUntil: Date.now() + 30 * 60_000,
        });
      } else if (val === "mute-120") {
        window.memedrop.updateSettings({
          paused: false,
          muteUntil: Date.now() + 120 * 60_000,
        });
      } else if (val === "mute-inf") {
        window.memedrop.updateSettings({ paused: false, muteUntil: -1 });
      }
    });
  }

  if (settingOpacity) {
    settingOpacity.value = settings.opacity ?? 1.0;
    opacityOut.textContent = `${Math.round(settingOpacity.value * 100)}%`;
    settingOpacity.addEventListener("input", (e) => {
      opacityOut.textContent = `${Math.round(e.target.value * 100)}%`;
    });
    settingOpacity.addEventListener("change", (e) => {
      window.memedrop.updateSettings({ opacity: parseFloat(e.target.value) });
    });
  }

  if (settingDuration) {
    settingDuration.value = settings.duration ?? 4;
    durationOut.textContent = `${settingDuration.value}s`;
    settingDuration.addEventListener("input", (e) => {
      durationOut.textContent = `${e.target.value}s`;
    });
    settingDuration.addEventListener("change", (e) => {
      window.memedrop.updateSettings({
        duration: parseInt(e.target.value, 10),
      });
    });
  }

  if (settingVideoDuration) {
    settingVideoDuration.value = settings.videoDuration ?? 30;
    videoDurationOut.textContent = `${settingVideoDuration.value}s`;
    settingVideoDuration.addEventListener("input", (e) => {
      videoDurationOut.textContent = `${e.target.value}s`;
    });
    settingVideoDuration.addEventListener("change", (e) => {
      window.memedrop.updateSettings({
        videoDuration: parseInt(e.target.value, 10),
      });
    });
  }

  if (settingSoundOnArrival) {
    settingSoundOnArrival.checked = !!settings.soundOnArrival;
    settingSoundOnArrival.addEventListener("change", (e) => {
      window.memedrop.updateSettings({ soundOnArrival: e.target.checked });
    });
  }

  if (settingSpotlightOnDrop) {
    settingSpotlightOnDrop.checked = !!settings.spotlightOnDrop;
    settingSpotlightOnDrop.addEventListener("change", (e) => {
      window.memedrop.updateSettings({ spotlightOnDrop: e.target.checked });
    });
  }

  if (settingTheme) {
    settingTheme.value = settings.theme || "classic";
    document.body.dataset.theme = settings.theme || "classic";
    settingTheme.addEventListener("change", (e) => {
      window.memedrop.updateSettings({ theme: e.target.value });
      document.body.dataset.theme = e.target.value;
    });
  }

  if (settingOverlayDisplayId && window.memedrop.listDisplays) {
    try {
      const displays = await window.memedrop.listDisplays();
      settingOverlayDisplayId.innerHTML =
        '<option value="">Automatique (Écran principal)</option>';
      displays.forEach((d) => {
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = d.label + (d.primary ? " (Principal)" : "");
        settingOverlayDisplayId.appendChild(opt);
      });
      settingOverlayDisplayId.value = settings.overlayDisplayId || "";

      settingOverlayDisplayId.addEventListener("change", (e) => {
        window.memedrop.updateSettings({
          overlayDisplayId: e.target.value
            ? parseInt(e.target.value, 10)
            : null,
        });
      });
    } catch (err) {
      console.error("Failed to load displays", err);
    }
  }

  if (settingGiphy) {
    settingGiphy.value = settings.giphyApiKey || "A7Su0Alx0oH5dgrDaOicRiEBYqeZGWdX";
    settingGiphy.addEventListener("change", (e) => {
      window.memedrop.updateSettings({ giphyApiKey: e.target.value.trim() });
    });
  }

  // Meme folder chooser
  const settingMemeFolder = document.getElementById("setting-meme-folder");
  const btnChooseFolder = document.getElementById("btn-choose-meme-folder");
  if (settingMemeFolder) {
    settingMemeFolder.value = settings.memeFolderPath || "";
  }
  btnChooseFolder?.addEventListener("click", async () => {
    const result = await window.memedrop.selectFolder();
    if (result) {
      window.memedrop.updateSettings({ memeFolderPath: result });
      settingMemeFolder.value = result;
      toast("📂 Dossier mis à jour, recharge...");
      setTimeout(() => window.location.reload(), 1000);
    }
  });

  // Export config
  document
    .getElementById("btn-export-config")
    ?.addEventListener("click", async () => {
      const data = await window.memedrop.exportConfig();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `memedrop-config-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast("📤 Configuration exportée");
    });

  // Import config
  document
    .getElementById("btn-import-config")
    ?.addEventListener("click", async () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          const result = await window.memedrop.importConfig(data);
          if (result && result.ok) {
            toast("📥 Configuration importée, recharge...");
            setTimeout(() => window.location.reload(), 1000);
          } else {
            toast(
              "Erreur d'import: " + (result?.error || "format invalide"),
              "error",
            );
          }
        } catch (e) {
          toast("Erreur de lecture du fichier", "error");
        }
      };
      input.click();
    });

  if (pairingCodeDisplay) {
    pairingCodeDisplay.textContent = settings.linkIdentity || "------";
  }

  if (copyCodeBtn) {
    copyCodeBtn.addEventListener("click", () => {
      let codeToCopy = pairingCodeDisplay.textContent || "";
      if (codeToCopy === "------" || codeToCopy.startsWith("Lié")) {
        codeToCopy = ""; // Ne rien copier si c'est vide ou déjà lié
      }
      navigator.clipboard.writeText(codeToCopy);
      toast("Code copié !");
    });
  }

  if (serversListDisplay) {
    const guilds = settings.guilds || {};
    serversListDisplay.innerHTML = "";
    Object.entries(guilds).forEach(([id, g]) => {
      const div = document.createElement("div");
      div.style.display = "flex";
      div.style.justifyContent = "space-between";
      div.style.padding = "4px 8px";
      div.style.background = "#2a2240";
      div.style.borderRadius = "4px";

      const name = document.createElement("span");
      name.textContent = g.name;

      const toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggle.checked = !g.disabled;
      toggle.addEventListener("change", (e) => {
        const newGuilds = { ...guilds };
        newGuilds[id].disabled = !e.target.checked;
        window.memedrop.updateSettings({ guilds: newGuilds });
      });

      div.appendChild(name);
      div.appendChild(toggle);
      serversListDisplay.appendChild(div);
    });
  }

  // Update logic
  window.memedrop.onUpdateState((state) => {
    const globalBanner = document.getElementById("global-update-banner");
    const globalText = document.getElementById("global-update-text");
    const globalBtn = document.getElementById("global-update-btn");

    if (globalBtn && !globalBtn.hasListener) {
      globalBtn.addEventListener("click", () =>
        window.memedrop.installUpdate(),
      );
      globalBtn.hasListener = true;
    }

    if (updateTitle) {
      updateProgress.classList.add("hidden");
      updateCheckBtn.classList.add("hidden");
      updateDownloadBtn.classList.add("hidden");
      updateInstallBtn.classList.add("hidden");
    }

    if (state.status === "checking") {
      if (updateMsg) updateMsg.textContent = "Recherche de mise à jour...";
    } else if (state.status === "available") {
      if (updateTitle)
        updateTitle.textContent = `Mise à jour ${state.version} dispo !`;
      if (updateMsg)
        updateMsg.textContent =
          "Une nouvelle version est disponible. Téléchargement auto...";
      if (globalBanner) {
        globalBanner.classList.remove("hidden");
        globalText.textContent = `Téléchargement de la mise à jour ${state.version}...`;
        globalBtn.classList.add("hidden");
      }
    } else if (state.status === "up-to-date") {
      if (updateMsg) updateMsg.textContent = "L'application est à jour.";
      if (updateCheckBtn) updateCheckBtn.classList.remove("hidden");
      if (globalBanner) globalBanner.classList.add("hidden");
    } else if (state.status === "downloading") {
      if (updateMsg)
        updateMsg.textContent = `Téléchargement... ${state.progress}%`;
      if (updateProgress) {
        updateProgress.classList.remove("hidden");
        updateProgressFill.style.width = `${state.progress}%`;
      }
      if (globalBanner) {
        globalBanner.classList.remove("hidden");
        globalText.textContent = `Téléchargement de la mise à jour... ${state.progress}%`;
      }
    } else if (state.status === "downloaded") {
      if (updateTitle) updateTitle.textContent = "Prêt à installer";
      if (updateMsg) updateMsg.textContent = "Le téléchargement est terminé.";
      if (updateInstallBtn) updateInstallBtn.classList.remove("hidden");
      if (globalBanner) {
        globalBanner.classList.remove("hidden");
        globalText.textContent = `Mise à jour ${state.version} prête !`;
        globalBtn.classList.remove("hidden");
      }
    } else if (state.status === "error") {
      if (updateTitle) updateTitle.textContent = "Erreur";
      if (updateMsg)
        updateMsg.textContent =
          state.error || "Impossible de vérifier les mises à jour.";
      if (updateCheckBtn) updateCheckBtn.classList.remove("hidden");
      if (globalBanner) globalBanner.classList.add("hidden");
    }
  });

  if (updateCheckBtn) {
    updateCheckBtn.addEventListener("click", () =>
      window.memedrop.checkForUpdates(),
    );
  }
  if (updateDownloadBtn) {
    updateDownloadBtn.addEventListener("click", () =>
      window.memedrop.downloadUpdate(),
    );
  }
  if (updateInstallBtn) {
    updateInstallBtn.addEventListener("click", () =>
      window.memedrop.installUpdate(),
    );
  }
}

// ── Init ────────────────────────────────────────────────────────────────
async function init() {
  // Create sort UI
  createSortUI();

  // Load all data
  await Promise.all([
    loadMemes(),
    loadTags(),
    loadFavorites(),
    loadAudioLibrary(),
    loadHistory(),
    loadStreak(),
    loadGroups(),
    loadScheduled(),
    loadTemplates(),
    loadUsers(),
    loadSoundboard(),
    initSettings(),
  ]);

  // Set App Version
  try {
    const version = await window.memedrop.getVersion();
    const versionEl = document.getElementById("app-version-display");
    if (versionEl) versionEl.textContent = "v" + version;
  } catch (e) {
    console.warn("Failed to get app version", e);
  }

  // Setup listeners
  setupShortcutListener();
  setupFileWatcher();

  // Selection action bar
  document
    .getElementById("btn-delete-selected")
    ?.addEventListener("click", deleteSelected);
  document
    .getElementById("btn-clear-selection")
    ?.addEventListener("click", clearSelection);

  // Audio play listener
  try {
    let currentAudio = null;
    window.memedrop.onAudioPlay?.((filePath) => {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
      }
      const audioUrl = `file:///${filePath.replace(/\\/g, "/")}`;
      const audio = new Audio(audioUrl);
      audio.volume = (currentVolume || 75) / 100;
      audio.play().catch(() => {});
      currentAudio = audio;
    });
  } catch (e) {
    console.warn("onAudioPlay not available", e);
  }

  // Load cached users list (displays immediately instead of waiting for broadcast)
  if (window.memedrop.getCachedUsers) {
    const cached = await window.memedrop.getCachedUsers();
    if (cached) {
      const el = document.getElementById("users-count");
      if (el) {
        el.textContent = `${cached.count} connectés`;
        el.title = cached.users.map((u) => u.username).join("\n") || "";
      }
    }
  }

  // Load trending GIFs if on that tab
  const activeTab = document.querySelector(".studio-tab.active");
  if (activeTab && activeTab.dataset.tab === "giphy") {
    loadTrending();
  }
}

init();

// Re-scan on window focus (in case files changed)
window.addEventListener("focus", () => {
  loadMemes();
});

// Paste from clipboard shortcut (Ctrl+Shift+V / Ctrl+V)
document.addEventListener("paste", async (e) => {
  if (e.clipboardData.files.length > 0) {
    const result = await window.memedrop.saveFromClipboard();
    if (result && result.path) {
      openDropPanel(result);
    } else {
      toast("Rien � coller depuis le presse-papier", "error");
    }
  } else {
    const result = await window.memedrop.saveFromClipboard();
    if (result && result.path) {
      openDropPanel(result);
    }
  }
});

// Load Discord Users for Autocomplete
async function loadUsers() {
  try {
    const users = await window.memedrop.getUsers();
    const recentTargets = (await window.memedrop.listTargets()) || [];
    // Populate multi-target select: Discord users + recent targets + custom targets
    if (panelTarget) {
      panelTarget.innerHTML = "";
      const added = new Set();
      // Discord users first
      if (users && users.length > 0) {
        users.forEach((u) => {
          const v = "@" + u.username;
          added.add(v);
          const opt = document.createElement("option");
          opt.value = v;
          opt.textContent = v;
          panelTarget.appendChild(opt);
        });
      }
      // Recent targets (not already in Discord users)
      for (const rt of recentTargets) {
        if (!added.has(rt)) {
          added.add(rt);
          const opt = document.createElement("option");
          opt.value = rt;
          opt.textContent = rt;
          panelTarget.appendChild(opt);
        }
      }
      // Add custom targets (persisted in localStorage)
      for (const ct of customTargets) {
        if (!added.has(ct)) {
          added.add(ct);
          const opt = document.createElement("option");
          opt.value = ct;
          opt.textContent = ct;
          panelTarget.appendChild(opt);
        }
      }
    }
  } catch (e) {
    console.error("Failed to load users for autocomplete", e);
  }
}
