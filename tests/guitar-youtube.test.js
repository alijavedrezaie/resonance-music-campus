const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  videoId,
  parseChord,
  normalize,
  analyze,
} = require("../js/guitar-service.js");
const fs = require("node:fs");
const vm = require("node:vm");
const sample = {
  segments: [
    { label: "N", start: 0, end: 14.025 },
    { label: "Ab", start: 14.025, end: 26.05 },
    { label: "Fm7", start: 26.05, end: 30.09 },
    { label: "Db", start: 30.09, end: 33.65 },
    { label: "Eb", start: 33.65, end: 37.31 },
  ],
  tempo: 63.024,
  key: "Ab",
  time_signature: "4/4",
};
test("YouTube URLs are canonicalized without accepting credentials or lookalike hosts", () => {
  for (const url of [
    "https://youtu.be/2Vv-BfVoq4g?t=20",
    "https://www.youtube.com/watch?v=2Vv-BfVoq4g",
    "https://music.youtube.com/watch?v=2Vv-BfVoq4g",
    "https://youtube.com/shorts/2Vv-BfVoq4g",
  ])
    assert.equal(videoId(url), "2Vv-BfVoq4g");
  for (const url of [
    "https://youtube.com.attacker.test/watch?v=2Vv-BfVoq4g",
    "https://name:secret@youtube.com/watch?v=2Vv-BfVoq4g",
    "file:///watch?v=2Vv-BfVoq4g",
    "garbage",
  ])
    assert.equal(videoId(url), null);
});
test("Provider normalization preserves seventh and slash chord qualities, excludes silence and rejects unsafe labels", () => {
  const r = normalize(sample);
  assert.equal(r.chords.length, 4);
  assert.deepEqual(r.chords[1], {
    root: 5,
    quality: "m7",
    minor: true,
    start: 26.05,
    end: 30.09,
  });
  assert.equal(r.tempo, 63);
  assert.equal(r.key, "Ab");
  assert.deepEqual(parseChord("F#m7/C#"), {
    root: 6,
    quality: "m7",
    minor: true,
    bass: 1,
  });
  assert.equal(parseChord("C<script>"), null);
  assert.throws(
    () => normalize({ segments: [{ label: "C", start: 5, end: 1 }] }),
    /No clear chords/,
  );
});
test("URL jobs poll to completion and propagate unavailable video errors", async () => {
  const calls = [];
  const request = async (route, method, body) => {
    calls.push(body.action);
    return body.action === "submit"
      ? { job_id: "test_job_123", status: "processing" }
      : body.action === "status"
        ? { status: "complete" }
        : sample;
  };
  const result = await analyze("2Vv-BfVoq4g", {
    request,
    delay: async () => {},
  });
  assert.equal(result.chords.length, 4);
  assert.deepEqual(calls, ["submit", "status", "result"]);
  await assert.rejects(
    analyze("2Vv-BfVoq4g", {
      request: async () => ({ job_id: "test_job_123", status: "error" }),
      delay: async () => {},
    }),
    /could not be accessed/,
  );
});
test("Cancelled analyses do not poll or apply a result", async () => {
  const controller = new AbortController();
  let count = 0;
  await assert.rejects(
    analyze("2Vv-BfVoq4g", {
      signal: controller.signal,
      request: async () => {
        count++;
        controller.abort();
        return { job_id: "test_job_123", status: "processing" };
      },
    }),
    { name: "AbortError" },
  );
  assert.equal(count, 1);
});
const env = (key) =>
  ({
    SUPABASE_URL: "https://campustest.supabase.co",
    SUPABASE_ANON_KEY: "test-public-key",
  })[key];
