# Plan: QuickLauncher — Auto-Watch Console + Social URL Resolver

## Summary
Deux features complémentaires pour le QuickLauncher MemeDrop :
1. **Console Watcher** : un agent de surveillance 24h/24 qui monitore les logs de `npm run dev` et les erreurs JS de la fenêtre Electron pour détecter et réparer automatiquement les bugs.
2. **Social URL Resolver** : extraction automatique d'un vrai lien média direct (`.mp4`, `.gif`, `.jpg`) à partir d'URLs de réseaux sociaux (Twitter/X, YouTube, etc.) avant de l'envoyer via `quick_drop`.

## Metadata
- **Complexity**: Large
- **Estimated Files**: 6

---

## Mandatory Reading (Context)

* `quicklauncher/main.js` — Point d'entrée Electron, contient `connectWebSocket()`, tous les `ipcMain.handle()`, et la logique `drop:sendUrl`
* `quicklauncher/utils.js` — Contient `formatQuickDropPayload` et `getPreviewTarget`, le bon endroit pour ajouter `resolveMediaUrl()`
* `quicklauncher/app.js` — Frontend. Contient le handler `btn-weblink-send` qui appelle `sendDropUrl`
* `bot/index.js` — Bot Railway. Accepte uniquement `quick_drop` (avec `media.url` ou `media.data`). Pas de handler `drop_url`.
* `quicklauncher/tests/formatPayload.test.js` — Pattern de test en vigueur (vitest + ESM pour les tests, CJS pour le code source)

---

## Patterns to Mirror

### ERROR_HANDLING
```js
// Dans main.js — toujours retourner { ok, error }
return { ok: false, error: 'Not connected' };
// Dans utils.js — try/catch silencieux avec console.error
try { ... } catch (err) { console.error("Failed:", err); }
```

### NAMING_CONVENTION
```
ipcMain.handle('domain:action', ...)   // snake_case avec : séparateur
formatXxx()                            // fonctions utilitaires en camelCase
quicklauncher/tests/xxx.test.js       // tests dans /tests/, extension .test.js
```

### WEBSOCKET_SEND
```js
// Toujours utiliser quick_drop, jamais drop_url (bot ne le connaît pas)
ws.send(JSON.stringify({ type: 'quick_drop', target, media: { url, kind, mime, name, size: 0 } }));
```

### TEST_STRUCTURE
```js
// vitest avec import ESM pour les tests, require CJS pour le code source
import { describe, it, expect } from 'vitest';
import { maFonction } from '../utils.js'; // utils doit aussi exporter en ESM si possible
```

---

## Files to Change

| Fichier | Action | Justification |
|---|---|---|
| `quicklauncher/utils.js` | UPDATE | Ajouter `resolveMediaUrl(url)` — résolution d'URLs sociales |
| `quicklauncher/main.js` | UPDATE | Brancher `resolveMediaUrl` dans `drop:sendUrl`, ajouter IPC `url:resolve` |
| `quicklauncher/preload.js` | UPDATE | Exposer `resolveUrl` au renderer |
| `quicklauncher/app.js` | UPDATE | Appeler `resolveUrl` avant envoi dans `btn-weblink-send`, afficher le statut |
| `quicklauncher/tests/resolveUrl.test.js` | CREATE | Tests TDD pour `resolveMediaUrl` |
| `quicklauncher/watcher.js` | CREATE | Script Node.js de surveillance console/log à lancer séparément |

---

## NOT Building
- Téléchargement complet de la vidéo YouTube (trop volumineux pour Discord)
- Support d'Instagram (login requis, trop complexe)
- Interface graphique du watcher (mode CLI uniquement)
- Modification du bot Railway (déployé, ne pas y toucher pour cette feature)

---

## Step-by-Step Tasks

### Task 1: [TDD] Écrire les tests pour `resolveMediaUrl`
- **ACTION**: Créer `tests/resolveUrl.test.js`
- **IMPLEMENT**:
```js
// Test 1: URL directe (.mp4) → retournée telle quelle
expect(await resolveMediaUrl('https://example.com/vid.mp4')).toEqual({
  url: 'https://example.com/vid.mp4', kind: 'video', mime: 'video/mp4'
});

// Test 2: URL Twitter/X → extraire le CDN twimg.com (si API oEmbed disponible)
// Pour l'instant : retourner { url: originalUrl, kind: 'image', needsResolve: true }

// Test 3: URL YouTube → extraire thumbnail HD comme fallback
// https://img.youtube.com/vi/{ID}/maxresdefault.jpg

// Test 4: URL gif tenor/giphy → extraire l'URL .gif directe
```
- **MIRROR**: `tests/formatPayload.test.js` — même structure describe/it
- **VALIDATE**: `npm run test` → 0 failures

