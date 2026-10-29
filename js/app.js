const courses = [
  {
    name: "Music Theory",
    image: "assets/courses/theory.jpg",
    imageAlt: "Sheet music and a pencil on a composer’s desk",
    icon: "♮",
    code: "MTH",
    color: "#ac6d42",
    tint: "#f0e4d4",
    desc: "Understand the music you already love.",
  },
  {
    name: "Music Production",
    image: "assets/courses/production.jpg",
    imageAlt: "Mixing console in a music production studio",
    icon: "≋",
    code: "MPR",
    color: "#6e8266",
    tint: "#e4e9da",
    desc: "Turn your ideas into finished recordings.",
  },
  {
    name: "Guitar",
    image: "assets/courses/guitar.jpg",
    imageAlt: "An acoustic guitar with a natural wood finish",
    icon: "♬",
    code: "GTR",
    color: "#ad705a",
    tint: "#eee0d7",
    desc: "Connect familiar shapes to musical meaning.",
  },
  {
    name: "Piano",
    image: "assets/courses/piano.jpg",
    imageAlt: "Black and white keys of a piano",
    icon: "▥",
    code: "PNO",
    color: "#7b7d9a",
    tint: "#e7e6ee",
    desc: "Make harmony visible. Write with confidence.",
  },
];
let state;
try {
  state =
    typeof CampusAccount !== "undefined"
      ? CampusAccount.initialState
      : JSON.parse(localStorage.getItem("resonance-v1")) || {};
} catch {
  state = {};
}
state.done ||= {};
state.notes ||= {};
state.songs ||= [];
state.quizzes ||= {};
state.pace ||= "core";
state.plans ||= [];
state.accessibility = {
  textSize: "comfortable",
  highContrast: false,
  reducedMotion: false,
  ...state.accessibility,
};
function applyAccessibility() {
  const preferences = state.accessibility;
  if (!["comfortable", "large", "largest"].includes(preferences.textSize))
    preferences.textSize = "comfortable";
  document.documentElement.dataset.textSize = preferences.textSize;
  document.documentElement.dataset.contrast =
    preferences.highContrast === true ? "high" : "normal";
  document.documentElement.dataset.motion =
    preferences.reducedMotion === true ? "reduce" : "system";
}
applyAccessibility();
let assignmentFilter = "current";
let term = 0,
  libraryFilter = "all",
  librarySearch = "";