const req = (body) =>
  new Request("https://campustest.supabase.co/functions/v1/guitar-youtube", {
    method: "POST",
    headers: {
      Origin: "https://alijavedrezaie.github.io",
      Authorization: "Bearer owner-test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
test("Relay checks the active campus owner before submitting a canonical URL", async () => {
  const { createHandler } =
    await import("../supabase/functions/guitar-youtube/handler.mjs");
  const calls = [];
  const handler = createHandler({
    env,
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return Response.json(
        url.includes("campus_is_owner")
          ? true
          : { job_id: "test_job_123", status: "processing" },
      );
    },
  });
  assert.equal(
    (await handler(req({ action: "submit", videoId: "2Vv-BfVoq4g" }))).status,
    200,
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.headers.Authorization, "Bearer owner-test");
  assert.equal(calls[1].options.headers.Authorization, undefined);
  assert.equal(
    JSON.parse(calls[1].options.body).url,
    "https://www.youtube.com/watch?v=2Vv-BfVoq4g",
  );
  const denied = createHandler({
    env,
    fetcher: async () => Response.json(false),
  });
  assert.equal(
    (await denied(req({ action: "submit", videoId: "2Vv-BfVoq4g" }))).status,
    403,
  );
});
test("Relay blocks anonymous callers, foreign origins, arbitrary URLs and job traversal", async () => {
  const { createHandler } =
    await import("../supabase/functions/guitar-youtube/handler.mjs");
  let count = 0;
  const handler = createHandler({
    env,
    fetcher: async () => {
      count++;
      return Response.json(true);
    },
  });
  assert.equal(
    (await handler(new Request("https://test", { method: "POST" }))).status,
    401,
  );
  assert.equal(count, 0);
  const foreign = new Request("https://test", {
    method: "POST",
    headers: {
      Origin: "https://attacker.test",
      Authorization: "Bearer owner-test",
    },
  });
  assert.equal((await handler(foreign)).status, 403);
  assert.equal(count, 0);
  assert.equal(
    (await handler(req({ action: "submit", videoId: "https://127.0.0.1" })))
      .status,
    400,
  );
  assert.equal(count, 1);
  assert.equal(
    (await handler(req({ action: "result", jobId: "../../secret" }))).status,
    400,
  );
  assert.equal(count, 2);
});
test("Relay exposes only musical results and respects upstream quota errors", async () => {
  const { createHandler } =
    await import("../supabase/functions/guitar-youtube/handler.mjs");
  const handler = createHandler({
    env,
    fetcher: async (url) =>
      Response.json(
        url.includes("campus_is_owner")
          ? true
          : {
              ...sample,
              audio_url: "/private/file",
              btc_checkpoint: { path: "/app/models" },
            },
      ),
  });
  const data = await (
    await handler(req({ action: "result", jobId: "test_job_123" }))
  ).json();
  assert.equal(data.segments.length, 5);
  assert.equal(data.audio_url, undefined);
  assert.equal(data.btc_checkpoint, undefined);
  const quota = createHandler({
    env,
    fetcher: async (url) =>
      url.includes("campus_is_owner")
        ? Response.json(true)
        : new Response("", { status: 429, headers: { "Retry-After": "60" } }),
  });
  const r = await quota(req({ action: "submit", videoId: "2Vv-BfVoq4g" }));
  assert.equal(r.status, 429);
  assert.equal(r.headers.get("Retry-After"), "60");
});
test("Campus URL form renders actual analyzed chords and cancels when leaving the tool", async () => {
  const elements = new Map();
  const element = () => ({
    value: "",
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {},
    removeAttribute() {},
    replaceChildren() {},
    append() {},
    pause() {},
    scrollIntoView() {},
    querySelectorAll() {
      return [];
    },
  });
  const root = {
    querySelector: (selector) => {
      if (!elements.has(selector)) elements.set(selector, element());
      return elements.get(selector);
    },
    querySelectorAll: () => [],
  };
  const service = require("../js/guitar-service.js");
  const ctx = vm.createContext({
    LyricsSheet: require("../js/lyrics-sheet.js"),
    GuitarService: {
      ...service,
      analyze: (id, opts) =>
        service.analyze(id, { ...opts, delay: async () => {} }),
    },
    CampusBackend: {
      request: async (route, method, b) =>
        b.action === "submit"
          ? { job_id: "test_job_123", status: "complete" }
          : sample,
    },
    document: {
      documentElement: { dataset: {} },
      createElement: element,
      addEventListener() {},
      removeEventListener() {},
    },
    setTimeout,
    clearTimeout,
    structuredClone,
    AbortController,
    URL,
    console,
  });
  vm.runInContext(fs.readFileSync("js/guitar-tools.js", "utf8"), ctx);
  ctx.root = root;
  root.querySelector("#patternSelect").value = "folk";
  vm.runInContext("GuitarTools.mount(root,()=>true)", ctx);
  root.querySelector("#youtubeUrl").value = "https://youtu.be/2Vv-BfVoq4g";
  await root.querySelector("#urlForm").onsubmit({ preventDefault() {} });
  assert.match(
    root.querySelector("#modeBadge").textContent,
    /YOUTUBE ANALYZED/,
  );
  assert.match(root.querySelector("#chordGrid").innerHTML, /Fm7/);
  assert.equal(root.querySelector("#tempo").value, 63);
  assert.match(root.querySelector("#urlStatus").textContent, /ready/);
  assert.match(root.querySelector("#songAnalysisStatus").textContent, /ready/);
  ctx.CampusBackend.request = async () => {
    throw new Error(
      "The analysis service is busy or its free quota is reached. Try again later.",
    );
  };
  await root.querySelector("#analyseBtn").onclick();
  assert.match(root.querySelector("#songAnalysisStatus").textContent, /quota/);
  assert.equal(root.querySelector("#analyseBtn").disabled, false);
  assert.equal(root.querySelector("#analyseBtn").textContent, "Analyse chords");
  assert.equal(
    root.querySelector("#difficulty").textContent,
    "Analysis unavailable",
  );
  assert.equal(root.querySelector("#analysisProgress").hidden, true);
  assert.match(root.querySelector("#chartAnalysisStatus").textContent, /quota/);
  // A delayed request must show activity immediately and reject duplicate submissions.
  let rejectRequest;
  let requests = 0;
  ctx.CampusBackend.request = () => {
    requests++;
    return new Promise((resolve, reject) => {
      rejectRequest = reject;
    });
  };
  const pending = root.querySelector("#analyseBtn").onclick();
  assert.equal(root.querySelector("#analysisPanel").hidden, false);
  assert.equal(root.querySelector("#analysisProgress").hidden, false);
  assert.equal(root.querySelector("#cancelAnalysisBtn").hidden, false);
  assert.equal(root.querySelector("#submitAnalysisBtn").disabled, true);
  assert.match(
    root.querySelector("#analysisElapsed").textContent,
    /Elapsed 0:00/,
  );
  assert.match(root.querySelector("#modeBadge").textContent, /ANALYSING/);
  await root.querySelector("#urlForm").onsubmit({ preventDefault() {} });
  assert.equal(requests, 1);
  rejectRequest(Object.assign(new Error("Quota reached"), { status: 429 }));
  await pending;
  assert.equal(root.querySelector("#analysisProgress").hidden, true);
  assert.equal(root.querySelector("#analysisElapsed").textContent, "");
  assert.equal(root.querySelector("#submitAnalysisBtn").disabled, false);
  assert.match(
    root.querySelector("#chartAnalysisStatus").textContent,
    /request limit/,
  );
  assert.equal(
    root.querySelector("#difficulty").textContent,
    "Service request limit",
  );
  assert.match(root.querySelector("#modeBadge").textContent, /FAILED/);

  // Cancelled requests cannot overwrite the cancellation message when they finish.
  let finishRequest;
  ctx.CampusBackend.request = () =>
    new Promise((resolve) => {
      finishRequest = resolve;
    });
  const cancelled = root.querySelector("#analyseBtn").onclick();
  root.querySelector("#cancelAnalysisBtn").onclick();
  assert.equal(root.querySelector("#analysisProgress").hidden, true);
  assert.equal(root.querySelector("#submitAnalysisBtn").disabled, false);
  finishRequest({ job_id: "test_job_123", status: "complete" });
  await cancelled;
  assert.equal(
    root.querySelector("#analysisHeading").textContent,
    "Analysis cancelled",
  );
  vm.runInContext("GuitarTools.stop()", ctx);
  vm.runInContext("GuitarTools.mount(root,()=>true)", ctx);
  assert.equal(
    root.querySelector("#analysisHeading").textContent,
    "No analysis is running",
  );
  vm.runInContext("GuitarTools.stop()", ctx);
});

test("Video lyrics jobs use the transcription endpoint and reject empty instrumental results", async () => {
  const { transcribe, normalizeLyrics } = require("../js/guitar-service.js");
  const actions = [];
  const result = await transcribe("2Vv-BfVoq4g", {
    request: async (route, method, body) => {
      actions.push(body.action);
      if (body.action === "lyrics-submit")
        return { job_id: "lyrics_job_123", status: "processing" };
      if (body.action === "status") return { status: "complete" };
      return {
        words: [
          { word: "Morning", start: 0, end: 1 },
          { word: "light", start: 1, end: 2 },
        ],
      };
    },
    delay: async () => {},
  });
  assert.equal(result.text, "Morning light");
  assert.deepEqual(actions, ["lyrics-submit", "status", "lyrics-result"]);
  assert.throws(
    () => normalizeLyrics({ words: [] }),
    /No lyrics were detected/,
  );
  assert.throws(() => normalizeLyrics({ text: "a".repeat(80001) }), /too long/);
});

test("Lyrics relay submits a canonical video URL and returns only transcript fields", async () => {
  const { createHandler } =
    await import("../supabase/functions/guitar-youtube/handler.mjs");
  const calls = [];
  const handler = createHandler({
    env,
    fetcher: async (url, options) => {
      calls.push({ url, options });
      if (url.includes("campus_is_owner")) return Response.json(true);
      if (url.endsWith("/transcribe/url"))
        return Response.json({
          job_id: "lyrics_job_123",
          status: "processing",
        });
      return Response.json({
        segments: [
          {
            text: "Morning light",
            words: [
              { word: "Morning", start: 0, end: 1, internal: "private" },
              { word: "light", start: 1, end: 2 },
            ],
          },
        ],
        audio_url: "/private/file",
        model_path: "/private/model",
      });
    },
  });
  assert.equal(
    (await handler(req({ action: "lyrics-submit", videoId: "2Vv-BfVoq4g" })))
      .status,
    200,
  );
  assert(calls[1].url.endsWith("/transcribe/url"));
  assert.equal(
    JSON.parse(calls[1].options.body).url,
    "https://www.youtube.com/watch?v=2Vv-BfVoq4g",
  );
  const response = await handler(
    req({ action: "lyrics-result", jobId: "lyrics_job_123" }),
  );
  const data = await response.json();
  assert.equal(data.text, "Morning light");
  assert.deepEqual(data.words[0], { word: "Morning", start: 0, end: 1 });
  assert.equal(data.audio_url, undefined);
  assert.equal(data.model_path, undefined);
  assert.equal(
    (
      await handler(
        req({ action: "lyrics-submit", videoId: "https://127.0.0.1" }),
      )
    ).status,
    400,
  );
});