---

### Task 2: [Green] Implémenter `resolveMediaUrl` dans `utils.js`
- **ACTION**: Ajouter la fonction après `getPreviewTarget`
- **IMPLEMENT**:
```js
async function resolveMediaUrl(url) {
  // 1. URL directe (extension reconnue) → pass-through
  if (/\.(mp4|webm|gif|jpg|jpeg|png|webp)(\?|$)/i.test(url)) {
    const ext = url.match(/\.(mp4|webm|gif|jpg|jpeg|png|webp)/i)[1].toLowerCase();
    const kindMap = { mp4:'video', webm:'video', gif:'gif' };
    const kind = kindMap[ext] || 'image';
    return { url, kind, mime: kind==='video'?'video/mp4': kind==='gif'?'image/gif':'image/jpeg' };
  }

  // 2. Twitter/X → oEmbed pour extraire thumbnail (pas de CDN direct sans auth)
  if (/twitter\.com|x\.com/i.test(url)) {
    try {
      const oembed = await fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`);
      const data = await oembed.json();
      // Extraire thumbnail_url de la réponse oEmbed
      const thumbUrl = data.thumbnail_url || null;
      if (thumbUrl) return { url: thumbUrl, kind: 'image', mime: 'image/jpeg', sourceUrl: url };
    } catch {}
    // Fallback : envoyer l'URL brute (l'overlay tentera de la charger)
    return { url, kind: 'image', mime: 'image/jpeg', unresolved: true };
  }

  // 3. YouTube → thumbnail HD
  if (/youtube\.com\/watch|youtu\.be\//i.test(url)) {
    const idMatch = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (idMatch) {
      const thumbUrl = `https://img.youtube.com/vi/${idMatch[1]}/maxresdefault.jpg`;
      return { url: thumbUrl, kind: 'image', mime: 'image/jpeg', sourceUrl: url };
    }
  }

  // 4. Tenor/Giphy → extraire l'URL .gif via oEmbed
  if (/tenor\.com|giphy\.com/i.test(url)) {
    try {
      const oembed = await fetch(`https://tenor.com/oembed?url=${encodeURIComponent(url)}`);
      const data = await oembed.json();
      if (data.url) return { url: data.url, kind: 'gif', mime: 'image/gif' };
    } catch {}
  }

  // Fallback universel
  return { url, kind: 'image', mime: 'image/jpeg', unresolved: true };
}
module.exports = { formatQuickDropPayload, getPreviewTarget, resolveMediaUrl };
```
- **MIRROR**: Pattern `try/catch` silencieux de `utils.js`
- **VALIDATE**: `npm run test` → tous verts

---

### Task 3: Brancher `resolveMediaUrl` dans `main.js`
- **ACTION**: Modifier `drop:sendUrl` + ajouter `ipcMain.handle('url:resolve', ...)`
- **IMPLEMENT**:
```js
const { formatQuickDropPayload, getPreviewTarget, resolveMediaUrl } = require('./utils');

// Nouveau handler pour résolution préalable depuis le renderer
ipcMain.handle('url:resolve', async (_e, url) => {
  return await resolveMediaUrl(url);
});

