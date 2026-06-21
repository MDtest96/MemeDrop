const { ipcMain } = require("electron");

function setupFavorites(store) {
  ipcMain.handle("favs:get", () => store.get("favorites") || []);

  ipcMain.handle("favs:toggle", (_e, memePath, memeData) => {
    let favs = store.get("favorites") || [];
    const idx = favs.findIndex((f) => f.path === memePath);
    if (idx >= 0) {
      favs.splice(idx, 1);
    } else {
      favs.push({
        path: memePath,
        name: memeData?.name,
        kind: memeData?.kind,
        ts: Date.now(),
      });
    }
    store.set("favorites", favs);
    return favs;
  });
}

module.exports = { setupFavorites };
