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
