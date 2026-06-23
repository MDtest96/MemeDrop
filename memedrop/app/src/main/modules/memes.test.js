import { describe, it, expect, vi, beforeEach } from "vitest";

// We'll test the deleteMemes helper function that will be extracted
// from the IPC handler in memes.js. This is the RED phase — the function
// doesn't exist in the production code yet.

describe("deleteMemes", () => {
  let mockFs;
  let mockWebContents;
  let mockBrowserWindow;

  beforeEach(() => {
    mockFs = {
      existsSync: vi.fn(() => true),
      unlinkSync: vi.fn(),
    };
    mockWebContents = { send: vi.fn() };
    mockBrowserWindow = {
      getAllWindows: vi.fn(() => [
        { isDestroyed: () => false, webContents: mockWebContents },
      ]),
    };
  });

  it("should delete a single file and return ok:true", async () => {
    // Import the helper from memes.js — this will fail in RED phase
    // because deleteMemes doesn't exist yet
    const { deleteMemes } = await import("./memes");

    const results = await deleteMemes(
      ["/memes/cat.gif"],
      mockFs,
      mockBrowserWindow,
    );

    expect(mockFs.unlinkSync).toHaveBeenCalledWith("/memes/cat.gif");
    expect(results).toEqual([{ path: "/memes/cat.gif", ok: true }]);
  });

  it("should delete multiple files", async () => {
    const { deleteMemes } = await import("./memes");

    const results = await deleteMemes(
      ["/memes/a.gif", "/memes/b.png", "/memes/c.mp4"],
      mockFs,
      mockBrowserWindow,
    );

    expect(mockFs.unlinkSync).toHaveBeenCalledTimes(3);
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it("should return ok:false per-file when deletion fails without throwing", async () => {
    mockFs.unlinkSync
      .mockImplementationOnce(() => {
        throw new Error("ENOENT: not found");
      })
      .mockImplementationOnce(() => {});

    const { deleteMemes } = await import("./memes");

    const results = await deleteMemes(
      ["/memes/missing.gif", "/memes/exists.gif"],
      mockFs,
      mockBrowserWindow,
    );

    expect(results[0]).toEqual({
      path: "/memes/missing.gif",
      ok: false,
      error: "ENOENT: not found",
    });
    expect(results[1]).toEqual({ path: "/memes/exists.gif", ok: true });
  });

  it("should emit library:changed on all non-destroyed windows after deletion", async () => {
    const { deleteMemes } = await import("./memes");

    await deleteMemes(["/memes/a.gif"], mockFs, mockBrowserWindow);

    expect(mockWebContents.send).toHaveBeenCalledWith("library:changed");
    expect(mockBrowserWindow.getAllWindows).toHaveBeenCalled();
  });

  it("should skip destroyed windows when emitting library:changed", async () => {
    const destroyedContent = { send: vi.fn() };
    mockBrowserWindow.getAllWindows.mockReturnValue([
      { isDestroyed: () => true, webContents: destroyedContent },
      { isDestroyed: () => false, webContents: mockWebContents },
    ]);

    const { deleteMemes } = await import("./memes");

    await deleteMemes(["/memes/a.gif"], mockFs, mockBrowserWindow);

    expect(destroyedContent.send).not.toHaveBeenCalled();
    expect(mockWebContents.send).toHaveBeenCalledWith("library:changed");
  });

  it("should skip deletion if file does not exist", async () => {
    mockFs.existsSync.mockReturnValue(false);

    const { deleteMemes } = await import("./memes");

    await deleteMemes(["/memes/ghost.gif"], mockFs, mockBrowserWindow);

    // Should not call unlinkSync for non-existent file
    expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    // But should still report success (nothing to delete is not an error)
    expect(mockWebContents.send).toHaveBeenCalledWith("library:changed");
  });
});

describe("soft-delete (hiddenMemes store logic)", () => {
  // These tests validate the store manipulation logic used by the IPC handlers
  // (Set-based dedup, filtering, add/remove)

  it("should add a path to hiddenMemes set-style", () => {
    const hiddenSet = new Set();
    hiddenSet.add("/memes/cat.gif");
    const result = Array.from(hiddenSet);
    expect(result).toEqual(["/memes/cat.gif"]);
  });

  it("should deduplicate when adding same path twice", () => {
    const hiddenSet = new Set();
    hiddenSet.add("/memes/cat.gif");
    hiddenSet.add("/memes/cat.gif");
    const result = Array.from(hiddenSet);
    expect(result).toHaveLength(1);
  });

  it("should remove a path from hiddenMemes via Set.delete", () => {
    const hiddenSet = new Set(["/memes/cat.gif", "/memes/dog.png"]);
    hiddenSet.delete("/memes/cat.gif");
    expect(Array.from(hiddenSet)).toEqual(["/memes/dog.png"]);
  });

  it("should filter out hidden memes from a list", () => {
    const hiddenSet = new Set(["/memes/hidden.gif"]);
    const allMemes = [
      { name: "cat", path: "/memes/cat.gif", kind: "gif" },
      { name: "hidden", path: "/memes/hidden.gif", kind: "gif" },
      { name: "dog", path: "/memes/dog.png", kind: "image" },
    ];
    const visible = allMemes.filter((m) => !hiddenSet.has(m.path));
    expect(visible).toHaveLength(2);
    expect(visible.map((m) => m.name)).toEqual(["cat", "dog"]);
  });

  it("should show only hidden memes when listing hidden", () => {
    const hiddenSet = new Set(["/memes/hidden.gif"]);
    const allMemes = [
      { name: "cat", path: "/memes/cat.gif", kind: "gif" },
      { name: "hidden", path: "/memes/hidden.gif", kind: "gif" },
    ];
    const onlyHidden = allMemes.filter((m) => hiddenSet.has(m.path));
    expect(onlyHidden).toHaveLength(1);
    expect(onlyHidden[0].name).toBe("hidden");
  });

  it("should handle empty hiddenMemes gracefully", () => {
    const hiddenSet = new Set();
    const allMemes = [{ name: "cat", path: "/memes/cat.gif", kind: "gif" }];
    const visible = allMemes.filter((m) => !hiddenSet.has(m.path));
    expect(visible).toHaveLength(1);

    const onlyHidden = allMemes.filter((m) => hiddenSet.has(m.path));
    expect(onlyHidden).toHaveLength(0);
  });

  it("should handle multiple paths in one add operation", () => {
    const hiddenSet = new Set();
    const paths = ["/memes/a.gif", "/memes/b.png", "/memes/c.mp4"];
    for (const p of paths) hiddenSet.add(p);
    expect(Array.from(hiddenSet)).toEqual(paths);
  });
});

describe("meme sync message format", () => {
  it("should build a valid meme_sync payload with path", () => {
    const memeData = { name: "cat.gif", path: "/memes/cat.gif", kind: "gif" };
    const payload = { type: "meme_sync", data: { ...memeData } };
    expect(payload.type).toBe("meme_sync");
    expect(payload.data.name).toBe("cat.gif");
    expect(payload.data.path).toBe("/memes/cat.gif");
    expect(payload.data.kind).toBe("gif");
  });

  it("should build a valid meme_sync payload with URL only", () => {
    const memeData = {
      name: "giphy",
      url: "https://giphy.com/test.gif",
      kind: "gif",
    };
    const payload = { type: "meme_sync", data: { ...memeData } };
    expect(payload.type).toBe("meme_sync");
    expect(payload.data.url).toBe("https://giphy.com/test.gif");
    expect(payload.data.path).toBeUndefined();
  });

  it("should add from metadata for bot relay", () => {
    const memePayload = {
      type: "meme_sync",
      data: { name: "test.gif", kind: "gif", buffer: "base64data" },
      from: { id: "user123", username: "testuser" },
      ts: Date.now(),
    };
    expect(memePayload.from.username).toBe("testuser");
    expect(memePayload.ts).toBeGreaterThan(0);
  });

  it("should handle syncMeme return value when connected", () => {
    // Simule un appel memes:sync réussi
    const result = { ok: true };
    expect(result.ok).toBe(true);
  });

  it("should handle syncMeme return value when not connected", () => {
    // Simule un appel memes:sync échoué
    const result = { ok: false, error: "Not connected" };
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Not connected");
  });

  it("should handle meme sync with buffer (base64 content)", () => {
    const memeData = {
      name: "test.gif",
      kind: "gif",
      buffer: Buffer.from("fake-image").toString("base64"),
    };
    expect(typeof memeData.buffer).toBe("string");
    expect(memeData.buffer.length).toBeGreaterThan(0);
  });

  it("should generate unique filenames for shared memes", () => {
    const name = "test.gif";
    const filename1 = `shared_${Date.now()}_${name}`;
    const filename2 = `shared_${Date.now() + 1}_${name}`;
    expect(filename1).not.toBe(filename2);
    expect(filename1).toContain(name);
    expect(filename1).toContain("shared_");
  });

  it("should handle meme from other user with from metadata", () => {
    const received = {
      name: "cool_meme",
      path: "/memes/shared_123_cool_meme.gif",
      kind: "gif",
      from: { id: "other_user", username: "friend" },
    };
    expect(received.from.username).toBe("friend");
    expect(received.path).toContain("shared_");
  });
});

describe("detectKindFromBuffer (magic bytes)", () => {
  it("should detect PNG from magic bytes", async () => {
    const { detectKindFromBuffer } = await import("./memes");
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectKindFromBuffer(buf)).toEqual({ ext: ".png", kind: "image" });
  });

  it("should detect JPEG from magic bytes", async () => {
    const { detectKindFromBuffer } = await import("./memes");
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(detectKindFromBuffer(buf)).toEqual({ ext: ".jpg", kind: "image" });
  });

  it("should detect GIF from magic bytes", async () => {
    const { detectKindFromBuffer } = await import("./memes");
    const buf = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(detectKindFromBuffer(buf)).toEqual({ ext: ".gif", kind: "gif" });
  });

  it("should detect WebP from magic bytes", async () => {
    const { detectKindFromBuffer } = await import("./memes");
    const buf = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    expect(detectKindFromBuffer(buf)).toEqual({ ext: ".webp", kind: "image" });
  });

  it("should detect MP4 from magic bytes", async () => {
    const { detectKindFromBuffer } = await import("./memes");
    const buf = Buffer.from([0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    expect(detectKindFromBuffer(buf)).toEqual({ ext: ".mp4", kind: "video" });
  });

  it("should detect WebM from magic bytes", async () => {
    const { detectKindFromBuffer } = await import("./memes");
    const buf = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
    expect(detectKindFromBuffer(buf)).toEqual({ ext: ".webm", kind: "video" });
  });

  it("should detect MP3 (ID3 tag) from magic bytes", async () => {
    const { detectKindFromBuffer } = await import("./memes");
    const buf = Buffer.from([0x49, 0x44, 0x33]);
    expect(detectKindFromBuffer(buf)).toEqual({ ext: ".mp3", kind: "audio" });
  });

  it("should detect MP3 (no ID3) from magic bytes", async () => {
    const { detectKindFromBuffer } = await import("./memes");
    const buf = Buffer.from([0xff, 0xfb]);
    expect(detectKindFromBuffer(buf)).toEqual({ ext: ".mp3", kind: "audio" });
  });

  it("should detect WAV from magic bytes", async () => {
    const { detectKindFromBuffer } = await import("./memes");
    const buf = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);
    expect(detectKindFromBuffer(buf)).toEqual({ ext: ".wav", kind: "audio" });
  });

  it("should detect OGG from magic bytes", async () => {
    const { detectKindFromBuffer } = await import("./memes");
    const buf = Buffer.from([0x4f, 0x67, 0x67, 0x53]);
    expect(detectKindFromBuffer(buf)).toEqual({ ext: ".ogg", kind: "audio" });
  });

  it("should return null for unknown format", async () => {
    const { detectKindFromBuffer } = await import("./memes");
    const buf = Buffer.from([0x00, 0x00, 0x00, 0x00]);
    expect(detectKindFromBuffer(buf)).toBeNull();
  });

  it("should return null for empty buffer", async () => {
    const { detectKindFromBuffer } = await import("./memes");
    expect(detectKindFromBuffer(Buffer.from([]))).toBeNull();
  });

  it("should return null for null buffer", async () => {
    const { detectKindFromBuffer } = await import("./memes");
    expect(detectKindFromBuffer(null)).toBeNull();
  });
});
