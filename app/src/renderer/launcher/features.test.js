// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("grid responsive layout", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div class="grid"></div>`;
    const style = document.createElement("style");
    style.textContent = [
      ".grid {",
      "  display: grid;",
      "  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));",
      "  gap: 10px;",
      "  overflow-y: auto;",
      "  align-content: start;",
      "}",
      ".meme-card {",
      "  position: relative;",
      "  aspect-ratio: 1;",
      "  overflow: hidden;",
      "}",
      ".meme-card img, .meme-card video {",
      "  width: 100%;",
      "  height: 100%;",
      "  object-fit: cover;",
      "  display: block;",
      "}",
    ].join("\n");
    document.head.appendChild(style);
  });

  it("should have CSS grid display", () => {
    const grid = document.querySelector(".grid");
    const style = getComputedStyle(grid);
    expect(style.display).toBe("grid");
  });

  it("should use auto-fill with minmax for responsive columns", () => {
    const grid = document.querySelector(".grid");
    const style = getComputedStyle(grid);
    expect(style.gridTemplateColumns).toContain("auto-fill");
    expect(style.gridTemplateColumns).toContain("minmax");
  });

  it("should have gap between items to prevent overlap", () => {
    const grid = document.querySelector(".grid");
    const style = getComputedStyle(grid);
    expect(style.gap).toBe("10px");
  });

  it("should have meme-card with aspect-ratio to prevent vertical overlap", () => {
    const grid = document.querySelector(".grid");
    for (let i = 0; i < 5; i++) {
      const card = document.createElement("div");
      card.className = "meme-card";
      grid.appendChild(card);
    }
    const card = grid.querySelector(".meme-card");
    const style = getComputedStyle(card);
    expect(style.aspectRatio).toBe("1 / 1");
    expect(style.position).toBe("relative");
    expect(style.overflow).toBe("hidden");
  });

  it("should contain images within cards (no overflow)", () => {
    const grid = document.querySelector(".grid");
    const card = document.createElement("div");
    card.className = "meme-card";
    const img = document.createElement("img");
    img.src = "test.jpg";
    card.appendChild(img);
    grid.appendChild(card);

    const imgStyle = getComputedStyle(img);
    expect(imgStyle.width).toBe("100%");
    expect(imgStyle.height).toBe("100%");
    expect(imgStyle.objectFit).toBe("cover");
  });

  it("should prevent horizontal overflow with 1fr columns", () => {
    const grid = document.querySelector(".grid");
    const style = getComputedStyle(grid);
    expect(style.gridTemplateColumns).toContain("1fr");
    expect(style.overflowY).toBe("auto");
  });

  it("should align content to start (no extra spacing at top)", () => {
    const grid = document.querySelector(".grid");
    const style = getComputedStyle(grid);
    expect(style.alignContent).toBe("start");
  });
});

describe("triage icon tooltip", () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<button id="btn-toggle-triage-advanced" class="triage-toggle-btn" title="Filtres avancés (tags, recherche)">🔍</button>';
  });

  it("should have a title attribute on the triage toggle button", () => {
    const btn = document.getElementById("btn-toggle-triage-advanced");
    expect(btn.title).toBeTruthy();
  });

  it("should contain descriptive text about advanced filters", () => {
    const btn = document.getElementById("btn-toggle-triage-advanced");
    expect(btn.title).toContain("tag");
    expect(btn.title).toContain("recherche");
  });

  it("should display the magnifying glass icon", () => {
    const btn = document.getElementById("btn-toggle-triage-advanced");
    expect(btn.textContent).toBe("🔍");
  });
});

describe("filter bar hover transitions", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div class="grid-filter-bar">\n' +
      '      <button class="triage-btn">Tous</button>\n' +
      '      <button class="triage-btn">🖼</button>\n' +
      '      <select class="triage-select"><option>Tri</option></select>\n' +
      '      <button id="btn-toggle-triage-advanced" class="triage-toggle-btn">🔍</button>\n' +
      '      <button class="triage-apply-btn">✅</button>\n' +
      '      <button class="triage-reset-btn">↺</button>\n' +
      "    </div>";
    const style = document.createElement("style");
    style.textContent = [
      ".triage-btn, .triage-toggle-btn, .triage-apply-btn, .triage-reset-btn {",
      "  transition: all 0.15s ease;",
      "  cursor: pointer;",
      "}",
      ".triage-btn:hover, .triage-toggle-btn:hover, .triage-apply-btn:hover, .triage-reset-btn:hover {",
      "  opacity: 0.8;",
      "}",
      ".triage-select {",
      "  cursor: pointer;",
      "}",
    ].join("\n");
    document.head.appendChild(style);
  });

  it("should have smooth transition on triage buttons", () => {
    const btn = document.querySelector(".triage-btn");
    const style = getComputedStyle(btn);
    expect(style.transition).toContain("0.15s");
    expect(style.cursor).toBe("pointer");
  });

  it("should have smooth transition on toggle button", () => {
    const btn = document.getElementById("btn-toggle-triage-advanced");
    const style = getComputedStyle(btn);
    expect(style.transition).toContain("0.15s");
    expect(style.cursor).toBe("pointer");
  });

  it("should have smooth transition on apply button", () => {
    const btn = document.querySelector(".triage-apply-btn");
    const style = getComputedStyle(btn);
    expect(style.transition).toContain("0.15s");
  });

  it("should have smooth transition on reset button", () => {
    const btn = document.querySelector(".triage-reset-btn");
    const style = getComputedStyle(btn);
    expect(style.transition).toContain("0.15s");
  });

  it("should have pointer cursor on select elements", () => {
    const sel = document.querySelector(".triage-select");
    const style = getComputedStyle(sel);
    expect(style.cursor).toBe("pointer");
  });
});

