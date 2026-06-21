const test = require('node:test');
const assert = require('node:assert');
const { getConnectedUsersList } = require('../index.js'); // Assuming we export it

test('getConnectedUsersList should return a count and list of unique usernames', () => {
  // Mock WSS clients
  const mockClients = new Set([
    { user: { id: '1', username: 'user1' }, readyState: 1 }, // OPEN
    { user: { id: '2', username: 'user2' }, readyState: 1 }, // OPEN
    { user: { id: '1', username: 'user1' }, readyState: 1 }, // OPEN (duplicate connection from same user)
    { user: null, readyState: 1 }, // Anonymous or not yet linked
    { user: { id: '3', username: 'user3' }, readyState: 2 }, // CLOSING, should be ignored
  ]);

  const mockWss = { clients: mockClients, OPEN: 1 };

  const result = getConnectedUsersList(mockWss);

  assert.strictEqual(result.count, 2); // user1 and user2
  assert.deepStrictEqual(result.users, [
    { id: '1', username: 'user1' },
    { id: '2', username: 'user2' }
  ]);
});
