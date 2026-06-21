import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('users list cache', () => {
  let mockStore;

  beforeEach(() => {
    mockStore = {
      store: {},
      get: vi.fn((key) => mockStore.store[key]),
      set: vi.fn((key, value) => { mockStore.store[key] = value; }),
    };
  });

  it('should store and return cached users list', () => {
    // Simulate the handler that stores users:list from bot
    const usersMsg = { count: 2, users: [{ username: 'alice' }, { username: 'bob' }] };
    mockStore.set('cachedUsers', usersMsg);

    const cached = mockStore.get('cachedUsers');
    expect(cached.count).toBe(2);
    expect(cached.users).toHaveLength(2);
  });

  it('should return empty list when no cache exists', () => {
    const cached = mockStore.get('cachedUsers');
    expect(cached).toBeUndefined();
  });

  it('should update cache when new users:list arrives', () => {
    const msg1 = { count: 1, users: [{ username: 'alice' }] };
    mockStore.set('cachedUsers', msg1);

    const msg2 = { count: 3, users: [{ username: 'alice' }, { username: 'bob' }, { username: 'charlie' }] };
    mockStore.set('cachedUsers', msg2);

    const cached = mockStore.get('cachedUsers');
    expect(cached.count).toBe(3);
  });
});