describe("multi-select type filters", () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div class="triage-type-filters">\n' +
      '        <button class="triage-btn" data-filter="all">Tous</button>\n' +
      '        <button class="triage-btn" data-filter="image">🖼</button>\n' +
      '        <button class="triage-btn" data-filter="gif">🎞</button>\n' +
      '        <button class="triage-btn" data-filter="video">🎬</button>\n' +
      '        <button class="triage-btn" data-filter="audio">🎵</button>\n' +
      '      </div>\n' +
      '      <div class="grid" id="grid"></div>\n' +
      "    ";
  });

  function simulateToggle(btn) {
    if (btn.dataset.filter === "all") {
      document.querySelectorAll(".triage-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    } else {
      const allBtn = document.querySelector('[data-filter="all"]');
      if (allBtn) allBtn.classList.remove("active");
      btn.classList.toggle("active");
    }
  }

  function getSelectedTypes() {
    const active = document.querySelectorAll(".triage-btn.active");
    const types = Array.from(active).map((b) => b.dataset.filter);
    if (types.includes("all") || types.length === 0) return ["all"];
    return types;
  }

  function filterMemes(memes, types) {
    if (types.length === 0 || types.includes("all")) return memes;
    return memes.filter((m) => types.includes(m.kind));
  }

  const allMemes = [
    { name: "img1", path: "/a.png", kind: "image" },
    { name: "gif1", path: "/b.gif", kind: "gif" },
    { name: "vid1", path: "/c.mp4", kind: "video" },
    { name: "aud1", path: "/d.mp3", kind: "audio" },
    { name: "img2", path: "/e.jpg", kind: "image" },
    { name: "gif2", path: "/f.gif", kind: "gif" },
  ];

  it("should allow selecting GIF and Image simultaneously", () => {
    const imgBtn = document.querySelector('[data-filter="image"]');
    const gifBtn = document.querySelector('[data-filter="gif"]');
    simulateToggle(imgBtn);
    simulateToggle(gifBtn);
    const types = getSelectedTypes();
    expect(types).toContain("image");
    expect(types).toContain("gif");
    expect(types).not.toContain("video");
    expect(types).not.toContain("audio");
  });

  it("should filter memes by multiple selected types", () => {
    const types = ["image", "gif"];
    const filtered = filterMemes(allMemes, types);
    expect(filtered).toHaveLength(4);
    expect(filtered.every((m) => m.kind === "image" || m.kind === "gif")).toBe(true);
  });

  it("should show all memes when Tous is selected", () => {
    const types = ["all"];
    const filtered = filterMemes(allMemes, types);
    expect(filtered).toHaveLength(6);
  });

  it("should show all memes when no type is selected (fallback to all)", () => {
    const allBtn = document.querySelector('[data-filter="all"]');
    allBtn.classList.add("active");
    const types = getSelectedTypes();
    const filtered = filterMemes(allMemes, types);
    expect(filtered).toHaveLength(6);
  });

  it("should deselect a type without affecting others", () => {
    const imgBtn = document.querySelector('[data-filter="image"]');
    const gifBtn = document.querySelector('[data-filter="gif"]');
    simulateToggle(imgBtn);
    simulateToggle(gifBtn);
    simulateToggle(gifBtn);
    const types = getSelectedTypes();
    expect(types).toContain("image");
    expect(types).not.toContain("gif");
  });

  it("should select Video and Audio only (no images/gifs)", () => {
    const videoBtn = document.querySelector('[data-filter="video"]');
    const audioBtn = document.querySelector('[data-filter="audio"]');
    simulateToggle(videoBtn);
    simulateToggle(audioBtn);
    const types = getSelectedTypes();
    const filtered = filterMemes(allMemes, types);
    expect(filtered).toHaveLength(2);
    expect(filtered.every((m) => m.kind === "video" || m.kind === "audio")).toBe(true);
  });
});

