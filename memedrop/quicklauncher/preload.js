const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('memedrop', {
  onConnection: (callback) => {
    const fn = (_e, state) => callback(state);
    ipcRenderer.on("bot:status", fn);
    return () => ipcRenderer.off("bot:status", fn);
  },
  listMemes: () => ipcRenderer.invoke('memes:list'),
  sortMemes: (sort) => ipcRenderer.invoke('memes:sort', sort),
  saveFromFile: (path) => ipcRenderer.invoke('memes:saveFile', path),
  saveFromClipboard: () => ipcRenderer.invoke('memes:saveClipboard'),
  getUsers: () => ipcRenderer.invoke('discord:users'),
  sendDrop: (payload) => ipcRenderer.invoke('drop:send', payload),
  sendDropUrl: (payload) => ipcRenderer.invoke('drop:sendUrl', payload),
  getTags: () => ipcRenderer.invoke('tags:get'),
  addTag: (memeId, tag) => ipcRenderer.invoke('tags:add', memeId, tag),
  removeTag: (memeId, tag) => ipcRenderer.invoke('tags:remove', memeId, tag),
  getFavorites: () => ipcRenderer.invoke('favs:get'),
  toggleFavorite: (memeId) => ipcRenderer.invoke('favs:toggle', memeId),
  getAudioLibrary: () => ipcRenderer.invoke('audio:library'),
  getSoundboard: () => ipcRenderer.invoke('audio:soundboard'),
  addSoundboard: (memeId, audioId) => ipcRenderer.invoke('audio:addSoundboard', memeId, audioId),
  getHistory: () => ipcRenderer.invoke('history:get'),
  getStreak: () => ipcRenderer.invoke('streak:get'),
  getGroups: () => ipcRenderer.invoke('groups:get'),
  saveGroup: (group) => ipcRenderer.invoke('groups:save', group),
  dropGroup: (groupId, target) => ipcRenderer.invoke('groups:drop', groupId, target),
  getScheduled: () => ipcRenderer.invoke('schedule:get'),
  getTemplates: () => ipcRenderer.invoke('studio:templates'),
  generateMeme: (opts) => ipcRenderer.invoke('studio:generate', opts),
  searchGiphy: (q) => ipcRenderer.invoke('giphy:search', q),
  trendingGiphy: () => ipcRenderer.invoke('giphy:trending'),
});
