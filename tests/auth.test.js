const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createCampusServer } = require("../server/app.cjs");
const { validState } = require("../server/store.cjs");
const PASSWORD = "A long preview-only password!";
async function fixture(t, options = {}) {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "resonance-auth-test-"),
  );
  const app = createCampusServer({
    dataDir: directory,
    setupCode: "local-test-setup-code",
    ...options,
  });
  await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  async function call(route, method = "GET", body, cookie = "", headers = {}) {
    return fetch(base + route, {
      method,
      redirect: "manual",
      headers: {
        ...(method === "GET"
          ? {}
          : {
              Origin: base,
              "Content-Type": "application/json",
              "X-Campus-Request": "1",
            }),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  async function setup() {
    const response = await call("/api/setup", "POST", {
      code: "local-test-setup-code",
      email: "owner@example.test",
      password: PASSWORD,
      displayName: "Test Artist",
    });
    assert.equal(response.status, 201);
    return response.headers.get("set-cookie").split(";")[0];
  }
  return { app, call, setup, base };
}
test("Signed-out requests cannot read private pages, lessons, images, state or database files", async (t) => {
  const f = await fixture(t);
  const root = await f.call("/index.html.html");
  assert.equal(root.status, 303);
  assert.equal(root.headers.get("location"), "/login.html");
  for (const route of [
    "/api/bootstrap",
    "/js/app.js",
    "/js/data.js",
    "/assets/courses/theory.jpg",
  ])
    assert.equal((await f.call(route)).status, 401, route);
  for (const route of [
    "/.private/campus.sqlite",
    "/server/app.cjs",
    "/package.json",
    "/campus-preview.png",
    "/assets/../server/store.cjs",
  ])
    assert.equal((await f.call(route)).status, 404, route);
  assert.equal((await f.call("/login.html")).status, 200);
});
test("Only local one-time setup can create the single owner; passwords are hashed", async (t) => {
  const f = await fixture(t);
  assert.equal(
    (await f.call("/api/setup", "POST", { code: "wrong" })).status,
    403,
  );
  const cookie = await f.setup();
  const account = f.app.db.prepare("SELECT * FROM owner").get();
  assert.notEqual(account.password_hash, PASSWORD);
  assert.equal(account.password_hash.length, 128);
  assert(account.salt.length >= 32);
  assert.equal(
    (await f.call("/api/setup", "POST", { code: "local-test-setup-code" }))
      .status,
    403,
  );
  assert.equal(
    (await f.call("/js/data.js", "GET", undefined, cookie)).status,
    200,
  );
  const boot = await (
    await f.call("/api/bootstrap", "GET", undefined, cookie)
  ).json();
  assert.equal(boot.profile.email, "owner@example.test");
  assert.equal(boot.state, null);
  assert(!JSON.stringify(boot).includes(account.password_hash));
});
test("Login has generic errors, fresh HttpOnly sessions, and effective logout", async (t) => {
  const f = await fixture(t);
  await f.setup();
  const a = await f.call("/api/login", "POST", {
      email: "other@example.test",
      password: PASSWORD,
    }),
    b = await f.call("/api/login", "POST", {
      email: "owner@example.test",
      password: "incorrect",
    });
  assert.equal(a.status, 401);
  assert.deepEqual(await a.json(), await b.json());
  const login = () =>
    f.call("/api/login", "POST", {
      email: "OWNER@example.test",
      password: PASSWORD,
    });
  const first = await login(),
    second = await login();
  const cookie = second.headers.get("set-cookie");
  assert.equal(first.status, 200);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.notEqual(first.headers.get("set-cookie"), cookie);
  const auth = cookie.split(";")[0];
  assert.equal((await f.call("/api/logout", "POST", {}, auth)).status, 200);
  assert.equal(
    (await f.call("/api/bootstrap", "GET", undefined, auth)).status,
    401,
  );
});
test("Mutation requests reject cross-origin requests and missing CSRF headers", async (t) => {
  const f = await fixture(t),
    cookie = await f.setup();
  assert.equal(
    (
      await f.call("/api/profile", "PUT", { displayName: "Changed" }, cookie, {
        Origin: "https://unrelated.example",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.call("/api/logout", "POST", {}, cookie, {
        "X-Campus-Request": "",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.call("/api/profile", "PUT", { displayName: "Changed" }, cookie, {
        "Content-Type": "text/plain",
      })
    ).status,
    415,
  );
});
test("Profiles and learning state persist between sessions without exposing credentials", async (t) => {
  const f = await fixture(t),
    cookie = await f.setup();
  const update = await f.call(
    "/api/profile",
    "PUT",
    {
      displayName: "Updated Artist",
      instrument: "Piano",
      goal: "Finish my first song",
    },
    cookie,
  );
  assert.equal(update.status, 200);
  const state = {
    notes: { 0: "Practice reflection" },
    done: { "0-0": true },
    songs: [{ title: "First song", body: "Verse idea", stage: "Idea" }],
    plans: [
      {
        id: "plan-1",
        title: "Piano",
        date: "2026-11-01",
        course: "Piano",
        done: false,
      },
    ],
  };
  const saved = await f.call(
    "/api/state",
    "PUT",
    { revision: 0, state },
    cookie,
  );
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).revision, 1);
  const boot = await (
    await f.call("/api/bootstrap", "GET", undefined, cookie)
  ).json();
  assert.equal(boot.profile.displayName, "Updated Artist");
  assert.equal(boot.state.notes[0], "Practice reflection");
  assert.equal(
    (
      await f.call(
        "/api/state",
        "PUT",
        { revision: 0, state: { notes: { 0: "Stale device" } } },
        cookie,
      )
    ).status,
    409,
  );
  const latest = await (
    await f.call("/api/bootstrap", "GET", undefined, cookie)
  ).json();
  assert.equal(latest.state.notes[0], "Practice reflection");
  assert.equal(latest.revision, 1);
});
test("State validation rejects malformed backup values before they can be rendered", () => {
  assert.throws(() =>
    validState({ quizzes: { 0: "<script>alert(1)</script>" } }),
  );
  assert.throws(() => validState({ done: { "99-0": true } }));
  assert.throws(() =>
    validState({ songs: [{ title: "x", body: "y", stage: "Unknown" }] }),
  );
  const state = validState({ notes: { 0: "<img src=x onerror=alert(1)>" } });
  assert.equal(state.notes[0], "<img src=x onerror=alert(1)>");
});
test("Failed login attempts are rate limited", async (t) => {
  const f = await fixture(t);
  await f.setup();
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await f.call("/api/login", "POST", {
          email: "owner@example.test",
          password: "wrong",
        })
      ).status,
      401,
    );
  const limited = await f.call("/api/login", "POST", {
    email: "owner@example.test",
    password: PASSWORD,
  });
  assert.equal(limited.status, 429);
  assert(limited.headers.get("retry-after"));
});
test("Expired sessions cannot access private data", async (t) => {
  let time = Date.now();
  const f = await fixture(t, { now: () => time }),
    cookie = await f.setup();
  time += 13 * 3600 * 1000;
  assert.equal(
    (await f.call("/api/bootstrap", "GET", undefined, cookie)).status,
    401,
  );
});
test("Production refuses to start without a canonical HTTPS origin", () => {
  assert.throws(() => createCampusServer({ production: true }), /HTTPS/);
});

test("Setup enforces password length and malformed requests fail without creating an owner", async (t) => {
  const f = await fixture(t);
  const short = await f.call("/api/setup", "POST", {
    code: "local-test-setup-code",
    email: "owner@example.test",
    password: "short",
    displayName: "Artist",
  });
  assert.equal(short.status, 400);
  assert.equal(f.app.configured, false);
  assert.equal((await f.call("/api/setup", "POST", null)).status, 400);
  assert.equal(
    (await f.call("/api/state", "PUT", { revision: 0, state: {} })).status,
    401,
  );
});
test("Production sessions use Secure cookies and cannot run first-owner setup", async (t) => {
  const f = await fixture(t, {
    production: true,
    publicOrigin: "https://campus.example",
  });
  const productionRequest = (route, data) =>
    new Promise((resolve, reject) => {
      const payload = JSON.stringify(data);
      const req = require("node:http").request(
        f.base + route,
        {
          method: "POST",
          headers: {
            Host: "campus.example",
            Origin: "https://campus.example",
            "Content-Type": "application/json",
            "X-Campus-Request": "1",
            "Content-Length": Buffer.byteLength(payload),
          },
        },
        (res) => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () =>
            resolve({ status: res.statusCode, headers: res.headers, body }),
          );
        },
      );
      req.on("error", reject);
      req.end(payload);
    });
  assert.equal(
    (await productionRequest("/api/setup", { code: "local-test-setup-code" }))
      .status,
    403,
  );
  const { hashPassword } = require("../server/store.cjs");
  const p = await hashPassword(PASSWORD);
  f.app.db
    .prepare("INSERT INTO owner VALUES(1,?,?,?,?,?)")
    .run(
      "owner@example.test",
      p.hash,
      p.salt,
      JSON.stringify({ displayName: "Artist", instrument: "Piano", goal: "" }),
      Date.now(),
    );
  const login = await productionRequest("/api/login", {
    email: "owner@example.test",
    password: PASSWORD,
  });
  assert.equal(login.status, 200, login.body);
  assert.match(login.headers["set-cookie"][0], /; Secure/);
  assert(login.headers["strict-transport-security"]);
});

test("A write whose session is revoked while its body arrives cannot change saved work", async (t) => {
  const f = await fixture(t),
    cookie = await f.setup();
  let slow;
  const arrived = new Promise((resolve) =>
    f.app.server.once("request", () => resolve()),
  );
  const response = new Promise((resolve, reject) => {
    slow = require("node:http").request(
      f.base + "/api/state",
      {
        method: "PUT",
        headers: {
          Origin: f.base,
          "Content-Type": "application/json",
          "X-Campus-Request": "1",
          Cookie: cookie,
        },
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      },
    );
    slow.on("error", reject);
    slow.write('{"revision":0,');
  });
  await arrived;
  assert.equal((await f.call("/api/logout", "POST", {}, cookie)).status, 200);
  slow.end('"state":{}}');
  assert.equal(await response, 401);
  assert.equal(
    f.app.db.prepare("SELECT revision FROM campus WHERE id=1").get().revision,
    0,
  );
});