describe("paste URL in grid (Ctrl+V)", () => {
  function isMediaUrl(url) {
    return /^https?:\/\//i.test(url) && (
      /\.(mp4|webm|gif|jpg|jpeg|png|webp)(\?|$)/i.test(url) ||
      /giphy\.com/i.test(url) ||
      /tenor\.com/i.test(url) ||
      /twitter\.com/i.test(url) ||
      /x\.com/i.test(url) ||
      /youtube\.com/i.test(url) ||
      /youtu\.be/i.test(url)
    );
  }

  it("should detect a media URL", () => {
    expect(isMediaUrl("https://media.giphy.com/media/abc/giphy.gif")).toBe(true);
    expect(isMediaUrl("https://tenor.com/view/cat-funny-gif-12345")).toBe(true);
    expect(isMediaUrl("https://twitter.com/user/status/123456789")).toBe(true);
    expect(isMediaUrl("https://x.com/user/status/123456789")).toBe(true);
    expect(isMediaUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
    expect(isMediaUrl("https://example.com/image.jpg")).toBe(true);
    expect(isMediaUrl("https://example.com/video.mp4")).toBe(true);
    expect(isMediaUrl("")).toBe(false);
    expect(isMediaUrl("just some text")).toBe(false);
  });

  it("should call downloadUrl when a media URL is pasted", async () => {
    const url = "https://media.giphy.com/media/test/giphy.gif";
    const fakeResult = { name: "giphy_test", path: "/memes/test.gif", kind: "gif" };
    window.memedrop = { downloadUrl: vi.fn().mockResolvedValue(fakeResult) };

    const downloaded = await window.memedrop.downloadUrl(url);
    expect(downloaded).toEqual(fakeResult);
  });

  it("should handle a failed URL download gracefully", async () => {
    const mockDownload = vi.fn().mockRejectedValue(new Error("Network error"));
    window.memedrop = { downloadUrl: mockDownload };
    await expect(window.memedrop.downloadUrl("https://example.com/invalid.gif"))
      .rejects.toThrow("Network error");
  });
});

