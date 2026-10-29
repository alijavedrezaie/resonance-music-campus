(() => {
  const requestForm = document.querySelector("#recovery-request");
  const passwordForm = document.querySelector("#recovery-password");
  const error = document.querySelector("#recovery-error");
  const status = document.querySelector("#recovery-status");
  const parameters = new URLSearchParams(location.hash.slice(1));
  const hadLink = Boolean(location.hash || location.search);
  history.replaceState(null, "", location.pathname); // Remove tokens before any request.
  async function initialize() {
    if (!CampusBackend.isCloud) {
      requestForm.hidden = true;
      error.textContent = "For the local campus, run npm run reset-password in your terminal.";
      return;
    }
    if (!hadLink) return;
    requestForm.hidden = true;
    status.textContent = "Checking your reset link…";
    try {
      await CampusBackend.request("/api/recovery/verify", "POST", {
        type: parameters.get("type"), accessToken: parameters.get("access_token"),
      });
      parameters.delete("access_token");
      parameters.delete("refresh_token");
      status.textContent = "Your reset link is verified. Choose a new password.";
      passwordForm.hidden = false;
      passwordForm.elements.password.focus();
    } catch {
      parameters.delete("access_token");
      parameters.delete("refresh_token");
      status.textContent = "";
      error.textContent = "This reset link is expired or invalid. Request a new link below.";
      requestForm.hidden = false;
    }
  }
  requestForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = requestForm.querySelector("button");
    button.disabled = true;
    error.textContent = "";
    try {
      await CampusBackend.request("/api/recovery/request", "POST", { email: requestForm.elements.email.value });
      status.textContent = "If this email belongs to your campus account, a reset link is on its way. Check your inbox and spam folder. Use the newest link; keep it private.";
    } catch (issue) { error.textContent = issue.message; }
    finally { button.disabled = false; }
  });
  passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    if (passwordForm.elements.password.value !== passwordForm.elements.confirmation.value) {
      error.textContent = "The passwords do not match. Please enter them again.";
      return;
    }
    const button = passwordForm.querySelector("button");
    button.disabled = true;
    try {
      const result = await CampusBackend.request("/api/recovery/password", "POST", { password: passwordForm.elements.password.value });
      passwordForm.reset();
      passwordForm.hidden = true;
      status.textContent = result.signOutFailed
        ? "Password changed. Sign in with your new password. Existing sessions could not all be signed out; review them in your Supabase dashboard."
        : "Password changed and existing sessions signed out. You can now sign in with your new password.";
    } catch (issue) { error.textContent = issue.message; button.disabled = false; }
  });
  void initialize();
})();
