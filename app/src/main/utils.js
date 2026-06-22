const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');

// ── getMemeFolder ──────────────────────────────────────────────────────────
function getMemeFolder(store, app) {
  const custom = store.get('memeFolderPath');
  if (custom) {
    try {
      if (!fs.existsSync(custom)) fs.mkdirSync(custom, { recursive: true });
      return custom;
    } catch (err) {
      console.error("[getMemeFolder] custom path failed:", err.message);
      // Fallback vers default
    }
  }

  try {
    const defaultPath = path.join(app.getPath('documents'), 'MemeDrop', 'memes');
    if (!fs.existsSync(defaultPath)) fs.mkdirSync(defaultPath, { recursive: true });
    return defaultPath;
  } catch (err) {
    console.warn("[getMemeFolder] documents path failed:", err.message);
    // Ultimate fallback: %APPDATA%/MemeDrop/memes
    const fallback = path.join(app.getPath('appData'), 'MemeDrop', 'memes');
    if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
    console.log("[getMemeFolder] using fallback:", fallback);
    return fallback;
  }
}

// ── formatQuickDropPayload ────────────────────────────────────────────────
async function formatQuickDropPayload(payload) {
  let media = null;
  if (payload.filePath) {
    try {
      const ext = path.extname(payload.filePath).toLowerCase();
      let mime = 'image/png';
      if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
      else if (ext === '.gif') mime = 'image/gif';
      else if (ext === '.mp4') mime = 'video/mp4';
      else if (ext === '.webm') mime = 'video/webm';
      else if (ext === '.webp') mime = 'image/webp';
      else if (ext === '.mp3') mime = 'audio/mpeg';
      else if (ext === '.wav') mime = 'audio/wav';
      else if (ext === '.ogg') mime = 'audio/ogg';

      const data = await fs.promises.readFile(payload.filePath, 'base64');
      media = {
        name: path.basename(payload.filePath),
        kind: payload.kind,
        mime,
        data // Base64 string
      };
    } catch (err) {
      console.error("Failed to read media file for drop:", err);
    }
  }

  let music = null;
  let errors = [];

  if (payload.audioPath) {
    try {
      const ext = path.extname(payload.audioPath).toLowerCase();
      let mime = 'audio/mpeg';
      if (ext === '.wav') mime = 'audio/wav';
      else if (ext === '.ogg') mime = 'audio/ogg';

      const data = await fs.promises.readFile(payload.audioPath, 'base64');
      music = {
        name: path.basename(payload.audioPath),
        kind: 'audio',
        mime,
        data // Base64 string
      };
    } catch (err) {
      console.error("Failed to read audio file for drop:", err);
      errors.push("audio: " + err.message);
    }
  }

  const result = {
    type: 'quick_drop',
    target: payload.target,
    caption: payload.caption,
    media,
    music,
    volume: payload.volume !== undefined ? payload.volume : 1.0,
    duration: payload.duration || undefined,
    rain: payload.rain || undefined,
  };

  if (errors.length > 0) {
    result.warning = errors.join("; ");
  }

  return result;
}

// ── getPreviewTarget ──────────────────────────────────────────────────────
function getPreviewTarget(store) {
  const identity = store.get('linkIdentity');
  if (identity && identity.username) {
    return '@' + identity.username;
  }
  return null;
}

// ── buildCollage ──────────────────────────────────────────────────────────
// Compose plusieurs images en un seul JPEG côte à côte (2 colonnes, 1-2 lignes).
// Retourne { buffer, base64, mime, width, height, layout, count } ou null.
async function buildCollage(filePaths, cellSize = 600) {
  if (!filePaths || filePaths.length < 2) return null;
  const limited = filePaths.slice(0, 4); // cap à 4

  // Charger et redimensionner chaque image, ignorer les invalides
  const loaded = [];
  for (const fp of limited) {
    try {
      const img = await Jimp.read(fp);
      img.contain({ w: cellSize, h: cellSize });
      loaded.push(img);
    } catch {
      // fichier invalide ou introuvable → ignoré
    }
  }

  if (loaded.length < 2) return null;

  const cols = 2;
  const rows = Math.ceil(loaded.length / cols);
  const totalW = cols * cellSize;
  const totalH = rows * cellSize;

  const collage = new Jimp({ width: totalW, height: totalH, color: 0x000000ff });

  loaded.forEach((img, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    collage.composite(img, col * cellSize, row * cellSize);
  });

  const buffer = await collage.getBuffer('image/jpeg');
  return {
    buffer,
    base64: buffer.toString('base64'),
    mime: 'image/jpeg',
    width: totalW,
    height: totalH,
    layout: `${cols}x${rows}`,
    count: loaded.length
  };
}

// ── resolveMediaUrl ───────────────────────────────────────────────────────
// Résout une URL sociale (Twitter, YouTube, Giphy, Tenor) en URL média directe.
// Retourne { url, kind, mime, sourceUrl?, unresolved? }
async function resolveMediaUrl(url) {
  if (!url) return { url, kind: 'image', mime: 'image/jpeg', unresolved: true };

  // 1. URL directe avec extension reconnue → pass-through
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) {
    return { url, kind: 'video', mime: 'video/mp4' };
  }
  if (/\.gif(\?|$)/i.test(url)) {
    return { url, kind: 'gif', mime: 'image/gif' };
  }
  if (/\.(jpg|jpeg|png|webp|avif)(\?|$)/i.test(url)) {
    return { url, kind: 'image', mime: 'image/jpeg' };
  }

  // 2. YouTube → thumbnail maxresdefault
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    const thumbUrl = `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`;
    return { url: thumbUrl, kind: 'image', mime: 'image/jpeg', sourceUrl: url };
  }

  // 3. Twitter/X → vxtwitter API pour récupérer le média direct
  if (/twitter\.com|x\.com/i.test(url)) {
    const match = url.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/i);
    if (match) {
      try {
        const res = await fetch(`https://api.vxtwitter.com/Twitter/status/${match[1]}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.mediaURLs && data.mediaURLs.length > 0) {
            const mediaUrl = data.mediaURLs[0];
            const isVideo = data.media_extended?.[0]?.type === 'video' || mediaUrl.includes('.mp4');
            return {
              url: mediaUrl,
              kind: isVideo ? 'video' : 'image',
              mime: isVideo ? 'video/mp4' : 'image/jpeg',
              sourceUrl: url
            };
          }
        }
      } catch { /* ignore */ }
    }
    return { url, kind: 'image', mime: 'image/jpeg', unresolved: true, sourceUrl: url };
  }

  // 4. Giphy → URL .gif via oEmbed
  if (/giphy\.com/i.test(url)) {
    try {
      const res = await fetch(`https://giphy.com/services/oembed?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.url) return { url: data.url, kind: 'gif', mime: 'image/gif', sourceUrl: url };
      }
    } catch { /* ignore */ }
  }

  // 5. Tenor → oEmbed
  if (/tenor\.com/i.test(url)) {
    try {
      const res = await fetch(`https://tenor.com/oembed?url=${encodeURIComponent(url)}&key=LIVDSRZULELA`);
      if (res.ok) {
        const data = await res.json();
        if (data.url) return { url: data.url, kind: 'gif', mime: 'image/gif', sourceUrl: url };
      }
    } catch { /* ignore */ }
  }

  // Fallback universel
  return { url, kind: 'image', mime: 'image/jpeg', unresolved: true };
}

module.exports = { formatQuickDropPayload, getPreviewTarget, buildCollage, resolveMediaUrl, getMemeFolder };
