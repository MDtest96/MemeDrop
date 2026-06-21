// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// Vitest CWD is the package root (memedrop/app/)
const APP_ROOT = resolve(__dirname); // will be /.../memedrop/app/
// Actually vitest resolves __dirname to the test file's dir
// Let's use a relative approach from CWD which is app/

describe("roulette removal", () => {
  const rendererDir = resolve("src", "renderer", "launcher");
  const mainDir = resolve("src", "main");
  const preloadDir = resolve("src", "preload");

  it('should not reference "roulette" in index.html', () => {
    const html = readFileSync(resolve(rendererDir, "index.html"), "utf-8");

    // 🚩 RED: roulette still in HTML (tab button + content)
    expect(html).not.toContain("roulette");
    expect(html).not.toContain('data-tab="roulette"');
    expect(html).not.toContain("btn-roulette-spin");
    expect(html).not.toContain("roulette-meme");
    expect(html).not.toContain("roulette-target");
    expect(html).not.toContain("btn-roulette-send");
  });

  it('should not reference "roulette" in style.css', () => {
    const css = readFileSync(resolve(rendererDir, "style.css"), "utf-8");
    expect(css).not.toContain("roulette");
  });

  it('should not reference "roulette" in app.js', () => {
    const js = readFileSync(resolve(rendererDir, "app.js"), "utf-8");
    expect(js).not.toContain("roulette");
  });

  it("should not register tools:roulette IPC handler in index.js", () => {
    const mainJs = readFileSync(resolve(mainDir, "index.js"), "utf-8");
    expect(mainJs).not.toContain("tools:roulette");
  });

  it("should not expose rouletteSpin in preload/launcher.js", () => {
    const preload = readFileSync(resolve(preloadDir, "launcher.js"), "utf-8");
    expect(preload).not.toContain("roulette");
  });
});
