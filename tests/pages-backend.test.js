const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createBackend, validateConfig } = require("../js/backend.js");
const { validState } = require("../js/state-validation.js");
const CONFIG = {
  backend: "supabase",
  url: "https://campustest.supabase.co",
  publishableKey: "sb_publishable_test_only_not_a_real_key",
};
const profile = {
  displayName: "Test Artist",
  instrument: "Piano",
  goal: "Write a song",
};
function fixture({ owner = true, expiresIn = 3600 } = {}) {
  const calls = [],
    data = new Map();
  let refreshes = 0;
  const storage = {
    getItem: (key) => data.get(key) || null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
  const fetch = async (url, options) => {
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url, options, body });
    const response = (value, status = 200) => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => value,
    });
    if (url.includes("token?grant_type=password"))
      return response({
        access_token: "test-access",
        refresh_token: "test-refresh",
        expires_in: expiresIn,
        user: { id: "test-owner", email: "owner@example.test" },
      });
    if (url.includes("token?grant_type=refresh_token")) {
      refreshes++;
      return response({
        access_token: "refreshed-access",
        refresh_token: "refreshed-refresh",
        expires_in: 3600,
        user: { id: "test-owner", email: "owner@example.test" },
      });
    }
    if (url.endsWith("/user"))
      return response({
        id: "test-owner",
        email: "owner@example.test",
        created_at: "2026-01-01",
      });
    if (url.includes("logout?"))
      return {
        ok: true,
        status: 204,
        json: async () => {
          throw Error("No content");
        },
      };
    if (url.endsWith("/campus_is_owner")) return response(owner);
    if (url.endsWith("/campus_bootstrap"))
      return response({
        profile,
        state: { notes: { 0: "Private reflection" } },
        revision: 3,
      });
    if (url.endsWith("/campus_save_state"))
      return response({ revision: body.p_revision + 1 });
    if (url.endsWith("/campus_update_profile")) return response(body.p_profile);
    throw Error("Unexpected request " + url);
  };
  const backend = createBackend({
    config: CONFIG,
    fetch,
    storage,
    validateState: validState,
  });
  return { backend, calls, data, refreshes: () => refreshes };
}
test("Hosted configuration rejects private service keys and non-project URLs", () => {
  assert.doesNotThrow(() => validateConfig(CONFIG));
  for (const patch of [
    { publishableKey: "sb_secret_super_private_1234567890" },
    { url: "http://campustest.supabase.co" },
    { url: "https://unrelated.example" },
    { url: "https://campustest.supabase.co/other" },
  ])
    assert.throws(() => validateConfig({ ...CONFIG, ...patch }));
  const jwt = (role) =>
    Buffer.from("{}").toString("base64url") +
    "." +
    Buffer.from(JSON.stringify({ role })).toString("base64url") +
    ".test";
  assert.throws(() =>
    validateConfig({ ...CONFIG, publishableKey: jwt("service_role") }),
  );
  assert.doesNotThrow(() =>
    validateConfig({ ...CONFIG, publishableKey: jwt("anon") }),
  );
});
test("Signed-out cloud visitors get no profile or learning state", async () => {
  const f = fixture();
  assert.equal((await f.backend.request("/api/session")).authenticated, false);
  await assert.rejects(
    f.backend.request("/api/bootstrap"),
    (e) => e.status === 401,
  );
  assert.equal(f.calls.length, 0);
});
test("Owner sign-in reads private state with authorization and never stores a password", async () => {
  const f = fixture();
  await f.backend.request("/api/login", "POST", {
    email: "owner@example.test",
    password: "the-test-password",
  });
  const result = await f.backend.request("/api/bootstrap");
  assert.equal(result.profile.email, "owner@example.test");
  assert.equal(result.state.notes[0], "Private reflection");
  assert.equal(result.revision, 3);
  assert(!JSON.stringify([...f.data.values()]).includes("the-test-password"));
  const call = f.calls.find((c) => c.url.endsWith("/campus_bootstrap"));
  assert.equal(call.options.headers.Authorization, "Bearer test-access");
  assert.equal(call.options.headers.apikey, CONFIG.publishableKey);
});
test("Non-owner authenticated users are denied and their session is cleared", async () => {
  const f = fixture({ owner: false });
  await assert.rejects(
    f.backend.request("/api/login", "POST", {
      email: "other@example.test",
      password: "test-password",
    }),
    (e) => e.status === 403,
  );
  assert.equal(f.data.size, 0);
  assert.equal((await f.backend.request("/api/session")).authenticated, false);
});
test("Expired cloud tokens refresh before authenticated requests", async () => {
  const f = fixture({ expiresIn: 1 });
  await f.backend.request("/api/login", "POST", {
    email: "owner@example.test",
    password: "test",
  });
  await f.backend.request("/api/bootstrap");
  assert.equal(f.refreshes(), 1);
  assert(
    f.calls.some(
      (c) => c.options.headers.Authorization === "Bearer refreshed-access",
    ),
  );
});
test("Cloud updates include the revision and normalize personal data", async () => {
  const f = fixture();
  await f.backend.request("/api/login", "POST", {
    email: "owner@example.test",
    password: "test",
  });
  const result = await f.backend.request("/api/state", "PUT", {
    revision: 3,
    state: { notes: { 0: "A new idea" } },
  });
  assert.equal(result.revision, 4);
  const call = f.calls.find((c) => c.url.endsWith("/campus_save_state"));
  assert.equal(call.body.p_revision, 3);
  assert.equal(call.body.p_state.notes[0], "A new idea");
  await assert.rejects(
    f.backend.request("/api/state", "PUT", {
      revision: 4,
      state: { quizzes: { 0: "<script>bad</script>" } },
    }),
  );
});
test("Cloud sign-out handles HTTP 204 and clears the browser session", async () => {
  const f = fixture();
  await f.backend.request("/api/login", "POST", {
    email: "owner@example.test",
    password: "test",
  });
  await f.backend.request("/api/logout", "POST", {});
  assert.equal(f.data.size, 0);
  assert.equal((await f.backend.request("/api/session")).authenticated, false);
});
test("Local mode keeps the same-origin server interface", async () => {
  let sent;
  const backend = createBackend({
    config: { backend: "local" },
    fetch: async (url, options) => {
      sent = { url, options };
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    },
  });
  await backend.request("/api/login", "POST", {
    email: "local@example.test",
    password: "test",
  });
  assert.equal(sent.url, "/api/login");
  assert.equal(sent.options.headers["X-Campus-Request"], "1");
});
