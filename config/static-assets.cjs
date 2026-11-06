/* Explicit website allowlist shared by the local server and Pages build. */
const PUBLIC_FILES = [
  "/login.html",
  "/js/login.js",
  "/js/hosting-config.js",
  "/js/backend.js",
  "/js/state-validation.js",
  "/assets/logo.svg",
  "/css/styles.css",
  "/css/campus.css",
  "/css/accessibility.css",
  "/css/account.css",
];
const PRIVATE_FILES = [
  "/index.html",
  "/js/bootstrap.js",
  "/js/app.js",
  "/js/guitar-tools.js",
  "/js/guitar-analysis.js",
  "/js/guitar-service.js",
  "/js/lyrics-sheet.js",
  "/css/guitar-tools.css",
  "/js/data.js",
  "/js/lesson-data.js",
  "/js/lesson-visuals.js",
  "/css/lessons.css",
  "/css/responsive.css",
  ...["theory", "production", "guitar", "piano"].map(
    (n) => `/assets/courses/${n}.jpg`,
  ),
];
module.exports = { PUBLIC_FILES, PRIVATE_FILES };
