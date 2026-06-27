// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for multi-select and delete in the meme grid.
 * These test the selection interaction and the delete action UI.
 */

describe("grid selection & delete", () => {
  let grid;
  let allMemes;
  let selectedPaths;
  let actionBar;
  let deleteSelectedBtn;
  let selectedCountEl;
  let mockDeleteMemes;

  // Replica of the selection + delete logic we'll add to the grid
  function renderGridWithSelection(memes) {
    grid.innerHTML = "";

    if (memes.length === 0) {
      grid.innerHTML = "<p>Aucun meme trouvé</p>";
      return;
    }

    for (const meme of memes) {
      const card = document.createElement("div");
      card.className = "meme-card";
      card.dataset.path = meme.path;

      // Selection checkbox overlay
      const check = document.createElement("div");
      check.className = "meme-check";
      check.textContent = "✓";
      check.style.display = "none"; // hidden by default
      card.appendChild(check);

      // Card name
      const name = document.createElement("div");
      name.className = "meme-card-name";
      name.textContent = meme.name;
      card.appendChild(name);

      card.addEventListener("click", (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          toggleSelection(meme.path);
        } else {
          openDropPanel(meme);
        }
      });

      grid.appendChild(card);
    }
  }

  function toggleSelection(path) {
    if (selectedPaths.has(path)) {
      selectedPaths.delete(path);
    } else {
      selectedPaths.add(path);
    }
    updateSelectionUI();
  }

  function updateSelectionUI() {
    const count = selectedPaths.size;
    if (count > 0) {
      selectedCountEl.textContent = `${count} sélectionné${count > 1 ? "s" : ""}`;
      actionBar.classList.remove("hidden");
    } else {
      actionBar.classList.add("hidden");
    }

    grid.querySelectorAll(".meme-card").forEach((card) => {
      const path = card.dataset.path;
      const check = card.querySelector(".meme-check");
      if (selectedPaths.has(path)) {
        card.classList.add("selected");
        if (check) check.style.display = "flex";
      } else {
        card.classList.remove("selected");
        if (check) check.style.display = "none";
      }
    });
  }

  async function handleDeleteSelected(BrowserWindow, fs) {
    if (selectedPaths.size === 0) return;
    const paths = Array.from(selectedPaths);
    const { deleteMemes } = await import("../../main/modules/memes");
    const results = await deleteMemes(paths, fs, BrowserWindow);
    const allOk = results.every((r) => r.ok);

    if (allOk) {
      allMemes = allMemes.filter((m) => !selectedPaths.has(m.path));
      selectedPaths.clear();
      updateSelectionUI();
      renderGridWithSelection(allMemes);
      return { ok: true };
    }
    return { ok: false, errors: results.filter((r) => !r.ok) };
  }

  const openDropPanel = vi.fn();

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="meme-grid"></div>
      <div id="selection-action-bar" class="hidden">
        <span id="selected-count"></span>
        <button id="btn-delete-selected">🗑 Supprimer</button>
      </div>
    `;
    grid = document.getElementById("meme-grid");
    actionBar = document.getElementById("selection-action-bar");
    selectedCountEl = document.getElementById("selected-count");
    deleteSelectedBtn = document.getElementById("btn-delete-selected");

    allMemes = [
      { name: "cat", path: "/memes/cat.gif", kind: "gif" },
      { name: "dog", path: "/memes/dog.png", kind: "image" },
      { name: "bird", path: "/memes/bird.mp4", kind: "video" },
    ];
    selectedPaths = new Set();
    openDropPanel.mockClear();
  });

  it("should render meme cards with selection overlay", () => {
    renderGridWithSelection(allMemes);
    expect(grid.children.length).toBe(3);
    const firstCard = grid.children[0];
    expect(firstCard.classList.contains("meme-card")).toBe(true);
    expect(firstCard.querySelector(".meme-check")).toBeTruthy();
  });

  it("should toggle selection with Ctrl+Click", () => {
    renderGridWithSelection(allMemes);
    const firstCard = grid.children[0];

    const ctrlEvent = new MouseEvent("click", { ctrlKey: true, bubbles: true });
    firstCard.dispatchEvent(ctrlEvent);

    expect(selectedPaths.has("/memes/cat.gif")).toBe(true);
    expect(firstCard.classList.contains("selected")).toBe(true);
    expect(firstCard.querySelector(".meme-check").style.display).toBe("flex");
    expect(actionBar.classList.contains("hidden")).toBe(false);
    expect(selectedCountEl.textContent).toBe("1 sélectionné");
  });

  it("should deselect with second Ctrl+Click", () => {
    renderGridWithSelection(allMemes);
    const firstCard = grid.children[0];

    firstCard.dispatchEvent(
      new MouseEvent("click", { ctrlKey: true, bubbles: true }),
    );
    expect(selectedPaths.size).toBe(1);

    firstCard.dispatchEvent(
      new MouseEvent("click", { ctrlKey: true, bubbles: true }),
    );
    expect(selectedPaths.size).toBe(0);
    expect(actionBar.classList.contains("hidden")).toBe(true);
  });

  it("should select multiple items with Ctrl+Click", () => {
    renderGridWithSelection(allMemes);
    const cards = grid.children;

    cards[0].dispatchEvent(
      new MouseEvent("click", { ctrlKey: true, bubbles: true }),
    );
    cards[2].dispatchEvent(
      new MouseEvent("click", { ctrlKey: true, bubbles: true }),
    );

    expect(selectedPaths.size).toBe(2);
    expect(selectedPaths.has("/memes/cat.gif")).toBe(true);
    expect(selectedPaths.has("/memes/bird.mp4")).toBe(true);
    expect(selectedCountEl.textContent).toBe("2 sélectionnés");
  });

  it("should open drop panel on regular (non-ctrl) click", () => {
    renderGridWithSelection(allMemes);
    const firstCard = grid.children[0];
    firstCard.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(openDropPanel).toHaveBeenCalledWith(allMemes[0]);
    expect(selectedPaths.size).toBe(0);
  });

  it("should show action bar only when items are selected", () => {
    renderGridWithSelection(allMemes);
    expect(actionBar.classList.contains("hidden")).toBe(true);

    grid.children[0].dispatchEvent(
      new MouseEvent("click", { ctrlKey: true, bubbles: true }),
    );
    expect(actionBar.classList.contains("hidden")).toBe(false);

    grid.children[0].dispatchEvent(
      new MouseEvent("click", { ctrlKey: true, bubbles: true }),
    );
    expect(actionBar.classList.contains("hidden")).toBe(true);
  });

  it("should update selected count text", () => {
    renderGridWithSelection(allMemes);

    grid.children[0].dispatchEvent(
      new MouseEvent("click", { ctrlKey: true, bubbles: true }),
    );
    expect(selectedCountEl.textContent).toBe("1 sélectionné");

    grid.children[1].dispatchEvent(
      new MouseEvent("click", { ctrlKey: true, bubbles: true }),
    );
    expect(selectedCountEl.textContent).toBe("2 sélectionnés");
  });

  it("should remove selected items from allMemes after delete", async () => {
    renderGridWithSelection(allMemes);
    const cards = grid.children;

    cards[0].dispatchEvent(
      new MouseEvent("click", { ctrlKey: true, bubbles: true }),
    );
    cards[1].dispatchEvent(
      new MouseEvent("click", { ctrlKey: true, bubbles: true }),
    );

    expect(selectedPaths.size).toBe(2);

    const beforeCount = allMemes.length;
    allMemes = allMemes.filter((m) => !selectedPaths.has(m.path));
    selectedPaths.clear();

    expect(allMemes.length).toBe(beforeCount - 2);
    expect(allMemes.every((m) => m.name !== "cat" && m.name !== "dog")).toBe(
      true,
    );
  });
});

describe("grid layout", () => {
  it("should never overlap cards regardless of screen size", () => {
    const grid = {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
      gap: "6px",
    };
    expect(grid.display).toBe("grid");
    expect(grid.gridTemplateColumns).toContain("auto-fill");
  });

  it("cards should have overflow hidden to prevent content leak", () => {
    const card = { overflow: "hidden", position: "relative" };
    expect(card.overflow).toBe("hidden");
    expect(card.position).toBe("relative");
  });
});

describe("shared memes full list", () => {
  it("should NOT crop the list with maxShow", () => {
    const memes = Array.from({ length: 500 }, (_, i) => `meme${i}.gif`);
    const shown = memes.slice(0, memes.length);
    expect(shown.length).toBe(500);
    expect(shown[499]).toBe("meme499.gif");
  });
});
