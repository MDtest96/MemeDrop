const { ipcMain } = require("electron");

function setupTags(store) {
  ipcMain.handle("tags:get", (_e, memePath) => {
    const all = store.get("tags") || {};
    return all[memePath] || [];
  });

  ipcMain.handle("tags:set", (_e, memePath, tags) => {
    const all = store.get("tags") || {};
    all[memePath] = tags;
    store.set("tags", all);
  });

  ipcMain.handle("tags:add", (_e, memePath, tag) => {
    const all = store.get("tags") || {};
    if (!all[memePath]) all[memePath] = [];
    if (!all[memePath].includes(tag)) all[memePath].push(tag);
    store.set("tags", all);
  });

  ipcMain.handle("tags:remove", (_e, memePath, tag) => {
    const all = store.get("tags") || {};
    if (all[memePath]) {
      all[memePath] = all[memePath].filter((t) => t !== tag);
      store.set("tags", all);
    }
  });

  ipcMain.handle("tags:listAll", () => {
    const all = store.get("tags") || {};
    return [...new Set(Object.values(all).flat())];
  });
}

module.exports = { setupTags };
