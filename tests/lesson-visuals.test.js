const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = (name) =>
  fs.readFileSync(path.join(__dirname, "..", "js", name), "utf8");
function setup() {
  const handlers = {},
    windowHandlers = {};
  let roots = [];
  const document = {
    addEventListener(name, callback) {
      handlers[name] = callback;
    },
    querySelectorAll(selector) {
      return selector === "[data-lesson-lab]" ? roots : [];
    },
  };
  const context = vm.createContext({
    document,
    window: {
      addEventListener(name, callback) {
        windowHandlers[name] = callback;
      },
    },
    setTimeout() {
      return 1;
    },
    clearTimeout() {},
  });
  vm.runInContext(
    source("data.js") +
      source("lesson-data.js") +
      source("lesson-visuals.js") +
      ";this.rows=LESSON_VISUALS;this.weeks=DATA.weeks;this.lab=LessonLab",
    context,
  );
  return {
    context,
    handlers,
    windowHandlers,
    setRoots(value) {
      roots = value;
    },
  };
}
test("Every curriculum week has a distinct, complete example and a valid knowledge check", () => {
  const { context: c } = setup();
  assert.equal(c.rows.length, c.weeks.length);
  assert.equal(new Set(c.rows.map((r) => r[0])).size, 64);
  c.rows.forEach((row, id) => {
    assert.equal(row.length, 10, `week ${id}`);
    assert(row[2].length >= 2);
    assert(row[7].length >= 2);
    assert(row[8] >= 0 && row[8] < row[7].length);
    assert(row[9].length > 20);
    if (row[3])
      row[3]
        .split("|")
        .filter((g) => g !== "-")
        .flatMap((g) => g.split(" "))
        .forEach((n) =>
          assert(
            Number.isInteger(Number(n)) && Number(n) >= 0 && Number(n) <= 127,
          ),
        );
  });
});
test("All examples render with diagrams, practice prompts and accessible feedback", () => {
  const { context: c } = setup();
  c.rows.forEach((row, id) => {
    const html = c.lab.render(id);
    assert(html.includes(`data-lesson-lab="${id}"`));
    assert(html.includes("Try it yourself"));
    assert(html.includes("Read the diagram as text"));
    assert(html.includes('data-lab-feedback role="status"'));
    assert(!/NaN|undefined|Infinity/.test(html), `week ${id}`);
    if (row[1] === "keyboard") assert(html.includes('role="img"'));
  });
});
test("Playback descriptions agree with the mixer tones", () => {
  const { context: c } = setup();
  const html = c.lab.render(14);
  assert.equal(c.rows[14][3], "76 60 48");
  assert(html.includes("E5 + C4 + C3"));
});
function graph(setupResult, id, values = {}) {
  const output = { innerHTML: "" },
    caption = { textContent: "" };
  const root = {
    dataset: { lessonLab: String(id) },
    querySelector(selector) {
      if (selector === "[data-lab-plot]") return output;
      if (selector === "[data-plot-caption]") return caption;
      const name = selector.match(/data-lab-control="([^"]+)"/)?.[1];
      return name in values ? { value: String(values[name]) } : null;
    },
  };
  setupResult.setRoots([root]);
  setupResult.context.lab.mount();
  return { html: output.innerHTML, caption: caption.textContent };
}
test("Hard-knee compression uses the correct threshold and ratio calculation", () => {
  const env = setup();
  let result = graph(env, 28, { threshold: -18, ratio: 4 });
  assert(result.caption.includes("−10 dB input, output is -16.0 dB"));
  assert(!/NaN|Infinity/.test(result.html));
  result = graph(env, 28, { threshold: -18, ratio: 1 });
  assert(result.caption.includes("-10.0 dB"));
  result = graph(env, 28, { threshold: -6, ratio: 4 });
  assert(result.caption.includes("-10.0 dB"));
});
test("EQ and timing models stay finite at control extremes", () => {
  const env = setup();
  for (const [id, values] of [
    [27, { frequency: 40, gain: -12 }],
    [27, { frequency: 16000, gain: 12 }],
    [45, { quantize: 0 }],
    [45, { quantize: 100 }],
    [41, {}],
  ]) {
    const result = graph(env, id, values);
    assert(result.html.includes("<svg"));
    assert(!/NaN|Infinity/.test(result.html));
    assert(result.caption.length > 20);
  }
});
test("Feedback explains both a wrong answer and a correct answer", () => {
  const env = setup(),
    feedback = { dataset: {} },
    buttons = [{ setAttribute() {} }, { setAttribute() {} }];
  const root = {
    dataset: { lessonLab: "6" },
    querySelector() {
      return feedback;
    },
    querySelectorAll() {
      return buttons;
    },
  };
  const button = {
    dataset: { labAnswer: "1" },
    closest() {
      return root;
    },
    hasAttribute() {
      return false;
    },
  };
  env.handlers.click({
    target: {
      closest() {
        return button;
      },
    },
  });
  assert.equal(feedback.dataset.correct, "false");
  assert(feedback.textContent.includes("Lowering the third"));
  button.dataset.labAnswer = "0";
  env.handlers.click({
    target: {
      closest() {
        return button;
      },
    },
  });
  assert.equal(feedback.dataset.correct, "true");
  assert(feedback.textContent.startsWith("Correct."));
});

