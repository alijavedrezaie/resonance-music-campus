/* Explicit allowlist: never copy the repository root into a Pages artifact. */
const fs = require("node:fs/promises");
const path = require("node:path");
const { validateConfig } = require("../js/backend.js");
const ROOT = path.resolve(__dirname, "..");
const FILES = [
  "index.html.html",
  "login.html",
  "reset-password.html",
  ...[
    "styles",
    "campus",
    "lessons",
    "accessibility",
    "account",
    "responsive",
  ].map((n) => `css/${n}.css`),
  ...[
    "bootstrap",
    "backend",
    "state-validation",
    "login",
    "recovery",
    "app",
    "data",
    "lesson-data",
    "lesson-visuals",
  ].map((n) => `js/${n}.js`),
  "assets/logo.svg",
  ...["theory", "production", "guitar", "piano"].map(
    (n) => `assets/courses/${n}.jpg`,
  ),
];
async function buildPages({
  output = path.join(ROOT, "dist"),
  url = process.env.SUPABASE_URL,
  publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY,
} = {}) {
  const config = { backend: "supabase", url, publishableKey };
  validateConfig(config);
  const destination = path.resolve(output);
  if (destination === ROOT || destination === path.parse(destination).root)
    throw Error("Use a dedicated output directory.");
  // A manifest makes repeated builds safe without deleting arbitrary directories.
  await fs.mkdir(destination, { recursive: true });
  const existing = await fs.readdir(destination);
  if (existing.length && !existing.includes(".campus-pages-build"))
    throw Error(
      "Output directory must be empty or an existing campus Pages build.",
    );
  if (existing.includes(".campus-pages-build"))
    for (const file of existing)
      await fs.rm(path.join(destination, file), {
        recursive: true,
        force: true,
      });
  await fs.writeFile(
    path.join(destination, ".campus-pages-build"),
    "Generated website files only.\n",
  );
  for (const file of FILES) {
    const target = path.join(destination, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(path.join(ROOT, file), target);
  }
  await fs.copyFile(
    path.join(ROOT, "index.html.html"),
    path.join(destination, "index.html"),
  );
  await fs.writeFile(
    path.join(destination, "js/hosting-config.js"),
    `/* Public project settings. No secret/service-role key. */\nglobalThis.CAMPUS_CONFIG = Object.freeze(${JSON.stringify(config, null, 2)});\n`,
  );
  await fs.writeFile(path.join(destination, ".nojekyll"), "");
  return { directory: destination, files: FILES.length + 4 };
}
if (require.main === module)
  buildPages()
    .then((result) =>
      console.log(
        `Pages artifact ready in ${result.directory} (${result.files} files).`,
      ),
    )
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
module.exports = { buildPages, FILES };
