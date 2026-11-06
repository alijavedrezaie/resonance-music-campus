/* Normalization and cancellable YouTube analysis, shared with tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GuitarService = api;
})(globalThis, () => {
  const ROOTS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function videoId(value) {
    try {
      const url = new URL(value.trim());
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        return null;
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      let id;
      if (host === "youtu.be") id = url.pathname.split("/")[1];
      else if (
        ["youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)
      )
        id =
          url.searchParams.get("v") ||
          url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1];
      return /^[\w-]{11}$/.test(id || "") ? id : null;
    } catch {
      return null;
    }
  }
  function parseChord(label) {
    if (typeof label !== "string" || label.length > 40) return null;
    const m = label
      .replace(/♯/g, "#")
      .replace(/♭/g, "b")
      .match(/^([A-G])([#b]?)([^/]*)(?:\/([A-G])([#b]?))?$/);
    if (!m) return null;
    const pitch = (note, accidental) =>
      (ROOTS[note] +
        (accidental === "#" ? 1 : accidental === "b" ? -1 : 0) +
        12) %
      12;
    const quality = m[3]
      .replace(/^:/, "")
      .replace(/^min/, "m")
      .replace(/^maj(?=$)/, "");
    if (!/^[A-Za-z0-9+#()°ø-]*$/.test(quality)) return null;
    return {
      root: pitch(m[1], m[2]),
      quality,
      minor: /^m(?!aj)/.test(quality),
      ...(m[4] ? { bass: pitch(m[4], m[5]) } : {}),
    };
  }
  function normalize(data) {
    if (!data || !Array.isArray(data.segments))
      throw Error(
        "The service returned no chord timeline. Please try another video.",
      );
    const chords = [];
    for (const segment of data.segments.slice(0, 2000)) {
      const c = parseChord(segment.label);
      if (
        !c ||
        !Number.isFinite(segment.start) ||
        !Number.isFinite(segment.end) ||
        segment.start < 0 ||
        segment.end <= segment.start
      )
        continue;
      chords.push({ ...c, start: segment.start, end: segment.end });
    }
    chords.sort((a, b) => a.start - b.start);
    if (!chords.length)
      throw Error(
        "No clear chords were found in this video. Try a different recording.",
      );
    const tempo =
      Number.isFinite(data.tempo) && data.tempo >= 20 && data.tempo <= 300
        ? Math.round(data.tempo)
        : null;
    return {
      chords,
      tempo,
      key: typeof data.key === "string" ? data.key.slice(0, 30) : "",
      meter: /^\d{1,2}\/\d{1,2}$/.test(data.time_signature || "")
        ? data.time_signature
        : "",
      poweredBy: "Magic Chords",
    };
  }
  function normalizeLyrics(data) {
    const words = (Array.isArray(data?.words) ? data.words : [])
      .slice(0, 10000)
      .filter(
        (word) => word && typeof word.word === "string" && word.word.trim(),
      )
      .map((word) => ({
        word: word.word.trim().slice(0, 200),
        start: word.start,
        end: word.end,
      }));
    let text = typeof data?.text === "string" ? data.text.trim() : "";
    if (!text) text = words.map((word) => word.word).join(" ");
    if (!text)
      throw Error(
        "No lyrics were detected. The video may be instrumental or the vocals may be unclear. You can still paste lyrics manually.",
      );
    if (text.length > 80000)
      throw Error(
        "The transcript is too long for one song sheet. Try a shorter video.",
      );
    return { text, words };
  }
  const transcribe = (id, options) => analyze(id, { ...options, lyrics: true });
  function wait(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted)
        return reject(new DOMException("Cancelled", "AbortError"));
      const abort = () => {
        clearTimeout(timer);
        reject(new DOMException("Cancelled", "AbortError"));
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", abort);
        resolve();
      }, ms);
      signal?.addEventListener("abort", abort, { once: true });
    });
  }
  async function analyze(
    id,
    {
      request,
      signal,
      onStatus = () => {},
      delay = wait,
      now = () => Date.now(),
      lyrics = false,
    },
  ) {
    const check = () => {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    };
    check();
    onStatus(
      lyrics
        ? "Sending the video for lyrics transcription…"
        : "Sending the YouTube link for analysis…",
    );
    const job = await request("/api/guitar-youtube", "POST", {
      action: lyrics ? "lyrics-submit" : "submit",
      videoId: id,
    });
    check();
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(job.job_id || ""))
      throw Error(job.message || "Could not start the analysis. Please retry.");
    const started = now();
    let status = job.status;
    while (!["complete", "completed", "done", "success"].includes(status)) {
      check();
      if (["error", "failed", "cancelled"].includes(status))
        throw Error(
          "This video could not be accessed or analyzed. Try another public YouTube video.",
        );
      if (now() - started > 10 * 60 * 1000)
        throw Error("Analysis is taking too long. Please try again later.");
      onStatus(
        lyrics
          ? "Listening for lyrics… This can take a few minutes."
          : "Finding the chords and tempo… This can take a few minutes.",
      );
      await delay(5000, signal);
      check();
      const progress = await request("/api/guitar-youtube", "POST", {
        action: "status",
        jobId: job.job_id,
      });
      check();
      status = progress.status;
    }
    onStatus(lyrics ? "Preparing your lyrics…" : "Preparing your chord chart…");
    const data = await request("/api/guitar-youtube", "POST", {
      action: lyrics ? "lyrics-result" : "result",
      jobId: job.job_id,
    });
    check();
    return lyrics ? normalizeLyrics(data) : normalize(data);
  }
  return {
    videoId,
    parseChord,
    normalize,
    normalizeLyrics,
    analyze,
    transcribe,
  };
});