const app = document.querySelector("#app"),
  esc = (s) =>
    String(s ?? "").replace(
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
function save() {
  if (typeof CampusAccount !== "undefined") {
    CampusAccount.save(state);
    return;
  }
  try {
    localStorage.setItem("resonance-v1", JSON.stringify(state));
  } catch {
    toast("Storage unavailable. Export a backup before leaving.");
  }
}
function toast(s) {
  const t = document.querySelector("#toast");
  t.textContent = s;
  t.style.display = "block";
  clearTimeout(window.tt);
  window.tt = setTimeout(() => (t.style.display = "none"), 3500);
}
const taskKey = (id, c) => `${id}-${c}`,
  weekDone = (id) => courses.every((_, c) => state.done[taskKey(id, c)]),
  completed = () => DATA.weeks.filter((w) => weekDone(w.id)).length,
  current = () => DATA.weeks.find((w) => !weekDone(w.id)) || DATA.weeks[63],
  hours = () => (state.pace === "light" ? 3 : state.pace === "deep" ? 12 : 6);
function intro(k, title, sub, extra = "") {
  return `<div class="intro"><div><div class="eyebrow muted">${k}</div><h1>${title}</h1><p>${sub}</p></div>${extra}</div>`;
}
function taskToggle(id, c, checked) {
  state.done[taskKey(id, c)] = checked;
  save();
  if (checked)
    toast(
      weekDone(id)
        ? "All four course tasks complete. Week finished!"
        : "Practice recorded. Keep going.",
    );
}
function stats() {
  return `<div class="stats"><div class="stat"><label>YOUR PROGRAM</label><strong>4 <small>semesters</small></strong></div><div class="stat"><label>SMALL STEPS, REAL PROGRESS</label><strong>${completed()} <small>/ 64 weeks complete</small></strong></div><div class="stat"><label>THIS WEEK’S COMMITMENT</label><strong>~${hours()} <small>hours / week</small></strong></div><div class="stat"><label>THE BIG PICTURE</label><strong>3 songs <small>final portfolio</small></strong></div></div>`;
}
function courseCard(c, i, w) {
  const n = DATA.weeks.filter(
    (x) => x.semester === w.semester && state.done[taskKey(x.id, i)],
  ).length;
  return `<a class="course" style="--tint:${c.tint};--accent:${c.color}" href="#course/${i}/${w.semester}"><div class="course-cover"><img src="${c.image}" alt="${esc(c.imageAlt)}" width="800" height="400" loading="lazy" decoding="async"></div><div class="course-code">${c.code} ${w.semester + 1}01 · SEMESTER ${w.semester + 1}</div><h3>${c.name}</h3><p>${c.desc}</p><div class="bar"><span style="width:${(n / 16) * 100}%"></span></div><div class="course-bottom"><span>${n} / 16 modules</span><span>Open course ↗</span></div></a>`;
}
function home() {
  const w = current();
  return (
    intro(
      "YOUR PERSONAL MUSIC CAMPUS",
      `Welcome back, ${typeof CampusAccount !== "undefined" ? esc(CampusAccount.profile.displayName) : "artist"}.`,
      "A little practice. A new idea. Your next step starts here.",
      `<span class="pill">◷ &nbsp; ${state.pace === "light" ? "Light" : state.pace === "deep" ? "Deep practice" : "Part-time"} pace · ~${hours()} hrs / week</span>`,
    ) +
    `<section class="hero"><div class="hero-content"><div class="eyebrow">SEMESTER ${w.semester + 1} &nbsp; / &nbsp; WEEK ${String(w.week).padStart(2, "0")}</div><h2>${w.topic}</h2><p>Four connected courses. One step closer to your own sound.</p><a class="button light" href="#week/${w.id}">${completed() ? "Continue learning" : "Start your first week"} <span>↗</span></a></div><div class="hero-art" aria-hidden="true"><div class="record"></div><div class="keyboard">${'<div class="key"></div>'.repeat(10)}</div></div></section>` +
    `<div class="quick-links"><a href="#assignments"><b>✓</b><span>Assignments<small>Your next practice tasks</small></span><span>→</span></a><a href="#planner"><b>▦</b><span>Study planner<small>Make time for your music</small></span><span>→</span></a><a href="#studio"><b>♫</b><span>Your songbook<small>Keep a good idea close</small></span><span>→</span></a></div>` +
    `<div class="section-head"><h2>My courses</h2><a href="#curriculum">View all semesters →</a></div><div class="grid">${courses.map((c, i) => courseCard(c, i, w)).join("")}</div><div class="two-col"><section class="panel"><div class="section-head" style="margin-top:0"><h3>This week’s assignments</h3><span class="caps">WEEK ${String(w.week).padStart(2, "0")}</span></div>${courses.map((c, i) => `<div class="week-task"><input aria-label="Complete ${c.name} task" class="check" type="checkbox" ${state.done[taskKey(w.id, i)] ? "checked" : ""} data-task="${w.id},${i}"><a href="#week/${w.id}"><b>${c.name}</b><small>${i === 0 ? w.topic : i === 1 ? "Create & record" : i === 2 ? "Connect it on the fretboard" : "Find it on the keys"}</small></a><span class="muted" style="margin-left:auto">↗</span></div>`).join("")}</section><section class="panel"><div class="caps">THE SEMESTER FINISH LINE</div><div class="project-art" aria-hidden="true">${Array.from({ length: 34 }, (_, i) => `<div class="wave" style="height:${12 + Math.sin(i * 1.7) ** 2 * 55}px"></div>`).join("")}</div><h3>${["Your first original demo", "Your complete single", "Your produced song", "Your three-song portfolio"][w.semester]}</h3><p class="note">${DATA.terms[w.semester].description}</p><a href="#week/${w.semester * 16 + 15}" class="note">See the project brief ↗</a></section></div><div class="panel" style="margin-top:23px"><span class="eyebrow muted">BEFORE YOU BEGIN</span><p>You know chords, strumming, arpeggios and lyrics. That counts. Here, you’ll learn why those chords work, find them on piano, and turn your ideas into recordings. Start with the guitar and recording tools you have.</p><a class="note" href="#settings">Set your pace & read the study guide ↗</a></div>`
  );
}
function termTabs() {
  return `<div class="tabs">${DATA.terms.map((t, i) => `<button data-term="${i}" class="${term === i ? "selected" : ""}">0${i + 1} &nbsp; ${t.title}</button>`).join("")}</div>`;
}
function curriculum() {
  return (
    intro(
      "THE INDEPENDENT ARTIST PROGRAM",
      "Your path, one week at a time.",
      "64 weeks of theory, production, guitar and piano. Every concept becomes something you make.",
    ) +
    termTabs() +
    `<div class="panel"><span class="caps">SEMESTER ${term + 1} · 16 WEEKS · 4 COURSES</span><h2 style="margin-top:10px">${DATA.terms[term].title}</h2><p class="muted">${DATA.terms[term].description}</p><p class="note">Weeks 8 and 16 are review and project weeks. Repeat any week when needed. Later semesters introduce advanced tools; confident mastery will continue beyond this program.</p></div><div class="section-head"><h2>Semester courses</h2></div><div class="grid">${courses.map((c, i) => courseCard(c, i, { semester: term })).join("")}</div><div class="section-head"><h2>Weekly modules</h2><span class="caps">${DATA.weeks.filter((w) => w.semester === term && weekDone(w.id)).length} / 16 COMPLETE</span></div><div class="week-list">${DATA.weeks
      .filter((w) => w.semester === term)
      .map(weekRow)
      .join("")}</div>`
  );
}
function weekRow(w) {
  return `<a class="week-row" href="#week/${w.id}"><div class="week-num">${weekDone(w.id) ? "✓" : String(w.week).padStart(2, "0")}</div><div><h3>${w.topic}</h3><small>${w.project ? "Project & review" : "4 connected lessons"} · ~${hours()} hours</small></div><span class="arrow">↗</span></a>`;
}
function resource(r) {
  return `<a class="resource" href="${r.url}" target="_blank" rel="noopener noreferrer"><span class="caps">${r.type} &nbsp; ↗</span><h3>${r.title}</h3><span class="note">${r.provider}</span><p>${r.note}</p></a>`;
}
function week(id) {
  const w = DATA.weeks[id];
  if (!w)
    return '<h1>Module not found</h1><a href="#curriculum">Return to curriculum</a>';
  return (
    intro(
      `SEMESTER ${w.semester + 1} / WEEK ${w.week}`,
      w.topic,
      `${w.project ? "Project & review week" : "Learn → practice → create → review"} · ~${hours()} hours, at your pace`,
      `<button class="button ghost" data-print>Print module</button>`,
    ) +
    `<div class="lesson-layout"><div><section class="panel"><span class="eyebrow muted">THE IDEA</span><p class="lesson-copy">${w.lesson}</p><p class="note">Listen first, explain it simply, then try it in your own music. You don’t need to memorize everything before making a song.</p></section>${LessonLab.render(id)}${courses.map((c, i) => `<section class="task-card" style="--accent:${c.color}"><span class="caps">${c.code} ${w.semester + 1}01 · ${[90, 120, 60, 60][i]} MIN CORE TARGET</span><h3 style="margin-top:8px">${c.name}</h3><p>${w.tasks[i]}</p><p class="note">${["Study the matching reference lesson below. Spend five minutes singing or identifying notes by ear.", "Save a dated project version and an audio export. Listen once without watching your screen.", "Use a comfortable tempo. Aim for three relaxed, clean repetitions; do not practice through pain.", "Begin hands separately. A browser keyboard or MIDI piano can help you explore before buying an instrument."][i]}</p><label><input type="checkbox" class="check" data-task="${id},${i}" ${state.done[taskKey(id, i)] ? "checked" : ""}> I can demonstrate this task and have saved my work.</label></section>`).join("")}<section class="panel" style="margin-top:20px"><h3>Weekly reflection & assignment log</h3><p class="note">Write the key, tempo and chords you used. Explain this week’s concept in your own words, note what you heard, and add a file name or link to your recording. Notes save automatically to your private campus. Check the save status before closing this page.</p><textarea data-note="${id}" aria-label="Weekly reflection and assignment log" placeholder="This week I made…&#10;The concept I can explain is…&#10;My recording / project link…&#10;Next time I’ll work on…">${esc(state.notes[id] || "")}</textarea><h3>Before moving on</h3><ul class="rubric"><li>Understanding: explain the concept and demonstrate two examples.</li><li>Timing & technique: perform the passage steadily at a comfortable tempo.</li><li>Creative application: use the idea in an original sketch or song.</li><li>Recording & reflection: export something listenable and name one specific improvement.</li></ul><p class="note">Rate each item 0 = not yet, 1 = with help, 2 = independently. Aim for 6/8 with no zero before advancing. These are self-assessed tasks, not instructor grades.</p>${w.project ? `<a class="button ghost" href="#quiz/${id}">Take semester ${w.semester + 1} knowledge check ↗</a>` : '<p class="note">A short semester knowledge check is available in weeks 8 and 16.</p>'}</section><div class="actions">${id > 0 ? `<a class="button ghost" href="#week/${id - 1}">← Previous week</a>` : ""}<a class="button" href="${id < 63 ? "#week/" + (id + 1) : "#progress"}">${id < 63 ? "Next week →" : "View your progress →"}</a></div></div><div><section class="panel"><div class="caps">YOUR WEEKLY RHYTHM</div><div class="practice-plan">${(state.pace ===
    "light"
      ? [
          ["Theory & ear", "40 min"],
          ["Production", "60 min"],
          ["Guitar", "30 min"],
          ["Piano", "30 min"],
          ["Review", "20 min"],
        ]
      : state.pace === "deep"
        ? [
            ["Theory & ear", "3 hr"],
            ["Production", "4 hr"],
            ["Guitar", "2 hr"],
            ["Piano", "2 hr"],
            ["Review", "1 hr"],
          ]
        : [
            ["Theory & ear", "90 min"],
            ["Production", "120 min"],
            ["Guitar", "60 min"],
            ["Piano", "60 min"],
            ["Review", "30 min"],
          ]
    )
      .map((x) => `<div><span>${x[0]}</span><b>${x[1]}</b></div>`)
      .join(
        "",
      )}</div><p class="note">${state.pace === "light" ? "Split this module across two calendar weeks if needed. The course tasks stay the same; do smaller sessions." : state.pace === "deep" ? "Use extra time for additional takes, ear training, transposing and more detailed revisions." : "Try four short sessions plus one creative recording session. Extra practice is optional."}</p></section><section class="panel" style="margin-top:18px"><h3>Learn from good teachers</h3><p class="note">Choose the section matching “${w.topic}”. These are external resources, not required paid enrollments.</p>${w.resources.map((x) => resource(DATA.resources.find((r) => r.id === x))).join("")}${w.project ? resource(DATA.resources.find((r) => r.id === "pdf")) : ""}</section></div></div>`
  );
}
function quiz(id) {
  const w = DATA.weeks[id];
  if (!w) return "";
  return (
    intro(
      `SEMESTER ${w.semester + 1} · REVIEW CHECK`,
      "Check what’s sticking.",
      "A reusable semester checkpoint for weeks 8 and 16. Revisit it after practice; it does not grade your performance.",
    ) +
    `<form id="quiz-form" data-id="${id}" class="panel">${w.quiz.map((q, i) => `<div class="quiz-question"><h3>${i + 1}. ${q[0]}</h3>${q[1].map((a, j) => `<label><input type="radio" name="q${i}" value="${j}" required>${a}</label>`).join("")}</div>`).join("")}<div class="actions"><button class="button" type="submit">Check my answers</button><a class="button ghost" href="#week/${id}">Back to module</a></div><div id="quiz-result" aria-live="polite"></div></form>`
  );
}
function library() {
  return (
    intro(
      "YOUR REFERENCE SHELF",
      "Good resources. Less searching.",
      "A curated starting library of free videos, lessons, articles and an open PDF textbook.",
    ) +
    `<div class="tool-row"><input id="search" type="search" placeholder="Search topics, teachers or formats…" aria-label="Search resources" value="${esc(librarySearch)}"><select id="resource-filter" aria-label="Filter by course"><option value="all">All courses</option>${courses.map((c, i) => `<option value="${i}" ${libraryFilter == i ? "selected" : ""}>${c.name}</option>`).join("")}</select></div><div id="resources" class="resource-grid"></div><p class="note">Links researched October 2026. Some providers also offer paid products; the linked learning material is the focus here. Availability can change. Open Music Theory is a reference rather than a required cover-to-cover reading.</p>`
  );
}
function filterResources() {
  const list = DATA.resources.filter(
    (r) =>
      (libraryFilter === "all" || r.course === Number(libraryFilter)) &&
      `${r.title} ${r.provider} ${r.type} ${r.note}`
        .toLowerCase()
        .includes(librarySearch.toLowerCase()),
  );
  document.querySelector("#resources").innerHTML = list.length
    ? list.map(resource).join("")
    : '<p class="empty">No matching resources. Try another search or course.</p>';
}
function studio() {
  return (
    intro(
      "THE SONGBOOK",
      "Give your ideas somewhere to grow.",
      "Keep lyrics, project links, chord progressions and reflections together.",
    ) +
    `<div class="panel"><h3>Capture a song idea</h3><form id="song-form"><div class="tool-row"><input name="title" type="text" required maxlength="150" placeholder="Song title or working idea" aria-label="Song title"><select name="stage" aria-label="Project stage"><option>Idea</option><option>Demo</option><option>Recording</option><option>Mixing</option><option>Finished</option></select></div><textarea name="body" required placeholder="Lyrics, key, tempo, chords, recording links, and the next small step…" aria-label="Song notes"></textarea><button class="button">Add to songbook +</button></form></div><div class="section-head"><h2>Your songs</h2><span class="caps">${state.songs.length} IDEAS SAVED</span></div>${state.songs.length ? state.songs.map((s, i) => `<section class="panel song"><span class="caps">${esc(s.stage)}</span><h3>${esc(s.title)}</h3><textarea data-song="${i}" aria-label="Notes for ${esc(s.title)}">${esc(s.body)}</textarea><p class="note">Notes save to your private campus. Audio stays in your own files; paste a link here to keep a reference.</p><button class="button ghost" data-delete-song="${i}">Delete idea</button></section>`).join("") : '<div class="empty">Your first idea belongs here. A lyric, a chord change, a voice memo — start small.</div>'}<div class="section-head"><h2>Portfolio milestones</h2></div><div class="week-list">${[15, 31, 47, 63].map((id) => weekRow(DATA.weeks[id])).join("")}</div>`
  );
}
function progress() {
  return (
    intro(
      "LOOK HOW FAR YOU’VE COME",
      "Progress is a practice.",
      "Completed work matters more than a perfect streak. You can revisit every module.",
    ) +
    stats() +
    `<div class="grid">${DATA.terms
      .map((t, i) => {
        const n = DATA.weeks.filter(
          (w) => w.semester === i && weekDone(w.id),
        ).length;
        return `<div class="panel"><span class="caps">SEMESTER 0${i + 1}</span><h3>${t.title}</h3><div class="bar"><span style="width:${(n / 16) * 100}%"></span></div><p class="note">${n} of 16 weeks complete</p></div>`;
      })
      .join(
        "",
      )}</div><div class="section-head"><h2>Course practice completed</h2></div><div class="panel">${courses
      .map((c, i) => {
        const n = DATA.weeks.filter((w) => state.done[taskKey(w.id, i)]).length;
        return `<p>${c.name} <b style="float:right">${n} / 64</b></p><div class="bar"><span style="width:${(n / 64) * 100}%"></span></div>`;
      })
      .join(
        "",
      )}</div><div class="section-head"><h2>Knowledge checks</h2></div><div class="panel">${
      Object.keys(state.quizzes).length
        ? Object.entries(state.quizzes)
            .map(
              ([id, n]) =>
                `<p>Semester ${DATA.weeks[id].semester + 1}, week ${DATA.weeks[id].week}: ${n}/3 <a href="#quiz/${id}">Revisit ↗</a></p>`,
            )
            .join("")
        : '<p class="note">Your checkpoint scores will appear here after weeks 8 and 16.</p>'
    }</div><div class="actions"><button class="button ghost" data-export>Export a progress backup</button></div>`
  );
}
function readingPreferences() {
  const p = state.accessibility;
  return `<section class="panel reading-preferences" aria-labelledby="reading-heading"><span class="eyebrow">MAKE READING COMFORTABLE</span><h2 id="reading-heading">Reading & accessibility</h2><p>Choose the display that works for you. Your preferences save with your account and apply across your campus.</p><div class="reading-options"><div class="text-size-field"><label for="text-size">Text size</label><select id="text-size" aria-describedby="text-size-help">${[
    ["comfortable", "Comfortable · default"],
    ["large", "Large"],
    ["largest", "Extra large"],
  ]
    .map(
      ([value, label]) =>
        `<option value="${value}" ${p.textSize === value ? "selected" : ""}>${label}</option>`,
    )
    .join(
      "",
    )}</select></div><p id="text-size-help" class="note">Text and controls grow together. You can also use your browser's zoom controls.</p><label class="preference-check"><input type="checkbox" id="high-contrast" ${p.highContrast ? "checked" : ""}><span><b>Higher contrast</b><small>Darker text and stronger borders make content easier to distinguish.</small></span></label><label class="preference-check"><input type="checkbox" id="reduce-motion" ${p.reducedMotion ? "checked" : ""}><span><b>Reduce motion</b><small>Turn off transitions and decorative animation. Your system's reduced-motion preference is always respected.</small></span></label></div><div class="reading-sample"><h3>A little, often.</h3><p>Learn a musical idea, hear an example, then try it on your instrument. Take your time: every small step counts.</p></div></section>`;
}
function settings() {
  return (
    intro(
      "MAKE IT FIT YOUR LIFE",
      "Your pace. Your program.",
      "A structured independent study program, without deadlines or tuition.",
    ) +
    readingPreferences() +
    `<div class="panel"><h3>Choose your study rhythm</h3><p class="note">A curriculum week is a module, not a deadline. Four semesters contain 64 learning weeks; breaks and repeats extend the calendar.</p><select id="pace" aria-label="Study pace">${[
      ["light", "Light · about 3 hours · split modules across two weeks"],
      ["core", "Part-time · about 6 hours per module"],
      ["deep", "Deep practice · about 12 hours per module"],
    ]
      .map(
        ([v, t]) =>
          `<option value="${v}" ${state.pace === v ? "selected" : ""}>${t}</option>`,
      )
      .join(
        "",
      )}</select><p>Recommended: start with part-time. If life gets busy, switch to light and spread each module over two weeks. The deep-practice option adds repetition, transposition and revisions; it is not a formal full-time college workload.</p><h3>What you need</h3><p>A guitar, a way to hear your recordings, and a computer or phone. Use one recording app or DAW consistently. A keyboard is helpful; begin with a browser piano if necessary. You can start without buying plugins, premium lessons or an audio interface.</p><h3>How to study</h3><ol class="rubric"><li>Read the weekly idea and the matching reference lesson.</li><li>Play or sing each idea; keep ear training short and regular.</li><li>Complete the four connected practice tasks.</li><li>Save a recording and a short reflection.</li><li>Use the self-review rubric and repeat weak areas before moving ahead.</li></ol><h3>About this college</h3><p>This is a personal independent-study curriculum, not an accredited institution or degree. It takes you from foundational theory toward advanced songwriting and production concepts. Performance, listening judgment and a musical career continue to develop through practice, finished work and feedback.</p><h3>Your work & backups</h3><p>Progress, notes, planner sessions and songs save to your private campus server when connected. The same account can access that saved work from another device when the server is hosted. Audio uploads and instructor marking are not included. Export backups regularly, particularly before changing devices or clearing browser data.</p><div class="actions"><button class="button" data-export>Export backup</button><label class="import-backup">Import backup<input id="import" type="file" accept="application/json"></label></div><p class="note">Import merges saved notes, tasks, planner sessions and quiz scores into your account; imported songs are added when not already present.</p></div>`
  );
}

// Student tools: assignments, personal study sessions, and getting started.
function assignments() {
  const w = current();
  const weeks = assignmentFilter === "current" ? [w] : DATA.weeks;
  const tasks = weeks
    .flatMap((week) =>
      courses.map((course, i) => ({
        week,
        course,
        i,
        done: !!state.done[taskKey(week.id, i)],
      })),
    )
    .filter((t) => assignmentFilter !== "incomplete" || !t.done);
  return (
    intro(
      "YOUR WORK, IN ONE PLACE",
      "Assignments",
      "Practice tasks are self-assessed. Open a module for instructions, resources and your reflection.",
    ) +
    `<div class="notice"><b>No surprise deadlines.</b> Follow the current week or choose any module. Set your own study dates in the <a href="#planner">planner →</a></div>
  <div class="tool-row"><label for="assignment-filter">Show assignments</label><select id="assignment-filter">${[
    ["current", "Current week"],
    ["incomplete", "All incomplete tasks"],
    ["all", "All tasks"],
  ]
    .map(
      ([v, t]) =>
        `<option value="${v}" ${assignmentFilter === v ? "selected" : ""}>${t}</option>`,
    )
    .join(
      "",
    )}</select><span class="pill">${tasks.filter((t) => t.done).length} / ${tasks.length} complete</span></div>
  <div class="assignment-list">${tasks.length ? tasks.map((t) => `<section class="assignment-item ${t.done ? "is-done" : ""}"><input class="check" type="checkbox" aria-label="Complete week ${t.week.week} ${t.course.name}" data-task="${t.week.id},${t.i}" ${t.done ? "checked" : ""}><div><span class="caps">SEMESTER ${t.week.semester + 1} · WEEK ${t.week.week} · ${t.course.name}</span><h3><a href="#week/${t.week.id}">${t.week.topic}</a></h3><p>${esc(t.week.tasks[t.i])}</p></div><a class="text-link" href="#week/${t.week.id}">Open module →</a></section>`).join("") : '<div class="empty">All practice tasks are complete. Visit your songbook to keep creating.</div>'}</div>`
  );
}
function planner() {
  const plans = [...state.plans].sort((a, b) => a.date.localeCompare(b.date));
  return (
    intro(
      "A LITTLE, OFTEN",
      "Your study planner",
      "Give your practice a place in the week. These are your personal plans, so adjust them whenever you need.",
    ) +
    `<div class="planner-layout"><section class="panel"><h2>Plan a study session</h2><form id="plan-form" class="stack-form"><label>What will you work on?<input name="title" type="text" required maxlength="150" placeholder="e.g. Record an eight-bar guitar loop"></label><label>Study date<input name="date" type="date" required></label><label>Course<select name="course"><option>General practice</option>${courses.map((c) => `<option>${c.name}</option>`).join("")}</select></label><button class="button">Add study session +</button><p class="note">Saved to your private campus. Your planner does not send reminders.</p></form></section><section><div class="section-head" style="margin-top:0"><h2>Upcoming & completed</h2><span class="pill">${plans.length} ${plans.length === 1 ? "session" : "sessions"}</span></div>${plans.length ? plans.map((p) => `<article class="panel plan-item ${p.done ? "is-done" : ""}"><label class="plan-title"><input class="check" type="checkbox" data-plan-check="${esc(p.id)}" ${p.done ? "checked" : ""}><span><b>${esc(p.title)}</b><small>${new Date(p.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })} · ${esc(p.course)}${p.done ? " · Complete" : ""}</small></span></label><button class="text-button" data-delete-plan="${esc(p.id)}" aria-label="Remove ${esc(p.title)}">Remove</button></article>`).join("") : '<div class="empty"><h3>A little space for your music.</h3><p>Add your first study session. Even twenty minutes is a good start.</p><a class="text-link" href="#assignments">Find a task to work on →</a></div>'}</section></div>`
  );
}
function help() {
  return (
    intro(
      "YOUR STUDENT GUIDE",
      "Feel at home on campus.",
      "Everything you need to find your way, build a routine and keep your work safe.",
    ) +
    `<div class="help-grid">${[
      [
        "01",
        "Start with your courses",
        "Open My courses, pick a semester, and choose a weekly module. Each module connects theory, production, guitar and piano.",
        "curriculum",
        "Explore my courses",
      ],
      [
        "02",
        "Practice, then check it off",
        "Assignments collects your practice tasks. Mark a task complete when you can demonstrate it, then write a reflection inside the module.",
        "assignments",
        "View assignments",
      ],
      [
        "03",
        "Find your rhythm",
        "Add personal study sessions in your planner. Set a light, part-time or deep practice pace in settings. Repeat modules whenever you need.",
        "planner",
        "Plan a session",
      ],
      [
        "04",
        "Save a spark",
        "Keep lyrics, chord ideas and recording links in your songbook. Store audio in your own files and add a link or file name to your notes.",
        "studio",
        "Open my songbook",
      ],
    ]
      .map(
        ([n, title, body, link, action]) =>
          `<section class="panel"><span class="help-number">${n}</span><h2>${title}</h2><p>${body}</p><a class="text-link" href="#${link}">${action} →</a></section>`,
      )
      .join(
        "",
      )}</div><section class="panel faq"><h2>A few useful answers</h2><details><summary>Where is my work saved?</summary><p>Tasks, reflections, planner sessions and songs save to your private server. Check the save status before leaving. If a connection fails, keep the tab open and retry or download an unsaved backup. Export regular backups in Settings.</p><a href="#settings" class="text-link">Settings & backups →</a></details><details><summary>Are there deadlines or instructor grades?</summary><p>This is your independent learning space. Practice tasks are self-assessed, quizzes give immediate feedback, and planner dates are chosen by you. There are no instructor messages or formal grades.</p></details><details><summary>What equipment do I need?</summary><p>Start with a guitar and a phone or computer for recordings. A keyboard helps, but a browser piano is enough to explore. The resource library gives you places to learn.</p><a href="#library" class="text-link">Browse resources →</a></details></section>`
  );
}

