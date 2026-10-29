const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const store = require("./store.cjs");
const ROOT = path.resolve(__dirname, "..");
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const cookieName = "resonance_session";
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
};
const publicFiles = new Set([
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
]);
const privateFiles = new Set([
  "/index.html.html",
  "/js/bootstrap.js",
  "/js/app.js",
  "/js/data.js",
  "/js/lesson-data.js",
  "/js/lesson-visuals.js",
  "/css/lessons.css",
  "/css/responsive.css",
  ...["theory", "production", "guitar", "piano"].map(
    (n) => `/assets/courses/${n}.jpg`,
  ),
]);
function createCampusServer(options = {}) {
  const production =
    options.production ?? process.env.NODE_ENV === "production";
  const publicOrigin = options.publicOrigin || process.env.PUBLIC_ORIGIN || "";
  if (
    production &&
    (!publicOrigin || new URL(publicOrigin).protocol !== "https:")
  )
    throw Error(
      "Production requires PUBLIC_ORIGIN=https://your-domain and an HTTPS reverse proxy.",
    );
  const db = store.openStore(options.dataDir || store.defaultDataDir());
  let setupCode =
      options.setupCode || crypto.randomBytes(18).toString("base64url"),
    creating = false,
    hashes = 0;
  const owner = () => db.prepare("SELECT * FROM owner WHERE id=1").get();
  const sessionCookie = (token, maxAge = 7 * 24 * 3600) =>
    `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${production ? "; Secure" : ""}`;
  const json = (res, status, data) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
    });
    res.end(JSON.stringify(data));
  };
  const redirect = (res, where) => {
    res.writeHead(303, { Location: where });
    res.end();
  };
  const now = () => (options.now ? options.now() : Date.now());
  const local = (req) =>
    ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress);
  function expectedOrigins() {
    return publicOrigin
      ? [new URL(publicOrigin).origin]
      : [
          `http://127.0.0.1:${server.address().port}`,
          `http://localhost:${server.address().port}`,
          `http://[::1]:${server.address().port}`,
        ];
  }
  function requireMutation(req) {
    if (
      !expectedOrigins().includes(req.headers.origin) ||
      req.headers["x-campus-request"] !== "1"
    )
      throw Object.assign(
        new Error(
          "This request did not come from your campus. Reload and try again.",
        ),
        { status: 403 },
      );
    if (!/^application\/json(?:;|$)/i.test(req.headers["content-type"] || ""))
      throw Object.assign(new Error("Expected JSON."), { status: 415 });
  }
  async function body(req, limit = 2 * 1024 * 1024) {
    let chunks = [],
      size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limit)
        throw Object.assign(new Error("That request is too large."), {
          status: 413,
        });
      chunks.push(chunk);
    }
    try {
      const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw Error();
      return parsed;
    } catch {
      throw Object.assign(new Error("Invalid JSON."), { status: 400 });
    }
  }
  function session(req) {
    const token = (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const s = db
      .prepare("SELECT * FROM sessions WHERE token_hash=?")
      .get(hash(token));
    if (!s) return null;
    if (s.expires_at <= now() || s.last_seen < now() - 12 * 3600 * 1000) {
      db.prepare("DELETE FROM sessions WHERE token_hash=?").run(s.token_hash);
      return null;
    }
    db.prepare("UPDATE sessions SET last_seen=? WHERE token_hash=?").run(
      now(),
      s.token_hash,
    );
    return s;
  }
  function requireSession(req) {
    const s = session(req);
    if (!s)
      throw Object.assign(new Error("Sign in to your campus."), {
        status: 401,
      });
    return s;
  }
  function createSession(res) {
    const token = crypto.randomBytes(32).toString("hex");
    db.prepare("DELETE FROM sessions WHERE expires_at<=? OR last_seen<?").run(
      now(),
      now() - 12 * 3600 * 1000,
    );
    db.prepare("INSERT INTO sessions VALUES(?,?,?,?)").run(
      hash(token),
      now(),
      now(),
      now() + 7 * 24 * 3600 * 1000,
    );
    res.setHeader("Set-Cookie", sessionCookie(token));
  }
  function rate(key, max = 5) {
    const a = db.prepare("SELECT * FROM attempts WHERE key=?").get(key);
    if (a && a.window_start > now() - 15 * 60000 && a.count >= max)
      throw Object.assign(
        new Error("Too many attempts. Wait 15 minutes before trying again."),
        { status: 429 },
      );
  }
  function failed(key) {
    const a = db.prepare("SELECT * FROM attempts WHERE key=?").get(key);
    if (!a || a.window_start <= now() - 15 * 60000)
      db.prepare("INSERT OR REPLACE INTO attempts VALUES(?,1,?)").run(
        key,
        now(),
      );
    else db.prepare("UPDATE attempts SET count=count+1 WHERE key=?").run(key);
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    if (production)
      res.setHeader("Strict-Transport-Security", "max-age=31536000");
    try {
      const expected = expectedOrigins();
      if (!expected.some((origin) => new URL(origin).host === req.headers.host))
        throw Object.assign(new Error("Unknown host."), { status: 403 });
      const url = new URL(req.url, expected[0]),
        route = url.pathname;
      if (!["GET", "HEAD"].includes(req.method)) requireMutation(req);
      if (route === "/api/session" && req.method === "GET")
        return json(res, 200, {
          configured: !!owner(),
          authenticated: !!session(req),
          setupAllowed: !production && local(req) && !owner(),
        });
      if (route === "/api/setup" && req.method === "POST") {
        if (production || !local(req) || owner() || creating)
          throw Object.assign(new Error("Account setup is unavailable."), {
            status: 403,
          });
        rate("setup", 10);
        const input = await body(req, 16384);
        if (
          typeof input.code !== "string" ||
          input.code.length > 128 ||
          !crypto.timingSafeEqual(
            Buffer.from(hash(input.code), "hex"),
            Buffer.from(hash(setupCode), "hex"),
          )
        ) {
          failed("setup");
          throw Object.assign(
            new Error("Check the setup code printed in your server terminal."),
            { status: 403 },
          );
        }
        const email = store.emailAddress(input.email);
        store.validatePassword(input.password);
        const profile = store.validateProfile({
          displayName: input.displayName,
          instrument: "Exploring",
          goal: "",
        });
        creating = true;
        try {
          const p = await store.hashPassword(input.password);
          db.prepare("INSERT INTO owner VALUES(1,?,?,?,?,?)").run(
            email,
            p.hash,
            p.salt,
            JSON.stringify(profile),
            now(),
          );
          setupCode = "";
          createSession(res);
          return json(res, 201, { ok: true });
        } finally {
          creating = false;
        }
      }
      if (route === "/api/login" && req.method === "POST") {
        rate("login");
        const input = await body(req, 16384),
          o = owner();
        if (!o)
          throw Object.assign(
            new Error("Create your owner account on this computer first."),
            { status: 403 },
          );
        if (
          typeof input.password !== "string" ||
          input.password.length > 128 ||
          typeof input.email !== "string" ||
          input.email.length > 254
        ) {
          failed("login");
          return json(res, 401, { error: "Email or password is incorrect." });
        }
        if (hashes >= 2)
          throw Object.assign(
            new Error("Please wait a moment and try again."),
            { status: 429 },
          );
        hashes++;
        let correct;
        try {
          correct = await store.checkPassword(input.password, o);
        } finally {
          hashes--;
        }
        if (
          !correct ||
          input.email.trim().toLowerCase() !== o.email ||
          owner().password_hash !== o.password_hash
        ) {
          failed("login");
          return json(res, 401, { error: "Email or password is incorrect." });
        }
        db.prepare("DELETE FROM attempts WHERE key=?").run("login");
        createSession(res);
        return json(res, 200, { ok: true });
      }
      if (route === "/api/logout" && req.method === "POST") {
        const s = requireSession(req);
        db.prepare("DELETE FROM sessions WHERE token_hash=?").run(s.token_hash);
        res.setHeader("Set-Cookie", sessionCookie("", 0));
        return json(res, 200, { ok: true });
      }
      if (route === "/api/bootstrap" && req.method === "GET") {
        requireSession(req);
        const c = db.prepare("SELECT * FROM campus WHERE id=1").get();
        return json(res, 200, {
          profile: store.profile(owner()),
          state: c.state ? JSON.parse(c.state) : null,
          revision: c.revision,
        });
      }
      if (route === "/api/profile" && req.method === "PUT") {
        requireSession(req);
        const p = store.validateProfile(await body(req, 16384));
        requireSession(req);
        db.prepare("UPDATE owner SET profile=? WHERE id=1").run(
          JSON.stringify(p),
        );
        return json(res, 200, { profile: store.profile(owner()) });
      }
      if (route === "/api/state" && req.method === "PUT") {
        requireSession(req);
        const input = await body(req);
        requireSession(req);
        if (!Number.isSafeInteger(input.revision) || input.revision < 0)
          throw Object.assign(new Error("Missing state revision."), {
            status: 400,
          });
        const state = store.validState(input.state);
        const result = db
          .prepare(
            "UPDATE campus SET state=?,revision=revision+1 WHERE id=1 AND revision=?",
          )
          .run(JSON.stringify(state), input.revision);
        if (!result.changes)
          return json(res, 409, {
            error:
              "Your work changed on another device. Save a backup before reloading.",
          });
        return json(res, 200, { revision: input.revision + 1 });
      }
      if (route.startsWith("/api/"))
        return json(res, 404, { error: "Not found." });
      if (!["GET", "HEAD"].includes(req.method))
        return json(res, 405, { error: "Method not allowed." });
      if (route === "/")
        return redirect(res, session(req) ? "/index.html.html" : "/login.html");
      if (route === "/favicon.ico") return redirect(res, "/assets/logo.svg");
      if (route === "/login.html" && session(req))
        return redirect(res, "/index.html.html");
      if (privateFiles.has(route) && !session(req))
        return route.endsWith(".html")
          ? redirect(res, "/login.html")
          : json(res, 401, { error: "Sign in to your campus." });
      if (!publicFiles.has(route) && !privateFiles.has(route))
        return json(res, 404, { error: "Not found." });
      const content = await fs.readFile(path.join(ROOT, route));
      res.writeHead(200, {
        "Content-Type": mime[path.extname(route)] || "application/octet-stream",
      });
      res.end(req.method === "HEAD" ? undefined : content);
    } catch (error) {
      if (error.status === 429) res.setHeader("Retry-After", "900");
      json(res, error.status || 500, {
        error: error.status
          ? error.message
          : "Something went wrong. Your saved work has not been changed.",
      });
    }
  });
  return {
    server,
    db,
    get setupCode() {
      return setupCode;
    },
    get configured() {
      return !!owner();
    },
    close() {
      return new Promise((resolve) =>
        server.close(() => {
          db.close();
          resolve();
        }),
      );
    },
  };
}
module.exports = { createCampusServer };