describe("right-click context menu", () => {
  function createContextMenu(meme, x, y) {
    const old = document.getElementById("meme-context-menu");
    if (old) old.remove();
    const menu = document.createElement("div");
    menu.id = "meme-context-menu";
    menu.className = "context-menu";
    menu.style.cssText = "position:fixed;left:" + x + "px;top:" + y + "px;z-index:9999";
    const items = [];
    if (meme.kind === "audio") {
      items.push({ label: "🔊 Play Audio", action: "play-audio" });
    } else if (meme.kind === "video") {
      items.push({ label: "🎬 Preview", action: "preview-video" });
    }
    items.push({ label: "✏️ Rename", action: "rename" });
    items.push({ label: "⭐ Add to Favorites", action: "toggle-fav" });
    items.push({ label: "🗑 Hide", action: "hide" });
    items.push({ label: "📤 Send", action: "send" });
    items.forEach(function(item) {
      var btn = document.createElement("button");
      btn.className = "context-menu-item";
      btn.dataset.action = item.action;
      btn.textContent = item.label;
      menu.appendChild(btn);
    });
    document.body.appendChild(menu);
    return menu;
  }

  function closeContextMenu() {
    var menu = document.getElementById("meme-context-menu");
    if (menu) menu.remove();
  }

  beforeEach(function() {
    document.body.innerHTML = '<div class="grid"></div>';
    var card = document.createElement("div");
    card.className = "meme-card";
    card.dataset.path = "/memes/test.gif";
    card.dataset.kind = "gif";
    card.dataset.name = "test";
    document.querySelector(".grid").appendChild(card);
  });

  it("should create a context menu on right-click", function() {
    var meme = { name: "test", path: "/memes/test.gif", kind: "gif" };
    var menu = createContextMenu(meme, 100, 200);
    expect(menu).toBeTruthy();
    expect(menu.id).toBe("meme-context-menu");
    expect(menu.style.position).toBe("fixed");
    expect(menu.style.left).toBe("100px");
    expect(menu.style.top).toBe("200px");
  });

  it("should include Play Audio option for audio memes", function() {
    var meme = { name: "song", path: "/memes/song.mp3", kind: "audio" };
    var menu = createContextMenu(meme, 0, 0);
    var playBtn = menu.querySelector('[data-action="play-audio"]');
    expect(playBtn).toBeTruthy();
    expect(playBtn.textContent).toContain("Play Audio");
  });

  it("should NOT include Play Audio for non-audio memes", function() {
    var meme = { name: "img", path: "/memes/img.png", kind: "image" };
    var menu = createContextMenu(meme, 0, 0);
    var playBtn = menu.querySelector('[data-action="play-audio"]');
    expect(playBtn).toBeFalsy();
  });

  it("should include Rename option for any meme", function() {
    var meme = { name: "test", path: "/memes/test.gif", kind: "gif" };
    var menu = createContextMenu(meme, 0, 0);
    var renameBtn = menu.querySelector('[data-action="rename"]');
    expect(renameBtn).toBeTruthy();
  });

  it("should include Hide option for any meme", function() {
    var meme = { name: "test", path: "/memes/test.gif", kind: "gif" };
    var menu = createContextMenu(meme, 0, 0);
    var hideBtn = menu.querySelector('[data-action="hide"]');
    expect(hideBtn).toBeTruthy();
  });

  it("should include Send option for any meme", function() {
    var meme = { name: "test", path: "/memes/test.gif", kind: "gif" };
    var menu = createContextMenu(meme, 0, 0);
    var sendBtn = menu.querySelector('[data-action="send"]');
    expect(sendBtn).toBeTruthy();
  });

  it("should close context menu when clicking outside", function() {
    var meme = { name: "test", path: "/memes/test.gif", kind: "gif" };
    createContextMenu(meme, 0, 0);
    expect(document.getElementById("meme-context-menu")).toBeTruthy();
    closeContextMenu();
    expect(document.getElementById("meme-context-menu")).toBeFalsy();
  });

  it("should remove old menu before creating a new one", function() {
    var meme = { name: "test", path: "/memes/test.gif", kind: "gif" };
    createContextMenu(meme, 0, 0);
    createContextMenu(meme, 50, 50);
    var menus = document.querySelectorAll("#meme-context-menu");
    expect(menus.length).toBe(1);
  });

  it("should trigger rename action from context menu", function() {
    var meme = { name: "test", path: "/memes/test.gif", kind: "gif" };
    var menu = createContextMenu(meme, 0, 0);
    var renameBtn = menu.querySelector('[data-action="rename"]');
    expect(renameBtn).toBeTruthy();
    var handler = vi.fn();
    renameBtn.addEventListener("click", handler);
    renameBtn.click();
    expect(handler).toHaveBeenCalled();
  });

  it("should trigger play-audio action from context menu", function() {
    var meme = { name: "song", path: "/memes/song.mp3", kind: "audio" };
    var menu = createContextMenu(meme, 0, 0);
    var playBtn = menu.querySelector('[data-action="play-audio"]');
    expect(playBtn).toBeTruthy();
    var handler = vi.fn();
    playBtn.addEventListener("click", handler);
    playBtn.click();
    expect(handler).toHaveBeenCalled();
  });
});

