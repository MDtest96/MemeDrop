const test = require('node:test');
const assert = require('node:assert');
const { resolveTargetUserId } = require('./targetResolver');

test('resolveTargetUserId should resolve exact ID', async () => {
  const userLinks = new Map([
    ['123456789', { ws: {} }]
  ]);
  const fetchMock = async (id) => null;
  
  const result = await resolveTargetUserId('123456789', userLinks, fetchMock);
  assert.strictEqual(result.targetUserId, '123456789');
});

test('resolveTargetUserId should resolve username by fetching connected users', async () => {
  const userLinks = new Map([
    ['11111', { ws: {} }],
    ['22222', { ws: {} }] // evanlegends' ID
  ]);
  
  const fetchMock = async (id) => {
    if (id === '11111') return { id: '11111', username: 'otheruser' };
    if (id === '22222') return { id: '22222', username: 'evanlegends' };
    return null;
  };
  
  const result = await resolveTargetUserId('evanlegends', userLinks, fetchMock);
  assert.strictEqual(result.targetUserId, '22222');
  assert.strictEqual(result.targetUsername, 'evanlegends');
});

test('resolveTargetUserId should fail gracefully if user not found', async () => {
  const userLinks = new Map([
    ['11111', { ws: {} }]
  ]);
  
  const fetchMock = async (id) => {
    if (id === '11111') return { id: '11111', username: 'otheruser' };
    return null;
  };
  
  const result = await resolveTargetUserId('unknownuser', userLinks, fetchMock);
  assert.strictEqual(result.targetUserId, 'unknownuser'); // Unchanged
});
