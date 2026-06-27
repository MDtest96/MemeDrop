import { describe, it, expect } from "vitest";

describe("shared memes tracking", () => {
  it("should track meme count per user", () => {
    const userMemes = new Map(); // username -> Set<memeName>

    function trackSync(username, memeName) {
      if (!userMemes.has(username)) userMemes.set(username, new Set());
      userMemes.get(username).add(memeName);
    }

    trackSync("alice", "cat.gif");
    trackSync("alice", "dog.png");
    trackSync("bob", "meme.gif");

    expect(userMemes.get("alice").size).toBe(2);
    expect(userMemes.get("bob").size).toBe(1);
  });

  it("should not count duplicates per user", () => {
    const userMemes = new Map();

    function trackSync(username, memeName) {
      if (!userMemes.has(username)) userMemes.set(username, new Set());
      userMemes.get(username).add(memeName);
    }

    trackSync("alice", "cat.gif");
    trackSync("alice", "cat.gif"); // duplicate

    expect(userMemes.get("alice").size).toBe(1);
  });

  it("should return formatted list", () => {
    const userMemes = new Map();
    userMemes.set("alice", new Set(["cat.gif", "dog.png"]));
    userMemes.set("bob", new Set(["meme.gif"]));

    const result = [];
    for (const [username, memes] of userMemes) {
      result.push({ username, count: memes.size, memes: Array.from(memes) });
    }

    expect(result).toHaveLength(2);
    expect(result[0].count).toBe(2);
    expect(result[1].count).toBe(1);
  });
});
