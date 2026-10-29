process.umask(0o077);
const { defaultDataDir } = require("./store.cjs");
const { createCampusServer } = require("./app.cjs");
const host = process.env.HOST || "127.0.0.1",
  port = Number(process.env.PORT || 3000);
if (
  process.env.NODE_ENV !== "production" &&
  !["127.0.0.1", "localhost", "::1"].includes(host)
)
  throw Error(
    "Local mode binds to this computer only. Configure production HTTPS before exposing the campus.",
  );
const campus = createCampusServer();
campus.server.listen(port, host, () => {
  console.log(
    `Resonance Music Campus: ${process.env.PUBLIC_ORIGIN || `http://${host}:${port}`}`,
  );
  if (!campus.configured)
    console.log(
      `One-time owner setup code (enter it on the local setup page): ${campus.setupCode}`,
    );
  console.log(`Private storage: ${defaultDataDir()}`);
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => campus.close().then(() => process.exit(0)));
