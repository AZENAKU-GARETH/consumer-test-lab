# Consumer Test Lab

A functional product-testing & market-research platform. Companies create product tests; real consumers join the panel, take tests, submit feedback and earn FCFA rewards — with live stats and AI-style decision insights on a dashboard.

## Run it locally

Requires [Node.js 18+](https://nodejs.org).

```bash
npm install
npm start          # then open http://localhost:4000
```

Or double-click `START_SERVER.bat` (Windows).

- Local mode uses a **SQLite** database stored at `server/db/ctl.db`.
- Set the `DATABASE_URL` environment variable to use a **cloud PostgreSQL** database instead (e.g. [Neon](https://neon.tech)) — data then persists online and is shared across devices.

## Features

- Live public test grid + hero dashboard (real computed metrics)
- Business portal: sign in, create tests, view stats + AI decision signal
- Consumer panel: join, take tests, submit feedback, earn FCFA
- AI-style insights (rule-based) per study
- CSV report export
- Seed/demo data on first run
- Fully responsive

## Deploy to the cloud (free)

1. Create a free Postgres database at [Neon](https://neon.tech) → copy the **connection string**.
2. Deploy this repo on [Render](https://render.com) → **New → Blueprint** (it reads `render.yaml`).
3. When prompted, paste your Neon connection string into the `DATABASE_URL` variable.
4. Done — share your `https://<app>.onrender.com` link.

## Tech stack

Node.js · Express · better-sqlite3 (local) / pg + Neon Postgres (cloud) · Vanilla HTML/CSS/JS

## Documentation

See `BUILD_PROCESS_DOCUMENTATION.md` for the full build process, architecture and data model.