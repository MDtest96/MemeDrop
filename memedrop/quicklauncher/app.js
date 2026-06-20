// app.js — MemeDrop QuickLauncher renderer (Phases 2-7)

// ── State ────────────────────────────────────────────────────────────────
if (!window.memedrop) {
  console.warn("Running outside Electron. Mocking window.memedrop");
  window.memedrop = {
    onConnection: () => () => {},
    listMemes: async () => [],
    getTags: async () => [],
    getFavorites: async () => [],
    getAudioLibrary: async () => [],
    getHistory: async () => [],
    getStreak: async () => null,
    getGroups: async () => [],
    getScheduled: async () => [],
    getTemplates: async () => [],
    getUsers: async () => [],
    getSoundboard: async () => [],
    searchGiphy: async () => [],
    trendingGiphy: async () => [],
    sendDropUrl: async () => ({ok: true}),
    openMemeFolder: () => {},
    onShortcut: () => () => {},
    onLibraryChanged: () => () => {}
  };
}

let allMemes = [];
let currentFilter = "all";
let currentQuery = "";
let selectedMeme = null;
let allTags = [];
let activeTagFilter = null;
let favorites = [];
let audioLibrary = [];
let soundboard = [];
let history = [];
let scheduledDrops = [];
let streakData = null;
let groups = [];
let currentSort = "name";
let currentVolume = 100;
let lastDropData = null;
let isGiphyLoading = false;
let searchTimeout = null;

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
const btnRouletteSpin = document.getElementById("btn-roulette-spin");
const rouletteMeme = document.getElementById("roulette-meme");
const rouletteTarget = document.getElementById("roulette-target");
const btnRouletteSend = document.getElementById("btn-roulette-send");

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

// ── Connection ──────────────────────────────────────────────────────────
const unsubConn = window.memedrop.onConnection((state) => {
  const statusMap = {
    disconnected: { cls: "conn--disconnected", label: "● Déconnecté" },
    connected: { cls: "conn--connected", label: "● Connecté" },
    linked: { cls: "conn--linked", label: "● Lié à Discord" },
    pairing: {
      cls: "conn--pairing",
      label: `● ${state.message || "En attente"}`,
    },
  };
  const s = statusMap[state.status] || statusMap.disconnected;
  connStatus.className = `conn-badge ${s.cls}`;
  connStatus.textContent = s.label;
});

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
  });
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

// ── Load memes ──────────────────────────────────────────────────────────
async function loadMemes() {
  try {
    allMemes = await window.memedrop.listMemes();
  } catch (e) {
    console.error("Failed to load memes", e);
  }
  renderGrid();
}

async function renderGrid() {
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
    filtered = filtered.filter((m) => m.name.toLowerCase().includes(q));
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

    // Section C: Favorites indicator
    const isFav = favorites.includes(meme.path);
    if (isFav) {
      const star = document.createElement("span");
      star.className = "meme-card-fav";
      star.textContent = "⭐";
      star.style.cssText =
        "position:absolute;top:6px;left:6px;font-size:14px;z-index:2;pointer-events:none;";
      card.appendChild(star);
    }

    // Preview
    if (meme.kind === "audio") {
      const icon = document.createElement("div");
      icon.className = "audio-icon";
      icon.textContent = "🎵";
      card.appendChild(icon);
    } else {
      try {
        const preview = await window.memedrop.getPreview(meme.path, meme.kind);
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

    card.addEventListener("click", () => openDropPanel(meme));
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
  } catch (e) {
    allTags = [];
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
    favorites = (await window.memedrop.getFavorites()) || [];
  } catch (e) {
    favorites = [];
  }
  renderFavorites();
}

function renderFavorites() {
  if (!favoritesList) return;
  favoritesList.innerHTML = "";
  const favMemes = allMemes.filter((m) => favorites.includes(m.path));
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
    soundboardList.appendChild(btn);
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
        <div class="history-target">${entry.target}</div>
        <div class="history-meme">${entry.name || entry.fileName || ""}</div>
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

// ── Drop Panel ──────────────────────────────────────────────────────────
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
  if (meme.kind === "audio") {
    const d = document.createElement("div");
    d.className = "audio-icon-tn";
    d.textContent = "🎵";
    panelPreview.appendChild(d);
  } else {
    try {
      const preview = await window.memedrop.getPreview(meme.path, meme.kind);
      if (preview) {
        const el =
          meme.kind === "video"
            ? document.createElement("video")
            : document.createElement("img");
        el.src = preview;
        if (meme.kind === "video") {
          el.muted = true;
        }
        panelPreview.appendChild(el);
      }
    } catch (e) {
      // silent
    }
  }

  // Load recent targets
  const targets = await window.memedrop.listTargets();
  targetSuggestions.innerHTML = targets
    .map((t) => `<option value="${t}">`)
    .join("");
  panelTarget.value = "";
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
  
  await window.memedrop.previewDrop({
    filePath: selectedMeme.path,
    caption,
    rain,
    kind: selectedMeme.kind,
    volume,
  });
});

