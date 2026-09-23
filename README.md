# Dinto Manpower Tracker

Company-wide crew tracking and assignment app for Paul Dinto Electrical
Contractors. Tracks every worker's current job assignment, full movement
history, and handles PM-to-PM crew transfer requests with approval.

## Stack

- **Frontend:** Vite + React + React Router
- **Backend:** Netlify Functions v2 (serverless)
- **Storage:** Netlify Blobs (no external database)
- **Auth:** Custom username/password, hashed with Node's built-in `scrypt`,
  sessions via signed HttpOnly cookies
- **Deploy:** GitHub → Netlify (continuous deployment)

Same pattern as the Tool Register and Delivery Scheduler apps — no
Supabase, no external DB to manage.

## Local development

```bash
npm install
npx netlify dev
```

`netlify dev` (not plain `vite dev`) is required locally — it runs the
Vite dev server *and* the Netlify Functions together, and emulates
Netlify Blobs, so the app behaves the same locally as it does deployed.
Requires the [Netlify CLI](https://docs.netlify.com/cli/get-started/)
(`npm install -g netlify-cli`) and running `netlify link` once to
connect this folder to the Netlify site.

## Environment variables

Set these in **Netlify → Site configuration → Environment variables**
(never commit real values — see `.env.example` for the list):

| Variable | Purpose |
|---|---|
| `AUTH_JWT_SECRET` | Long random string used to sign session tokens. Generate one with `openssl rand -base64 32`. |
| `ADMIN_BOOTSTRAP_USERNAME` | Email for the one-time auto-created admin account (only used if the accounts store is completely empty). |
| `ADMIN_BOOTSTRAP_PASSWORD` | Password for that bootstrap admin account. Change it after first login if you want. |

## First-time setup

1. Push this repo to GitHub.
2. In Netlify: **Add new site → Import an existing project** → pick the repo.
   Build command and publish directory are already set via `netlify.toml`,
   so the defaults Netlify suggests will match.
3. Add the three environment variables above in Netlify's site settings.
4. Deploy.
5. Visit the live site and log in with `ADMIN_BOOTSTRAP_USERNAME` /
   `ADMIN_BOOTSTRAP_PASSWORD` — this creates the real admin account in
   Blobs on that first login.
6. From **Accounts**, create real accounts for every PM/foreman who
   needs access. Self-registration is intentionally disabled — only an
   admin can create accounts.

## How data works

Every entity (accounts, jobs, workers, assignments, requests) lives as
one JSON array in a Netlify Blobs store called `manpower-tracker`. All
reads/writes go through the functions in `netlify/functions/` — the
frontend never touches storage directly, and every write is
permission-checked server-side (`netlify/functions/utils/requireRole.js`),
not just hidden in the UI.

**"Live" data** means the app polls every 20 seconds and also refetches
whenever the tab regains focus — there's no push-based realtime (Netlify
Blobs doesn't support that), but for a crew tracker this keeps everyone
close enough to in-sync without needing a database subscription service.

## Project structure