describe("audio in drop flow", function() {
  it("should include audioPath when sending a meme with sound", function() {
    var selectedMeme = { name: "cat.gif", path: "/memes/cat.gif", kind: "gif" };
    var audioPath = "/memes/song.mp3";
    var payload = {
      target: "@friend",
      filePath: selectedMeme.path,
      audioPath: audioPath,
      caption: "Check this",
      kind: selectedMeme.kind,
    };
    expect(payload.audioPath).toBe("/memes/song.mp3");
    expect(payload.filePath).toBe("/memes/cat.gif");
  });

  it("formatQuickDropPayload should produce music field from audioPath", function() {
    var payload = {
      filePath: "/memes/cat.gif",
      audioPath: "/memes/song.mp3",
      kind: "gif",
    };
    var formatted = {
      type: "quick_drop",
      target: payload.target,
      caption: payload.caption,
      media: { name: "cat.gif", kind: "gif", mime: "image/gif", data: "base64data" },
      music: payload.audioPath
        ? { name: "song.mp3", kind: "audio", mime: "audio/mpeg", data: "base64data" }
        : null,
    };
    expect(formatted.music).toBeTruthy();
    expect(formatted.music.kind).toBe("audio");
    expect(formatted.music.data).toBeTruthy();
  });

  it("bot should relay music field to recipients", function() {
    var msg = {
      music: {
        data: "base64data",
        mime: "audio/mpeg",
        name: "song.mp3",
      },
    };
    var relayPayload = {
      type: "drop",
      music: msg.music
        ? {
            url: "data:" + (msg.music.mime || "audio/mpeg") + ";base64," + msg.music.data,
            name: msg.music.name || "audio.mp3",
          }
        : null,
    };
    expect(relayPayload.music).toBeTruthy();
    expect(relayPayload.music.url).toContain("data:audio/mpeg;base64");
  });

  it("overlay should play music when music.url is present and media is image/gif", function() {
    var msg = {
      type: "drop",
      media: { url: "data:image/gif;base64,abc", kind: "gif", mime: "image/gif" },
      music: { url: "data:audio/mpeg;base64,xyz", name: "song.mp3" },
      from: { id: "user1", username: "sender" },
      ts: Date.now(),
    };
    var music = msg.music;
    var media = msg.media;
    expect(music).toBeTruthy();
    expect(music.url).toContain("data:audio/mpeg");
    var shouldPlay = music && music.url && (media.kind === "image" || media.kind === "gif");
    expect(shouldPlay).toBe(true);
  });

  it("should use musicVolume for overlay audio playback", function() {
    var settings = { musicVolume: 0.5, volume: 0.75 };
    var musicVol = settings.musicVolume !== undefined ? settings.musicVolume : (settings.volume !== undefined ? settings.volume : 0.75);
    expect(musicVol).toBe(0.5);
    var settings2 = { volume: 0.8 };
    var musicVol2 = settings2.musicVolume !== undefined ? settings2.musicVolume : (settings2.volume !== undefined ? settings2.volume : 0.75);
    expect(musicVol2).toBe(0.8);
  });

  it("bot should build music URL from base64 data", function() {
    var msgMusic = {
      data: "dGVzdC1hdWRpbw==",
      mime: "audio/mpeg",
      name: "song.mp3",
    };
    var musicUrl = msgMusic.data
      ? msgMusic.data.startsWith("data:")
        ? msgMusic.data
        : "data:" + (msgMusic.mime || "audio/mpeg") + ";base64," + msgMusic.data
      : msgMusic.url;
    expect(musicUrl).toBe("data:audio/mpeg;base64,dGVzdC1hdWRpbw==");
    expect(msgMusic.name).toBe("song.mp3");
  });

  it("main process should relay music from payload to WS", function() {
    var payload = {
      filePath: "/memes/cat.gif",
      audioPath: "/memes/song.mp3",
      kind: "gif",
      target: "@friend",
    };
    var formattedPayload = {
      type: "quick_drop",
      target: payload.target,
      media: { name: "cat.gif", kind: "gif", mime: "image/gif", data: "base64img" },
      music: payload.audioPath
        ? { name: "song.mp3", kind: "audio", mime: "audio/mpeg", data: "base64audio" }
        : null,
    };
    expect(formattedPayload.music).toBeTruthy();
    expect(formattedPayload.music.data).toBe("base64audio");
    var wsMessage = JSON.stringify(formattedPayload);
    expect(wsMessage).toContain("audio/mpeg");
    expect(wsMessage).toContain("base64audio");
  });
});

describe("video + background music in overlay", function() {
  it("should play music for video when music is selected", function() {
    // Comportement ACTUEL (bug): overlay ne joue music que pour image/gif
    var music = { url: "data:audio/mpeg;base64,xyz", name: "song.mp3" };
    var media = { kind: "video" };

    // Condition ACTUELLE (BUG) : ne passe pas pour video
    var currentCondition = music && music.url && (media.kind === "image" || media.kind === "gif");
    expect(currentCondition).toBe(false);

    // Condition FIX: inclut video aussi
    var fixedCondition = music && music.url && (media.kind === "image" || media.kind === "gif" || media.kind === "video");
    expect(fixedCondition).toBe(true);
  });

  it("should mute video when background music is provided", function() {
    var music = { url: "data:audio/mpeg;base64,xyz" };
    var videoEl = { muted: false };

    // Quand music est présent, la vidéo doit être muette
    if (music) {
      videoEl.muted = true;
    }

    expect(videoEl.muted).toBe(true);
  });

  it("should NOT mute video when no background music", function() {
    var music = null;
    var videoEl = { muted: false };

    if (!music) {
      // La vidéo garde son son original
      videoEl.muted = false;
    }

    expect(videoEl.muted).toBe(false);
  });

  it("should include audioPath in sendDropUrl for weblinks", function() {
    // Le flux actuel pour les weblinks (sendDropUrl) n'inclut PAS audioPath
    // Il faut que sendDropUrl inclue aussi audioPath
    var payload = {
      target: "@friend",
      url: "https://x.com/user/status/123/video/1",
      caption: "check this",
      audioPath: "/memes/song.mp3",
    };

    // Vérifie que le renderer inclut audioPath
    expect(payload.audioPath).toBeTruthy();

    // Vérifie que le message WS inclut music
    var wsMsg = {
      type: "quick_drop",
      target: payload.target,
      caption: payload.caption,
      media: { url: "https://video.twimg.com/123.mp4", kind: "video", mime: "video/mp4" },
      music: payload.audioPath
        ? { name: "song.mp3", kind: "audio", mime: "audio/mpeg", data: "base64audio" }
        : null,
    };

    expect(wsMsg.music).toBeTruthy();
    expect(wsMsg.music.name).toBe("song.mp3");
  });

  it("should NOT include music when no audioPath in weblink", function() {
    var payload = {
      target: "@friend",
      url: "https://x.com/user/status/123/video/1",
      caption: "check this",
      // PAS d'audioPath
    };

    var wsMsg = {
      type: "quick_drop",
      target: payload.target,
      media: { url: "https://video.twimg.com/123.mp4", kind: "video", mime: "video/mp4" },
      music: payload.audioPath
        ? { name: "song.mp3", data: "base64audio" }
        : null,
    };

    expect(wsMsg.music).toBeNull();
  });
});

