/* Shared schema used before rendering or saving imported personal work. */
(function (root, factory) {
  const schema = factory();
  if (typeof module === "object" && module.exports) module.exports = schema;
  else root.CampusState = schema;
})(globalThis, () => {
  function text(value, max, field) {
    if (typeof value !== "string" || value.length > max)
      throw Object.assign(
        new Error(`Check ${field}; it must be text up to ${max} characters.`),
        { status: 400 },
      );
    return value;
  }
  function validState(input) {
    const fail = () => {
      throw Object.assign(
        new Error(
          "This backup contains invalid learning data. Check its format before importing.",
        ),
        { status: 400 },
      );
    };
    if (!input || typeof input !== "object" || Array.isArray(input)) fail();
    const result = {
      done: {},
      notes: {},
      quizzes: {},
      songs: [],
      plans: [],
      pace: "core",
      accessibility: {
        textSize: "comfortable",
        highContrast: false,
        reducedMotion: false,
      },
    };
    const weekKey = (k) => /^\d{1,2}$/.test(k) && Number(k) < 64;
    for (const field of ["done", "notes", "quizzes"]) {
      if (input[field] === undefined) continue;
      if (
        !input[field] ||
        typeof input[field] !== "object" ||
        Array.isArray(input[field])
      )
        fail();
      for (const [key, value] of Object.entries(input[field])) {
        if (field === "done") {
          if (
            !/^\d{1,2}-[0-3]$/.test(key) ||
            Number(key.split("-")[0]) >= 64 ||
            typeof value !== "boolean"
          )
            fail();
        }
        if (
          field === "notes" &&
          (!weekKey(key) || typeof value !== "string" || value.length > 100000)
        )
          fail();
        if (
          field === "quizzes" &&
          (!weekKey(key) || !Number.isInteger(value) || value < 0 || value > 3)
        )
          fail();
        result[field][key] = value;
      }
    }
    if (input.songs !== undefined) {
      if (!Array.isArray(input.songs) || input.songs.length > 500) fail();
      result.songs = input.songs.map((s) => {
        if (
          !s ||
          !["Idea", "Demo", "Recording", "Mixing", "Finished"].includes(s.stage)
        )
          fail();
        return {
          title: text(s.title, 150, "song title"),
          body: text(s.body, 100000, "song notes"),
          stage: s.stage,
        };
      });
    }
    if (input.plans !== undefined) {
      if (!Array.isArray(input.plans) || input.plans.length > 2000) fail();
      result.plans = input.plans.map((p) => {
        if (
          !p ||
          typeof p.id !== "string" ||
          !/^[A-Za-z0-9_-]{1,80}$/.test(p.id) ||
          typeof p.date !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(p.date) ||
          !Number.isFinite(Date.parse(p.date + "T12:00:00Z")) ||
          typeof p.done !== "boolean"
        )
          fail();
        return {
          id: p.id,
          title: text(p.title, 150, "session title"),
          date: p.date,
          course: text(p.course, 80, "course"),
          done: p.done,
        };
      });
    }
    if (input.pace !== undefined) {
      if (!["light", "core", "deep"].includes(input.pace)) fail();
      result.pace = input.pace;
    }
    if (input.accessibility) {
      const a = input.accessibility;
      if (
        !["comfortable", "large", "largest"].includes(a.textSize) ||
        typeof a.highContrast !== "boolean" ||
        typeof a.reducedMotion !== "boolean"
      )
        fail();
      result.accessibility = {
        textSize: a.textSize,
        highContrast: a.highContrast,
        reducedMotion: a.reducedMotion,
      };
    }
    return result;
  }
  return { validState };
});
