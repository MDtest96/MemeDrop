const { ipcMain } = require("electron");

const MAX_HISTORY = 20;

function setupHistory(store, callbacks) {
  function recordHistory(payload) {
    const entry = {
      from: payload.from?.username || "inconnu",
      kind: payload.media?.kind || (payload.rain ? "rain" : "unknown"),
      caption: payload.caption || null,
      ts: payload.ts || Date.now(),
    };
    const history = [entry, ...store.get("dropHistory")].slice(0, MAX_HISTORY);
    store.set("dropHistory", history);
    
    if (callbacks && callbacks.onHistoryUpdate) {
      callbacks.onHistoryUpdate(history);
    }
  }

  ipcMain.handle("history:get", () => store.get("dropHistory"));
  ipcMain.handle("history:clear", () => {
    store.set("dropHistory", []);
    if (callbacks && callbacks.onHistoryUpdate) {
      callbacks.onHistoryUpdate([]);
    }
    return true;
  });

  ipcMain.handle("history:add", () => {});
  ipcMain.handle("history:setLast", () => {});
  ipcMain.handle("history:getLast", () => null);

  ipcMain.handle("targets:list", () => store.get("recentTargets") || ["@fatima6848", "@evanlegends", "@elwen91"]);
  ipcMain.handle("targets:add", (_e, target) => {
    let list = store.get("recentTargets") || ["@fatima6848", "@evanlegends", "@elwen91"];
    list = list.filter((t) => t !== target);
    list.unshift(target);
    if (list.length > 20) list = list.slice(0, 20);
    store.set("recentTargets", list);
  });

  return { recordHistory };
}

module.exports = { setupHistory };