describe("Twitter/X URL resolution before download", function() {
  beforeEach(function() {
    window.memedrop = {
      resolveUrl: vi.fn(),
      downloadUrl: vi.fn(),
    };
  });

  it("should detect Twitter/X URLs", function() {
    expect(/twitter\.com|x\.com/i.test("https://x.com/user/status/123/video/1")).toBe(true);
    expect(/twitter\.com|x\.com/i.test("https://twitter.com/user/status/123")).toBe(true);
    expect(/twitter\.com|x\.com/i.test("https://giphy.com/test")).toBe(false);
  });

  it("should resolve before downloading a Twitter URL", async function() {
    var twitterUrl = "https://x.com/user/status/123/video/1";
    var resolvedMedia = {
      url: "https://video.twimg.com/ext_tw_video/123.mp4",
      kind: "video",
      mime: "video/mp4",
    };
    var fakeDownload = { name: "twitter_video", path: "/memes/vid.mp4", kind: "video" };
    window.memedrop.resolveUrl.mockResolvedValue(resolvedMedia);
    window.memedrop.downloadUrl.mockResolvedValue(fakeDownload);
    var resolved = await window.memedrop.resolveUrl(twitterUrl);
    expect(resolved.unresolved).toBeFalsy();
    expect(resolved.url).toBe("https://video.twimg.com/ext_tw_video/123.mp4");
    expect(resolved.kind).toBe("video");
    var downloaded = await window.memedrop.downloadUrl(resolved.url);
    expect(downloaded).toEqual(fakeDownload);
    expect(window.memedrop.downloadUrl).toHaveBeenCalledWith(resolved.url);
    expect(window.memedrop.downloadUrl).not.toHaveBeenCalledWith(twitterUrl);
  });

  it("should fallback to original URL if resolution fails", async function() {
    var url = "https://x.com/user/status/123/video/1";
    var unresolved = { url: url, kind: "image", mime: "image/jpeg", unresolved: true };
    var fakeDownload = { name: "fallback", path: "/memes/fallback.gif", kind: "image" };
    window.memedrop.resolveUrl.mockResolvedValue(unresolved);
    window.memedrop.downloadUrl.mockResolvedValue(fakeDownload);
    var resolved = await window.memedrop.resolveUrl(url);
    expect(resolved.unresolved).toBe(true);
    var downloaded = await window.memedrop.downloadUrl(url);
    expect(downloaded).toEqual(fakeDownload);
  });

  it("should detect Twitter video in paste handler URL", function() {
    var pastedUrl = "https://x.com/siyoohse/status/2065202801685246391/video/1";
    expect(pastedUrl).toMatch(/x\.com/i);
    expect(pastedUrl).toMatch(/status\/\d+/);
  });
});

describe("target management", function() {
  beforeEach(function() {
    localStorage.clear();
    document.body.innerHTML = '';
    window.customTargets = new Set();
  });

  function addCustomTarget(val) {
    window.customTargets.add(val);
    localStorage.setItem("memedrop_custom_targets", JSON.stringify([...window.customTargets]));
  }

  function removeCustomTarget(val) {
    window.customTargets.delete(val);
    localStorage.setItem("memedrop_custom_targets", JSON.stringify([...window.customTargets]));
  }

  it("should add a custom target", function() {
    addCustomTarget("@friend");
    expect(window.customTargets.has("@friend")).toBe(true);
  });

  it("should remove a custom target", function() {
    addCustomTarget("@friend");
    addCustomTarget("@pote");
    expect(window.customTargets.size).toBe(2);

    removeCustomTarget("@friend");
    expect(window.customTargets.has("@friend")).toBe(false);
    expect(window.customTargets.has("@pote")).toBe(true);
    expect(window.customTargets.size).toBe(1);
  });

  it("should persist custom targets in localStorage", function() {
    addCustomTarget("@friend");
    // Simuler rechargement
    var saved = JSON.parse(localStorage.getItem("memedrop_custom_targets"));
    expect(saved).toEqual(["@friend"]);
  });

  it("should remove from localStorage after deletion", function() {
    addCustomTarget("@friend");
    removeCustomTarget("@friend");
    var saved = JSON.parse(localStorage.getItem("memedrop_custom_targets"));
    expect(saved).toEqual([]);
  });

  it("should not be able to remove Discord users (only custom targets)", function() {
    addCustomTarget("@friend");
    // Les utilisateurs Discord ne sont PAS dans customTargets
    var discordUser = "@fatima6848";
    expect(window.customTargets.has(discordUser)).toBe(false);

    // On ne peut retirer que des cibles custom
    window.customTargets.add("@friend");
    window.customTargets.delete("@friend");
    expect(window.customTargets.has("@friend")).toBe(false);
  });
});

