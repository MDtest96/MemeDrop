# MemeDrop — Todo & Roadmap

> État actuel : v1.3.4 — Release publiée sur GitHub
> Dernière mise à jour : 21/06/2026

---

## 🔴 Critiques (bugs / blocages)

- [ ] **1. Overlay — croix toujours pas clickable sur certains PCs**
  Le `HOVER_MARGIN` est passé à 24 mais certains utilisateurs signalent que la croix reste inaccessible. Peut-être un problème de `setIgnoreMouseEvents` qui ne bascule pas correctement. Solution possible : rendre la croix toujours visible et toujours en `pointer-events: auto`, ou utiliser un `BrowserWindow` séparé rien pour la croix.

- [ ] **2. Overlay — le son de notification (pop) ne joue pas toujours**
  Le `playPop()` utilise `AudioContext` qui peut être bloqué par les politiques de autoplay de Chromium. Nécessite une interaction utilisateur avant de pouvoir jouer.

- [ ] **3. Les vidéos ne s'affichent pas dans l'overlay sur certains GPUs**
  L'accélération matérielle est désactivée (`app.disableHardwareAcceleration()`) ce qui peut causer des problèmes de rendu vidéo sur des machines faibles. Ajouter une option pour la réactiver.

- [ ] **4. Giphy — les images ne chargent pas dans l'onglet Trending**
  Problème mentionné dans le compact initial. Les URLs Giphy sont bloquées par la CSP ou un adblocker Electron interne. À investiguer avec les DevTools (`--remote-debugging-port=9222`).

- [ ] **5. Watcher — `errors.log` peut devenir énorme**
  Le watcher écrit toutes les erreurs détectées sans limite de taille. Ajouter une rotation (max 5MB, garder 3 backups).

- [ ] **6. Le nombre de connectés reste à 0 au démarrage**
  `users:list` n'est envoyé par le bot que quand la liste CHANGE, pas quand un client se connecte. Solution déjà partielle (cache dans le plan) mais pas encore implémentée.

---

## 🟡 Fonctionnalités manquantes

- [ ] **7. Drag & drop de fichiers depuis l'explorateur vers la grille**
  Actuellement on peut coller depuis le presse-papier, mais pas glisser-déposer des fichiers.

- [ ] **8. Éditer le nom d'un meme directement dans la grille**
  Double-clic sur le nom → champ edit → renomme le fichier sur le disque.

- [ ] **9. Recherche et filtres avancés**
  - Filtre par tag (existant mais basique)
  - Filtre par date d'ajout
  - Recherche dans les noms + tags combinés

- [ ] **10. Mode présentation / slideshow**
  Lancer un diaporama des memes d'un dossier, plein écran, avec intervalles configurable.

- [ ] **11. Export / import de la configuration**
  Sauvegarder les settings, tags, favoris, groupes dans un fichier JSON pour les transférer d'un PC à l'autre.

- [ ] **12. Support des stickers animés (APNG, WebP animé)**
  Actuellement seul le GIF est supporté comme format animé.

- [ ] **13. Miniatures personnalisables**
  Au lieu du carré fixed `aspect-ratio: 1`, permettre de choisir la forme des miniatures dans la grille.

- [ ] **14. Historique des drops avec re-search**
  L'historique existe mais on ne peut pas rechercher dedans, ni filtrer par target.

- [ ] **15. Raccourcis clavier configurables**
  Les raccourcis existent (Ctrl+Alt+S, Ctrl+Alt+M) mais ne sont pas configurables par l'utilisateur.

- [ ] **16. Thèmes custom (import CSS)**
  Permettre à l'utilisateur de charger son propre fichier CSS pour personnaliser l'apparence.

---

## 🟢 Améliorations UI/UX

- [ ] **18. Confirmation avant suppression multiple**
  Ajouter une boîte de dialogue "Supprimer X memes ?" avant d'exécuter la suppression.

- [ ] **19. Indicateur visuel quand le dossier memes est introuvable**
  Si le dossier configuré n'existe pas ou est inaccessible, afficher un message clair plutôt qu'une grille vide.

- [ ] **20. Tooltip / preview au survol des cartes**
  Au survol d'une carte dans la grille, afficher un aperçu agrandi de l'image/vidéo.

