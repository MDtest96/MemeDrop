const Store = require("electron-store");

const DEFAULT_SERVER =
  process.env.DEFAULT_SERVER || "wss://memedrop-bot-production.up.railway.app";

const store = new Store({
  defaults: {
    serverUrl: DEFAULT_SERVER,
    volume: 0.75,
    musicVolume: 0.75,
    opacity: 1.0,
    duration: 4,
    videoDuration: 30,
    soundOnArrival: true,
    spotlightOnDrop: true,
    autostart: true,
    muteUntil: null,
    linkIdentity: null,
    guilds: {},
    recentTargets: ["@fatima6848", "@evanlegends", "@elwen91"],
    dropHistory: [],
    streak: null,
    groups: [],
    scheduled: [],
    customTags: {},
    favorites: [],
    giphyApiKey: "A7Su0Alx0oH5dgrDaOicRiEBYqeZGWdX",
    audioPairings: {},
    paused: false,
    overlayDisplayId: null,
    theme: "classic",
    memeFolderPath: null,
    favorites: [],
    tags: {},
    groups: [],
    hiddenMemes: [],
    hiddenMemeNames: [],
    triageState: {
      typeFilters: [],
      tag: null,
      favFilter: "all",
      sort: "name",
      query: "",
      dateFilter: "all",
    },
    hardwareAcceleration: false,
    launcherTheme: "classic",
    thumbnailShape: "square",
    customCSS: null,
    slideshowInterval: 5,
    theme: "classic",
    launcherTheme: "classic",
  },
});

module.exports = store;
