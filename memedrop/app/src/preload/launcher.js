const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("memedrop", {
  onConnection: (callback) => {
    const fn = (_e, state) => callback(state);
    ipcRenderer.on("connection-state", fn);
    return () => ipcRenderer.off("connection-state", fn);
  },
  onUsersList: (callback) => {
    const fn = (_e, msg) => callback(msg);
    ipcRenderer.on("users:list", fn);
    return () => ipcRenderer.off("users:list", fn);
  },
  listMemes: () => ipcRenderer.invoke("memes:list"),
  getPreview: (path, kind) => ipcRenderer.invoke("memes:preview", path, kind),
  listTargets: () => ipcRenderer.invoke("targets:list"),
  sortMemes: (sort) => ipcRenderer.invoke("memes:sort", sort),
  saveFromFile: (path) => ipcRenderer.invoke("memes:saveFile", path),
  saveFromBuffer: (data) => ipcRenderer.invoke("memes:saveBuffer", data),
  saveFromClipboard: () => ipcRenderer.invoke("memes:saveClipboard"),
  getUsers: () => ipcRenderer.invoke("discord:users"),
  sendDrop: (payload) => ipcRenderer.invoke("drop:send", payload),
  sendDropUrl: (payload) => ipcRenderer.invoke("drop:sendUrl", payload),
  getTags: (path) => ipcRenderer.invoke("tags:get", path),
  listAllTags: () => ipcRenderer.invoke("tags:listAll"),
  setTags: (path, tags) => ipcRenderer.invoke("tags:set", path, tags),
  addTag: (memeId, tag) => ipcRenderer.invoke("tags:add", memeId, tag),
  removeTag: (memeId, tag) => ipcRenderer.invoke("tags:remove", memeId, tag),
  getFavorites: () => ipcRenderer.invoke("favs:get"),
  toggleFavorite: (memeId, memeData) => ipcRenderer.invoke('favs:toggle', memeId, memeData),
  getAudioLibrary: () => ipcRenderer.invoke("audio:library"),
  scanAudio: () => ipcRenderer.invoke("audio:library"),
  getSoundboard: () => ipcRenderer.invoke("audio:soundboard"),
  addSoundboard: (memeId, audioId) =>
    ipcRenderer.invoke("audio:addSoundboard", memeId, audioId),
  removeSoundboard: (path) => ipcRenderer.invoke("audio:removeSoundboard", path),
  setAudioPairing: (meme, audio) =>
    ipcRenderer.invoke("audio:setPairing", meme, audio),
  getAudioPairings: () => ipcRenderer.invoke("audio:getPairings"),
  getHistory: () => ipcRenderer.invoke("history:get"),
  addHistory: (entry) => ipcRenderer.invoke("history:add", entry),
  getStreak: () => ipcRenderer.invoke("streak:get"),
  incrementStreak: () => ipcRenderer.invoke("streak:increment"),
  getGroups: () => ipcRenderer.invoke("groups:get"),
  groupList: () => ipcRenderer.invoke("groups:get"),
  groupSave: (name, members) =>
    ipcRenderer.invoke("groups:save", name, members),
  saveGroup: (group) => ipcRenderer.invoke("groups:save", group),
  dropGroup: (groupId, target) =>
    ipcRenderer.invoke("groups:drop", groupId, target),
  getScheduled: () => ipcRenderer.invoke("schedule:get"),
  scheduleList: () => ipcRenderer.invoke("schedule:get"),
  scheduleCancel: (id) => ipcRenderer.invoke("schedule:cancel", id),
  getTemplates: () => ipcRenderer.invoke("studio:templates"),
  generateMeme: (data) => ipcRenderer.invoke("studio:generate", data),
  captureScreenshot: () => ipcRenderer.invoke("tools:screenshot"),
  previewDrop: (data) => ipcRenderer.invoke("drop:preview", data),
  addTarget: (target) => ipcRenderer.invoke("targets:add", target),
  setLastDrop: (data) => ipcRenderer.invoke("history:setLast", data),
  getLastDrop: () => ipcRenderer.invoke("history:getLast"),
  copyCommand: (data) => ipcRenderer.invoke("tools:copyCommand", data),
  searchGiphy: (query) => ipcRenderer.invoke("giphy:search", query),
  trendingGiphy: () => ipcRenderer.invoke("giphy:trending"),
  downloadGiphy: (url) => ipcRenderer.invoke("giphy:download", url),
  saveGroup: (group) => ipcRenderer.invoke("groups:save", group),
  dropGroup: (groupId, target) =>
    ipcRenderer.invoke("groups:drop", groupId, target),
  getScheduled: () => ipcRenderer.invoke("schedule:get"),
  getTemplates: () => ipcRenderer.invoke("studio:templates"),
  generateMeme: (opts) => ipcRenderer.invoke("studio:generate", opts),
  searchGiphy: (q) => ipcRenderer.invoke("giphy:search", q),
  trendingGiphy: () => ipcRenderer.invoke("giphy:trending"),
  openMemeFolder: () => ipcRenderer.invoke("memes:openFolder"),
  onShortcut: (callback) => {
    const fn = (_e, shortcut) => callback(shortcut);
    ipcRenderer.on("shortcut:trigger", fn);
    return () => ipcRenderer.off("shortcut:trigger", fn);
  },
  onLibraryChanged: (callback) => {
    const fn = () => callback();
    ipcRenderer.on("library:changed", fn);
    return () => ipcRenderer.off("library:changed", fn);
  },
  onAudioPlay: (callback) => {
    const fn = (_e, filePath) => callback(filePath);
    ipcRenderer.on("audio:play", fn);
    return () => ipcRenderer.off("audio:play", fn);
  },
  buildCollage: (filePaths) => ipcRenderer.invoke('collage:build', filePaths),
  resolveUrl: (url) => ipcRenderer.invoke('url:resolve', url),
  deleteMemes: (paths) => ipcRenderer.invoke('memes:delete', paths),
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  playSound: (filePath) => ipcRenderer.invoke('audio:playSound', filePath),
  downloadUrl: (url) => ipcRenderer.invoke('memes:downloadUrl', url),

  // Settings & Updater
  getVersion: () => ipcRenderer.invoke("app:get-version"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  updateSettings: (patch) => ipcRenderer.invoke("settings:set", patch),
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  downloadUpdate: () => ipcRenderer.invoke("update:download"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
  listDisplays: () => ipcRenderer.invoke("displays:list"),
  onUpdateState: (callback) => {
    const fn = (_e, state) => callback(state);
    ipcRenderer.on("update-state", fn);
    return () => ipcRenderer.off("update-state", fn);
  },
});
