/* One account interface for the local Node server and GitHub Pages + Supabase.
   Only public project configuration belongs here; never a service-role key. */
(function (root, factory) {
  const implementation = factory();
  if (typeof module === "object" && module.exports)
    module.exports = implementation;
  else
    root.CampusBackend = implementation.createBackend({
      config: root.CAMPUS_CONFIG || { backend: "local" },
      fetch: root.fetch.bind(root),
      storage: root.sessionStorage,
      validateState: root.CampusState.validState,
    });
})(globalThis, () => {
  const SESSION_KEY = "resonance-cloud-session-v1";
  function validateConfig(config) {
    if (config.backend !== "supabase") return;
    let url;
    try {
      url = new URL(config.url);
    } catch {
      throw Error("Set the Supabase project URL before deploying.");
    }
    if (
      url.protocol !== "https:" ||
      !url.hostname.endsWith(".supabase.co") ||
      url.username ||
      url.password ||
      !["", "/"].includes(url.pathname) ||
      url.search ||
      url.hash
    )
      throw Error("Use the HTTPS project URL from your Supabase dashboard.");
    const key = config.publishableKey;
    if (
      typeof key !== "string" ||
      key.length < 25 ||
      key.startsWith("sb_secret_")
    )
      throw Error("Use a public Supabase publishable key, never a secret key.");
    if (!key.startsWith("sb_publishable_")) {
      let claims;
      try {
        claims = JSON.parse(
          atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
        );
      } catch {
        throw Error("The Supabase public key is not valid.");
      }
      if (claims.role !== "anon")
        throw Error(
          "Only the public anon or publishable key may be included in this website.",
        );
    }
  }
  function createBackend({
    config,
    fetch,
    storage,
    validateState,
    now = () => Date.now(),
  }) {
    const cloud = config.backend === "supabase";
    let session = null,
      refreshing = null;
    const storageKey = SESSION_KEY + ":" + String(config.url || "local");
    function error(message, status) {
      return Object.assign(new Error(message), { status });
    }
    function persist(value) {
      session = value;
      try {
        if (value) storage.setItem(storageKey, JSON.stringify(value));
        else storage.removeItem(storageKey);
      } catch {
        /* Memory-only sessions still work until this page closes. */
      }
    }
    function localUrl(route) {
      return route;
    }
    async function network(url, options = {}) {
      const controller = new AbortController(),
        timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          cache: "no-store",
        });
        if (response.status === 204) return {};
        let result;
        try {
          result = await response.json();
        } catch {
          throw error(
            "Your campus backend is not available. Check its setup and try again.",
            response.status,
          );
        }
        if (!response.ok)
          throw error(
            result.error_description ||
              result.msg ||
              result.message ||
              result.error ||
              "Unable to contact your campus.",
            response.status,
          );
        return result;
      } finally {
        clearTimeout(timer);
      }
    }
    function cloudHeaders(accessToken) {
      return {
        "Content-Type": "application/json",
        apikey: config.publishableKey,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      };
    }
    async function auth(path, method = "GET", data, token) {
      return network(`${config.url.replace(/\/$/, "")}/auth/v1/${path}`, {
        method,
        headers: cloudHeaders(token),
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      });
    }
    function storeSession(value) {
      if (
        typeof value?.access_token !== "string" ||
        typeof value.refresh_token !== "string"
      )
        throw error("The sign-in service did not return a valid session.", 401);
      persist({
        access_token: value.access_token,
        refresh_token: value.refresh_token,
        expires_at:
          value.expires_at ||
          Math.floor(now() / 1000) + Number(value.expires_in || 3600),
        user: value.user || session?.user,
      });
    }
    async function access() {
      if (!session) throw error("Sign in to your campus.", 401);
      if (session.expires_at > Math.floor(now() / 1000) + 60)
        return session.access_token;
      if (!refreshing)
        refreshing = (async () => {
          try {
            storeSession(
              await auth("token?grant_type=refresh_token", "POST", {
                refresh_token: session.refresh_token,
              }),
            );
            return session.access_token;
          } catch (issue) {
            if (issue.status === 400 || issue.status === 401) {
              persist(null);
              throw error("Sign in to your campus.", 401);
            }
            throw issue;
          } finally {
            refreshing = null;
          }
        })();
      return refreshing;
    }
    async function rpc(name, args = {}) {
      const token = await access();
      return network(`${config.url.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: cloudHeaders(token),
        body: JSON.stringify(args),
      });
    }
    async function getUser() {
      try {
        const user = await auth("user", "GET", undefined, await access());
        session.user = user;
        return user;
      } catch (issue) {
        if (issue.status === 401) persist(null);
        throw issue;
      }
    }
    function normalizeProfile(value, user) {
      return {
        displayName: value?.displayName || "Artist",
        instrument: value?.instrument || "Exploring",
        goal: value?.goal || "",
        createdAt: value?.createdAt || user.created_at,
        email: user.email || "",
      };
    }
    async function request(route, method = "GET", body) {
      if (!cloud)
        return network(localUrl(route), {
          method,
          headers:
            method === "GET"
              ? {}
              : { "Content-Type": "application/json", "X-Campus-Request": "1" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
      validateConfig(config);
      if (!session) {
        try {
          const saved = JSON.parse(storage.getItem(storageKey));
          if (
            saved?.access_token &&
            saved?.refresh_token &&
            typeof saved.expires_at === "number"
          )
            session = saved;
        } catch {
          /* Invalid stored sessions are ignored. */
        }
      }
      if (route === "/api/session") {
        if (!session)
          return {
            configured: true,
            authenticated: false,
            setupAllowed: false,
          };
        try {
          await getUser();
          if (!(await rpc("campus_is_owner"))) {
            persist(null);
            return {
              configured: true,
              authenticated: false,
              setupAllowed: false,
            };
          }
          return { configured: true, authenticated: true, setupAllowed: false };
        } catch (issue) {
          if (issue.status === 400 || issue.status === 401) {
            persist(null);
            return {
              configured: true,
              authenticated: false,
              setupAllowed: false,
            };
          }
          throw issue;
        }
      }
      if (route === "/api/login") {
        try {
          storeSession(
            await auth("token?grant_type=password", "POST", {
              email: String(body.email).trim(),
              password: body.password,
            }),
          );
          if (!(await rpc("campus_is_owner"))) {
            await auth("logout?scope=local", "POST", {}, await access());
            persist(null);
            throw error("This account is not the owner of this campus.", 403);
          }
          return { ok: true };
        } catch (issue) {
          persist(null);
          if (issue.status === 400 || issue.status === 401)
            throw error("Email or password is incorrect.", 401);
          throw issue;
        }
      }
      if (route === "/api/setup")
        throw error(
          "Create the owner account in the Supabase dashboard. Public registration is disabled.",
          403,
        );
      if (route === "/api/logout") {
        try {
          if (session)
            await auth("logout?scope=local", "POST", {}, await access());
        } catch (issue) {
          if (issue.status !== 401) throw issue;
        }
        persist(null);
        return { ok: true };
      }
      if (route === "/api/bootstrap") {
        const user = await getUser(),
          result = await rpc("campus_bootstrap");
        return {
          profile: normalizeProfile(result.profile, user),
          state: result.state === null ? null : validateState(result.state),
          revision: Number(result.revision),
        };
      }
      if (route === "/api/profile") {
        const result = await rpc("campus_update_profile", { p_profile: body });
        return { profile: normalizeProfile(result, await getUser()) };
      }
      if (route === "/api/state")
        return rpc("campus_save_state", {
          p_revision: body.revision,
          p_state: validateState(body.state),
        });
      throw error("Unknown campus request.", 404);
    }
    return {
      request,
      isCloud: cloud,
      validateConfig: () => validateConfig(config),
    };
  }
  return { createBackend, validateConfig, SESSION_KEY };
});
