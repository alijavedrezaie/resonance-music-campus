# Resonance Music Campus

A responsive music-learning campus with email/password sign-in, a profile, visual lessons, a planner and a songbook.

**Live campus:** [Open Resonance Music Campus](https://alijavedrezaie.github.io/resonance-music-campus/). Hosted on GitHub Pages with Supabase Free for email/password sign-in and private saved work. The source and lesson assets are public; personal account data is protected by owner-only database permissions. See the [hosting guide](docs/github-pages.md) for configuration and recovery. The separate local Node version below remains available.

## Start locally

Requires Node.js **22.17 or newer**. The local runtime has no third-party package dependencies. Run `npm ci` to install development-only dependencies before running the full test suite. This uses Node's built-in SQLite API, which emits an experimental-feature warning on Node 22; the implementation is tested on Node 22.17.

1. In this project directory, run `npm start`.
2. Open **http://127.0.0.1:3000**.
3. On the first visit, enter the **one-time setup code printed in your terminal**, your display name, your email and a password you choose (15–128 characters).
4. Later visits use the same email and password. There is no public registration.

Enter your password only in the local setup/login screen. Do not put it in source files or send it in chat. The setup code is regenerated if you restart before creating the owner. Once the owner exists, account creation is disabled. The server binds to this computer only in local mode.

**Use `npm start` for the local Node version.** Live Server and opening the HTML directly do not run its authentication server. For GitHub Pages, the dedicated build produces a static frontend that connects to Supabase; publish only that generated artifact.

## Your profile and saved work

Use the avatar in the header to open your profile. Edit your display name, musical interest and learning goal. The account email is read-only. Use Sign out when finished on a shared device.

Profile, tasks, reflections, songs, planner sessions and reading preferences save to the server's `~/.resonance-music-campus/campus.sqlite`. The header reports whether changes are saved. Wait for **All changes saved** before closing the page. If disconnected, unsaved work remains only in the open tab: retry or download an unsaved backup. Private learning data is not newly cached in localStorage.

Updates use a revision check. A stale device cannot silently overwrite newer work. If you see a conflict, **Back up & reload** downloads that tab's unsaved version before opening the latest saved version; the backup can be reviewed/imported using Settings.

The previous browser-only campus may have data saved under a different origin (for example a file URL or another localhost port). Export its progress backup before switching, then import that JSON in **Settings & backups** after signing in. If the legacy data is available at the same origin and the server has no saved work, the app migrates it automatically after login and leaves the original browser copy unchanged. Keep your original backup until you verify the saved work.

Audio files remain in your own storage; add their file names or links to your song notes.

## Backups and account recovery

- Export regular learning backups from Settings.
- Back up `~/.resonance-music-campus/campus.sqlite` **while the server is stopped** to preserve the account, profile and all learning data. Keep database backups private; they contain personal learning data and a password hash.
- To reset a forgotten password, run **`npm run reset-password`** in your own terminal. It asks for the account email and a new password with hidden input. This changes the password and invalidates existing sessions. It does not delete your learning work. No email-based password-reset service is configured.

The default database lives outside the project directory. Any local `.private` backups and `.env` files are excluded from Git. HTTP routes serve only an explicit list of application assets; server files, database files, tests and preview screenshots are not downloadable.

## Phones, tablets and hosting later

The interface adapts to narrow phones, tablets, landscape screens and larger text. The mobile menu is keyboard accessible, forms have appropriate input types/autocomplete, touch targets are larger, and musical diagrams scroll within their own panels.

**Use the live campus link above on your phone or tablet.** The [free GitHub Pages guide](docs/github-pages.md) explains the deployed Supabase version. Running locally does not make the local account available away from this computer. The following Node deployment details describe an alternative that requires hosting with a persistent disk. Use the same private database when moving a local Node account. A static-only host cannot run the Node backend.

Production configuration:

- `NODE_ENV=production`
- `PUBLIC_ORIGIN=https://your-campus.example` (the exact origin, used for Host/Origin validation)
- `PORT` (default `3000`)
- `HOST` (default `127.0.0.1`; set as required by the hosting provider)
- `CAMPUS_DATA_DIR` (absolute path to a persistent private directory; default `~/.resonance-music-campus`, outside the project web root)

Create the owner locally first and migrate the private database; browser-based first-owner setup is disabled in production. Terminate HTTPS at a trusted reverse proxy and preserve the original Host header. Production sessions use Secure, HttpOnly, SameSite=Strict cookies. Do not place the SQLite directory under a separately served web root. This architecture is for one server instance with a persistent disk, not ephemeral/serverless or multiple replicas. Use the same origin for the frontend and API.

Password hashing uses salted scrypt, sessions use random tokens stored only as hashes server-side, mutation endpoints require same-origin requests and a custom header, and failed logins are rate limited. Sessions expire after 12 idle hours or seven days overall. HTTP is allowed only for the local development flow; production requires an HTTPS origin.

## Verification

Run `npm ci`, then `npm test`. The tests include hosted-backend behavior, static artifact exclusions, actual PostgreSQL owner policies, and protected-route access, one-time setup, password hashing, cookies, login/logout, cross-origin rejection, data persistence, stale-write conflicts, rate limiting, session expiry and the existing 64 visual lessons.

Implementation references: [Node SQLite](https://nodejs.org/download/release/v22.17.0/docs/api/sqlite.html), [Node crypto](https://nodejs.org/download/release/v22.17.0/docs/api/crypto.html), [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

### Recover progress from an old Live Server preview

If the private-server instructions now appear in your old preview before you could export your work, open **`legacy-export.html` at that same old origin** (for example `http://127.0.0.1:5500/legacy-export.html` while that existing Live Server is running). Click Download my previous progress, then import the JSON after signing into the new private campus. This utility leaves the original data unchanged and is deliberately not served by the private Node server. After recovering the old data, stop using the static preview for this application.
