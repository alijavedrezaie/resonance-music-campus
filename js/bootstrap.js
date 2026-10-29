/* Account data comes from the selected authenticated backend. Hosted source and lesson assets are public; personal work is owner-only. */
const CampusAccount = (() => {
  let revision = 0,
    pending = null,
    saving = false,
    blocked = false,
    timer,
    initialState,
    needsMigration = false;
  let profile = {},
    lastError = "";
  const status = () => document.querySelector("#sync-status");
  const setStatus = (text) => {
    if (status()) status().textContent = text;
  };
  function notice(message, conflict = false) {
    const banner = document.querySelector("#account-notice");
    banner.hidden = false;
    banner.querySelector("p").textContent = message;
    banner.querySelector("[data-account-retry]").hidden = conflict;
    banner.querySelector("[data-account-reload]").hidden = !conflict;
  }
  function downloadPending() {
    if (!pending) return;
    const blob = new Blob(
        [
          JSON.stringify(
            {
              format: "resonance-backup-v1",
              exported: new Date().toISOString(),
              data: pending,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = "resonance-unsaved-backup.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function request(url, method = "GET", body) {
    return CampusBackend.request(url, method, body);
  }
  function loginLocation() {
    return new URL("login.html", document.baseURI).href;
  }
  async function flush() {
    clearTimeout(timer);
    if (blocked) return false;
    if (saving) {
      await new Promise((resolve) => setTimeout(resolve, 80));
      return flush();
    }
    saving = true;
    let current;
    try {
      while (pending) {
        current = pending;
        pending = null;
        setStatus("Saving your work…");
        const saved = await request("/api/state", "PUT", {
          revision,
          state: current,
        });
        revision = saved.revision;
        if (needsMigration) {
          needsMigration = false;
        }
      }
      lastError = "";
      document.querySelector("#account-notice").hidden = true;
      setStatus("All changes saved");
      return true;
    } catch (error) {
      pending ||= current;
      lastError = error.message;
      if (error.status === 409) {
        blocked = true;
        notice(
          "This campus changed on another device. Download your unsaved work, then reload the latest saved version.",
          true,
        );
      } else if (error.status === 401) {
        blocked = true;
        notice(
          "Your session ended. Save a backup of your unsaved work, then sign in again.",
          true,
        );
      } else
        notice(
          error.status === 400
            ? error.message
            : "Your changes are waiting in this tab. Reconnect and retry, or download a backup before closing it.",
        );
      setStatus("Changes not yet saved");
      return false;
    } finally {
      saving = false;
    }
  }
  function save(state) {
    pending = JSON.parse(JSON.stringify(state));
    clearTimeout(timer);
    setStatus("Changes waiting to save…");
    timer = setTimeout(() => void flush(), 400);
  }
  function avatar() {
    const initials = (profile.displayName || "Artist")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
    document
      .querySelectorAll("[data-avatar]")
      .forEach((el) => (el.textContent = initials));
  }
  async function updateProfile(value) {
    const result = await request("/api/profile", "PUT", value);
    profile = result.profile;
    avatar();
    return profile;
  }
  async function logout() {
    if (!(await flush())) {
      downloadPending();
      pending = null;
    }
    try {
      await request("/api/logout", "POST", {});
      if (typeof LessonLab !== "undefined") LessonLab.stop();
      location.replace(loginLocation());
    } catch (error) {
      if (error.status === 401) {
        location.replace(loginLocation());
        return;
      }
      notice(
        "Sign-out needs a connection to your campus. Your unsaved work has been downloaded if needed; reconnect and try Sign out again.",
      );
    }
  }
  async function start() {
    try {
      if (location.protocol === "file:")
        throw Error(
          "Start this private campus with npm start and open http://127.0.0.1:3000.",
        );
      const account = await request("/api/bootstrap");
      revision = account.revision;
      profile = account.profile;
      initialState = account.state;
      if (initialState === null) {
        try {
          const legacy = JSON.parse(localStorage.getItem("resonance-v1"));
          if (legacy && typeof legacy === "object" && !Array.isArray(legacy)) {
            initialState = legacy;
            needsMigration = true;
          }
        } catch {
          /* A backup can be imported after sign-in. */
        }
      }
      initialState ||= {};
      avatar();
      setStatus("All changes saved");
      for (const src of [
        "js/data.js",
        "js/lesson-data.js",
        "js/lesson-visuals.js",
        "js/app.js",
      ])
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = src;
          script.onload = resolve;
          script.onerror = () =>
            reject(Error("A campus file could not load. Please reload."));
          document.body.append(script);
        });
    } catch (error) {
      if (error.status === 401) {
        location.replace(loginLocation());
        return;
      }
      const app = document.querySelector("#app");
      app.replaceChildren();
      const heading = document.createElement("h1");
      heading.textContent = CampusBackend.isCloud
        ? "Your hosted campus needs its account setup"
        : "Your campus needs its private server";
      const p = document.createElement("p");
      p.textContent = CampusBackend.isCloud
        ? error.message +
          " Check the Supabase account configuration, then try signing in again."
        : "Run npm start in the project terminal, then open http://127.0.0.1:3000. A static preview server cannot run the local login.";
      const link = document.createElement("a");
      link.href = loginLocation();
      link.textContent = "Go to sign in";
      link.className = "button";
      app.append(heading, p, link);
    }
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-account-logout]")) void logout();
    if (e.target.closest("[data-account-retry]")) {
      blocked = false;
      void flush();
    }
    if (e.target.closest("[data-account-backup]")) downloadPending();
    if (e.target.closest("[data-account-reload]")) {
      downloadPending();
      pending = null;
      location.reload();
    }
  });
  window.addEventListener("beforeunload", (e) => {
    if (pending || saving) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) location.reload();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    void request("/api/session")
      .then((session) => {
        if (!session.authenticated) {
          if (typeof LessonLab !== "undefined") LessonLab.stop();
          if (pending)
            notice(
              "Your session ended. Download your unsaved work, then sign in again.",
              true,
            );
          else location.replace(loginLocation());
        }
      })
      .catch(() => setStatus("Connection unavailable"));
  });
  return {
    start,
    save,
    flush,
    updateProfile,
    get profile() {
      return profile;
    },
    get initialState() {
      return initialState;
    },
    get needsMigration() {
      return needsMigration;
    },
  };
})();
void CampusAccount.start();