// drop:sendUrl mis à jour
ipcMain.handle('drop:sendUrl', async (_e, payload) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const resolved = await resolveMediaUrl(payload.url);
    const msg = {
      type: 'quick_drop',
      target: payload.target,
      caption: payload.caption || null,
      rain: payload.rain || null,
      media: { ...resolved, name: resolved.url.split('/').pop()?.split('?')[0] || 'media', size: 0 }
    };
    ws.send(JSON.stringify(msg));
    // persist target...
    return { ok: true, resolved };
  }
  return { ok: false, error: 'Not connected' };
});
```
- **VALIDATE**: Recharger l'app, envoyer un lien YouTube → la miniature s'affiche sur l'Overlay

---

### Task 4: Mettre à jour `preload.js`
- **ACTION**: Ajouter `resolveUrl`
- **IMPLEMENT**:
```js
resolveUrl: (url) => ipcRenderer.invoke('url:resolve', url),
```
- **VALIDATE**: `window.memedrop.resolveUrl` disponible dans le renderer

---

### Task 5: Mettre à jour le renderer (`app.js`)
- **ACTION**: Dans `btn-weblink-send`, afficher un aperçu de résolution avant l'envoi
- **IMPLEMENT**:
```js
// Dans le handler btn-weblink-send, avant l'envoi :
const status = document.getElementById('weblink-resolve-status'); // à ajouter dans index.html
if (status) status.textContent = '🔍 Résolution du lien...';
const resolved = await window.memedrop.resolveUrl(url);
if (resolved.unresolved) {
  if (status) status.textContent = '⚠️ Lien non résolu, envoi brut...';
} else {
  if (status) status.textContent = `✅ ${resolved.kind.toUpperCase()} détecté`;
}
```
- **VALIDATE**: L'UI affiche le type détecté (IMAGE / VIDEO / GIF) avant d'envoyer

---

### Task 6: Créer `watcher.js` — Surveillance console 24h/24
- **ACTION**: Créer `quicklauncher/watcher.js`, un script Node.js autonome
- **IMPLEMENT**:
```js
// watcher.js — Lance npm run dev et surveille stderr pour des erreurs connues
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'watcher.log');
const KNOWN_ERRORS = [
  { pattern: /is not a function/, action: 'MISSING_IPC' },
  { pattern: /Cannot set properties of null/, action: 'NULL_DOM' },
  { pattern: /ERR_CONNECTION_REFUSED/, action: 'WS_REFUSED' },
  { pattern: /getContext is not a function/, action: 'WRONG_ELEMENT' },
];

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function startDev() {
  log('🟢 Démarrage du watcher MemeDrop QuickLauncher...');
  const proc = spawn('npm', ['run', 'dev'], { cwd: __dirname, shell: true });

  proc.stdout.on('data', (data) => {
    const text = data.toString();
    process.stdout.write(text);
    checkForErrors(text);
  });

  proc.stderr.on('data', (data) => {
    const text = data.toString();
    process.stderr.write(text);
    checkForErrors(text);
  });

  proc.on('close', (code) => {
    log(`⚠️ Processus terminé avec code ${code}. Redémarrage dans 3s...`);
    setTimeout(startDev, 3000);
  });
}

function checkForErrors(text) {
  for (const { pattern, action } of KNOWN_ERRORS) {
    if (pattern.test(text)) {
      log(`🚨 Erreur détectée [${action}]: ${text.trim().slice(0, 200)}`);
      // Écrire dans un fichier d'erreur que l'agent lit
      fs.appendFileSync(path.join(__dirname, 'errors.log'), 
        JSON.stringify({ ts: Date.now(), action, text: text.trim().slice(0, 500) }) + '\n'
      );
    }
  }
}

startDev();
```
- **VALIDATE**: `node watcher.js` démarre l'app, les erreurs apparaissent dans `errors.log`

---

## Testing & Validation

### Edge Cases Checklist
- [ ] URL directe `.mp4` → pass-through sans fetch réseau
- [ ] URL YouTube valide → retourne thumbnail `maxresdefault.jpg`
- [ ] URL YouTube invalide (pas d'ID) → fallback brut
- [ ] URL Twitter → oEmbed retourne 404 → fallback brut
- [ ] URL complètement inconnue → fallback brut sans crash
- [ ] Watcher : crash de l'app → redémarrage automatique dans 3s

### Validation Commands
```bash
# Depuis quicklauncher/
npm run test          # Tous les tests verts
node watcher.js       # Démarre la surveillance

# Tester resolveMediaUrl manuellement :
node -e "const {resolveMediaUrl}=require('./utils'); resolveMediaUrl('https://youtu.be/dQw4w9WgXcQ').then(console.log)"
```

---

## Limitations connues
- **Twitter/X** : L'API oEmbed de Twitter ne retourne que la miniature (thumbnail), pas la vidéo brute (nécessiterait l'API Twitter v2 avec Bearer token). La miniature sera affichée sur l'Overlay à la place.
- **YouTube** : Même chose — thumbnail uniquement. Pour la vidéo complète, il faudrait `yt-dlp` installé sur la machine.
- **Le watcher est un outil dev local** : il ne tourne que sur votre machine, pas en production. Il signale les erreurs mais ne modifie pas le code automatiquement — c'est l'agent (moi) qui intervient quand vous lui montrez les logs.

---

## Feature 3 — Multi-image Collage (images côte à côte en un seul Drop)

### Contexte & Contrainte Architecture
L'overlay (`overlay.js:renderDrop`) accepte **un seul objet `media`** par drop. Le bot et l'overlay ne connaissent pas le concept de "liste d'images". Il est donc impossible d'envoyer plusieurs images séparées en un seul message sans modifier le bot.

**Stratégie retenue : composition Canvas côté QuickLauncher**
Créer un collage JPEG/PNG à la volée (via `node-canvas` ou `Jimp`) dans le process principal Electron **avant** l'envoi, puis envoyer l'image résultante en base64 comme un `quick_drop` normal. Aucune modification du bot ni de l'overlay.

### Fichiers supplémentaires

| Fichier | Action | Justification |
|---|---|---| 
| `quicklauncher/utils.js` | UPDATE | Ajouter `buildCollage(filePaths, layout)` |
| `quicklauncher/main.js` | UPDATE | Ajouter `ipcMain.handle('collage:build')` + modifier `drop:send` pour accepter `filePaths[]` |
| `quicklauncher/preload.js` | UPDATE | Exposer `buildCollage` et `sendCollage` |
| `quicklauncher/index.html` | UPDATE | Ajouter mode "multi-sélection" dans le drop panel |
| `quicklauncher/app.js` | UPDATE | UI de sélection multiple + aperçu collage |
| `quicklauncher/tests/collage.test.js` | CREATE | Tests TDD pour `buildCollage` |

### Dépendance requise
```bash
# Dans quicklauncher/
npm install jimp
# Jimp est pure JS (pas de binaire natif) — compatible Electron sans recompilation
```

### Task 7: [TDD] Écrire les tests pour `buildCollage`
- **ACTION**: Créer `tests/collage.test.js`
- **IMPLEMENT**:
```js
import { describe, it, expect } from 'vitest';
import { buildCollage } from '../utils.js';
import path from 'path';
import fs from 'fs';