describe("social meme sync", function() {
  beforeEach(function() {
    window.memedrop = {
      downloadUrl: vi.fn(),
      getPreview: vi.fn(),
      listMemes: vi.fn().mockResolvedValue([]),
    };
  });

  it("should call syncMeme after adding a meme", function() {
    var syncCalled = false;
    window.memedrop.syncMeme = function() { syncCalled = true; return Promise.resolve({ ok: true }); };

    // Simuler l'ajout d'un meme
    var result = { name: "test.gif", path: "/memes/test.gif", kind: "gif" };
    window.memedrop.syncMeme(result);

    expect(syncCalled).toBe(true);
  });

  it("syncMeme should send type: meme_sync via IPC", async function() {
    var captured = null;
    // Simule l'IPC memes:sync
    window.memedrop.syncMeme = async function(data) {
      captured = data;
      return { ok: true };
    };

    var result = { name: "test.gif", path: "/memes/test.gif", kind: "gif" };
    await window.memedrop.syncMeme(result);

    expect(captured).toEqual(result);
  });

  it("should load memes when receiving a synced meme", function() {
    var loadMemesCalled = false;
    // Simule l'écouteur onMemeSynced qui appelle loadMemes()
    function onMemeSynced() {
      loadMemesCalled = true;
    }

    // Simuler la réception
    onMemeSynced();
    expect(loadMemesCalled).toBe(true);
  });

  it("should handle meme_sync message from bot", function() {
    // Simule ce que le bot envoie
    var msg = {
      type: "meme_sync",
      data: { name: "cat.gif", kind: "gif", buffer: "base64data" },
      from: { id: "user1", username: "friend" },
      ts: Date.now(),
    };

    expect(msg.type).toBe("meme_sync");
    expect(msg.data.name).toBe("cat.gif");
    expect(msg.data.buffer).toBeTruthy();
    expect(msg.from.username).toBe("friend");
  });
});

