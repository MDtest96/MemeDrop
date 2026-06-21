let updateState = {
  status: "idle",
  version: null,
  error: null,
  progress: null,
};

function setupUpdater(callbacks, mockDeps = null) {
  const { ipcMain, app } = mockDeps ? mockDeps.electron : require("electron");
  const autoUpdater = mockDeps ? mockDeps.autoUpdater : require("electron-updater").autoUpdater;

  function broadcastUpdate() {
    if (callbacks && callbacks.onStateChange) {
      callbacks.onStateChange(updateState);
    }
  }

  function setUpdateState(patch) {
    updateState = { ...updateState, ...patch };
    broadcastUpdate();
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = console;

  autoUpdater.on("checking-for-update", () => {
    setUpdateState({ status: "checking", error: null });
  });

  autoUpdater.on("update-available", (info) => {
    console.log("[updater] update available:", info.version);
    setUpdateState({ status: "available", version: info.version, error: null });
  });

  autoUpdater.on("update-not-available", () => {
    setUpdateState({ status: "up-to-date", error: null });
  });

  autoUpdater.on("error", (err) => {
    console.error("[updater] error:", err);
    setUpdateState({ status: "error", error: err?.message || String(err) });
  });

  autoUpdater.on("download-progress", (p) => {
    setUpdateState({ status: "downloading", progress: Math.round(p.percent) });
  });

  autoUpdater.on("update-downloaded", (info) => {
    console.log("[updater] downloaded:", info.version);
    setUpdateState({ status: "downloaded", version: info.version });
  });

  function checkForUpdates(manual = false) {
    if (!app.isPackaged) {
      if (manual) {
        setUpdateState({ status: "dev-mode", error: null });
      }
      return;
    }
    try {
      autoUpdater.checkForUpdates().catch((err) => {
        setUpdateState({ status: "error", error: err?.message || String(err) });
      });
    } catch (err) {
      setUpdateState({ status: "error", error: err?.message || String(err) });
    }
  }

  ipcMain.handle("app:get-version", () => app.getVersion());
  ipcMain.handle("update:get-state", () => updateState);
  ipcMain.handle("update:check", () => {
    checkForUpdates(true);
    return true;
  });
  ipcMain.handle("update:download", () => {
    if (updateState.status === "available") {
      autoUpdater
        .downloadUpdate()
        .catch((err) =>
          setUpdateState({ status: "error", error: err?.message || String(err) })
        );
    }
    return true;
  });
  ipcMain.handle("update:install", () => {
    if (updateState.status === "downloaded") {
      autoUpdater.quitAndInstall(true, true);
    }
    return true;
  });

  return {
    checkForUpdates
  };
}

module.exports = { setupUpdater, getUpdateState: () => updateState };
