(() => {
  const form = document.querySelector("#login-form"),
    submit = document.querySelector("#login-submit"),
    error = document.querySelector("#login-error");
  let setup = false;
  document.querySelector("#toggle-password").addEventListener("click", (e) => {
    const visible = e.currentTarget.getAttribute("aria-pressed") !== "true";
    form
      .querySelectorAll("[data-password]")
      .forEach((input) => (input.type = visible ? "text" : "password"));
    e.currentTarget.setAttribute("aria-pressed", String(visible));
    e.currentTarget.textContent = visible ? "Hide password" : "Show password";
  });
  async function initialize() {
    try {
      const account = await CampusBackend.request("/api/session");
      document.querySelector("#cloud-recovery").hidden = !CampusBackend.isCloud;
      if (CampusBackend.isCloud)
        document.querySelector("#recovery-help").textContent =
          "Your owner account is managed in your Supabase dashboard. Public registration is disabled. Sign out when using a shared device.";
      if (account.authenticated) {
        location.replace(new URL("index.html.html", document.baseURI).href);
        return;
      }
      setup = !account.configured && account.setupAllowed;
      if (!account.configured && !setup) {
        error.textContent =
          "Your owner account needs to be created locally before this campus can be used.";
        return;
      }
      if (setup) {
        document.querySelector("#login-title").textContent =
          "Create your owner account";
        document.querySelector("#login-description").textContent =
          "Set up your private campus on this computer. You only need to do this once.";
        document.querySelector("#setup-fields").hidden = false;
        document.querySelector("#confirmation-field").hidden = false;
        for (const id of ["display-name", "setup-code", "confirmation"])
          document.getElementById(id).required = true;
        document.querySelector("#password").minLength = 15;
        document.querySelector("#password").autocomplete = "new-password";
        document.querySelector("#recovery-help").hidden = true;
      }
      submit.disabled = false;
      submit.textContent = setup
        ? "Create my private campus"
        : "Sign in to my campus";
    } catch (issue) {
      error.textContent = CampusBackend.isCloud
        ? issue.message +
          " Check your project settings and internet connection."
        : "Start the private campus with npm start, then open the local address printed in the terminal.";
      submit.textContent = "Server unavailable";
    }
  }
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.textContent = "";
    const fields = new FormData(form),
      data = Object.fromEntries(fields);
    if (setup && data.password !== data.confirmation) {
      error.textContent =
        "Your passwords do not match. Please enter them again.";
      return;
    }
    submit.disabled = true;
    submit.textContent = setup ? "Creating your campus…" : "Signing in…";
    try {
      await CampusBackend.request(setup ? "/api/setup" : "/api/login", "POST", {
        email: data.email,
        password: data.password,
        ...(setup ? { code: data.code, displayName: data.displayName } : {}),
      });
      form.reset();
      location.replace(new URL("index.html.html", document.baseURI).href);
    } catch (issue) {
      error.textContent = issue.message;
      submit.disabled = false;
      submit.textContent = setup
        ? "Create my private campus"
        : "Sign in to my campus";
    }
  });
  void initialize();
})();
