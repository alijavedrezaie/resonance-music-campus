process.umask(0o077);
const { createInterface } = require("node:readline/promises");
const { Writable } = require("node:stream");
const {
  openStore,
  defaultDataDir,
  hashPassword,
  validatePassword,
} = require("../server/store.cjs");
(async () => {
  if (!process.stdin.isTTY)
    throw Error(
      "Run this command directly in your own terminal. Password input will be hidden.",
    );
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, done) {
      if (!muted) process.stdout.write(chunk);
      done();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  const db = openStore(defaultDataDir());
  try {
    const owner = db.prepare("SELECT email FROM owner WHERE id=1").get();
    if (!owner) throw Error("Create your owner account with npm start first.");
    const email = await rl.question("Account email: ");
    if (email.trim().toLowerCase() !== owner.email)
      throw Error("That email does not match the owner account.");
    process.stdout.write("New password (15–128 characters; hidden): ");
    muted = true;
    const password = await rl.question("");
    muted = false;
    process.stdout.write("\n");
    validatePassword(password);
    process.stdout.write("Confirm password (hidden): ");
    muted = true;
    const confirmation = await rl.question("");
    muted = false;
    process.stdout.write("\n");
    if (confirmation !== password)
      throw Error("Passwords did not match. Nothing changed.");
    const p = await hashPassword(password);
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("UPDATE owner SET password_hash=?,salt=? WHERE id=1").run(
        p.hash,
        p.salt,
      );
      db.exec("DELETE FROM sessions; COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    console.log("Password updated. Previous sessions have been signed out.");
  } finally {
    rl.close();
    db.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
