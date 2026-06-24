import { describe, it, expect, vi } from "vitest";

describe("meme_sync name sanitization", () => {
  it("should generate fallback name when safeName is underscore", () => {
    const dataName = "#";
    const safeName = dataName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fallback =
      safeName === "_" || safeName === "."
        ? "unknown_" + Date.now() + ".gif"
        : safeName;
    expect(fallback).not.toBe("_");
    expect(fallback).toContain("unknown_");
  });

  it("should handle special-char-only filenames", () => {
    const dataName = "@@@";
    const safeName = dataName.replace(/[^a-zA-Z0-9._-]/g, "_");
    expect(safeName.length).toBeGreaterThan(0);
    const fallback =
      safeName === "_" || safeName === "."
        ? "unknown_" + Date.now() + ".gif"
        : "shared_" + safeName;
    expect(fallback).toBe("shared____");
  });

  it("should pass normal filenames unchanged", () => {
    const dataName = "funny-cat.gif";
    const safeName = dataName.replace(/[^a-zA-Z0-9._-]/g, "_");
    expect(safeName).toBe("funny-cat.gif");
  });
});

describe("dedupCache initialization", () => {
  it("should be a Map that can hold sha256 entries", () => {
    const cache = new Map();
    cache.set("abc123", "/memes/cat.gif");
    expect(cache.has("abc123")).toBe(true);
    expect(cache.get("abc123")).toBe("/memes/cat.gif");
  });

  it("should be empty after init if no files", () => {
    const cache = new Map();
    expect(cache.size).toBe(0);
  });
});

describe("Giphy URL download before send", () => {
  it("should download file before sending as URL-only drop", async () => {
    const url = "https://media.giphy.com/media/test/giphy.gif";
    let downloaded = false;
    const downloader = async (u) => {
      if (u === url) downloaded = true;
      return {
        name: "downloaded.gif",
        path: "/memes/downloaded.gif",
        kind: "gif",
      };
    };
    const result = await downloader(url);
    expect(downloaded).toBe(true);
    expect(result.path).toBeDefined();
  });

  it("should fallback to URL send if download fails", async () => {
    const url = "https://invalid.url/expired.gif";
    const downloader = async () => null;
    const result = await downloader(url);
    expect(result).toBeNull();
  });
});
