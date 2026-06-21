const test = require('node:test');
const assert = require('node:assert');

// Simulate the bot's global Map
const userLinks = new Map();

// Helper functions to test
function addConnection(userId, linkData) {
  if (!userLinks.has(userId)) {
    userLinks.set(userId, []);
  }
  userLinks.get(userId).push(linkData);
}

function removeConnection(userId, ws) {
  const links = userLinks.get(userId);
  if (!links) return;
  const index = links.findIndex(l => l.ws === ws);
  if (index !== -1) {
    links.splice(index, 1);
  }
  if (links.length === 0) {
    userLinks.delete(userId);
  }
}

function getConnections(userId) {
  return userLinks.get(userId) || [];
}

test('userLinksManager: add and retrieve multiple connections', () => {
  userLinks.clear();
  const ws1 = { id: 1 };
  const ws2 = { id: 2 };
  
  addConnection('user1', { ws: ws1 });
  addConnection('user1', { ws: ws2 });
  
  const conns = getConnections('user1');
  assert.strictEqual(conns.length, 2);
  assert.strictEqual(conns[0].ws, ws1);
  assert.strictEqual(conns[1].ws, ws2);
});

test('userLinksManager: remove a connection keeps the user if other connections exist', () => {
  userLinks.clear();
  const ws1 = { id: 1 };
  const ws2 = { id: 2 };
  
  addConnection('user1', { ws: ws1 });
  addConnection('user1', { ws: ws2 });
  
  removeConnection('user1', ws1);
  
  const conns = getConnections('user1');
  assert.strictEqual(conns.length, 1);
  assert.strictEqual(conns[0].ws, ws2);
  assert.ok(userLinks.has('user1'));
});

test('userLinksManager: remove last connection deletes the user', () => {
  userLinks.clear();
  const ws1 = { id: 1 };
  
  addConnection('user1', { ws: ws1 });
  removeConnection('user1', ws1);
  
  const conns = getConnections('user1');
  assert.strictEqual(conns.length, 0);
  assert.strictEqual(userLinks.has('user1'), false);
});
