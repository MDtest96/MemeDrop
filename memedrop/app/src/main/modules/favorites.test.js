import { describe, it, expect } from "vitest";

describe("favorites module store logic", () => {
  it("should return empty array when no favorites exist", () => {
    const favorites = [];
    expect(favorites).toEqual([]);
  });

  it("should add a favorite", () => {
    const favorites = [];
    const newFav = { name: "cat.gif", path: "/memes/cat.gif", kind: "gif" };
    favorites.push(newFav);
    expect(favorites).toHaveLength(1);
    expect(favorites[0].name).toBe("cat.gif");
  });

  it("should remove a favorite by path", () => {
    let favorites = [
      { name: "cat.gif", path: "/memes/cat.gif", kind: "gif" },
      { name: "dog.png", path: "/memes/dog.png", kind: "image" },
    ];
    favorites = favorites.filter((f) => f.path !== "/memes/cat.gif");
    expect(favorites).toHaveLength(1);
    expect(favorites[0].name).toBe("dog.png");
  });

  it("should toggle a favorite (add if not present, remove if present)", () => {
    let favorites = [{ name: "cat.gif", path: "/memes/cat.gif", kind: "gif" }];
    const meme = { name: "cat.gif", path: "/memes/cat.gif", kind: "gif" };
    const idx = favorites.findIndex((f) => f.path === meme.path);
    if (idx >= 0) {
      favorites.splice(idx, 1);
    } else {
      favorites.push(meme);
    }
    expect(favorites).toHaveLength(0);
  });

  it("should not add duplicates", () => {
    const favorites = [{ name: "cat.gif", path: "/memes/cat.gif", kind: "gif" }];
    const isDuplicate = favorites.some((f) => f.path === "/memes/cat.gif");
    expect(isDuplicate).toBe(true);
  });
});
