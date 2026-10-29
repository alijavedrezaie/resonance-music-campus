# Free hosting: GitHub Pages + Supabase

This is the selected online deployment path. GitHub Pages serves the public app, while a dedicated **Supabase Free** project handles email/password authentication and private account data. No paid Render instance, persistent disk, custom domain or paid Supabase feature is needed.

**Live site:** [Resonance Music Campus](https://alijavedrezaie.github.io/resonance-music-campus/). The dedicated Supabase Free project, owner registry, disabled public registration, GitHub repository variables, and Pages workflow are configured. The steps below document how to maintain or recreate this setup. Passwords remain managed in your Supabase dashboard.

## Privacy and cost boundaries

- The GitHub repository, app source, curriculum and course images are public. This matches the public-code hosting choice.
- Personal profiles, notes, tasks, quiz results, plans and songs belong in Supabase, not in GitHub.
- Owner-only PostgreSQL row policies protect both tables. RPCs check the same owner restriction; a session-registry check denies data access after that Auth session signs out.
- Public sign-up is disabled. Manually creating another Supabase user still does not make that user a campus owner.
- Only a public project URL and **publishable** key appear in the site. Never add a `service_role` JWT, `sb_secret_` key, database password or account password to code, repository variables or deployment files. The build rejects secret keys.
- This browser-based deployment keeps access/refresh tokens in session storage for the current tab, not an HttpOnly server cookie. It never stores your password, and personal work is not cached locally. Only host trusted scripts on the same `username.github.io` origin. Closing the tab requires signing in again; signing out clears its session.
- Free-plan limits still apply. Supabase can pause inactive free projects after a week; restore them from your dashboard if needed. Keep exported backups. Do not enable paid upgrades, add-ons or a custom domain as part of this deployment.

References: [GitHub Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [Supabase Free plan](https://supabase.com/pricing), [project pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [session handling](https://supabase.com/docs/guides/auth/sessions).

## 1. Prepare Supabase — Free plan only

1. Open your Supabase dashboard and create a dedicated project in a **Free-plan organization**. Keep it on Free. Do not put a production database password in this repository.
2. In SQL Editor, run [schema.sql](../supabase/schema.sql). It creates the profile/work tables, owner restrictions and save/version functions. It is safe to rerun this schema when updating the app; it does not replace the registered owner or delete learning data.
3. In Authentication settings, **disable new-user sign-ups** and leave anonymous sign-ins disabled. Keep email/password authentication enabled.
4. In Authentication → Users, manually create your own confirmed email/password user. Choose and enter your password yourself in that dashboard. Do not send it in chat or put it into a SQL script.
5. Copy that user's UUID. Open [set-owner.sql.example](../supabase/set-owner.sql.example), replace the placeholder with the UUID, then run the statement in SQL Editor. There can be only one owner. Do not commit a populated account-setup script.
6. From the project's API settings, copy the project URL (`https://PROJECT.supabase.co`) and its **public publishable key**. These are public configuration, not passwords.

Your existing local Node account and the Supabase Auth account are separate. Recreate the online owner in Supabase, then migrate learning work with an exported JSON backup; do not publish the SQLite database or attempt to upload its password hash.

## 2. Put the source on GitHub

Create the public repository `resonance-music-campus` (or another name you prefer). Publish the source files, the course cover images, `package-lock.json`, `supabase/`, and the workflow in `.github/workflows/pages.yml`.

The `.gitignore` excludes databases, local private folders, personal JSON backups, preview PNGs, `.env` files, generated `dist/`, and `node_modules/`. Review the staged file list before the initial push. Never upload the entire local directory with private backups included.

The build publishes only an explicit allowlist of website files. SQL files, server code, tests, screenshots, local backups and runtime databases are not placed in the Pages artifact, even though non-secret source code may be in the public repository.

## 3. Set public configuration and enable Pages

In GitHub repository → Settings → Secrets and variables → Actions → **Variables**, add:

| Variable                   | Value                                                                            |
| -------------------------- | -------------------------------------------------------------------------------- |
| `SUPABASE_URL`             | Your `https://PROJECT.supabase.co` URL                                           |
| `SUPABASE_PUBLISHABLE_KEY` | Your public `sb_publishable_…` key (a legacy public `anon` JWT is also accepted) |

In Settings → Pages, choose **GitHub Actions** as the publishing source. Push to `main` or run “Test and deploy GitHub Pages” manually from Actions.

The workflow installs only test dependencies, runs all tests, builds `dist/`, and publishes that artifact. If the repository variables are missing, tests still run and deployment is skipped. The build command rejects missing configuration or a secret key before producing a publishable artifact. No `gh-pages` branch, Node server or GitHub Codespace needs to remain running.

The usual site address is `https://USERNAME.github.io/resonance-music-campus/`. Use the actual URL returned by the workflow. Paths work under a repository subdirectory as well as the account root.

Once that URL is known, set the Supabase Auth Site URL to it. No social login, SMTP provider or paid session controls are required for the manually created owner's password sign-in. Password/account recovery is managed through your Supabase dashboard; `npm run reset-password` applies only to the separate local Node account.

## 4. Verify before using it for your work

1. Open the published URL in a private window. It should show the sign-in page. Source and decorative lesson assets are public by design.
2. Confirm a wrong password fails and your owner password succeeds.
3. Save a profile change, a reflection and a planner entry. Wait for All changes saved, sign out, sign back in and verify them.
4. Verify anonymous API access and a non-owner user cannot read or modify either table. The local PostgreSQL tests exercise these policies; they do not replace verification against your real Supabase project.
5. Export regular learning backups. Import an existing local-campus backup through Settings once you're signed into the hosted campus.

## Local verification and build

For full tests:

```sh
npm ci
npm test
```

The development-only PGlite package runs the actual PostgreSQL schema and row policies locally without Docker or a cloud project. Production site visitors download none of the test engine.

For a local Pages artifact, set the two public environment variables above in your own terminal, then run `npm run build:pages`. It writes only the static website into `dist/`. Serve that folder with a static server to preview the hosted mode; it connects to the configured Supabase project. Use test data for preview work.

The existing `npm start` route still uses the local Node/SQLite backend and its one-time owner setup. Its source configuration remains `backend: "local"`; the Pages build generates `backend: "supabase"` only inside `dist/`.