describe('buildCollage', () => {
  it('retourne null si moins de 2 images', async () => {
    const result = await buildCollage(['single.jpg']);
    expect(result).toBeNull();
  });

  it('retourne un buffer PNG pour 2 images valides', async () => {
    // Créer 2 images test 10x10 pixels
    const img1 = path.join(__dirname, 'test1.jpg');
    const img2 = path.join(__dirname, 'test2.jpg');
    // (dans le test réel, on crée de vrais fichiers JPEG avec Jimp)
    const result = await buildCollage([img1, img2]);
    expect(result).not.toBeNull();
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('supporte jusqu\'à 4 images (grille 2×2)', async () => {
    const imgs = [img1, img2, img3, img4]; // 4 images test
    const result = await buildCollage(imgs);
    expect(result.layout).toBe('2x2');
  });
});
```
- **VALIDATE**: `npm run test` → tests en rouge (red phase TDD)

---

### Task 8: [Green] Implémenter `buildCollage` dans `utils.js`
- **ACTION**: Ajouter après `resolveMediaUrl`
- **IMPLEMENT**:
```js
const Jimp = require('jimp');

async function buildCollage(filePaths, maxWidth = 1200) {
  if (!filePaths || filePaths.length < 2) return null;
  const imgs = filePaths.slice(0, 4); // max 4 images

  // Charger toutes les images
  const jimps = await Promise.all(imgs.map(p => Jimp.read(p).catch(() => null)));
  const valid = jimps.filter(Boolean);
  if (valid.length < 2) return null;

  // Layout automatique
  const cols = valid.length <= 2 ? 2 : 2; // toujours 2 colonnes
  const rows = Math.ceil(valid.length / 2);
  const cellW = Math.floor(maxWidth / cols);
  const cellH = cellW; // carré

  // Redimensionner chaque image pour tenir dans la cellule
  valid.forEach(img => img.cover(cellW, cellH)); // cover = rognage centré

  // Créer le canvas résultant
  const totalW = cols * cellW;
  const totalH = rows * cellH;
  const collage = new Jimp(totalW, totalH, 0x000000ff);

  valid.forEach((img, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    collage.composite(img, col * cellW, row * cellH);
  });

  const buffer = await collage.getBufferAsync(Jimp.MIME_JPEG);
  return {
    buffer,
    base64: buffer.toString('base64'),
    mime: 'image/jpeg',
    width: totalW,
    height: totalH,
    layout: `${cols}x${rows}`,
    count: valid.length
  };
}

module.exports = { formatQuickDropPayload, getPreviewTarget, resolveMediaUrl, buildCollage };
```
- **VALIDATE**: `npm run test` → tests collage au vert

---

### Task 9: Exposer le collage dans `main.js`
- **ACTION**: Ajouter `ipcMain.handle('collage:build')` et modifier `drop:send` pour détecter `filePaths[]`
- **IMPLEMENT**:
```js
const { ..., buildCollage } = require('./utils');

// Nouveau handler : build collage depuis le renderer
ipcMain.handle('collage:build', async (_e, filePaths) => {
  const result = await buildCollage(filePaths);
  if (!result) return { ok: false, error: 'Pas assez d\'images valides' };
  return { ok: true, ...result };
});

// drop:send modifié pour détecter un collage (filePaths[])
ipcMain.handle('drop:send', async (_e, payload) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    let formattedPayload;
    
    // Mode collage : plusieurs chemins fichiers
    if (Array.isArray(payload.filePaths) && payload.filePaths.length >= 2) {
      const collage = await buildCollage(payload.filePaths);
      if (!collage) return { ok: false, error: 'Collage impossible' };
      formattedPayload = {
        type: 'quick_drop',
        target: payload.target,
        caption: payload.caption || null,
        rain: payload.rain || null,
        media: {
          data: collage.base64,
          mime: collage.mime,
          kind: 'image',
          name: `collage_${Date.now()}.jpg`,
          size: collage.buffer.length
        }
      };
    } else {
      // Mode normal (1 fichier)
      formattedPayload = await formatQuickDropPayload(payload);
    }
    
    ws.send(JSON.stringify(formattedPayload));
    // persist target...
    return { ok: true };
  }
  return { ok: false, error: 'Not connected' };
});
```

---

### Task 10: UI multi-sélection dans `app.js`
- **ACTION**: Ajouter un bouton "Mode Collage" dans le drop panel. Quand activé, les clics sur les cartes **accumulent** les sélections au lieu d'ouvrir le panel.
- **IMPLEMENT**:
```js
let collageMode = false;
let collagePaths = [];

