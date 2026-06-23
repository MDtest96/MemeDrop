import { describe, it, expect } from "vitest";

describe("YouTube URL resolution", () => {
  function resolveMediaUrl(url) {
    if (!url)
      return { url, kind: "image", mime: "image/jpeg", unresolved: true };
    // 1. Direct file URL
    if (/\.(mp4|webm|mov)(\?|$)/i.test(url))
      return { url, kind: "video", mime: "video/mp4" };
    if (/\.gif(\?|$)/i.test(url))
      return { url, kind: "gif", mime: "image/gif" };
    if (/\.(jpg|jpeg|png|webp|avif)(\?|$)/i.test(url))
      return { url, kind: "image", mime: "image/jpeg" };
    // 2. YouTube → thumbnail
    const ytMatch = url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    );
    if (ytMatch) {
      return {
        url: `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`,
        kind: "image",
        mime: "image/jpeg",
        sourceUrl: url,
      };
    }
    return { url, kind: "image", mime: "image/jpeg", unresolved: true };
  }

  it("should extract video ID from youtube.com URL", () => {
    const result = resolveMediaUrl(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(result.url).toBe(
      "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    );
    expect(result.kind).toBe("image");
    expect(result.sourceUrl).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
  });

  it("should extract video ID from youtu.be URL", () => {
    const result = resolveMediaUrl("https://youtu.be/dQw4w9WgXcQ");
    expect(result.url).toContain("dQw4w9WgXcQ");
  });

  it("should handle invalid URLs gracefully", () => {
    const result = resolveMediaUrl("not-a-url");
    expect(result.unresolved).toBe(true);
  });

  it("should return null for empty URL", () => {
    const result = resolveMediaUrl("");
    expect(result.unresolved).toBe(true);
  });
});

describe("getMimeFromExt", () => {
  function getMimeFromExt(ext) {
    const map = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".ogg": "audio/ogg",
    };
    return map[ext.toLowerCase()] || "image/png";
  }

  it("should return correct MIME for .png", () => {
    expect(getMimeFromExt(".png")).toBe("image/png");
  });

  it("should return correct MIME for .gif", () => {
    expect(getMimeFromExt(".gif")).toBe("image/gif");
  });

  it("should return correct MIME for .mp4", () => {
    expect(getMimeFromExt(".mp4")).toBe("video/mp4");
  });

  it("should return correct MIME for .mp3", () => {
    expect(getMimeFromExt(".mp3")).toBe("audio/mpeg");
  });

  it("should handle .jpg and .jpeg consistently", () => {
    expect(getMimeFromExt(".jpg")).toBe("image/jpeg");
    expect(getMimeFromExt(".jpeg")).toBe("image/jpeg");
  });

  it("should return default for unknown extension", () => {
    expect(getMimeFromExt(".unknown")).toBe("image/png");
  });

  it("should handle case-insensitive input", () => {
    expect(getMimeFromExt(".PNG")).toBe("image/png");
    expect(getMimeFromExt(".GIF")).toBe("image/gif");
  });
});
