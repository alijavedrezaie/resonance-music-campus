document.querySelector("#export-legacy").addEventListener("click", () => {
  const status = document.querySelector("#legacy-status");
  try {
    const data = JSON.parse(localStorage.getItem("resonance-v1"));
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      status.textContent =
        "No previous campus data was found at this address. Try opening this page at the exact hostname and port you previously used, in the same browser.";
      return;
    }
    const blob = new Blob(
        [
          JSON.stringify(
            {
              format: "resonance-backup-v1",
              exported: new Date().toISOString(),
              data,
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
    link.download = "resonance-previous-browser-backup.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent =
      "Backup downloaded. Your original browser data has not been changed.";
  } catch {
    status.textContent =
      "The previous data could not be read. Keep this browser’s stored data until you can recover it.";
  }
});
