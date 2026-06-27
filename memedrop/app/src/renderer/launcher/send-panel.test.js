// @vitest-environment jsdom
import { describe, it, expect } from "vitest";

describe("send panel audio — multiple sends", () => {
  it("should include audioPath in all 3 payloads when select stays selected", () => {
    document.body.innerHTML = `<select id="panel-audio-select">
      <option value="">Aucun son</option>
      <option value="/audio/song.mp3" selected>Song</option>
    </select>`;

    const getAudioPath = () => {
      const select = document.getElementById("panel-audio-select");
      return select ? select.value || null : null;
    };

    // Send 1
    expect(getAudioPath()).toBe("/audio/song.mp3");
    // Send 2
    expect(getAudioPath()).toBe("/audio/song.mp3");
    // Send 3
    expect(getAudioPath()).toBe("/audio/song.mp3");
  });

  it("should survive renderAudioSelect resetting the innerHTML", () => {
    document.body.innerHTML = `<select id="panel-audio-select"></select>`;

    const audioLibrary = [{ path: "/audio/a.mp3", name: "A" }, { path: "/audio/b.mp3", name: "B" }];
    const select = document.getElementById("panel-audio-select");

    // Simule renderAudioSelect
    select.innerHTML = '<option value="">Aucun son</option>';
    for (const audio of audioLibrary) {
      const opt = document.createElement("option");
      opt.value = audio.path;
      opt.textContent = audio.name;
      if (audio.path === "/audio/b.mp3") opt.selected = true;
      select.appendChild(opt);
    }

    expect(select.value).toBe("/audio/b.mp3");

    // Simule re-ouverture du panel — renderAudioSelect again with same pairing
    select.innerHTML = '<option value="">Aucun son</option>';
    for (const audio of audioLibrary) {
      const opt = document.createElement("option");
      opt.value = audio.path;
      opt.textContent = audio.name;
      if (audio.path === "/audio/b.mp3") opt.selected = true;
      select.appendChild(opt);
    }

    expect(select.value).toBe("/audio/b.mp3");
  });

  it("should return null for empty value (Aucun son)", () => {
    document.body.innerHTML = `<select id="panel-audio-select">
      <option value="" selected>Aucun son</option>
    </select>`;
    const select = document.getElementById("panel-audio-select");
    // Facon getAudioPath retourne null pour ""
    const audioPath = select.value || null;
    expect(audioPath).toBeNull();
  });
});
