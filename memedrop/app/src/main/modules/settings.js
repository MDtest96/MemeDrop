function setupSettings(store, callbacks, mockElectron = null) {
  const { ipcMain, app, screen } = mockElectron || require("electron");
  ipcMain.handle("settings:get", () => {
    return {
      serverUrl: store.get("serverUrl"),
      volume: store.get("volume"),
      musicVolume: store.get("musicVolume"),
      opacity: store.get("opacity"),
      duration: store.get("duration"),
      videoDuration: store.get("videoDuration"),
      soundOnArrival: store.get("soundOnArrival"),
      spotlightOnDrop: store.get("spotlightOnDrop"),
      autostart: store.get("autostart"),
      overlayDisplayId: store.get("overlayDisplayId"),
      paused: store.get("paused"),
      muteUntil: store.get("muteUntil"),
      theme: store.get("theme"),
      linkIdentity: store.get("linkIdentity"),
      guilds: store.get("guilds"),
      giphyApiKey: store.get("giphyApiKey"),
    };
  });

  ipcMain.handle("settings:set", (_e, patch) => {
    for (const [k, v] of Object.entries(patch)) store.set(k, v);
    
    if ("autostart" in patch) {
      app.setLoginItemSettings({
        openAtLogin: !!patch.autostart,
        openAsHidden: true,
        args: ["--hidden"],
      });
    }

    if (callbacks) {
      if ("serverUrl" in patch) {
        if (callbacks.onServerChanged) callbacks.onServerChanged();
      }
      
      if ("paused" in patch) {
        if (callbacks.onPausedChanged) callbacks.onPausedChanged(patch.paused);
      }
      
      if ("overlayDisplayId" in patch) {
        if (callbacks.onDisplayChanged) callbacks.onDisplayChanged();
      }
      
      if ("volume" in patch ||
          "musicVolume" in patch ||
          "opacity" in patch ||
          "duration" in patch ||
          "videoDuration" in patch ||
          "spotlightOnDrop" in patch ||
          "theme" in patch) {
        const livePatch = {};
        if ("volume" in patch) livePatch.volume = patch.volume;
        if ("musicVolume" in patch) livePatch.musicVolume = patch.musicVolume;
        if ("opacity" in patch) livePatch.opacity = patch.opacity;
        if ("duration" in patch) livePatch.duration = patch.duration;
        if ("videoDuration" in patch) livePatch.videoDuration = patch.videoDuration;
        if ("spotlightOnDrop" in patch) livePatch.spotlightOnDrop = patch.spotlightOnDrop;
        if ("theme" in patch) livePatch.theme = patch.theme;
        
        if (callbacks.onLivePatch) callbacks.onLivePatch(livePatch);
      }
    }
  });

  ipcMain.handle("displays:list", () => {
    return screen.getAllDisplays().map((d) => ({
      id: d.id,
      label: d.label || `Display ${d.id}`,
      bounds: d.bounds,
      primary: d.id === screen.getPrimaryDisplay().id,
    }));
  });
}

module.exports = { setupSettings };
