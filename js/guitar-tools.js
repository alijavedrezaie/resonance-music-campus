/* Guitar tools share the campus shell and private Songbook persistence. */
const GuitarTools = (() => {
  let cleanup = null,
    session = null;
  const template =
    '<div class="strum-tool"><div class="strum-links"><a href="#studio">← Campus songbook</a><button id="helpBtn" type="button">How this tool works ↗</button></div><section class="hero"><div class="eyebrow">— FROM YOUR FAVORITE SONG TO YOUR FRETBOARD</div><h1>Hear it. Find it. <em>Play it.</em></h1><p>Paste a YouTube song link to find its chords and tempo.<br>Then practice with chord shapes and a suggested strumming pattern.</p><div class="doodle" aria-hidden="true">♫<span>less scrolling,<br>more strumming.</span>⤵</div></section>\n<section class="import-panel"><form id="urlForm"><span class="youtube">▶</span><input id="youtubeUrl" type="url" placeholder="Paste a YouTube song link here…" aria-label="YouTube song URL" required><button id="submitAnalysisBtn" class="primary">Analyse chords <span>↗</span></button></form><div class="caption"><span>Your link is sent to Magic Chords for analysis.</span><button id="demoBtn">Just exploring? Try a practice track →</button></div><p id="urlStatus" class="status" role="status"></p></section>\n<div class="workspace-heading" id="workspace"><div><span class="eyebrow">YOUR PRACTICE SPACE</span><h2>A good place to get lost in music.</h2></div><span class="badge" id="modeBadge"><i></i>PRACTICE DEMO</span></div>\n<section class="workspace"><aside class="song-panel"><div class="cover" id="cover"><div class="vinyl"><span>s.</span></div><small>THE ACOUSTIC SESSIONS / 001</small><div class="cover-type">Sunday<br><em>kind of slow.</em></div><div class="cover-bottom">AN ORIGINAL PRACTICE LOOP <span>↗</span></div></div><div id="videoWrap" hidden></div><div class="song-title"><div><h3 id="songTitle">Sunday kind of slow</h3><p id="songArtist">Strum Studio · original exercise</p></div><button class="icon-button" id="saveBtn" aria-label="Save chart to campus songbook">♡</button></div><div class="tags"><span id="difficulty">Beginner friendly</span><span>Guitar practice</span></div><button id="analyseBtn" class="primary" type="button">Analyse chords</button><p id="songAnalysisStatus" class="status" role="status"></p><div class="stats"><div><small>KEY / SHAPES</small><strong id="keyDisplay">G major</strong></div><div><small>TEMPO</small><strong><span id="tempoDisplay">84</span> <small>BPM</small></strong></div><div><small>TIME</small><strong id="meterDisplay">4/4</strong></div></div><details class="audio-input"><summary>Or analyze an audio file</summary><p>Optional: choose a file for experimental analysis on your device.</p><label class="upload">＋ Choose audio file<input type="file" id="audioFile" accept="audio/*"></label><small id="analysisStatus" role="status">MP3, WAV, M4A · up to 30 MB</small><audio id="audioPlayer" controls hidden></audio></details><div class="tip"><span>✳</span><p><b>Make it your own.</b><br>Start slow. Keep your strumming hand moving, even between chords.</p></div></aside>\n<div class="practice-main"><div class="tabbar" role="tablist" aria-label="Practice views"><button class="selected" id="chordsTab" role="tab" aria-selected="true" aria-controls="chordsView">Chords & rhythm</button><button id="structureTab" role="tab" aria-selected="false" aria-controls="structureView">Song timeline</button><button id="lyricsTab" role="tab" aria-selected="false" aria-controls="lyricsView">Lyrics & chords</button><button id="exportBtn" class="export">↓ Export</button></div><div id="chordsView" role="tabpanel" aria-labelledby="chordsTab"><section class="chord-section"><div class="section-top"><div><span class="step">01</span><h3>Meet your chords</h3><span class="muted subtitle" id="chordCount">4 shapes. Endless possibilities.</span></div><div class="transpose"><span>Transpose</span><button id="transposeDown" aria-label="Transpose down">−</button><b id="transposeValue">0</b><button id="transposeUp" aria-label="Transpose up">＋</button></div></div><section id="analysisPanel" class="analysis-panel" aria-label="Song analysis" hidden><div class="analysis-heading"><strong id="analysisHeading"></strong><button id="cancelAnalysisBtn" type="button" hidden>Cancel</button></div><p id="chartAnalysisStatus" role="status" aria-live="polite"></p><progress id="analysisProgress" aria-label="Analyzing song" hidden></progress><small id="analysisElapsed"></small></section><div id="chordGrid" class="chord-grid"></div><div class="chord-foot"><span>● Numbers are your fretting fingers</span><span>○ Open string &nbsp; × Muted string</span></div></section><section class="progression"><div class="section-top"><div><span class="step">02</span><h3>Find the flow</h3></div><span class="eyebrow" id="progressionLabel">REPEAT THE LOOP ↻</span></div><div id="progressionGrid" class="progression-grid"></div></section><section class="rhythm"><div class="section-top"><div><span class="step">03</span><h3>Get into the groove</h3></div><select id="patternSelect" aria-label="Strumming pattern"><option value="folk">Easy folk</option><option value="straight">Steady eighths</option><option value="simple">Downstroke basics</option></select></div><p class="rhythm-description">A suggested pattern to make this progression feel at home.</p><div class="strum-grid" id="strumGrid"></div><div class="rhythm-bottom"><span><b>↓</b> Downstroke &nbsp; <b>↑</b> Upstroke <span class="muted">&nbsp; · Ghost / keep moving</span></span><span class="pill" id="trainerMeter">4/4 PRACTICE</span></div></section><section class="transport"><button id="playBtn" class="play-button" aria-label="Start rhythm trainer">▶</button><div class="transport-text"><b id="playText">Let’s play it together</b><span id="playSub">Follow the chords. Feel the rhythm.</span></div><div class="tempo-control"><label for="tempo">TEMPO</label><div><input id="tempo" type="range" min="40" max="180" value="84"><output id="tempoOutput">84</output><small>BPM</small></div></div><button id="soundBtn" class="icon-button" aria-label="Mute metronome" aria-pressed="false">◖))</button></section></div><div id="structureView" role="tabpanel" aria-labelledby="structureTab" hidden><div class="timeline-intro"><span class="eyebrow">THE BIG PICTURE</span><h3>Your chord timeline</h3><p id="timelineNote">An original four-bar practice loop. Each chord lasts one bar.</p></div><div id="timeline"></div></div><div id="lyricsView" role="tabpanel" aria-labelledby="lyricsTab" hidden><section class="lyrics-editor"><h3>Sing and play</h3><form id="lyricsVideoForm" class="lyrics-video-form"><label for="lyricsVideoUrl">YouTube video link</label><input id="lyricsVideoUrl" type="url" placeholder="Paste a YouTube video link" required><button id="generateLyricsBtn" class="primary" type="submit">Generate lyrics from video</button><button id="cancelLyricsBtn" type="button" hidden>Cancel transcription</button></form><p id="lyricsGenerationStatus" role="status" aria-live="polite"></p><progress id="lyricsGenerationProgress" aria-label="Transcribing lyrics" hidden></progress><small id="lyricsGenerationElapsed"></small><div id="generatedLyricsPanel" hidden><label for="generatedLyricsText">Generated lyrics — review before replacing your draft</label><textarea id="generatedLyricsText" rows="6" readonly></textarea><button id="useGeneratedLyricsBtn" type="button">Replace current lyrics with this version</button></div><p>Paste your lyrics and place a chord before the word where it changes: <code>[G]Morning light, [D]take it slow</code>. The sheet displays the chords above your words. Generated lyrics are estimates; review the words and add chord markers where they change.</p><label for="lyricsTitle">Song title</label><input id="lyricsTitle" type="text" maxlength="150"><label for="lyricsInput">Lyrics with chord markers</label><textarea id="lyricsInput" rows="10" maxlength="80000" placeholder="[Verse]&#10;[G]Morning light, [D]take it slow&#10;[Em]Find the notes and [C]let them flow" aria-describedby="lyricsHelp"></textarea><p id="lyricsHelp">Place the cursor in your lyrics, then select a chord below or enter one yourself. Edits stay in this tab until you save to Songbook.</p><div id="lyricsChordPalette" class="lyrics-chord-palette" aria-label="Chords from this chart"></div><div class="lyrics-insert"><label for="lyricsChord">Chord (in the original key)</label><input id="lyricsChord" type="text" maxlength="40" placeholder="G, Am7, D/F#"><button id="insertLyricChord" type="button">Insert chord at cursor</button></div><p id="lyricsStatus" role="status"></p><div class="lyrics-actions"><button id="saveLyricsBtn" class="primary" type="button">Save lyrics & chords to Songbook</button><button id="lyricsTransposeDown" type="button" aria-label="Transpose lyrics down">−</button><span id="lyricsTransposeValue"></span><button id="lyricsTransposeUp" type="button" aria-label="Transpose lyrics up">＋</button></div><h3>Your song sheet</h3><div id="lyricsPreview" class="lyrics-sheet" aria-label="Lyrics with chords above the words"></div></section></div><div class="bottom-note"><span>✧</span><p id="accuracyNote">An original practice exercise. Upload audio for estimated chords.<br>Strumming patterns are suggestions — your ears always get the final say.</p></div></div></section>\n<dialog id="helpDialog"><button class="close" aria-label="Close">×</button><span class="eyebrow">FROM LINK TO PRACTICE</span><h2>Your next song starts here.</h2><ol><li><b>Paste a YouTube link.</b> Select Analyse chords. Magic Chords processes the public video; no audio file or audio link is required.</li><li><b>Review the estimates.</b> Explore the detected chords, key, tempo and timeline. Some videos may be restricted, unavailable or unsupported.</li><li><b>Practice.</b> Transpose the chart, choose a suggested strumming pattern and adjust the metronome. Save your chart to your campus Songbook.</li></ol><p>Analysis is provided by <a href="https://magic-chords.dev/api" target="_blank" rel="noopener noreferrer">Magic Chords</a>, subject to availability and free-use limits. Your YouTube link is sent to that service. Strumming patterns are suggestions, not a transcription of the guitar part. The trainer is independent of video playback. Optional local-file analysis stays on your device.</p></dialog><div id="strumToast" role="status"></div></div>';
  function stop() {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
  }
  function mount(root, saveChart) {
    stop();
    cleanup = initialize(root, saveChart);
  }
  function initialize(root, saveChart) {
    const $ = (id) => root.querySelector("#" + id);
    const within = (selector) => root.querySelectorAll(selector);
    const notes = [
      "C",
      "C♯",
      "D",
      "E♭",
      "E",
      "F",
      "F♯",
      "G",
      "A♭",
      "A",
      "B♭",
      "B",
    ];
    const demo = {
      title: "Sunday kind of slow",
      artist: "Strum Studio · original exercise",
      video: null,
      mode: "demo",
      tempo: 84,
      chords: [
        { root: 7, minor: false, start: 0, end: 2.857 },
        { root: 2, minor: false, start: 2.857, end: 5.714 },
        { root: 4, minor: true, start: 5.714, end: 8.571 },
        { root: 0, minor: false, start: 8.571, end: 11.428 },
      ],
    };
    let song = structuredClone(demo),
      shift = 0,
      selected = 0,
      playing = false,
      timer = null,
      tick = 0,
      muted = false,
      ctx,
      audioUrl,
      worker,
      urlController = null,
      disposed = false,
      lyricsController = null,
      lyricsTimer = null,
      generatedLyrics = null;

    const patterns = {
      folk: ["↓", "·", "↓", "↑", "·", "↑", "↓", "↑"],
      straight: ["↓", "↑", "↓", "↑", "↓", "↑", "↓", "↑"],
      simple: ["↓", "·", "↓", "·", "↓", "·", "↓", "·"],
    };
    const quality = (c) => c.quality ?? (c.minor ? "m" : "");
    const chordName = (c, offset = shift) =>
      notes[(c.root + offset + 120) % 12] +
      quality(c) +
      (Number.isInteger(c.bass)
        ? "/" + notes[(c.bass + offset + 120) % 12]
        : "");
    const trainerBeats = () => (song.meter === "3/4" ? 3 : 4);
    const pattern = () =>
      trainerBeats() === 3
        ? {
            folk: ["↓", "·", "↓", "↑", "↓", "↑"],
            straight: ["↓", "↑", "↓", "↑", "↓", "↑"],
            simple: ["↓", "·", "↓", "·", "↓", "·"],
          }[$("patternSelect").value]
        : patterns[$("patternSelect").value];
    const time = (s) =>
      `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
    function toast(message) {
      $("strumToast").textContent = message;
      $("strumToast").style.display = "block";
      clearTimeout(toast.timer);
      toast.timer = setTimeout(
        () => ($("strumToast").style.display = "none"),
        3000,
      );
    }
    function shapes(c) {
      const n = (c.root + shift + 120) % 12,
        q = quality(c);
      if (Number.isInteger(c.bass)) return null;
      const known = {
        C: [-1, 3, 2, 0, 1, 0],
        D: [-1, -1, 0, 2, 3, 2],
        E: [0, 2, 2, 1, 0, 0],
        G: [3, 2, 0, 0, 0, 3],
        A: [-1, 0, 2, 2, 2, 0],
        Am: [-1, 0, 2, 2, 1, 0],
        Em: [0, 2, 2, 0, 0, 0],
        Dm: [-1, -1, 0, 2, 3, 1],
      };
      const name = notes[n] + q;
      if (known[name]) return known[name];
      const templates = {
        "": [0, 2, 2, 1, 0, 0],
        m: [0, 2, 2, 0, 0, 0],
        7: [0, 2, 0, 1, 0, 0],
        m7: [0, 2, 0, 0, 0, 0],
        maj7: [0, 2, 1, 1, 0, 0],
        sus4: [0, 2, 2, 2, 0, 0],
      };
      if (!templates[q]) return null;
      const fret = (n - 4 + 12) % 12;
      return templates[q].map((f) => f + fret);
    }
    function diagram(c) {
      const shape = shapes(c);
      if (!shape)
        return '<div class="shape-unavailable">No diagram<br>for this voicing</div>';
      const fretted = shape.filter((x) => x > 0),
        min = Math.min(...fretted),
        max = Math.max(...fretted),
        start = max > 4 ? min : 1;
      let svg = `<svg viewBox="0 0 100 112" role="img" aria-label="${chordName(c)} chord, frets ${shape.map((x) => (x < 0 ? "muted" : x === 0 ? "open" : x)).join(", ")} from low E to high E"><g stroke="#c8c0b0" stroke-width="1">`;
      for (let s = 0; s < 6; s++) svg += `<path d="M${20 + s * 12} 24V96"/>`;
      for (let f = 0; f < 5; f++)
        svg += `<path d="M20 ${24 + f * 18}H80" stroke-width="${f === 0 && start === 1 ? 3 : 1}"/>`;
      svg += "</g>";
      if (start > 1)
        svg += `<text x="4" y="38" font-size="9" fill="#8b8372">${start}</text>`;
      let finger = 0;
      for (let s = 0; s < 6; s++) {
        const fret = shape[s],
          x = 20 + s * 12;
        if (fret <= 0)
          svg += `<text x="${x}" y="16" text-anchor="middle" font-size="11" fill="#8b8372">${fret < 0 ? "×" : "○"}</text>`;
        else {
          finger++;
          const label = !["C", "D", "E", "G", "A", "Am", "Em", "Dm"].includes(
            chordName(c),
          )
            ? fret === min
              ? 1
              : fret === min + 1
                ? 2
                : s < 3
                  ? 3
                  : 4
            : {
                C: [0, 3, 2, 0, 1, 0],
                D: [0, 0, 0, 1, 3, 2],
                E: [0, 2, 3, 1, 0, 0],
                G: [2, 1, 0, 0, 0, 3],
                A: [0, 0, 1, 2, 3, 0],
                Am: [0, 0, 2, 3, 1, 0],
                Em: [0, 2, 3, 0, 0, 0],
                Dm: [0, 0, 0, 2, 3, 1],
              }[chordName(c)]?.[s] || 1;
          svg += `<circle cx="${x}" cy="${33 + (fret - start) * 18}" r="6" fill="#646a54"/><text x="${x}" y="${36 + (fret - start) * 18}" text-anchor="middle" fill="white" font-size="9">${label}</text>`;
        }
      }
      svg +=
        ["E", "A", "D", "G", "B", "E"]
          .map(
            (note, i) =>
              `<text x="${20 + i * 12}" y="110" text-anchor="middle" font-size="9" fill="#496174">${note}</text>`,
          )
          .join("") + "</svg>";
      return svg;
    }
    function uniqueChords() {
      return song.chords.filter(
        (c, i, a) =>
          a.findIndex(
            (x) =>
              x.root === c.root &&
              quality(x) === quality(c) &&
              x.bass === c.bass,
          ) === i,
      );
    }
    function render() {
      stop();
      $("analyseBtn").hidden = song.mode !== "youtube";
      $("songTitle").textContent = song.title;
      $("songArtist").textContent = song.artist;
      $("modeBadge").textContent =
        song.mode === "demo"
          ? "● PRACTICE DEMO"
          : song.mode === "audio"
            ? "● ESTIMATED FROM AUDIO"
            : song.chords.length
              ? "● YOUTUBE ANALYZED"
              : "● YOUTUBE LOADED";
      $("difficulty").textContent =
        song.mode === "audio"
          ? "Estimated chords"
          : song.mode === "youtube"
            ? song.chords.length
              ? "Detected chords"
              : "Ready to analyze"
            : "Beginner friendly";
      $("cover").hidden = !!song.video;
      $("videoWrap").hidden = !song.video;
      $("videoWrap").replaceChildren();
      if (song.video) {
        const iframe = document.createElement("iframe");
        iframe.src = `https://www.youtube-nocookie.com/embed/${song.video}`;
        iframe.title = "YouTube song player";
        iframe.referrerPolicy = "strict-origin-when-cross-origin";
        iframe.allow = "encrypted-media; picture-in-picture";
        iframe.allowFullscreen = true;
        $("videoWrap").append(iframe);
      }
      const key = song.key
        ? GuitarService.parseChord(
            song.key.replace(/ major$/, "").replace(/ minor$/, "m"),
          )
        : null;
      $("keyDisplay").textContent =
        song.mode === "demo"
          ? notes[(7 + shift + 120) % 12] + " major"
          : key
            ? chordName(key) + " (est.)"
            : "—";
      $("meterDisplay").textContent = song.meter || "4/4 practice";
      $("tempo").min = Math.min(40, song.tempo);
      $("tempo").max = Math.max(180, song.tempo);
      $("tempo").value = song.tempo;
      updateTempo();
      $("transposeValue").textContent = shift > 0 ? "+" + shift : shift;
      const chords = uniqueChords();
      $("chordCount").textContent = `${chords.length} shapes. Find your sound.`;
      $("chordGrid").innerHTML = chords
        .map(
          (c, i) =>
            `<button class="chord-card ${i === selected ? "selected" : ""}" data-index="${i}" aria-label="Hear ${chordName(c)} chord"><h4>${chordName(c)}</h4>${diagram(c)}<p>${shapes(c) ? (shapes(c).some((x) => x > 4) ? "BARRE SHAPE" : "STANDARD TUNING") : "CHORD LABEL PRESERVED"}</p></button>`,
        )
        .join("");
      if (!chords.length)
        $("chordGrid").innerHTML =
          '<p class="empty-message">No chords yet. Select Analyse chords to start, or try the practice track.</p>';
      $("chordGrid")
        .querySelectorAll("button")
        .forEach(
          (b) =>
            (b.onclick = () => {
              selected = Number(b.dataset.index);
              $("chordGrid")
                .querySelectorAll("button")
                .forEach((x) => x.classList.toggle("selected", x === b));
              playChord(chords[selected]);
            }),
        );
      $("progressionGrid").innerHTML = song.chords
        .slice(0, 12)
        .map(
          (c, i) =>
            `<div class="bar-chord" data-index="${i}">${chordName(c)}<small>${song.mode !== "demo" ? time(c.start) : "• • • •"}</small></div>`,
        )
        .join("");
      $("progressionLabel").textContent =
        song.mode !== "demo"
          ? "FIRST 12 CHANGES · FULL TIMELINE ↗"
          : "REPEAT THE LOOP ↻";
      $("timeline").innerHTML = song.chords
        .map(
          (c) =>
            `<div class="timeline-row"><time>${time(c.start)}</time><b>${chordName(c)}</b><small>${(c.end - c.start).toFixed(1)} sec${c.confidence ? " · " + Math.round(c.confidence * 100) + "% match" : ""}</small></div>`,
        )
        .join("");
      $("timelineNote").textContent =
        song.mode === "audio"
          ? "Estimated chord changes in the first 3 minutes. Match scores describe template similarity, not probability of correctness."
          : song.mode === "demo"
            ? "An original four-bar practice loop. Each chord lasts one bar."
            : "Estimated chord changes from the YouTube video. Blank or unrecognized sections are omitted; check by ear.";
      $("accuracyNote").textContent =
        song.mode === "audio"
          ? "Experimental chord estimates — check by ear. Tempo and strumming are practice suggestions. Transposing changes the chart, not the recording."
          : song.mode === "youtube"
            ? song.chords.length
              ? "YouTube chord, key and tempo estimates by Magic Chords. Strumming is a suggestion. Transposing changes the chart, not the video."
              : "Waiting for YouTube analysis. Some videos may be restricted or unsupported."
            : "An original practice exercise. Paste a YouTube link above to analyze a song. Strumming patterns are suggestions — your ears get the final say.";
      $("playBtn").disabled = !song.chords.length;
      renderPattern();
      renderLyrics();
      updateSaved();
    }
    function renderPattern() {
      $("trainerMeter").textContent = trainerBeats() + "/4 PRACTICE";
      $("strumGrid").style.gridTemplateColumns =
        "repeat(" + trainerBeats() * 2 + ",minmax(0,1fr))";
      $("strumGrid").innerHTML = pattern()
        .map(
          (p, i) =>
            `<div class="strum-cell ${p === "↑" ? "up" : p === "·" ? "ghost" : ""}"><small>${i % 2 ? "&" : i / 2 + 1}</small><b>${p}</b></div>`,
        )
        .join("");
    }
    async function audioContext() {
      if (!ctx) ctx = new AudioContext();
      await ctx.resume();
      return ctx;
    }
    function tone(freq, when, duration = 0.08, volume = 0.1, type = "sine") {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(volume, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + duration);
      o.connect(g).connect(ctx.destination);
      o.start(when);
      o.stop(when + duration);
    }
    async function playChord(c) {
      if (
        !["", "m", "7", "m7", "maj7", "sus4"].includes(quality(c)) ||
        Number.isInteger(c.bass)
      ) {
        toast("Audio preview is unavailable for this voicing.");
        return;
      }
      try {
        await audioContext();
        const root = (c.root + shift + 120) % 12;
        (
          ({
            m: [0, 3, 7, 12],
            m7: [0, 3, 7, 10],
            maj7: [0, 4, 7, 11],
            7: [0, 4, 7, 10],
            sus4: [0, 5, 7, 12],
          })[quality(c)] || [0, c.minor ? 3 : 4, 7, 12]
        ).forEach((n, i) =>
          tone(
            440 * 2 ** ((48 + root + n - 69) / 12),
            ctx.currentTime + i * 0.045,
            1,
            0.07,
            "triangle",
          ),
        );
      } catch {
        toast("Audio is unavailable in this browser.");
      }
    }
    function updateTempo() {
      $("tempoOutput").value = $("tempo").value;
      $("tempoDisplay").textContent = $("tempo").value;
      song.tempo = Number($("tempo").value);
    }
    function stop() {
      playing = false;
      clearTimeout(timer);
      $("playBtn").textContent = "▶";
      $("playBtn").setAttribute("aria-label", "Start rhythm trainer");
      $("playText").textContent = "Let’s play it together";
      within(".current,.playing").forEach((x) =>
        x.classList.remove("current", "playing"),
      );
    }
    function step() {
      if (!playing) return;
      const cells = trainerBeats() * 2,
        cell = tick % cells,
        bar = Math.floor(tick / cells) % song.chords.length;
      within(".strum-cell").forEach((e, i) =>
        e.classList.toggle("current", i === cell),
      );
      within(".bar-chord").forEach((e, i) =>
        e.classList.toggle("playing", i === bar),
      );
      $("playText").textContent =
        `${chordName(song.chords[bar])} · Beat ${Math.floor(cell / 2) + 1}`;
      if (!muted && cell % 2 === 0)
        tone(cell === 0 ? 1000 : 700, ctx.currentTime, 0.05, 0.09);
      tick++;
      timer = setTimeout(step, 30000 / Number($("tempo").value));
    }
    $("playBtn").onclick = async () => {
      if (playing) {
        stop();
        return;
      }
      try {
        await audioContext();
        playing = true;
        tick = 0;
        $("playBtn").textContent = "Ⅱ";
        $("playBtn").setAttribute("aria-label", "Stop rhythm trainer");
        step();
      } catch {
        toast("Audio is unavailable in this browser.");
      }
    };
    $("tempo").oninput = updateTempo;
    $("patternSelect").onchange = renderPattern;
    $("soundBtn").onclick = () => {
      muted = !muted;
      $("soundBtn").textContent = muted ? "◖×" : "◖))";
      $("soundBtn").setAttribute("aria-pressed", String(muted));
      $("soundBtn").setAttribute(
        "aria-label",
        muted ? "Unmute metronome" : "Mute metronome",
      );
    };
    $("transposeUp").onclick = () => {
      shift = shift === 11 ? 0 : shift + 1;
      render();
    };
    $("transposeDown").onclick = () => {
      shift = shift === -11 ? 0 : shift - 1;
      render();
    };
    function setTab(which) {
      for (const name of ["chords", "structure", "lyrics"]) {
        $(name + "Tab").classList.toggle("selected", name === which);
        $(name + "Tab").setAttribute("aria-selected", String(name === which));
        $(name + "View").hidden = name !== which;
      }
    }
    $("chordsTab").onclick = () => setTab("chords");
    $("structureTab").onclick = () => setTab("structure");
    $("lyricsTab").onclick = () => setTab("lyrics");
    within("[role=tab]").forEach(
      (t) =>
        (t.onkeydown = (e) => {
          if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
            e.preventDefault();
            const names = ["chords", "structure", "lyrics"];
            const index = names.indexOf(t.id.replace("Tab", ""));
            const next =
              names[(index + (e.key === "ArrowRight" ? 1 : 2)) % names.length];
            setTab(next);
            $(next + "Tab").focus();
          }
        }),
    );
    let analysisTimer = null;
    let analysisStarted = 0;
    function analysisPanel(state, heading, message) {
      clearTimeout(analysisTimer);
      $("analysisPanel").hidden = state === "idle";
      $("analysisPanel").setAttribute("data-state", state);
      $("analysisHeading").textContent = heading;
      $("analysisProgress").hidden = state !== "loading";
      $("cancelAnalysisBtn").hidden = state !== "loading";
      $("chordGrid").setAttribute("aria-busy", String(state === "loading"));
      analysisStatus(message);
      if (state === "loading") {
        analysisStarted = Date.now();
        const elapsed = () => {
          $("analysisElapsed").textContent =
            `Elapsed ${time((Date.now() - analysisStarted) / 1000)} · This can take a few minutes. No completion percentage is available.`;
          analysisTimer = setTimeout(elapsed, 1000);
        };
        elapsed();
      } else {
        $("analysisElapsed").textContent = "";
      }
    }
    function analysisStatus(message) {
      $("urlStatus").textContent = message;
      $("songAnalysisStatus").textContent = message;
      $("chartAnalysisStatus").textContent = message;
    }
    function analysisBusy(value) {
      $("analyseBtn").disabled = value;
      $("submitAnalysisBtn").disabled = value;
      $("generateLyricsBtn").disabled = value;
      $("analyseBtn").textContent = value ? "Analysing…" : "Analyse chords";
      $("submitAnalysisBtn").textContent = value
        ? "Analysing…"
        : "Analyse chords ↗";
      if (value) {
        $("difficulty").textContent = "Analysing song";
        $("modeBadge").textContent = "● ANALYSING YOUTUBE";
      }
    }
    $("cancelAnalysisBtn").onclick = () => {
      cancelAnalysis();
      analysisPanel(
        "cancelled",
        "Analysis cancelled",
        "Select Analyse chords to try again, or choose the practice track.",
      );
      $("difficulty").textContent = "Analysis cancelled";
      $("modeBadge").textContent = "● ANALYSIS CANCELLED";
    };
    $("analyseBtn").onclick = () => {
      if (!$("youtubeUrl").value && song.video)
        $("youtubeUrl").value = "https://www.youtube.com/watch?v=" + song.video;
      return $("urlForm").onsubmit({ preventDefault() {} });
    };
    $("urlForm").onsubmit = async (e) => {
      e.preventDefault();
      if (urlController || lyricsController) return;
      const id = GuitarService.videoId($("youtubeUrl").value);
      if (!id) {
        analysisStatus("Please paste a valid YouTube video link.");
        return;
      }
      cancelAnalysis();
      urlController = new AbortController();
      const controller = urlController;
      song = {
        lyrics: song.video === id ? song.lyrics : "",
        title: "YouTube song · " + id,
        artist: "YouTube · analysis by Magic Chords",
        video: id,
        mode: "youtube",
        tempo: 84,
        chords: [],
      };
      shift = 0;
      selected = 0;
      $("audioPlayer").pause();
      $("audioPlayer").hidden = true;
      render();
      $("urlForm").setAttribute("aria-busy", "true");
      analysisBusy(true);
      analysisPanel(
        "loading",
        "Finding your chords…",
        "Connecting to the analysis service…",
      );
      $("workspace").scrollIntoView({
        behavior:
          document.documentElement.dataset.motion === "reduce"
            ? "auto"
            : "smooth",
        block: "start",
      });
      try {
        const result = await GuitarService.analyze(id, {
          request: (...args) => CampusBackend.request(...args),
          signal: controller.signal,
          onStatus: (message) => {
            if (!disposed && !controller.signal.aborted)
              analysisStatus(message);
          },
        });
        if (disposed || controller.signal.aborted) return;
        song = {
          ...song,
          ...result,
          tempo: result.tempo || 84,
          detectedTempo: result.tempo,
        };
        $("tempo").min = Math.min(40, song.tempo);
        $("tempo").max = Math.max(180, song.tempo);
        render();
        analysisPanel(
          "success",
          "Your chords are ready",
          "Your YouTube chord chart is ready. Strumming patterns below are suggestions.",
        );
        toast("Chords found — ready to practice.");
      } catch (error) {
        if (!disposed && !controller.signal.aborted) {
          const limited = error.status === 429;
          analysisPanel(
            "error",
            limited ? "Analysis service is busy" : "Could not find chords",
            limited
              ? "The analysis service has reached its request limit. No chords were returned. Please wait before trying again, or choose an audio file for analysis on your device."
              : error.message || "Analysis could not finish. Try again later.",
          );
          $("difficulty").textContent = limited
            ? "Service request limit"
            : "Analysis unavailable";
          $("modeBadge").textContent = "● ANALYSIS FAILED";
          $("accuracyNote").textContent =
            "No chord chart was returned. See the analysis message above for what to do next.";
        }
      } finally {
        if (!disposed && urlController === controller) {
          $("urlForm").removeAttribute("aria-busy");
          urlController = null;
          analysisBusy(false);
        }
      }
    };
    function cancelAnalysis() {
      cancelLyrics();
      analysisBusy(false);
      analysisPanel("idle", "", "");
      urlController?.abort();
      urlController = null;
      $("urlForm").removeAttribute("aria-busy");
      $("audioFile").generation = Symbol();
      if (worker) {
        worker.terminate();
        worker = null;
      }
      $("audioFile").value = "";
    }
    $("demoBtn").onclick = () => {
      cancelAnalysis();
      song = structuredClone(demo);
      shift = 0;
      selected = 0;
      $("urlStatus").textContent = "";
      $("audioPlayer").hidden = true;
      $("analysisStatus").textContent = "MP3, WAV, M4A · up to 30 MB";
      render();
      toast("Original practice track loaded");
    };
    $("audioFile").onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      cancelAnalysis();
      if (file.size > 30 * 1024 * 1024) {
        $("analysisStatus").textContent =
          "Please choose an audio file smaller than 30 MB.";
        return;
      }
      if (worker) worker.terminate();
      const generation = Symbol();
      $("audioFile").generation = generation;
      stop();
      $("analysisStatus").textContent = "Decoding audio…";
      try {
        await audioContext();
        const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
        if ($("audioFile").generation !== generation) return;
        const length = Math.min(
          buffer.length,
          Math.ceil(buffer.sampleRate * 180),
        );
        const mono = new Float32Array(length);
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
          const data = buffer.getChannelData(ch);
          for (let i = 0; i < length; i++)
            mono[i] += data[i] / buffer.numberOfChannels;
        }
        if (length < buffer.sampleRate) {
          throw new Error("Please choose at least one second of audio.");
        }
        worker = new Worker(new URL("js/guitar-analysis.js", document.baseURI));
        $("analysisStatus").textContent = "Listening for chord changes…";
        worker.onmessage = (ev) => {
          if ($("audioFile").generation !== generation) return;
          if (ev.data.error) {
            $("analysisStatus").textContent = ev.data.error;
            worker.terminate();
            worker = null;
            return;
          }
          if (ev.data.progress) {
            $("analysisStatus").textContent =
              `Estimating chords… ${ev.data.progress}%`;
            return;
          }
          const chords = ev.data.chords;
          worker.terminate();
          worker = null;
          if (!chords.length) {
            $("analysisStatus").textContent =
              "No clear pitched audio found. Try a clearer recording.";
            return;
          }
          song = {
            lyrics: song.lyrics,
            title: file.name.replace(/\.[^.]+$/, ""),
            artist: "Your audio · local analysis",
            video: song.video,
            mode: "audio",
            tempo: Number($("tempo").value),
            chords,
          };
          shift = 0;
          selected = 0;
          if (audioUrl) URL.revokeObjectURL(audioUrl);
          audioUrl = URL.createObjectURL(file);
          $("audioPlayer").src = audioUrl;
          $("audioPlayer").hidden = false;
          render();
          $("analysisStatus").textContent =
            `${chords.length} estimated changes · ${time(length / buffer.sampleRate)} analyzed. Check by ear.`;
          toast("Your chord estimates are ready");
        };
        worker.onerror = () => {
          $("analysisStatus").textContent =
            "Analysis could not finish. Try a smaller MP3 or WAV file.";
          worker?.terminate();
          worker = null;
        };
        worker.postMessage({ pcm: mono, sampleRate: buffer.sampleRate }, [
          mono.buffer,
        ]);
      } catch (error) {
        $("analysisStatus").textContent = error.message.startsWith("Please")
          ? error.message
          : "Could not decode this audio. Try an MP3 or WAV file.";
      }
    };
    function cancelLyrics() {
      lyricsController?.abort();
      lyricsController = null;
      clearTimeout(lyricsTimer);
      $("lyricsGenerationProgress").hidden = true;
      $("cancelLyricsBtn").hidden = true;
      $("lyricsGenerationElapsed").textContent = "";
      $("lyricsVideoForm").removeAttribute("aria-busy");
      $("generateLyricsBtn").disabled = false;
      $("generateLyricsBtn").textContent = "Generate lyrics from video";
      $("analyseBtn").disabled = false;
      $("submitAnalysisBtn").disabled = false;
    }
    function applyGeneratedLyrics() {
      if (!generatedLyrics) return;
      const { id, text } = generatedLyrics;
      if (song.video !== id) {
        song = {
          title: "YouTube song · " + id,
          artist: "YouTube · lyrics by Magic Chords",
          video: id,
          mode: "youtube",
          tempo: 84,
          chords: [],
        };
        shift = 0;
        selected = 0;
      }
      song.lyrics = text;
      $("generatedLyricsPanel").hidden = true;
      generatedLyrics = null;
      render();
      $("lyricsStatus").textContent =
        "Generated lyrics added. Review the words, add chords, then save to Songbook.";
    }
    $("useGeneratedLyricsBtn").onclick = applyGeneratedLyrics;
    $("cancelLyricsBtn").onclick = () => {
      cancelLyrics();
      $("lyricsGenerationStatus").textContent =
        "Lyrics transcription cancelled. Your draft is unchanged.";
    };
    $("lyricsVideoForm").onsubmit = async (event) => {
      event.preventDefault();
      if (lyricsController || urlController) return;
      const value =
        $("lyricsVideoUrl").value ||
        $("youtubeUrl").value ||
        (song.video ? "https://youtu.be/" + song.video : "");
      const id = GuitarService.videoId(value);
      if (!id) {
        $("lyricsGenerationStatus").textContent =
          "Paste a valid YouTube video link.";
        return;
      }
      generatedLyrics = null;
      $("generatedLyricsPanel").hidden = true;
      lyricsController = new AbortController();
      const controller = lyricsController;
      $("lyricsVideoForm").setAttribute("aria-busy", "true");
      $("generateLyricsBtn").disabled = true;
      $("generateLyricsBtn").textContent = "Generating lyrics…";
      $("analyseBtn").disabled = true;
      $("submitAnalysisBtn").disabled = true;
      $("lyricsGenerationProgress").hidden = false;
      $("cancelLyricsBtn").hidden = false;
      const started = Date.now();
      const elapsed = () => {
        $("lyricsGenerationElapsed").textContent =
          `Elapsed ${time((Date.now() - started) / 1000)} · Transcription can take a few minutes.`;
        lyricsTimer = setTimeout(elapsed, 1000);
      };
      elapsed();
      try {
        const result = await GuitarService.transcribe(id, {
          request: (...args) => CampusBackend.request(...args),
          signal: controller.signal,
          onStatus: (message) => {
            if (!disposed && !controller.signal.aborted)
              $("lyricsGenerationStatus").textContent = message;
          },
        });
        if (disposed || controller.signal.aborted) return;
        generatedLyrics = { id, text: result.text };
        if (!song.lyrics?.trim()) {
          applyGeneratedLyrics();
          $("lyricsGenerationStatus").textContent =
            "Lyrics generated. Review the transcription below before saving.";
        } else {
          $("generatedLyricsText").value = result.text;
          $("generatedLyricsPanel").hidden = false;
          $("lyricsGenerationStatus").textContent =
            "Lyrics generated. Your existing draft is unchanged. Review the new version before replacing it.";
        }
      } catch (error) {
        if (!disposed && !controller.signal.aborted)
          $("lyricsGenerationStatus").textContent =
            error.status === 429
              ? "The transcription service is busy or its request limit is reached. Wait before trying again, or paste lyrics manually."
              : error.message ||
                "Lyrics could not be generated. Try another public video or paste lyrics manually.";
      } finally {
        if (lyricsController === controller) cancelLyrics();
      }
    };
    function renderLyrics() {
      $("lyricsInput").value = song.lyrics || "";
      if (!$("lyricsVideoUrl").value && song.video)
        $("lyricsVideoUrl").value = "https://youtu.be/" + song.video;
      $("lyricsTitle").value = song.title;
      $("lyricsPreview").innerHTML = LyricsSheet.render(
        song.lyrics || "",
        shift,
      );
      $("lyricsTransposeValue").textContent =
        `Transpose: ${shift > 0 ? "+" : ""}${shift}`;
      $("lyricsChordPalette").innerHTML = uniqueChords()
        .map(
          (c, i) =>
            `<button type="button" data-lyric-chord="${i}">${LyricsSheet.escape(chordName(c))}</button>`,
        )
        .join("");
      $("lyricsChordPalette")
        .querySelectorAll("button")
        .forEach((button) => {
          button.onclick = () =>
            insertChord(
              chordName(uniqueChords()[Number(button.dataset.lyricChord)], 0),
            );
        });
    }
    function insertChord(label) {
      if (!LyricsSheet.chord(label)) {
        $("lyricsStatus").textContent = "Enter a chord such as G, Am7 or D/F#.";
        return;
      }
      const input = $("lyricsInput");
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      const marker = `[${label}]`;
      if (input.value.length - (end - start) + marker.length > 80000) {
        $("lyricsStatus").textContent =
          "This sheet has reached the 80,000 character limit.";
        return;
      }
      input.setRangeText(marker, start, end, "end");
      song.lyrics = input.value;
      $("lyricsPreview").innerHTML = LyricsSheet.render(song.lyrics, shift);
      $("lyricsStatus").textContent =
        "Chord inserted. Save to Songbook when ready.";
      input.focus();
    }
    $("lyricsInput").oninput = () => {
      song.lyrics = $("lyricsInput").value;
      $("lyricsPreview").innerHTML = LyricsSheet.render(song.lyrics, shift);
      $("lyricsStatus").textContent =
        "Unsaved lyrics. Save to Songbook when ready.";
    };
    $("lyricsTitle").oninput = () => {
      song.title = $("lyricsTitle").value;
      $("songTitle").textContent = song.title;
    };
    $("insertLyricChord").onclick = () =>
      insertChord($("lyricsChord").value.trim());
    $("lyricsTransposeUp").onclick = () => $("transposeUp").onclick();
    $("lyricsTransposeDown").onclick = () => $("transposeDown").onclick();
    $("saveLyricsBtn").onclick = () => {
      if (!song.lyrics?.trim()) {
        $("lyricsStatus").textContent =
          "Add some lyrics before saving your song sheet.";
        return;
      }
      if (!song.title.trim()) {
        $("lyricsStatus").textContent = "Add a song title before saving.";
        return;
      }
      const body = chartText();
      if (saveChart({ title: song.title.slice(0, 150), stage: "Idea", body })) {
        $("lyricsStatus").textContent =
          "Added to Songbook. Check the campus save status.";
        toast("Lyrics and chords added to your Songbook.");
      }
    };
    function updateSaved() {
      $("saveBtn").textContent = "♡";
    }
    $("saveBtn").onclick = () => {
      if (!song.chords.length && !song.lyrics?.trim()) {
        toast(
          "Add lyrics, analyze a YouTube link or open the practice demo first.",
        );
        return;
      }
      const body = chartText();
      if (saveChart({ title: song.title.slice(0, 150), stage: "Idea", body }))
        toast("Added to your campus Songbook. Check the campus save status.");
    };
    $("helpBtn").onclick = () => $("helpDialog").showModal();
    within("dialog .close").forEach(
      (b) => (b.onclick = () => b.closest("dialog").close()),
    );
    function chartText() {
      return `${song.title}\n${song.artist}\n${song.mode === "demo" ? "Original exercise" : song.mode === "youtube" ? "YouTube analysis by Magic Chords — estimates, check by ear" : "Experimental chord estimates — check by ear"}\n${song.video ? "YouTube: https://www.youtube.com/watch?v=" + song.video + "\n" : ""}Transpose: ${shift} semitones\nPractice tempo: ${song.tempo} BPM${song.detectedTempo ? " (detected " + song.detectedTempo + " BPM)" : " (not detected)"}\nSuggested strum: ${pattern().join(" ")}\n\n${song.chords.map((c) => `${time(c.start)} — ${chordName(c)}`).join("\n")}\n\nStandard tuning E A D G B E\n${song.lyrics?.trim() ? "\nLyrics & chords\n" + LyricsSheet.transpose(song.lyrics, shift) + "\n" : ""}`;
    }
    $("exportBtn").onclick = () => {
      if (!song.chords.length && !song.lyrics?.trim()) {
        toast(
          "Add lyrics, analyze a YouTube link or open the practice demo first.",
        );
        return;
      }
      const text = chartText();
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = song.title.replace(/[^\w -]/g, "") + "-chords.txt";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    const visibility = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", visibility);
    if (session) {
      song = structuredClone(session.song);
      shift = session.shift;
      $("patternSelect").value = session.pattern;
      if (song.mode === "audio")
        $("analysisStatus").textContent =
          "Chart restored. Re-upload audio for recording playback.";
    }
    render();
    if (song.mode === "youtube" && !song.chords.length)
      analysisPanel(
        "cancelled",
        "No analysis is running",
        "Select Analyse chords to start again. The video player does not analyze the song.",
      );
    return () => {
      disposed = true;
      session = {
        song: structuredClone(song),
        shift,
        pattern: $("patternSelect").value,
      };
      stop();
      cancelAnalysis();
      $("audioPlayer").pause();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      clearTimeout(toast.timer);
      if (ctx) void ctx.close();
      document.removeEventListener("visibilitychange", visibility);
    };
  }
  return { render: () => template, mount, stop };
})();
