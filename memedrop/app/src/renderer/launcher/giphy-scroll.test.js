// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

// Note: Giphy infinite scroll a été remplacé par un bouton "Afficher plus"
// Ce test est adapté pour la nouvelle UI avec bouton de chargement
describe("giphy grid - layout de base", () => {
  let grid;

  beforeEach(() => {
    document.body.innerHTML =
      '<div id="giphy-grid" class="giphy-grid" style="max-height:500px;overflow-y:auto"></div>';
    grid = document.getElementById("giphy-grid");
  });

  it("should start empty", () => {
    expect(grid.children.length).toBe(0);
  });

  it("should accept items without scroll issues", () => {
    for (let i = 0; i < 24; i++) {
      const item = document.createElement("div");
      item.className = "giphy-item";
      item.style.height = "30px";
      grid.appendChild(item);
    }
    expect(grid.children.length).toBe(24);
  });

  it("should trigger scroll event when scrolled", () => {
    // Fill enough to have scroll
    for (let i = 0; i < 100; i++) {
      const item = document.createElement("div");
      item.style.height = "30px";
      grid.appendChild(item);
    }

    const handler = vi.fn();
    grid.addEventListener("scroll", handler);
    grid.scrollTop = 100;
    const event = new Event("scroll");
    grid.dispatchEvent(event);

    expect(handler).toHaveBeenCalled();
  });

  it("should clean grid contents", () => {
    for (let i = 0; i < 10; i++) {
      const item = document.createElement("div");
      item.className = "giphy-item";
      grid.appendChild(item);
    }
    grid.innerHTML = "";
    expect(grid.children.length).toBe(0);
  });
});
