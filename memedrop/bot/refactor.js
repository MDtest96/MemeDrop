const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'index.js');
let code = fs.readFileSync(file, 'utf8');

// Replace Map initialization
code = code.replace(
  'const userLinks = new Map();',
  'const userLinks = new Map(); // userId -> { sockets: Set<ws>, scope, guildIds, blockedUsers }'
);

// pushLinksUpdate
code = code.replace(
  `  sendJson(link.ws, {
    type: "links_snapshot",
    links: await buildLinksSnapshot(userId),
  });`,
  `  for (const ws of link.sockets) {
    if (ws.readyState === 1) sendJson(ws, { type: "links_snapshot", links: await buildLinksSnapshot(userId) });
  }`
);

// Register logic: instead of kicking, add to Set
code = code.replace(
  `      // Kick any other live overlay currently bound to this user
      const existing = userLinks.get(userId);
      if (existing && existing.ws !== ws) {
        sendJson(existing.ws, { type: "unlinked", reason: "replaced" });
      }
      userLinks.set(userId, { ws, scope, guildIds, blockedUsers });`,
  `      const existing = userLinks.get(userId);
      if (existing) {
        existing.sockets.add(ws);
        existing.scope = scope;
        existing.guildIds = guildIds;
        existing.blockedUsers = blockedUsers;
      } else {
        userLinks.set(userId, { sockets: new Set([ws]), scope, guildIds, blockedUsers });
      }`
);

// WS disconnect logic
code = code.replace(
  `      const link = userLinks.get(meta.userId);
      if (link && link.ws === ws) userLinks.delete(meta.userId);`,
  `      const link = userLinks.get(meta.userId);
      if (link) {
        link.sockets.delete(ws);
        if (link.sockets.size === 0) userLinks.delete(meta.userId);
      }`
);

// /link existing overlay logic
code = code.replace(
  `          // If the user had a previous overlay linked, kick it cleanly
          if (existing && existing.ws !== ws) {
            sendJson(existing.ws, { type: "unlinked", reason: "replaced" });
            userLinks.delete(interaction.user.id);
            reissuePairingCode(existing.ws);
          }`,
  `          // We now support multiple connections, so we just add to the existing Set later
          // No need to kick existing overlays anymore.`
);

code = code.replace(
  `          const link = {
            ws,
            scope: targetGuildId ? "guild" : "global",
            guildIds: new Set(targetGuildId ? [targetGuildId] : []),
            blockedUsers,
          };
          userLinks.set(interaction.user.id, link);`,
  `          const scope = targetGuildId ? "guild" : "global";
          const guildIds = new Set(targetGuildId ? [targetGuildId] : []);
          if (existing) {
            existing.sockets.add(ws);
            existing.scope = scope;
            existing.guildIds = guildIds;
            existing.blockedUsers = blockedUsers;
          } else {
            userLinks.set(interaction.user.id, { sockets: new Set([ws]), scope, guildIds, blockedUsers });
          }`
);

// isConnected check
code = code.replace(/link\.ws\.readyState !== link\.ws\.OPEN/g, '!Array.from(link.sockets).some(s => s.readyState === 1)');
code = code.replace(/link\.ws\.readyState === WebSocket\.OPEN/g, 'Array.from(link.sockets).some(s => s.readyState === 1)');
code = code.replace(/!targetLink \|\| targetLink\.ws\.readyState !== targetLink\.ws\.OPEN/g, '!targetLink || !Array.from(targetLink.sockets).some(s => s.readyState === 1)');

// sending payload (everyone)
code = code.replace(
  `        for (const [uid, uLink] of userLinks) {
          if (uid !== meta.userId && uLink.ws.readyState === WebSocket.OPEN) {
            sendJson(uLink.ws, payload);
            sentCount++;
          }
        }`,
  `        for (const [uid, uLink] of userLinks) {
          if (uid !== meta.userId) {
            for (const sock of uLink.sockets) {
              if (sock.readyState === 1) {
                sendJson(sock, payload);
                sentCount++;
              }
            }
          }
        }`
);

// sending payload (slash drop)
code = code.replace(
  `      sendJson(userLinks.get(t.id).ws, payload);`,
  `      for (const sock of userLinks.get(t.id).sockets) {
        if (sock.readyState === 1) sendJson(sock, payload);
      }`
);

// sending payload (specific user)
code = code.replace(
  `      sendJson(targetLink.ws, payload);`,
  `      for (const sock of targetLink.sockets) {
        if (sock.readyState === 1) sendJson(sock, payload);
      }`
);

// /unlink
code = code.replace(
  `        const { ws } = link;
        userLinks.delete(interaction.user.id);
        sendJson(ws, { type: "unlinked", reason: "user" });
        reissuePairingCode(ws);`,
  `        const sockets = Array.from(link.sockets);
        userLinks.delete(interaction.user.id);
        for (const sock of sockets) {
          sendJson(sock, { type: "unlinked", reason: "user" });
          reissuePairingCode(sock);
        }`
);

fs.writeFileSync(file, code);
console.log("Refactored index.js!");