function profile() {
  const p =
    typeof CampusAccount !== "undefined"
      ? CampusAccount.profile
      : { displayName: "Artist", email: "", instrument: "Exploring", goal: "" };
  return (
    intro(
      "YOUR PERSONAL CAMPUS",
      "Your artist profile",
      "A space for your name, your musical interests and what you want to create.",
    ) +
    `<div class="profile-layout"><section class="panel profile-summary"><div class="profile-avatar" data-avatar aria-hidden="true">${esc(
      p.displayName
        .split(/\s+/)
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase(),
    )}</div><h2>${esc(p.displayName)}</h2><p class="profile-account-email">${esc(p.email)}</p><p>${esc(p.instrument)}</p><p class="session-note">Private owner account. Your email identifies your account and is not displayed publicly.</p><div class="actions"><a class="button ghost" href="#settings">Reading & study settings</a><button class="button ghost" type="button" data-account-logout>Sign out of this device</button></div></section><section class="panel profile-form-panel"><h2>Make this campus yours</h2><p class="note">Your profile saves to the private campus server.</p><form id="profile-form" class="account-form"><label for="profile-name">Display name<input id="profile-name" name="displayName" required autocomplete="name" maxlength="80" value="${esc(p.displayName)}"></label><label for="profile-email">Account email<input id="profile-email" type="email" value="${esc(p.email)}" readonly aria-describedby="profile-email-help"></label><p class="note" id="profile-email-help">This is the email you use to sign in.</p><label for="profile-instrument">Main musical interest<select id="profile-instrument" name="instrument">${["Guitar", "Piano", "Guitar & piano", "Music production", "Voice", "Exploring"].map((value) => `<option ${p.instrument === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label for="profile-goal">What would you like to achieve?<textarea id="profile-goal" name="goal" maxlength="1000" placeholder="For example: finish my first original song and play it confidently.">${esc(p.goal)}</textarea></label><p class="form-error" id="profile-error" role="alert"></p><div class="form-actions"><button class="button" type="submit">Save my profile</button></div></form></section></div>`
  );
}

function render() {
  LessonLab.stop();
  const parts = (location.hash.slice(1) || "home").split("/"),
    page = parts[0];
  document
    .querySelectorAll("nav a")
    .forEach((a) =>
      a.classList.toggle(
        "active",
        a.dataset.nav === page ||
          (["week", "course", "quiz"].includes(page) &&
            a.dataset.nav === "curriculum"),
      ),
    );
  document.querySelector("#crumb").innerHTML =
    `<a href="#home">My campus</a> <i>/</i> ${esc({ home: "Overview", assignments: "Assignments", planner: "Study planner", help: "Student help", curriculum: "Curriculum", week: "Weekly module", course: "Course", quiz: "Knowledge check", library: "Resource library", studio: "Songbook", progress: "Progress", settings: "Study settings", profile: "Your profile" }[page] || "Dashboard")}`;
  if (page === "course") {
    const ci = Number(parts[1]),
      si = Number(parts[2]);
    if (!courses[ci] || !DATA.terms[si]) {
      location.hash = "curriculum";
      return;
    }
    app.innerHTML =
      intro(
        `${courses[ci].code} ${si + 1}01 · SEMESTER ${si + 1}`,
        courses[ci].name,
        courses[ci].desc,
      ) +
      `<div class="panel"><p>${DATA.terms[si].description}</p><p class="note">Each module opens all four subjects, so you can hear how this course connects to your song.</p></div><div class="section-head"><h2>16 weekly practices</h2></div><div class="week-list">${DATA.weeks
        .filter((w) => w.semester === si)
        .map(
          (w) =>
            `<a class="week-row" href="#week/${w.id}"><div class="week-num">${state.done[taskKey(w.id, ci)] ? "✓" : w.week}</div><div><h3>${w.topic}</h3><small>${esc(w.tasks[ci])}</small></div></a>`,
        )
        .join("")}</div>`;
  } else
    app.innerHTML = (
      {
        home,
        assignments,
        planner,
        help,
        curriculum,
        library,
        studio,
        progress,
        settings,
        profile,
        week: () => week(Number(parts[1])),
        quiz: () => quiz(Number(parts[1])),
      }[page] || home
    )();
  if (["week", "course", "quiz"].includes(page)) {
    app.insertAdjacentHTML(
      "afterbegin",
      `<nav class="module-nav" aria-label="Learning navigation"><a href="#curriculum">← My courses</a><a href="#assignments">Assignments</a><a href="#library">Resources</a><a href="#progress">My progress</a></nav>`,
    );
  }
  if (page === "library") filterResources();
  LessonLab.mount();
  document.querySelectorAll(".campus-nav a").forEach((a) => {
    if (a.classList.contains("active")) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  document.title = `${{ home: "Overview", curriculum: "My courses", assignments: "Assignments", planner: "Study planner", help: "Student help", week: "Weekly module", course: "Course", quiz: "Knowledge check", library: "Resources", studio: "Songbook", progress: "Progress", settings: "Settings", profile: "Profile" }[page] || "Overview"} · Resonance Music Campus`;
  app.classList.remove("page-enter");
  void app.offsetWidth;
  app.classList.add("page-enter");
}
document.querySelector(".skip-link").addEventListener("click", (e) => {
  e.preventDefault();
  app.focus();
  app.scrollIntoView({ block: "start" });
});
function renderKeepingFocus(matches) {
  render();
  const target = Array.from(
    app.querySelectorAll("button, input, select, textarea, a"),
  ).find(matches);
  (target || app).focus({ preventScroll: true });
}
const navigation = document.querySelector(".campus-nav");
const navigationToggle = document.querySelector("#nav-toggle");
function closeNavigation() {
  navigation.classList.remove("is-open");
  navigationToggle.setAttribute("aria-expanded", "false");
}
navigation.addEventListener("click", (e) => {
  const link = e.target.closest("a[data-nav]");
  if (link) {
    closeNavigation();
    if (location.hash === link.hash) app.focus({ preventScroll: true });
  }
});
navigationToggle.addEventListener("click", () => {
  const open = navigation.classList.toggle("is-open");
  navigationToggle.setAttribute("aria-expanded", String(open));
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && navigation.classList.contains("is-open")) {
    closeNavigation();
    navigationToggle.focus();
  }
});
window.addEventListener("hashchange", () => {
  closeNavigation();
  render();
  window.scrollTo(0, 0);
  app.focus({ preventScroll: true });
});
app.addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.task) {
    const [id, c] = el.dataset.task.split(",").map(Number);
    taskToggle(id, c, el.checked);
    if (
      location.hash.startsWith("#assignments") ||
      !location.hash ||
      location.hash === "#home"
    )
      renderKeepingFocus((next) => next.dataset.task === el.dataset.task);
  }
  if (el.id === "assignment-filter") {
    assignmentFilter = el.value;
    renderKeepingFocus((next) => next.id === "assignment-filter");
  }
  if (el.dataset.planCheck !== undefined) {
    const plan = state.plans.find((p) => p.id === el.dataset.planCheck);
    if (plan) {
      plan.done = el.checked;
      save();
      renderKeepingFocus(
        (next) => next.dataset.planCheck === el.dataset.planCheck,
      );
    }
  }
  if (["text-size", "high-contrast", "reduce-motion"].includes(el.id)) {
    if (el.id === "text-size") state.accessibility.textSize = el.value;
    if (el.id === "high-contrast")
      state.accessibility.highContrast = el.checked;
    if (el.id === "reduce-motion")
      state.accessibility.reducedMotion = el.checked;
    applyAccessibility();
    save();
    toast("Reading preferences saved.");
  }
  if (el.id === "pace") {
    state.pace = el.value;
    save();
    toast("Study pace updated. Your progress stays with you.");
  }
  if (el.id === "resource-filter") {
    libraryFilter = el.value;
    filterResources();
  }
  if (el.id === "import" && el.files[0]) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result);
        if (
          d.format !== "resonance-backup-v1" ||
          !d.data ||
          typeof d.data.done !== "object"
        )
          throw Error();
        const x = d.data;
        for (const field of ["done", "notes", "quizzes"])
          if (
            x[field] &&
            typeof x[field] === "object" &&
            !Array.isArray(x[field])
          )
            for (const [key, value] of Object.entries(x[field])) {
              if (
                field === "done" &&
                /^\d{1,2}-[0-3]$/.test(key) &&
                Number(key.split("-")[0]) < 64 &&
                typeof value === "boolean"
              )
                state.done[key] = value;
              if (
                field === "notes" &&
                /^\d{1,2}$/.test(key) &&
                Number(key) < 64 &&
                typeof value === "string"
              )
                state.notes[key] = value;
              if (
                field === "quizzes" &&
                /^\d{1,2}$/.test(key) &&
                Number(key) < 64 &&
                Number.isInteger(value) &&
                value >= 0 &&
                value <= 3
              )
                state.quizzes[key] = value;
            }
        if (Array.isArray(x.songs))
          for (const s of x.songs)
            if (
              s &&
              typeof s.title === "string" &&
              typeof s.body === "string" &&
              !state.songs.some((a) => a.title === s.title && a.body === s.body)
            )
              state.songs.push({
                title: s.title,
                body: s.body,
                stage: [
                  "Idea",
                  "Demo",
                  "Recording",
                  "Mixing",
                  "Finished",
                ].includes(s.stage)
                  ? s.stage
                  : "Idea",
              });
        if (Array.isArray(x.plans))
          for (const p of x.plans) {
            if (
              p &&
              typeof p.id === "string" &&
              typeof p.title === "string" &&
              /^\d{4}-\d{2}-\d{2}$/.test(p.date) &&
              !state.plans.some((a) => a.id === p.id)
            )
              state.plans.push({
                id: p.id,
                title: p.title,
                date: p.date,
                course: String(p.course || "General"),
                done: !!p.done,
              });
          }
        save();
        render();
        toast("Backup imported.");
      } catch {
        toast("That file is not a valid Resonance backup.");
      }
    };
    reader.readAsText(el.files[0]);
  }
});
app.addEventListener("input", (e) => {
  if (e.target.dataset.note !== undefined) {
    state.notes[e.target.dataset.note] = e.target.value;
    save();
  }
  if (e.target.dataset.song !== undefined) {
    state.songs[e.target.dataset.song].body = e.target.value;
    save();
  }
  if (e.target.id === "search") {
    librarySearch = e.target.value;
    filterResources();
  }
});
app.addEventListener("click", (e) => {
  const el = e.target.closest("button");
  if (!el) return;
  if (el.dataset.term !== undefined) {
    term = Number(el.dataset.term);
    renderKeepingFocus((next) => next.dataset.term === el.dataset.term);
  }
  if (el.dataset.deletePlan !== undefined) {
    state.plans = state.plans.filter((p) => p.id !== el.dataset.deletePlan);
    save();
    render();
    toast("Study session removed.");
  }
  if (el.hasAttribute("data-print")) window.print();
  if (el.hasAttribute("data-export")) {
    const blob = new Blob(
        [
          JSON.stringify(
            {
              format: "resonance-backup-v1",
              exported: new Date().toISOString(),
              data: state,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "resonance-progress.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Backup downloaded.");
  }
  if (
    el.dataset.deleteSong !== undefined &&
    confirm("Delete this idea from your songbook?")
  ) {
    state.songs.splice(Number(el.dataset.deleteSong), 1);
    save();
    render();
  }
});
app.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (e.target.id === "profile-form") {
    const button = e.target.querySelector("button[type=submit]"),
      error = document.querySelector("#profile-error");
    button.disabled = true;
    error.textContent = "";
    try {
      const form = new FormData(e.target);
      await CampusAccount.updateProfile(Object.fromEntries(form));
      render();
      toast("Your profile has been updated.");
      document.querySelector("#profile-name").focus({ preventScroll: true });
    } catch (issue) {
      error.textContent = issue.message;
      button.disabled = false;
    }
  }
  if (e.target.id === "plan-form") {
    const f = new FormData(e.target);
    state.plans.push({
      id: crypto.randomUUID(),
      title: String(f.get("title")).trim(),
      date: String(f.get("date")),
      course: String(f.get("course")),
      done: false,
    });
    save();
    render();
    toast("Study session added to your planner.");
  }
  if (e.target.id === "song-form") {
    const f = new FormData(e.target);
    state.songs.unshift({
      title: f.get("title"),
      body: f.get("body"),
      stage: f.get("stage"),
    });
    save();
    render();
    toast("Idea added to your songbook.");
  }
  if (e.target.id === "quiz-form") {
    const id = Number(e.target.dataset.id),
      w = DATA.weeks[id],
      f = new FormData(e.target);
    let score = 0;
    const feedback = w.quiz
      .map((q, i) => {
        const correct = Number(f.get("q" + i)) === q[2];
        if (correct) score++;
        return `<p><b>${correct ? "✓" : "↻"} ${i + 1}. ${correct ? "Correct" : "Review: " + q[1][q[2]]}</b><br>${q[3]}</p>`;
      })
      .join("");
    state.quizzes[id] = score;
    save();
    document.querySelector("#quiz-result").innerHTML =
      `<div class="feedback"><h3>${score}/3 — ${score === 3 ? "Ready to apply it." : "Practice, then try again."}</h3>${feedback}<p>Use the module’s practical rubric as well. A quiz score alone does not show performance mastery.</p></div>`;
  }
});
render();
if (typeof CampusAccount !== "undefined" && CampusAccount.needsMigration)
  save();
