const { DatabaseSync } = require("node:sqlite");
const { mkdirSync, chmodSync } = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const defaultDataDir = () =>
  process.env.CAMPUS_DATA_DIR ||
  path.join(require("node:os").homedir(), ".resonance-music-campus");
const { promisify } = require("node:util");
const derive = promisify(crypto.scrypt);
const SCRYPT = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
async function hashPassword(
  password,
  salt = crypto.randomBytes(24).toString("hex"),
) {
  const hash = await derive(password, salt, 64, SCRYPT);
  return { salt, hash: hash.toString("hex") };
}
async function checkPassword(password, owner) {
  const candidate = await hashPassword(password, owner.salt);
  return crypto.timingSafeEqual(
    Buffer.from(candidate.hash, "hex"),
    Buffer.from(owner.password_hash, "hex"),
  );
}
function openStore(directory) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  const file = path.join(directory, "campus.sqlite");
  const db = new DatabaseSync(file);
  chmodSync(file, 0o600);
  db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=DELETE;
    CREATE TABLE IF NOT EXISTS owner(id INTEGER PRIMARY KEY CHECK(id=1),email TEXT NOT NULL,password_hash TEXT NOT NULL,salt TEXT NOT NULL,profile TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,created_at INTEGER NOT NULL,last_seen INTEGER NOT NULL,expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS campus(id INTEGER PRIMARY KEY CHECK(id=1),state TEXT,revision INTEGER NOT NULL DEFAULT 0);
    INSERT OR IGNORE INTO campus(id,state,revision) VALUES(1,NULL,0);
    CREATE TABLE IF NOT EXISTS attempts(key TEXT PRIMARY KEY,count INTEGER NOT NULL,window_start INTEGER NOT NULL);
  `);
  return db;
}
function profile(owner) {
  return {
    ...JSON.parse(owner.profile),
    email: owner.email,
    createdAt: new Date(owner.created_at).toISOString(),
  };
}
function validatePassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 15 ||
    password.length > 128
  )
    throw Object.assign(
      new Error(
        "Use a password between 15 and 128 characters. Spaces and pasted passwords are welcome.",
      ),
      { status: 400 },
    );
}
function emailAddress(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (email.length > 254 || !/^\S+@\S+\.\S+$/.test(email))
    throw Object.assign(new Error("Enter a valid email address."), {
      status: 400,
    });
  return email;
}
function text(value, max, field) {
  if (typeof value !== "string" || value.length > max)
    throw Object.assign(
      new Error(`Check ${field}; it must be text up to ${max} characters.`),
      { status: 400 },
    );
  return value;
}
function validateProfile(value) {
  const displayName = text(value?.displayName, 80, "your name").trim();
  if (!displayName)
    throw Object.assign(new Error("Enter your display name."), { status: 400 });
  const instrument = [
    "Guitar",
    "Piano",
    "Guitar & piano",
    "Music production",
    "Voice",
    "Exploring",
  ].includes(value.instrument)
    ? value.instrument
    : "Exploring";
  return {
    displayName,
    instrument,
    goal: text(value.goal ?? "", 1000, "your learning goal").trim(),
  };
}
const { validState } = require("../js/state-validation.js");

module.exports = {
  defaultDataDir,
  openStore,
  hashPassword,
  checkPassword,
  profile,
  validatePassword,
  emailAddress,
  validateProfile,
  validState,
};
