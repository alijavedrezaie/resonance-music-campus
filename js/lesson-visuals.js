/* Topic-aware teaching visuals and short, user-initiated Web Audio examples. */
const LessonLab = (() => {
  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const pitchClasses = [
    "C",
    "C♯/D♭",
    "D",
    "D♯/E♭",
    "E",
    "F",
    "F♯/G♭",
    "G",
    "G♯/A♭",
    "A",
    "A♯/B♭",
    "B",
  ];
  const noteName = (n, row) => {
    let pitch = pitchClasses[n % 12];
    if (row && pitch.includes("/")) {
      const context = row[2].flat().join(" ") + " " + row[4];
      const names = pitch.split("/");
      pitch = names.find((name) => context.includes(name)) || names[0];
    }
    return `${pitch}${Math.floor(n / 12) - 1}`;
  };
  const events = (row) =>
    row[3]
      ? row[3]
          .split("|")
          .map((group) => (group === "-" ? [] : group.split(" ").map(Number)))
      : [];
  const rowFor = (root) => LESSON_VISUALS[Number(root.dataset.lessonLab)];
  let audio,
    sources = new Set(),
    timers = [],
    generation = 0,
    playingRoot;
  const svg = (body, title, description, width = 720, height = 230) =>
    `<svg class="teaching-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(title + ". " + description)}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

  function piano(row) {
    const notes = [...new Set(events(row).flat())];
    const first = Math.floor(Math.min(...notes) / 12) * 12;
    const last = Math.max(
      first + 12,
      Math.floor(Math.max(...notes) / 12) * 12 + 12,
    );
    const white = [],
      black = [];
    for (let n = first; n <= last; n++)
      ([1, 3, 6, 8, 10].includes(n % 12) ? black : white).push(n);
    const w = 660 / white.length,
      x = (n) => 28 + white.filter((v) => v < n).length * w;
    const shapes =
      white
        .map(
          (n) =>
            `<rect x="${x(n)}" y="20" width="${w - 1}" height="133" rx="3" data-piano-note="${n}" class="piano-white ${notes.includes(n) ? "selected" : ""}"/><text x="${x(n) + w / 2}" y="178" text-anchor="middle" class="key-caption">${escape(noteName(n))}</text>`,
        )
        .join("") +
      black
        .map(
          (n) =>
            `<rect x="${x(n) - w * 0.3}" y="20" width="${w * 0.6}" height="82" rx="3" data-piano-note="${n}" class="piano-black ${notes.includes(n) ? "selected" : ""}"/>${notes.includes(n) ? `<text x="${x(n)}" y="88" text-anchor="middle" class="black-key-caption">${escape(noteName(n, row).replace(/\d+$/, ""))}</text>` : ""}`,
        )
        .join("");
    return svg(
      shapes +
        `<text x="28" y="213" class="diagram-label">Teal keys = notes used in this example. C4 = middle C.</text>`,
      row[0],
      `Highlighted pitches: ${notes.map((n) => noteName(n, row)).join(", ")}.`,
      720,
      235,
    );
  }
  function fretboard(row) {
    const pcs = [
      ...new Set(
        events(row)
          .flat()
          .map((n) => n % 12),
      ),
    ];
    const open = [64, 59, 55, 50, 45, 40],
      names = ["e · high", "B", "G", "D", "A", "E · low"];
    let body = "";
    for (let f = 0; f <= 12; f++) {
      const x = 84 + f * 46;
      body += `<text x="${x}" y="26" text-anchor="middle" class="key-caption">${f === 0 ? "open" : f}</text>`;
      if (f < 12)
        body += `<line x1="${x + 23}" y1="41" x2="${x + 23}" y2="214" class="fret-line"/>`;
    }
    open.forEach((m, s) => {
      const y = 52 + s * 30;
      body += `<text x="8" y="${y + 4}" class="key-caption">${names[s]}</text><line x1="64" y1="${y}" x2="659" y2="${y}" class="guitar-string" style="stroke-width:${1 + s * 0.25}"/>`;
      for (let f = 0; f <= 12; f++)
        if (pcs.includes((m + f) % 12))
          body += `<circle cx="${84 + f * 46}" cy="${y}" r="12" class="fret-note"/><text x="${84 + f * 46}" y="${y + 4}" text-anchor="middle" class="fret-caption">${escape(noteName(m + f, row).replace(/\d+$/, ""))}</text>`;
    });
    return svg(
      body,
      row[0] + " on guitar",
      "Standard tuning E A D G B E, low to high. Highlighted note positions through fret 12. This is a pitch map, not a suggested chord fingering.",
      720,
      230,
    );
  }
  function steps(row) {
    return `<ol class="visual-steps ${["rhythm", "swing"].includes(row[1]) ? "beat-grid" : ""}">${row[2].map(([label, detail], i) => `<li data-event-index="${i}"><span class="step-index">${String(i + 1).padStart(2, "0")}</span><strong>${escape(label)}</strong><span>${escape(detail)}</span>${row[1] === "rhythm" && events(row)[i]?.length === 0 ? '<span class="rest-symbol" aria-label="Rest">—</span>' : ""}</li>`).join("")}</ol>`;
  }
  function range(name, label, min, max, value, step = 1) {
    return `<label class="lab-range">${label}<input type="range" data-lab-control="${name}" min="${min}" max="${max}" step="${step}" value="${value}"><output>${value}</output></label>`;
  }
  function plot(root) {
    const row = rowFor(root),
      kind = row[1],
      val = (name, fallback) =>
        Number(
          root.querySelector(`[data-lab-control="${name}"]`)?.value ?? fallback,
        );
    let body = "",
      caption = "";
    const line = (x1, y1, x2, y2, cls = "graph-grid") =>
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}"/>`;
    const text = (x, y, t, anchor = "start") =>
      `<text x="${x}" y="${y}" text-anchor="${anchor}" class="diagram-label">${escape(t)}</text>`;
    if (kind === "eq") {
      const frequency = val("frequency", 1000),
        gain = val("gain", 0),
        logMin = Math.log10(20),
        logMax = Math.log10(20000);
      [-12, -6, 0, 6, 12].forEach((db) => {
        const y = 110 - db * 5;
        body +=
          line(55, y, 675, y) + text(8, y + 4, `${db > 0 ? "+" : ""}${db} dB`);
      });
      [20, 100, 1000, 10000, 20000].forEach((hz) => {
        const x = 55 + ((Math.log10(hz) - logMin) / (logMax - logMin)) * 620;
        body +=
          line(x, 50, x, 170) +
          text(x, 196, hz >= 1000 ? `${hz / 1000}k` : hz, "middle");
      });
      const points = Array.from({ length: 151 }, (_, i) => {
        const x = 55 + (i / 150) * 620,
          logHz = logMin + (i / 150) * (logMax - logMin),
          db =
            gain *
            Math.exp(-0.5 * ((logHz - Math.log10(frequency)) / 0.3) ** 2);
        return `${x},${110 - db * 5}`;
      }).join(" ");
      body +=
        `<polyline points="${points}" class="graph-curve"/>` +
        text(365, 225, "Frequency (Hz) · logarithmic spacing", "middle");
      caption = `Illustrative EQ curve: ${gain > 0 ? "+" : ""}${gain} dB at ${frequency} Hz. ${gain === 0 ? "Flat: no boost or cut." : gain > 0 ? "Boost: selected region is raised." : "Cut: selected region is lowered."} This visual does not process audio.`;
    } else if (kind === "compression") {
      const threshold = val("threshold", -18),
        ratio = val("ratio", 4),
        x = (db) => 65 + ((db + 36) / 36) * 570,
        y = (db) => 190 - ((db + 36) / 36) * 150;
      [-36, -24, -12, 0].forEach((db) => {
        body +=
          line(x(db), 40, x(db), 190) +
          line(65, y(db), 635, y(db)) +
          text(x(db), 210, db, "middle") +
          text(18, y(db) + 4, db);
      });
      const out = (input) =>
        input <= threshold ? input : threshold + (input - threshold) / ratio;
      body +=
        line(65, 190, 635, 40, "graph-reference") +
        `<polyline points="${Array.from({ length: 37 }, (_, i) => `${x(i - 36)},${y(out(i - 36))}`).join(" ")}" class="graph-curve"/>` +
        line(x(threshold), 190, x(threshold), y(threshold), "graph-threshold") +
        `<circle cx="${x(-10)}" cy="${y(out(-10))}" r="6" class="graph-dot"/>` +
        text(
          350,
          237,
          "Input level (dB) →   ·   vertical axis: output (dB)",
          "middle",
        );
      caption = `Threshold ${threshold} dB, ratio ${ratio}:1. For −10 dB input, output is ${out(-10).toFixed(1)} dB. Static hard-knee model; no attack, release or makeup gain.`;
    } else if (kind === "quantize") {
      const amount = val("quantize", 0) / 100,
        offsets = [18, -22, 26, 8];
      offsets.forEach((offset, i) => {
        const x = 110 + i * 155;
        body +=
          line(x, 35, x, 174, "graph-reference") +
          text(x, 205, `Beat ${i + 1}`, "middle") +
          `<circle cx="${x + offset * (1 - amount)}" cy="105" r="12" class="graph-dot"/>`;
      });
      body += text(
        28,
        25,
        "Grid lines stay fixed; note attacks move toward them.",
      );
      caption = `${Math.round(amount * 100)}% quantization. Visual positions move toward the grid; this model does not edit recorded audio.`;
    } else if (kind === "automation") {
      body += line(65, 190, 650, 190) + line(65, 40, 65, 190);
      const levels = [-12, -9, -6, -9],
        points = levels
          .map((db, i) => `${90 + i * 170},${170 - (db + 15) * 11}`)
          .join(" ");
      body += `<polyline points="${points}" class="graph-curve"/>`;
      levels.forEach(
        (db, i) =>
          (body +=
            `<circle cx="${90 + i * 170}" cy="${170 - (db + 15) * 11}" r="7" class="graph-dot"/>` +
            text(90 + i * 170, 214, `Bar ${i + 1} · ${db} dB`, "middle")),
      );
      body += text(75, 32, "Volume rises toward bar 3, then falls.");
      caption =
        "Volume automation: −12, −9, −6, −9 dB across four illustrative bars.";
    }
    const container = root.querySelector("[data-lab-plot]");
    if (container) container.innerHTML = svg(body, row[0], caption, 720, 255);
    const output = root.querySelector("[data-plot-caption]");
    if (output) output.textContent = caption;
  }
  function widget(row) {
    const kind = row[1];
    if (kind === "keyboard")
      return `<div class="instrument-tabs" role="group" aria-label="Instrument diagram"><button type="button" data-instrument="piano" aria-pressed="true">Piano map</button><button type="button" data-instrument="guitar" aria-pressed="false">Guitar map</button></div><div class="instrument-map" data-instrument-map>${piano(row)}</div><p class="note">Piano labels use octave numbers; C4 is middle C. The guitar map shows pitch classes in standard tuning, not a chord fingering.</p>`;
    if (["eq", "compression", "quantize", "automation"].includes(kind))
      return `<div data-lab-plot class="lab-plot"></div><div class="parameter-controls">${kind === "eq" ? range("frequency", "Frequency (Hz)", 40, 16000, 1000, 10) + range("gain", "Gain (dB)", -12, 12, 0) : kind === "compression" ? range("threshold", "Threshold (dB)", -30, -6, -18) + range("ratio", "Ratio (x:1)", 1, 10, 4, 0.5) : kind === "quantize" ? range("quantize", "Quantize strength (%)", 0, 100, 0) : ""}</div><p class="plot-caption" data-plot-caption></p>`;
    if (kind === "mixer")
      return `<div class="parameter-controls">${range("voice", "Lead tone · E5 (%)", 0, 100, 70) + range("guitar", "Support tone · C4 (%)", 0, 100, 55) + range("bass", "Bass tone · C3 (%)", 0, 100, 45)}</div>`;
    if (kind === "synth")
      return `<div class="parameter-controls"><label class="lab-range">Oscillator waveform<select data-lab-control="wave"><option value="sine">Sine · smooth</option><option value="sawtooth">Sawtooth · bright</option><option value="triangle">Triangle · mellow</option></select></label>${range("cutoff", "Low-pass cutoff (Hz)", 100, 8000, 1500, 50)}</div><p class="note">Settings apply on the next playback. The amplitude envelope has a short attack and a gentle release.</p>`;
    if (kind === "pan")
      return `<div class="pan-stage" aria-hidden="true"><span>LEFT</span><span class="pan-position" data-pan-dot>●</span><span>RIGHT</span></div>${range("pan", "Pan · −100 left / 0 center / +100 right", -100, 100, 0)}<p class="note">Pan changes apply on the next playback. Mono devices will not reproduce a left/right position.</p>`;
    if (kind === "swing")
      return `<label class="lab-range">Eighth-note feel<select data-lab-control="feel"><option value="straight">Straight · 1:1</option><option value="swing">Swing teaching model · 2:1</option></select></label>`;
    return "";
  }
  function render(id) {
    const row = LESSON_VISUALS[id];
    if (!row) return "";
    const sequence = events(row),
      kind = row[1];
    const playable = sequence.length > 0;
    return `<section class="lesson-lab panel" data-lesson-lab="${id}" aria-labelledby="lab-title-${id}"><div class="lab-heading"><span class="eyebrow">SEE IT · UNDERSTAND IT · TRY IT</span><span class="lab-type">${{ keyboard: "Pitch & harmony lab", rhythm: "Rhythm lab", swing: "Rhythm lab", timeline: "Worked example", signal: "Signal flow", lanes: "Compare & connect", eq: "EQ model", compression: "Dynamics model", automation: "Automation lab", quantize: "Timing model", mixer: "Balance lab", synth: "Sound lab", pan: "Stereo lab", delay: "Echo lab" }[kind]}</span></div><h2 id="lab-title-${id}">${escape(row[0])}</h2><div class="visual-workspace">${widget(row)}${steps(row)}</div>${playable ? `<div class="lab-transport"><button type="button" class="button" data-lab-play>▶ Play example</button><button type="button" class="button ghost" data-lab-stop disabled>Stop</button>${range("tempo", kind === "rhythm" && id === 43 ? "Playback tempo (BPM; one event = one bar)" : "Tempo (quarter-note BPM)", 40, 160, 80)}<span class="playback-status" role="status" data-audio-status>Sound starts only when you press play.</span></div>${kind === "keyboard" ? `<div class="note-audition" role="group" aria-label="Hear individual events">${sequence.map((notes, i) => `<button type="button" data-lab-event="${i}" aria-label="Hear event ${i + 1}: ${escape(notes.map((n) => noteName(n, row)).join(", "))}"><small>${i + 1}</small>${escape(notes.map((n) => noteName(n, row)).join(" · "))}</button>`).join("")}</div>` : ""}<p class="note">Short synthesized tones illustrate the musical idea. They do not represent a recorded performance. Tempo and sound settings apply on the next playback. ${kind === "keyboard" ? "Teal keys show every pitch used; the highlighted event shows what is playing." : ""}</p>` : ""}<div class="teaching-notes"><div><h3>What to notice</h3><p>${escape(row[4])}</p></div><div><h3>Try it yourself</h3><p>${escape(row[5])}</p></div></div><fieldset class="visual-check"><legend>Check your understanding</legend><p>${escape(row[6])}</p><div class="check-options">${row[7].map((answer, i) => `<button type="button" class="button ghost" data-lab-answer="${i}" aria-pressed="false">${escape(answer)}</button>`).join("")}</div><p class="check-feedback" data-lab-feedback role="status"></p></fieldset><details class="lab-transcript"><summary>Read the diagram as text</summary><ol>${row[2].map(([label, detail]) => `<li><b>${escape(label)}</b>${detail ? ": " + escape(detail) : ""}</li>`).join("")}</ol>${playable ? `<p>Playback events in order: ${sequence.map((notes, i) => `${i + 1}: ${notes.length ? notes.map((n) => noteName(n, row)).join(" + ") : "rest"}`).join("; ")}.</p>` : ""}<p>Playback is one short pass. A moving highlight follows the events. Reduced-motion settings remove transitions.</p></details><p class="lab-reference">Theory reference: <a href="https://open-musictheory.github.io/" target="_blank" rel="noopener noreferrer">Open Music Theory ↗</a>. These are original teaching examples; use the module resources for further study.</p></section>`;
  }
  function mount() {
    document.querySelectorAll("[data-lesson-lab]").forEach((root) => {
      plot(root);
      if (rowFor(root)[1] === "mixer")
        root.querySelector("[data-lab-play]").textContent =
          "▶ Play balance example";
    });
  }
  function stop() {
    generation++;
    timers.forEach(clearTimeout);
    timers = [];
    sources.forEach((source) => {
      try {
        source.stop();
      } catch {
        /* Already finished. */
      }
    });
    sources.clear();
    document
      .querySelectorAll(".lesson-lab .is-playing, .lesson-lab .is-sounding")
      .forEach((el) => el.classList.remove("is-playing", "is-sounding"));
    if (playingRoot) {
      const root = playingRoot;
      root.querySelector("[data-lab-play]").disabled = false;
      root.querySelector("[data-lab-stop]").disabled = true;
      root.querySelector("[data-audio-status]").textContent =
        "Playback stopped. Play again whenever you are ready.";
      playingRoot = null;
    }
  }
  function tone(notes, start, duration, root, level = 1) {
    if (!notes.length) return;
    const kind = rowFor(root)[1],
      value = (name, fallback) =>
        Number(
          root.querySelector(`[data-lab-control="${name}"]`)?.value ?? fallback,
        );
    notes.forEach((m, i) => {
      const osc = audio.createOscillator(),
        gain = audio.createGain(),
        filter = audio.createBiquadFilter();
      osc.type =
        kind === "synth"
          ? root.querySelector('[data-lab-control="wave"]').value
          : "triangle";
      osc.frequency.value = 440 * 2 ** ((m - 69) / 12);
      filter.type = "lowpass";
      filter.frequency.value = kind === "synth" ? value("cutoff", 1500) : 12000;
      let amplitude = (0.12 / Math.max(1, notes.length)) * level;
      if (kind === "mixer")
        amplitude =
          ((0.12 / 3) * value(["voice", "guitar", "bass"][i], 50)) / 100;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(amplitude, start + 0.015);
      gain.gain.setValueAtTime(
        amplitude,
        start + Math.max(0.02, duration - 0.06),
      );
      gain.gain.linearRampToValueAtTime(0, start + duration);
      osc.connect(filter);
      filter.connect(gain);
      let panner;
      if (kind === "pan" && typeof audio.createStereoPanner === "function") {
        panner = audio.createStereoPanner();
        panner.pan.value = value("pan", 0) / 100;
        gain.connect(panner);
        panner.connect(audio.destination);
      } else gain.connect(audio.destination);
      sources.add(osc);
      osc.onended = () => {
        sources.delete(osc);
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
        panner?.disconnect();
      };
      osc.start(start);
      osc.stop(start + duration + 0.01);
    });
  }
  async function play(root, single) {
    stop();
    const token = generation;
    const status = root.querySelector("[data-audio-status]");
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error("unsupported");
      audio ||= new Context();
      await audio.resume();
      if (token !== generation || !root.isConnected) return;
      if (audio.state !== "running") throw new Error("suspended");
      const row = rowFor(root),
        kind = row[1],
        bpm = Number(root.querySelector('[data-lab-control="tempo"]').value),
        beat = 60 / bpm;
      let sequence = events(row);
      if (kind === "mixer") sequence = [[76, 60, 48]];
      const indexed =
        single === undefined
          ? sequence.map((notes, i) => ({ notes, i }))
          : [{ notes: sequence[single], i: single }];
      playingRoot = root;
      root.querySelector("[data-lab-play]").disabled = true;
      root.querySelector("[data-lab-stop]").disabled = false;
      status.textContent =
        "Playing one example. Follow the highlighted events.";
      let offset = 0.04;
      indexed.forEach(({ notes, i }) => {
        const subdivision =
          kind === "swing" || (kind === "rhythm" && sequence.length === 8)
            ? 0.5
            : 1;
        let length = beat * subdivision;
        if (
          kind === "swing" &&
          root.querySelector('[data-lab-control="feel"]').value === "swing"
        )
          length = beat * (i % 2 ? 1 / 3 : 2 / 3);
        if (kind === "keyboard") length = beat * (notes.length > 1 ? 1.5 : 0.8);
        if (kind === "mixer") length = 3.5;
        if (
          (kind === "rhythm" && Number(root.dataset.lessonLab) === 43) ||
          kind === "automation"
        )
          length = beat * 4;
        const level =
          kind === "delay"
            ? 0.55 ** i
            : kind === "automation"
              ? 10 ** ([-12, -9, -6, -9][i] / 20)
              : 1;
        tone(
          notes,
          audio.currentTime + offset,
          Math.max(0.08, length * 0.88),
          root,
          level,
        );
        const currentOffset = offset;
        timers.push(
          setTimeout(() => {
            if (token !== generation) return;
            root
              .querySelectorAll(".is-playing")
              .forEach((el) => el.classList.remove("is-playing"));
            if (row[2].length === sequence.length && kind !== "mixer")
              root
                .querySelector(`[data-event-index="${i}"]`)
                ?.classList.add("is-playing");
            root
              .querySelectorAll("[data-piano-note]")
              .forEach((key) =>
                key.classList.toggle(
                  "is-sounding",
                  notes.includes(Number(key.dataset.pianoNote)),
                ),
              );
            root
              .querySelector(`[data-lab-event="${i}"]`)
              ?.classList.add("is-playing");
            status.textContent = `Event ${i + 1} of ${sequence.length}: ${notes.length ? notes.map((n) => noteName(n, row)).join(", ") : "rest — keep counting"}.`;
          }, currentOffset * 1000),
        );
        offset += length;
      });
      timers.push(
        setTimeout(
          () => {
            if (token === generation) {
              stop();
              status.textContent =
                "Example complete. Try it on your instrument, then check your understanding.";
            }
          },
          offset * 1000 + 70,
        ),
      );
    } catch {
      if (token !== generation) return;
      stop();
      status.textContent =
        "Audio could not start in this browser. You can still use the diagrams and play the written notes on your instrument.";
    }
  }
  document.addEventListener("click", (e) => {
    const button = e.target.closest("button"),
      root = button?.closest("[data-lesson-lab]");
    if (!root) return;
    if (button.hasAttribute("data-lab-play")) void play(root);
    if (button.hasAttribute("data-lab-stop")) stop();
    if (button.dataset.labEvent !== undefined)
      void play(root, Number(button.dataset.labEvent));
    if (button.dataset.instrument) {
      root.querySelector("[data-instrument-map]").innerHTML =
        button.dataset.instrument === "piano"
          ? piano(rowFor(root))
          : fretboard(rowFor(root));
      root
        .querySelectorAll("[data-instrument]")
        .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    }
    if (button.dataset.labAnswer !== undefined) {
      const row = rowFor(root),
        correct = Number(button.dataset.labAnswer) === row[8],
        feedback = root.querySelector("[data-lab-feedback]");
      root
        .querySelectorAll("[data-lab-answer]")
        .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      feedback.textContent = `${correct ? "Correct." : "Think it through: " + row[7][row[8]] + "."} ${row[9]}`;
      feedback.dataset.correct = String(correct);
    }
  });
  document.addEventListener("input", (e) => {
    const control = e.target,
      root = control.closest("[data-lesson-lab]");
    if (!root || !control.dataset.labControl) return;
    const output = control.parentElement.querySelector("output");
    if (output) output.textContent = control.value;
    if (
      ["frequency", "gain", "ratio", "threshold", "quantize"].includes(
        control.dataset.labControl,
      )
    )
      plot(root);
    if (control.dataset.labControl === "pan")
      root.querySelector("[data-pan-dot]").style.left =
        `${50 + Number(control.value) * 0.4}%`;
    if (
      ["voice", "guitar", "bass"].includes(control.dataset.labControl) &&
      playingRoot === root
    ) {
      stop();
      root.querySelector("[data-audio-status]").textContent =
        "Balance changed. Press play to hear the new mix.";
    }
  });
  window.addEventListener("hashchange", stop);
  window.addEventListener("pagehide", stop);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });
  return { render, mount, stop };
})();
