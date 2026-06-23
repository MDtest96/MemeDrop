# Changelog — MemeDrop

## v1.4.7 (2026-06-23)

### ✨ Nouveautés
- **Détection des fichiers sans extension** : les memes sans extension dans le dossier sont automatiquement détectés par signature (magic bytes) et apparaissent dans la grille
- **Légende sous l'image** : le toggle fonctionne correctement dans l'overlay (texte en dessous du média)

### 🔧 Corrections
- **Fichiers sans extension** : `detectKindFromBuffer()` lit les magic bytes (PNG, JPEG, GIF, WebP, MP4, WebM, MP3, WAV, OGG) pour identifier et afficher les fichiers sans extension
- **Légende sous l'image** : le texte s'affiche en dessous du média via `flex-direction: column` au lieu de `position: static` dans un bloc absolute (résolution du bug CSS)
- **Réactions émojis supprimées** : la barre d'émojis cliquables sous les drops overlay a été retirée

### 🧪 Tests
- 198 tests unitaires, 18 fichiers
- 13 nouveaux tests pour `detectKindFromBuffer` (tous les formats + cas limites)

---

## v1.4.5 (2026-06-22)

### ✨ Nouveautés
- **Sync bibliothèque** : partage tes memes avec tous les utilisateurs connectés (bouton 📤 Sync)
- **Téléchargement des memes des autres** : bouton 📥 Tout DL pour importer la bibliothèque des autres
- **Triage multi-critères** : filtres par type/tag/favoris, tris multiples, persistance des préférences
- **Menu contextuel** : clic droit sur un meme → Play Audio, Rename, Favorites, Hide, Blacklist
- **Recherche full-text** : cherche par nom, tag, type, chemin
- **Sélection Shift+clic** : sélectionne une plage de memes
- **Édition par lot** : 🏷️ Tag applique/supprime un tag sur tous les memes sélectionnés
- **Tags éditor** : voir et supprimer les tags du meme sélectionné dans le panneau latéral
- **Recherche inversée** : préfixe `!tagname` pour exclure un tag du filtre
- **Vue en liste** : 📋/📄 alterne entre grille et liste compacte
- **Légende sous l'image** : 📝 toggle pour mettre le nom sous la miniature
- **Drop aléatoire** : 🎲 choisit un meme au hasard et ouvre le panneau d'envoi
- **Template de message** : 💾 sauvegarde/charge des messages dans le panneau d'envoi
- **Sync durée audio** : ⏱️ checkbox pour synchroniser la durée d'affichage avec l'audio
- **Programmateur mute** : 🤫 Ne pas déranger, créneaux horaires configurables
- **Raccourcis clavier** : Ctrl+F (recherche), Ctrl+T (triage), Ctrl+M (mute), Ctrl+Shift+L (renvoyer dernier)
- **Badge Blacklist** : le bouton 🚫 affiche le nombre de memes cachés
- **Durée audio** : affichée dans le dropdown de sélection audio
- **Compteur caractères** : dans le champ caption
- **Réinitialisation** : bouton 🗑️ dans les settings

### 🔧 Corrections
- **Fichiers Twitter/X** : preview vidéo fonctionnelle (résolution d'URL avant download)
- **YouTube/Spotify** : détection et résolution avec preview thumbnail
- **Audio en fond** : le son sélectionné remplace celui de la vidéo
- **Noms spéciaux** : sanitization des caractères (#, 👋, @) dans les noms de fichiers
- **Noms simplifiés** : les fichiers importés sont nommés `shared_nom.ext` (sans timestamp)
- **Déduplication** : par hash SHA256 (premiers 4KB) — fiable et précise
- **Sync en boucle** : cooldown de 5 min entre deux sync
- **library:changed** : débouncé pour éviter les rafales
- **Chemins** : fallback `appData` si Documents inaccessible (OneDrive)
- **Migration** : `hiddenMemeNames` extraits automatiquement des anciens `hiddenMemes`
- **Cibles** : suppression possible des utilisateurs Discord du panneau d'envoi

### 🧪 Tests
- 183 tests unitaires, 18 fichiers de test
- Couverture : memes.js, settings.js, utils.js, grid, features

---

## v1.4.4 (2026-06-22)

- Fix sync loop (cooldown persisté)
- Cleanup doublons shared_* au démarrage

## v1.4.3 (2026-06-22)

- Première version avec social sync
- Triage panel
- Menu contextuel
- Fix Twitter/X preview
- Fix audio en drop

## v1.4.2 (2026-06-22)

- Fix Giphy infinite scroll → bouton "Afficher plus"
- Fix overlay croix toujours visible
- Fix connexion/WebSocket race condition
- Presse-papier préserve GIF/MP4
- YouTube → vignette au lieu de fetch HTML
- Dossier memes configurable
- Export/import config JSON
- Drag & drop depuis l'explorateur
- Multi-target
- Thème appliqué au launcher
- 73 tests

## v1.4.1 (2026-06-21)

- Fix Giphy affichage images
- Fix overlay + pop sonore
- Réactions émojis
- Tags/Favs/Audio/Groups avec persistance electron-store
- Renommer (double-clic)
- Drop à tous
- Quicklauncher retiré du suivi
- 73 tests

## v1.4.0 (2026-06-20)

- Version initiale avec bot Railway
- Overlay transparent
- Drops avec médias
- Pairing Discord
