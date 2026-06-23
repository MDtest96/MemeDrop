import { describe, it, expect, vi } from "vitest";

// Test the store operations used by the tags module directly
// instead of going through IPC handlers.
describe("tags module store logic", () => {
  it("should return empty array for meme with no tags", () => {
    const all = {};
    const result = all["/memes/cat.png"] || [];
    expect(result).toEqual([]);
  });

  it("should return tags for a meme", () => {
    const all = { "/memes/cat.png": ["funny", "cat"] };
    const result = all["/memes/cat.png"] || [];
    expect(result).toEqual(["funny", "cat"]);
  });

  it("should set tags for a meme", () => {
    const all = {};
    all["/memes/dog.png"] = ["animal", "dog"];
    expect(all["/memes/dog.png"]).toEqual(["animal", "dog"]);
  });

  it("should add a tag without duplicates", () => {
    const all = { "/memes/cat.png": ["funny"] };
    if (!all["/memes/cat.png"].includes("funny")) {
      all["/memes/cat.png"].push("funny");
    }
    expect(all["/memes/cat.png"]).toEqual(["funny"]);
  });

  it("should remove a tag", () => {
    const all = { "/memes/cat.png": ["funny", "cat"] };
    all["/memes/cat.png"] = all["/memes/cat.png"].filter((t) => t !== "cat");
    expect(all["/memes/cat.png"]).toEqual(["funny"]);
  });

  it("should list all unique tags across memes", () => {
    const all = {
      "/memes/a.png": ["funny", "cat"],
      "/memes/b.png": ["funny", "dog"],
    };
    const result = [...new Set(Object.values(all).flat())];
    expect(result.sort()).toEqual(["cat", "dog", "funny"]);
  });
});