test("Audio is user-initiated and navigation stops scheduled voices", async () => {
  const env = setup();
  let contexts = 0,
    starts = 0,
    stops = 0;
  const parameter = () => ({
    setValueAtTime() {},
    linearRampToValueAtTime() {},
  });
  class Context {
    constructor() {
      contexts++;
      this.currentTime = 0;
      this.state = "running";
      this.destination = {};
    }
    resume() {
      return Promise.resolve();
    }
    createOscillator() {
      return {
        frequency: {},
        connect() {},
        disconnect() {},
        start() {
          starts++;
        },
        stop() {
          stops++;
        },
      };
    }
    createGain() {
      return { gain: parameter(), connect() {}, disconnect() {} };
    }
    createBiquadFilter() {
      return { frequency: {}, connect() {}, disconnect() {} };
    }
  }
  env.context.window.AudioContext = Context;
  const controls = {
    "[data-audio-status]": { textContent: "" },
    "[data-lab-play]": { disabled: false },
    "[data-lab-stop]": { disabled: true },
    '[data-lab-control="tempo"]': { value: "80" },
  };
  const root = {
    isConnected: true,
    dataset: { lessonLab: "6" },
    querySelector(selector) {
      return controls[selector] || null;
    },
    querySelectorAll() {
      return [];
    },
  };
  const button = {
    dataset: {},
    closest() {
      return root;
    },
    hasAttribute(name) {
      return name === "data-lab-play";
    },
  };
  assert.equal(contexts, 0);
  env.handlers.click({
    target: {
      closest() {
        return button;
      },
    },
  });
  await new Promise(setImmediate);
  assert.equal(contexts, 1);
  assert.equal(starts, 6);
  assert.equal(controls["[data-lab-play]"].disabled, true);
  const scheduledStops = stops;
  env.windowHandlers.hashchange();
  assert(stops > scheduledStops);
  assert.equal(controls["[data-lab-play]"].disabled, false);
  assert.equal(controls["[data-lab-stop]"].disabled, true);
});

test("Chord labels use the spelling taught by the lesson", () => {
  const { context: c } = setup();
  const minor = c.lab.render(6),
    dominant = c.lab.render(34);
  assert(minor.includes("E♭4"));
  assert(!minor.includes("D♯4"));
  assert(dominant.includes("F♯4"));
});
test("All weekly module pages include their matching visual teaching panel", () => {
  const elements = new Map();
  function element() {
    return {
      innerHTML: "",
      style: {},
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener() {},
      insertAdjacentHTML(_position, value) {
        this.innerHTML = value + this.innerHTML;
      },
      focus() {},
      scrollIntoView() {},
    };
  }
  const document = {
    documentElement: { dataset: {} },
    hidden: false,
    addEventListener() {},
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, element());
      return elements.get(selector);
    },
    querySelectorAll() {
      return [];
    },
  };
  const context = vm.createContext({
    document,
    location: { hash: "" },
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
    },
    window: { addEventListener() {}, scrollTo() {} },
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(
    ["data.js", "lesson-data.js", "lesson-visuals.js", "app.js"]
      .map(source)
      .join("\n"),
    context,
  );
  for (let id = 0; id < 64; id++) {
    context.location.hash = `#week/${id}`;
    vm.runInContext("render()", context);
    assert(elements.get("#app").innerHTML.includes(`data-lesson-lab="${id}"`));
  }
  for (const page of [
    "home",
    "curriculum",
    "assignments",
    "planner",
    "library",
    "studio",
    "progress",
    "settings",
    "help",
  ]) {
    context.location.hash = "#" + page;
    vm.runInContext("render()", context);
    assert(elements.get("#app").innerHTML.includes("<h1>"), page);
  }
});