- [ ] **21. Mode sombre / clair (thème déjà partiel mais basique)**
  Le thème existe déjà dans les settings mais n'affecte que l'overlay. Appliquer aussi au launcher.

- [ ] **22. Badge de notification (nombre de drops reçus)**
  Compter les drops reçus pendant que la fenêtre est minimisée, afficher un badge dans le titre ou la tray icon.

- [ ] **23. Liste des targets récentes avec autocomplete**
  Les targets existent déjà dans `recentTargets` mais ne sont pas utilisées dans le nouveau système de multi-select.

---

## 🔧 Technique / Performance

- [ ] **24. Migration quicklauncher → unified app**
  Le dossier `quicklauncher/` est un fork parallèle qui n'est plus maintenu. Supprimer ou merger dans `app/`.

- [ ] **25. Tests pour les nouveaux modules**
  - `favorites.test.js` — tests pour favs:toggle
  - `tags.test.js` — tests pour tags:set/get/add/remove
  - `audio.test.js` — tests pour audio:library et soundboard
  - Tests overlay (environnement jsdom ou headless)

- [ ] **26. CI/CD — GitHub Actions**
  Un workflow `.github/workflows/release.yml` existe mais n'a pas été testé. Automatiser le build et la release sur tag push.

- [ ] **27. Lazy loading des memes dans la grille**
  Pour les dossiers avec 1000+ memes, la grille charge tout d'un coup. Implémenter un virtual scroll ou une pagination.

- [ ] **28. Cache des previews côté renderer**
  `getPreview` convertit les chemins en `file:///` à chaque render. Pas de cache, ce qui peut ralentir sur les dossiers volumineux.

- [ ] **29. Auditer les dépendances**
  `npm audit` signale 6 high severity vulnerabilities. Les corriger (attention aux breaking changes).

- [ ] **30. Documenter l'architecture**
  README obsolète (parle de l'ancienne structure `overlay/`). Mettre à jour avec la nouvelle structure `app/`.

---

## 🚀 Idées nouvelles fonctionnalités

- [ ] **31. Meme studio — réactiver avec génération IA**
  Le studio a été masqué car non fonctionnel. Le réactiver avec une vraie génération via API (Replicate / OpenAI / Stable Diffusion).

- [ ] **32. Mode "Présentation" — envoyer un meme à TOUS les connectés d'un coup**
  Un bouton "Drop à tous" qui envoie le meme à tous les utilisateurs liés (existe déjà côté bot avec `@everyone`, mais pas dans l'UI).

- [ ] **33. Soundboard avec catégories et dossiers**
  Pouvoir organiser les sons par catégorie (memes, effets, musique) avec une arborescence.

- [ ] **34. Recettes / macros — enchaîner plusieurs actions**
  "Quand je reçois un drop de X, jouer son Y et afficher le meme Z".

- [ ] **35. Partage de soundboard entre utilisateurs**
  Pouvoir partager un son ou un preset de soundboard avec un autre utilisateur via le bot.

- [ ] **36. Mode "kiosk" — pour affichage public**
  Lancer l'overlay en mode kiosk (plein écran verrouillé) pour des événements avec affichage public des drops.

- [ ] **37. Statistiques d'utilisation**
  Compter : nombre de drops envoyés/reçus, memes les plus utilisés, temps d'écran, etc.

- [ ] **38. Réactions aux drops (émojis)**
  Permettre de réagir à un drop avec des émojis (👍😂🔥) qui s'affichent sur l'overlay du destinataire.

- [ ] **39. Intégration Twitch / YouTube Live**
  Permettre aux streameurs de recevoir des drops de leurs viewers directement depuis le live chat.

- [ ] **40. Application mobile companion**
  Une app mobile (React Native / Flutter) pour envoyer des drops depuis son téléphone.

---

## 📋 Légende

| Symbole | Signification |
|---|---|
| 🔴 Critique | Bug ou blocage |
| 🟡 Manquante | Feature qui devrait exister |
| 🟢 Amélioration | UX/UI polish |
| 🔧 Technique | Dette / perf / tests |
| 🚀 Nouvelle | Idée pour le futur |