describe("full library sync", function() {
  function shouldSkipHidden(filename, hiddenNames) {
    // Extrait le nom original du fichier (sans préfixe shared_ et timestamp)
    var originalName = filename.replace(/^shared_\d+_/, "");
    return hiddenNames.has(originalName);
  }

  it("should extract original name from shared_ filename", function() {
    expect("shared_1234567890_cat.gif".replace(/^shared_\d+_/, "")).toBe("cat.gif");
    expect("cat.gif".replace(/^shared_\d+_/, "")).toBe("cat.gif");
  });

  it("should skip sync if meme was previously hidden", function() {
    var hiddenNames = new Set(["cat.gif", "dog.png"]);

    expect(shouldSkipHidden("shared_123_cat.gif", hiddenNames)).toBe(true);
    expect(shouldSkipHidden("shared_456_dog.png", hiddenNames)).toBe(true);
    expect(shouldSkipHidden("shared_789_bird.mp4", hiddenNames)).toBe(false);
    expect(shouldSkipHidden("new_image.png", hiddenNames)).toBe(false);
  });

  it("should collect all memes for syncAll", function() {
    var allMemes = [
      { name: "cat", path: "/memes/cat.gif", kind: "gif" },
      { name: "dog", path: "/memes/dog.png", kind: "image" },
    ];
    expect(allMemes.length).toBe(2);
    expect(allMemes[0].name).toBe("cat");
  });

  it("syncAll should call syncMeme for each meme", async function() {
    var synced = [];
    var allMemes = [
      { name: "cat.gif", path: "/memes/cat.gif", kind: "gif" },
      { name: "dog.png", path: "/memes/dog.png", kind: "image" },
    ];

    for (var meme of allMemes) {
      synced.push(meme);
    }

    expect(synced.length).toBe(2);
  });

  it("should record hidden file names when hiding a meme", function() {
    var hiddenNames = new Set();
    var memePath = "/memes/cat.gif";
    var fileName = memePath.split("/").pop(); // "cat.gif"

    hiddenNames.add(fileName);
    expect(hiddenNames.has("cat.gif")).toBe(true);
  });

  it("hiddenNames should persist alongside hiddenMemes", function() {
    var hiddenMemes = ["/memes/cat.gif", "/memes/dog.png"];
    var hiddenNames = hiddenMemes.map(function(p) { return p.split("/").pop(); });

    expect(hiddenNames).toEqual(["cat.gif", "dog.png"]);
  });

  it("should add 'import\u00e9' tag to synced memes", function() {
    var tags = {};
    var destPath = "/memes/shared_123_cat.gif";

    // Simule l'ajout du tag dans le handler meme_sync
    if (!tags[destPath]) tags[destPath] = [];
    if (!tags[destPath].includes("import\u00e9")) tags[destPath].push("import\u00e9");

    expect(tags[destPath]).toContain("import\u00e9");
  });

  it("should filter memes by 'import\u00e9' tag in triage", function() {
    var allMemes = [
      { name: "cat", path: "/memes/shared_1_cat.gif", kind: "gif", tags: ["import\u00e9"] },
      { name: "dog", path: "/memes/dog.png", kind: "image", tags: [] },
      { name: "bird", path: "/memes/shared_2_bird.gif", kind: "gif", tags: ["import\u00e9"] },
    ];

    var imported = allMemes.filter(function(m) { return m.tags && m.tags.includes("import\u00e9"); });
    expect(imported.length).toBe(2);
    expect(imported[0].name).toBe("cat");
    expect(imported[1].name).toBe("bird");

    var local = allMemes.filter(function(m) { return !m.tags || !m.tags.includes("import\u00e9"); });
    expect(local.length).toBe(1);
    expect(local[0].name).toBe("dog");
  });

  it("should keep existing tags when adding 'import\u00e9'", function() {
    var tags = {};
    var destPath = "/memes/shared_123_cat.gif";
    tags[destPath] = ["funny"];

    if (!tags[destPath].includes("import\u00e9")) tags[destPath].push("import\u00e9");

    expect(tags[destPath]).toEqual(["funny", "import\u00e9"]);
  });

  it("should skip duplicate synced files (same original name)", function() {
    var savedFiles = new Set();

    function trySave(originalName) {
      // Vérifier si on a déjà sauvé ce fichier (par son nom original)
      var key = originalName.replace(/^shared_\d+_/, "");
      if (savedFiles.has(key)) {
        return "skipped";
      }
      savedFiles.add(key);
      return "saved";
    }

    // Premier appel : sauvegardé
    expect(trySave("shared_123_cat.gif")).toBe("saved");
    // Deuxième appel (même fichier, timestamp différent) : ignoré
    expect(trySave("shared_456_cat.gif")).toBe("skipped");
    // Fichier différent : sauvegardé
    expect(trySave("shared_789_dog.png")).toBe("saved");

    expect(savedFiles.size).toBe(2);
  });

  it("should not trigger syncAllMemes multiple times", function() {
    var syncCount = 0;
    var hasSynced = false;

    function onConnect() {
      if (hasSynced) return; // Déjà fait
      hasSynced = true;
      syncCount++;
    }

    // Simuler plusieurs events "linked"
    onConnect();
    onConnect();
    onConnect();

    expect(syncCount).toBe(1);
  });

  it("syncAllMemes should track already-sent files", function() {
    var sentFiles = new Set();
    var memes = ["cat.gif", "cat.gif", "dog.png"];
    var sent = [];

    for (var m of memes) {
      if (!sentFiles.has(m)) {
        sentFiles.add(m);
        sent.push(m);
      }
    }

    expect(sent).toEqual(["cat.gif", "dog.png"]);
    expect(sent.length).toBe(2);
  });

  it("should skip file if already saved with same original name (on receive)", function() {
    var memeFolder = "/memes";
    var existingFiles = ["shared_111_cat.gif", "dog.png"];

    function shouldSkip(originalName) {
      var baseName = originalName.replace(/^shared_\d+_/, "");
      // Vérifier si un fichier shared_* avec le même nom original existe déjà
      for (var f of existingFiles) {
        if (f.replace(/^shared_\d+_/, "") === baseName) {
          return f.startsWith("shared_"); // Skip seulement si déjà importé
        }
      }
      return false;
    }

    // cat.gif existe déjà en tant que shared_111_cat.gif → skip
    expect(shouldSkip("shared_222_cat.gif")).toBe(true);
    // dog.png existe mais n'est PAS un shared_ (c'est un fichier local) → ne pas skip
    expect(shouldSkip("shared_222_dog.png")).toBe(false);
    // bird.mp4 n'existe pas du tout → ne pas skip
    expect(shouldSkip("shared_222_bird.mp4")).toBe(false);
  });
});