// Send
document.getElementById("btn-send")?.addEventListener("click", async () => {
  if (!selectedMeme) return;
  const target = panelTarget.value.trim();
  if (!target) {
    panelStatus.textContent = "❌ Mets une cible (@utilisateur)";
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

  const result = await window.memedrop.sendDrop({
    target,
    filePath: selectedMeme.path,
    caption,
    rain,
    kind: selectedMeme.kind,
    volume,
  });

  sendBtn.disabled = false;
  sendBtn.textContent = "🚀 Envoyer";

  if (result.ok) {
    panelStatus.textContent = `✅ Drop envoyé à ${target}`;
    panelStatus.className = "panel-status success";
    await window.memedrop.addTarget(target);
    await window.memedrop.addHistory({
      target,
      name: selectedMeme.name,
      ts: Date.now(),
    });

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
      target,
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

    toast(`✅ Drop envoyé à ${target}`);
    closeDropPanel();
  } else {
    panelStatus.textContent = `❌ ${result.error || "Échec de l'envoi"}`;
    panelStatus.className = "panel-status error";
  }
});

// Copy command
document.getElementById("btn-copy-cmd")?.addEventListener("click", () => {
  if (!selectedMeme) return;
  const target = panelTarget.value.trim() || "@pote";
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

// ── Section J: Roulette ────────────────────────────────────────────────
btnRouletteSpin?.addEventListener("click", async () => {
  try {
    const result = await window.memedrop.rouletteSpin();
    if (!result) {
      toast("Pas assez de memes pour le roulette", "error");
      return;
    }
    rouletteMeme.innerHTML = "";
    const { meme, target } = result;

    // Store result for sending
    rouletteMeme.dataset.memePath = meme.path;
    rouletteMeme.dataset.memeKind = meme.kind;

    // Show meme preview
    if (meme.kind === "audio") {
      const d = document.createElement("div");
      d.style.cssText = "font-size:48px;opacity:0.6;";
      d.textContent = "🎵";
      rouletteMeme.appendChild(d);
    } else {
      try {
        const preview = await window.memedrop.getPreview(meme.path, meme.kind);
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
          rouletteMeme.appendChild(el);
        }
      } catch (e) {
        const d = document.createElement("div");
        d.textContent = "🖼️";
        d.style.cssText = "font-size:48px;opacity:0.4;";
        rouletteMeme.appendChild(d);
      }
    }

    rouletteTarget.textContent = `Cible: ${target}`;
    btnRouletteSend.classList.remove("hidden");
    btnRouletteSend.dataset.target = target;
    btnRouletteSend.dataset.memePath = meme.path;
    btnRouletteSend.dataset.memeKind = meme.kind;
  } catch (e) {
    toast("Erreur du roulette", "error");
  }
});

btnRouletteSend?.addEventListener("click", async () => {
  const target = btnRouletteSend.dataset.target;
  const memePath = btnRouletteSend.dataset.memePath;
  const memeKind = btnRouletteSend.dataset.memeKind;
  if (!target || !memePath) return toast("Fais d'abord un spin", "error");

  try {
    const result = await window.memedrop.sendDrop({
      target,
      filePath: memePath,
      caption: null,
      rain: null,
      kind: memeKind,
    });
    if (result && result.ok) {
      toast(`🎲 Drop roulette envoyé à ${target}`);
      btnRouletteSend.classList.add("hidden");
      rouletteMeme.innerHTML = "";
      rouletteTarget.textContent = "";
      // Refresh history + streak
      await loadHistory();
      try {
        await window.memedrop.incrementStreak();
        await loadStreak();
      } catch (e) {
        /* silent */
      }
    } else {
      toast("Échec de l'envoi roulette", "error");
    }
  } catch (e) {
    toast("Erreur d'envoi", "error");
  }
});

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
      toast("✨ Meme généré et ajouté à la bibliothèque");
    } else {
      toast("Erreur de génération", "error");
    }
  } catch (e) {
    toast("Erreur de génération", "error");
  }
});

