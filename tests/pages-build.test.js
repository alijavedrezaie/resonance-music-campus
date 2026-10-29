const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { buildPages } = require("../scripts/build-pages.cjs");
test("Pages artifact contains only website files and works at a repository subpath", async (t) => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "resonance-pages-test-"),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await buildPages({
    output: directory,
    url: "https://campustest.supabase.co",
    publishableKey: "sb_publishable_test_only_not_a_real_key",
  });
  const index = await fs.readFile(path.join(directory, "index.html"), "utf8"),
    login = await fs.readFile(path.join(directory, "login.html"), "utf8"),
    config = await fs.readFile(
      path.join(directory, "js/hosting-config.js"),
      "utf8",
    );
  assert(index.includes("js/backend.js"));
  assert(index.includes("js/bootstrap.js"));
  assert(login.includes("js/hosting-config.js"));
  const reset = await fs.readFile(path.join(directory, "reset-password.html"), "utf8");
  const version = login.match(/js\/backend\.js\?v=([a-f0-9]{16})/)[1];
  for (const page of [index, login, reset]) {
    const assets = [...page.matchAll(/(?:src|href)="((?:js|css|assets)\/[^\"]+)"/g)];
    assert(assets.length > 0);
    assert(assets.every((match) => match[1].endsWith(`?v=${version}`)));
  }
  assert(!login.includes('href="/login.html"'));
  assert(config.includes('"backend": "supabase"'));
  for (const privatePath of [
    "server",
    "supabase",
    "tests",
    ".private",
    "README.md",
    "package.json",
    "node_modules",
    "legacy-export.html",
    "profile-preview.png",
    "campus-preview.png",
  ])
    await assert.rejects(fs.stat(path.join(directory, privatePath)));
  assert.equal(
    new URL("login.html", "https://example.github.io/resonance/index.html.html")
      .pathname,
    "/resonance/login.html",
  );
  await buildPages({
    output: directory,
    url: "https://campustest.supabase.co",
    publishableKey: "sb_publishable_changed_test_only_not_a_real_key",
  });
  const rebuilt = await fs.readFile(path.join(directory, "reset-password.html"), "utf8");
  assert(!rebuilt.includes(`?v=${version}`));
});
test("Pages build fails before publishing a secret key or missing project configuration", async () => {
  await assert.rejects(
    buildPages({
      publishableKey: "sb_secret_do_not_publish_this_key",
      url: "https://campustest.supabase.co",
    }),
  );
  await assert.rejects(
    buildPages({ url: undefined, publishableKey: undefined }),
  );
});
