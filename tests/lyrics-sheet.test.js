const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const sheet = require("../js/lyrics-sheet.js");
const { validState } = require("../js/state-validation.js");

test("Lyrics place chords above the following syllables and retain sections, blank lines and trailing chords", () => {
  const html = sheet.render("[Verse]\n[G]Morning [D/F#]light\n\n[Am7][C]");
  assert.match(html, /lyrics-word">\[Verse\]/);
  assert.match(
    html,
    /lyrics-chord">G<\/span><span class="lyrics-word">Morning /,
  );
  assert.match(
    html,
    /lyrics-chord">D\/F#<\/span><span class="lyrics-word">light/,
  );
  assert.match(html, /<div class="lyrics-line">&nbsp;<\/div>/);
  assert.match(
    html,
    /lyrics-chord">Am7<\/span><span class="lyrics-word">&nbsp;/,
  );
  assert.match(html, /lyrics-chord">C<\/span><span class="lyrics-word">&nbsp;/);
  assert.equal((html.match(/class="lyrics-line"/g) || []).length, 4);
});

test("Transposing preserves chord quality, bass notes and lyric text", () => {
  const source = "[Chorus]\n[Bbmaj7]Soft [F#m7/C#]light\n[Bridge]";
  assert.equal(
    sheet.transpose(source, 2),
    "[Chorus]\n[Cmaj7]Soft [A♭m7/E♭]light\n[Bridge]",
  );
  assert.equal(sheet.transpose(source, 0), source);
  assert.equal(sheet.transposeChord("C", -1), "B");
  assert.equal(sheet.chord("Chorus"), null);
});

test("User lyrics and unrecognized chord markers cannot inject HTML", () => {
  const html = sheet.render("[G]<img src=x onerror=alert(1)> & [<script>]");
  assert(!html.includes("<img"));
  assert(!html.includes("<script>"));
  assert.match(html, /&lt;img/);
  assert.match(html, /&amp;/);
  assert.match(html, /\[&lt;script&gt;\]/);
});

function fixture(t) {
  const elements = new Map();
  const element = () => ({
    value: "",
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {},
    removeAttribute() {},
    replaceChildren() {},
    append() {},
    pause() {},
    scrollIntoView() {},
    focus() {},
    querySelectorAll() {
      return [];
    },
    setRangeText(text, start, end) {
      this.value = this.value.slice(0, start) + text + this.value.slice(end);
      this.selectionStart = this.selectionEnd = start + text.length;
    },
  });
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  };
  const root = { querySelector: get, querySelectorAll: () => [] };
  const saved = [];
  const context = vm.createContext({
    LyricsSheet: sheet,
    GuitarService: require("../js/guitar-service.js"),
    document: {
      documentElement: { dataset: {} },
      createElement: element,
      addEventListener() {},
      removeEventListener() {},
    },
    structuredClone,
    AbortController,
    URL,
    setTimeout,
    clearTimeout,
    root,
    saveChart: (chart) => {
      saved.push(chart);
      return true;
    },
  });
  get("#patternSelect").value = "folk";
  vm.runInContext(fs.readFileSync("js/guitar-tools.js", "utf8"), context);
  vm.runInContext("GuitarTools.mount(root, saveChart)", context);
  t.after(() => vm.runInContext("GuitarTools.stop()", context));
  return { get, saved, context };
}

test("The editor inserts chords at the cursor, previews transposition and saves a backup-compatible sheet", (t) => {
  const { get, saved, context } = fixture(t);
  get("#lyricsTab").onclick();
  assert.equal(get("#lyricsView").hidden, false);
  assert.equal(get("#chordsView").hidden, true);
  get("#lyricsTitle").value = "Morning light";
  get("#lyricsTitle").oninput();
  get("#lyricsInput").value = "Morning light";
  get("#lyricsInput").oninput();
  get("#lyricsInput").selectionStart = get("#lyricsInput").selectionEnd = 8;
  get("#lyricsChord").value = "D/F#";
  get("#insertLyricChord").onclick();
  assert.equal(get("#lyricsInput").value, "Morning [D/F#]light");
  assert.match(get("#lyricsPreview").innerHTML, /lyrics-chord">D\/F#/);
  get("#lyricsTransposeUp").onclick();
  assert.match(get("#lyricsPreview").innerHTML, /lyrics-chord">E♭\/G/);
  assert.equal(get("#lyricsInput").value, "Morning [D/F#]light");
  get("#saveLyricsBtn").onclick();
  assert.equal(saved[0].title, "Morning light");
  assert.match(saved[0].body, /Lyrics & chords\nMorning \[E♭\/G\]light/);
  assert.deepEqual(validState({ songs: saved }).songs[0].body, saved[0].body);
  vm.runInContext(
    "GuitarTools.stop(); GuitarTools.mount(root, saveChart)",
    context,
  );
  assert.equal(get("#lyricsInput").value, "Morning [D/F#]light");
});

test("Manual lyrics can be saved without a successful YouTube analysis", async (t) => {
  const { get, saved, context } = fixture(t);
  context.CampusBackend = {
    request: async () => {
      throw Error("Service unavailable");
    },
  };
  get("#youtubeUrl").value = "https://youtu.be/2Vv-BfVoq4g";
  await get("#urlForm").onsubmit({ preventDefault() {} });
  get("#lyricsInput").value = "[G]A song of my own";
  get("#lyricsInput").oninput();
  get("#saveLyricsBtn").onclick();
  assert.equal(saved.length, 1);
  assert.match(saved[0].body, /\[G\]A song of my own/);
  get("#lyricsChord").value = "invalid chord";
  get("#insertLyricChord").onclick();
  assert.match(get("#lyricsStatus").textContent, /Enter a chord/);
});

test("Video lyrics fill an empty sheet, preserve existing drafts and ignore cancelled results", async (t) => {
  const { get, context } = fixture(t);
  context.GuitarService = {
    ...context.GuitarService,
    transcribe: async () => ({ text: "Morning light" }),
  };
  get("#lyricsVideoUrl").value = "https://youtu.be/2Vv-BfVoq4g";
  await get("#lyricsVideoForm").onsubmit({ preventDefault() {} });
  assert.equal(get("#lyricsInput").value, "Morning light");
  assert.equal(get("#lyricsGenerationProgress").hidden, true);
  assert.equal(get("#generateLyricsBtn").disabled, false);
  context.GuitarService.transcribe = async () => ({ text: "A new version" });
  await get("#lyricsVideoForm").onsubmit({ preventDefault() {} });
  assert.equal(get("#lyricsInput").value, "Morning light");
  assert.equal(get("#generatedLyricsPanel").hidden, false);
  assert.equal(get("#generatedLyricsText").value, "A new version");
  get("#useGeneratedLyricsBtn").onclick();
  assert.equal(get("#lyricsInput").value, "A new version");
  let finish;
  context.GuitarService.transcribe = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const pending = get("#lyricsVideoForm").onsubmit({ preventDefault() {} });
  assert.equal(get("#lyricsGenerationProgress").hidden, false);
  assert.equal(get("#generateLyricsBtn").disabled, true);
  assert.equal(get("#submitAnalysisBtn").disabled, true);
  get("#cancelLyricsBtn").onclick();
  finish({ text: "Late result" });
  await pending;
  assert.equal(get("#lyricsInput").value, "A new version");
  assert.match(get("#lyricsGenerationStatus").textContent, /cancelled/);
  context.GuitarService.transcribe = async () => {
    throw Object.assign(Error("Quota"), { status: 429 });
  };
  await get("#lyricsVideoForm").onsubmit({ preventDefault() {} });
  assert.match(get("#lyricsGenerationStatus").textContent, /request limit/);
  assert.equal(get("#lyricsInput").value, "A new version");
  assert.equal(get("#generateLyricsBtn").disabled, false);
});
