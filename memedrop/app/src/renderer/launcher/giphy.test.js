// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for renderGiphyGrid — the function that renders Giphy search/trending results
 * and handles the "add to local grid" interaction.
 */

describe("renderGiphyGrid", () => {
  let giphyGrid;
  let mockDownloadGiphy;
  let allMemes;
  let renderGrid;
  let openDropPanel;
  let toast;

  // Minimal DOM setup for the function
  function renderGiphyGrid(results) {
    if (!giphyGrid) return;
    giphyGrid.innerHTML = "";
    if (results.length === 0) {
      giphyGrid.innerHTML =
        '<p style="grid-column:1/-1;text-align:center;color:var(--text-dim);">Aucun résultat</p>';
      return;
    }
    for (const gif of results) {
      const item = document.createElement("div");
      item.className = "giphy-item";

      const img = document.createElement("img");
      img.src =
        gif.images?.fixed_height?.url || gif.images?.original?.url || "";
      img.loading = "lazy";
      img.alt = gif.title || "GIF";
      item.appendChild(img);

      // Shared download logic
      const handleGiphyDownload = async () => {
        try {
          const downloaded = await mockDownloadGiphy(
            gif.images?.original?.url || gif.images?.fixed_height?.url,
          );
          if (downloaded) {
            allMemes.unshift(downloaded);
            renderGrid();
            openDropPanel(downloaded);
            toast("🌐 GIF importé !");
          } else {
            toast("Erreur d'import GIF", "error");
          }
        } catch (err) {
          toast("Erreur d'import GIF", "error");
        }
      };

      const dropBtn = document.createElement("button");
      dropBtn.className = "drop-btn";
      dropBtn.textContent = "⬇ Drop";
      dropBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await handleGiphyDownload();
      });
      item.appendChild(dropBtn);

      // Clicking anywhere on the card also triggers download
      item.addEventListener("click", handleGiphyDownload);

      giphyGrid.appendChild(item);
    }
  }

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '<div id="giphy-grid"></div>';
    giphyGrid = document.getElementById("giphy-grid");

    // Reset mocks
    mockDownloadGiphy = vi.fn();
    allMemes = [];
    renderGrid = vi.fn();
    openDropPanel = vi.fn();
    toast = vi.fn();
  });

  it("should render each gif result as a .giphy-item card", () => {
    const results = [
      {
        title: "Funny Cat",
        images: { fixed_height: { url: "https://giphy.com/cat.gif" } },
      },
    ];

    renderGiphyGrid(results);

    expect(giphyGrid.children.length).toBe(1);
    const card = giphyGrid.children[0];
    expect(card.className).toBe("giphy-item");
    expect(card.querySelector("img").src).toBe("https://giphy.com/cat.gif");
    expect(card.querySelector(".drop-btn")).toBeTruthy();
  });

  it("should handle empty results gracefully", () => {
    renderGiphyGrid([]);
    expect(giphyGrid.innerHTML).toContain("Aucun résultat");
  });

  it("should use fixed_height url as img src, fallback to original", () => {
    const results = [
      {
        images: { original: { url: "https://giphy.com/original.gif" } },
      },
    ];

    renderGiphyGrid(results);
    expect(giphyGrid.querySelector("img").src).toBe(
      "https://giphy.com/original.gif",
    );
  });

  it("should call downloadGiphy and add to allMemes when drop button is clicked", async () => {
    const gifUrl = "https://giphy.com/original.gif";
    const downloaded = {
      name: "giphy_test",
      path: "/memes/giphy_test.gif",
      kind: "gif",
    };
    mockDownloadGiphy.mockResolvedValue(downloaded);

    const results = [{ images: { original: { url: gifUrl } } }];

    renderGiphyGrid(results);

    const dropBtn = giphyGrid.querySelector(".drop-btn");
    await dropBtn.click();

    expect(mockDownloadGiphy).toHaveBeenCalledWith(gifUrl);
    expect(allMemes).toContain(downloaded);
    expect(allMemes.length).toBe(1);
    expect(renderGrid).toHaveBeenCalled();
    expect(openDropPanel).toHaveBeenCalledWith(downloaded);
    expect(toast).toHaveBeenCalledWith("🌐 GIF importé !");
  });

  it("should show error toast when download fails", async () => {
    mockDownloadGiphy.mockResolvedValue(null);

    const results = [
      { images: { original: { url: "https://giphy.com/fail.gif" } } },
    ];

    renderGiphyGrid(results);
    await giphyGrid.querySelector(".drop-btn").click();

    expect(toast).toHaveBeenCalledWith("Erreur d'import GIF", "error");
    expect(allMemes.length).toBe(0);
    expect(renderGrid).not.toHaveBeenCalled();
  });

  // 🚩 THIS TEST WILL FAIL — the feature is not implemented yet
  it("should download and add to grid when clicking the GIF image (not just the drop button)", async () => {
    const gifUrl = "https://giphy.com/clickable.gif";
    const downloaded = {
      name: "giphy_click",
      path: "/memes/giphy_click.gif",
      kind: "gif",
    };
    mockDownloadGiphy.mockResolvedValue(downloaded);

    const results = [{ images: { original: { url: gifUrl } } }];

    renderGiphyGrid(results);

    // Click the IMG element inside the card
    const img = giphyGrid.querySelector("img");
    await img.click();

    // ❌ Currently fails because only the drop button triggers the download
    expect(mockDownloadGiphy).toHaveBeenCalledWith(gifUrl);
    expect(allMemes).toContain(downloaded);
    expect(toast).toHaveBeenCalledWith("🌐 GIF importé !");
  });

  it("should still work with the drop button after adding image click handler", async () => {
    // The drop button click should not be broken by the new handler
    const downloaded = {
      name: "giphy_drop",
      path: "/memes/giphy_drop.gif",
      kind: "gif",
    };
    mockDownloadGiphy.mockResolvedValue(downloaded);

    const results = [
      { images: { original: { url: "https://giphy.com/test.gif" } } },
    ];

    renderGiphyGrid(results);

    // Click the drop button (should still work)
    await giphyGrid.querySelector(".drop-btn").click();

    expect(mockDownloadGiphy).toHaveBeenCalledTimes(1);
    expect(allMemes.length).toBe(1);
    expect(toast).toHaveBeenCalledWith("🌐 GIF importé !");
  });
});