// Bouton toggle collage mode
document.getElementById('btn-collage-mode')?.addEventListener('click', () => {
  collageMode = !collageMode;
  collagePaths = [];
  document.getElementById('btn-collage-mode').textContent = 
    collageMode ? `🖼️ Collage (0)` : '🖼️ Mode Collage';
  document.getElementById('collage-preview-bar')?.classList.toggle('hidden', !collageMode);
});

// Modifier le click sur les cartes pour accumuler en mode collage
// (dans renderGrid, adapter card.addEventListener('click'))
card.addEventListener('click', () => {
  if (collageMode) {
    if (collagePaths.length < 4 && !collagePaths.includes(meme.path)) {
      collagePaths.push(meme.path);
      card.classList.add('selected-collage');
      document.getElementById('btn-collage-mode').textContent = 
        `🖼️ Collage (${collagePaths.length}/4)`;
    }
    return;
  }
  openDropPanel(meme);
});

// Bouton "Envoyer le collage"
document.getElementById('btn-send-collage')?.addEventListener('click', async () => {
  if (collagePaths.length < 2) return toast('Sélectionne au moins 2 images', 'error');
  const target = prompt('Cible (@pseudo) :');
  if (!target) return;
  const result = await window.memedrop.sendDrop({ 
    target, filePaths: collagePaths, kind: 'image' 
  });
  if (result?.ok) {
    toast(`🖼️ Collage envoyé à ${target}`);
    collagePaths = [];
    collageMode = false;
  } else {
    toast(`❌ ${result?.error}`, 'error');
  }
});
```

### Task 11: Ajouter les éléments HTML manquants dans `index.html`
- **ACTION**: Ajouter barre de contrôle collage dans la toolbar
```html
<!-- Dans la toolbar, après les filtres existants -->
<button id="btn-collage-mode" class="filter-btn" title="Sélectionner plusieurs images pour un collage">🖼️ Mode Collage</button>
<div id="collage-preview-bar" class="hidden" style="display:flex;gap:8px;padding:8px;background:var(--glass);border-radius:8px;">
  <span id="collage-count">0/4 images</span>
  <button id="btn-send-collage" class="primary" style="padding:4px 12px;">Envoyer le collage</button>
  <button id="btn-clear-collage" class="secondary" style="padding:4px 12px;">✕ Annuler</button>
</div>
```

---

### Testing Collage

#### Edge Cases
- [ ] 1 seule image sélectionnée → message d'erreur "Sélectionne au moins 2"
- [ ] 5 images → silently capped à 4
- [ ] Image corrompue dans la sélection → ignorée, collage des images valides restantes
- [ ] Images en portrait vs paysage → `cover()` gère le rognage centré automatiquement

#### Validation Commands
```bash
npm install jimp
npm run test   # tests collage verts
# Puis : activer Mode Collage, sélectionner 2 memes, cliquer "Envoyer le collage"
# L'overlay doit afficher une image composite avec les 2 memes côte à côte
```

---

## Next Steps (mise à jour)
> Plan mis à jour avec **3 features** :
> 1. Console Watcher (Tasks 1→6)
> 2. Social URL Resolver (Tasks 1→5)  
> 3. Multi-image Collage (Tasks 7→11)
>
> Dites-moi **"implémente le plan"** pour démarrer dans l'ordre des tasks.