// ── Section L: GIPHY ──────────────────────────────────────────────────
btnGiphySearch?.addEventListener("click", async () => {
  const query = giphySearch?.value.trim();
  if (!query) return;
  try {
    isGiphyLoading = true;
    giphyGrid.innerHTML =
      '<p style="grid-column:1/-1;text-align:center;color:var(--text-dim);">Recherche…</p>';
    const results = (await window.memedrop.searchGiphy(query)) || [];
    renderGiphyGrid(results);
  } catch (e) {
    giphyGrid.innerHTML =
      '<p style="grid-column:1/-1;text-align:center;color:var(--text-dim);">Erreur de recherche</p>';
  } finally {
    isGiphyLoading = false;
  }
});

async function loadTrending() {
  if (isGiphyLoading) return;
  try {
    isGiphyLoading = true;
    const results = (await window.memedrop.trendingGiphy()) || [];
    renderGiphyGrid(results);
  } catch (e) {
    giphyGrid.innerHTML =
      '<p style="grid-column:1/-1;text-align:center;color:var(--text-dim);">Erreur de chargement</p>';
  } finally {
    isGiphyLoading = false;
  }
}

btnGiphyTrending?.addEventListener("click", loadTrending);

giphySearch?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnGiphySearch?.click();
});

function renderGiphyGrid(results) {
  if (!giphyGrid) return;
  giphyGrid.innerHTML = "";
  if (results.length === 0) {
    giphyGrid.innerHTML =
      '<p style="grid-column:1/-1;text-align:center;color:var(--text-dim);">Aucun résultat</p>';
    return;
  }
  for (const gif of results) {
    const item = document.createElement("div");
    item.className = "giphy-item";

    const img = document.createElement("img");
    img.src = gif.url || gif.images?.fixed_height?.url || "";
    img.loading = "lazy";
    img.alt = gif.title || "GIF";
    item.appendChild(img);

    const dropBtn = document.createElement("button");
    dropBtn.className = "drop-btn";
    dropBtn.textContent = "⬇ Drop";
    dropBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        const downloaded = await window.memedrop.downloadGiphy(
          gif.url || gif.images?.original?.url,
        );
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
    });
    item.appendChild(dropBtn);

    giphyGrid.appendChild(item);
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
    const result = await window.memedrop.saveFromFile(file.path);
    if (result) {
      allMemes.unshift(result);
    }
  }
  renderGrid();
  if (e.dataTransfer.files.length > 0) {
    toast(`📦 ${e.dataTransfer.files.length} fichier(s) importé(s)`);
  }
});

// ── Toast ───────────────────────────────────────────────────────────────
// (declared at top)

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
  ]);

  // Setup listeners
  setupShortcutListener();
  setupFileWatcher();

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
    if (users && users.length > 0) {
      const suggestions = document.getElementById("target-suggestions");
      if (suggestions) {
        suggestions.innerHTML = "";
        users.forEach(u => {
          const option = document.createElement("option");
          option.value = "@" + u.username;
          suggestions.appendChild(option);
        });
      }
    }
  } catch (e) {
    console.error("Failed to load users for autocomplete", e);
  }
}


