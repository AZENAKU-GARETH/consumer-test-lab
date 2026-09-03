# Consumer Test Lab

A functional product-testing & market-research platform. Companies create product tests; real consumers join the panel, take tests, submit feedback and earn FCFA rewards — with live stats and modern product-validation insights (NPS, Product-Market Fit, and a combined Launch Readiness score) on a dashboard.

## Pages

| Page | File | Purpose |
|---|---|---|
| Home | `index.html` | Hero + live dashboard + available tests grid |
| How it works | `how-it-works.html` | The validation process & product journey |
| Pricing | `pricing.html` | Tiered plans in FCFA |
| Business | `business.html` | Company portal: sign in, create tests, dashboards |
| Testers | `testers.html` | Consumer panel: join, take tests, earn FCFA |
| Contact | `contact.html` | Contact / CTA form |

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
- **Product-validation metrics**: NPS (Net Promoter Score) + Product-Market Fit (Sean Ellis "very disappointed")
- **Launch Readiness engine** combining satisfaction, purchase intent, NPS and PMF into a 0–100 score with a launch / pricing / refine / revise verdict
- Business portal: sign in, create tests, view stats + AI decision signal
- Consumer panel: join, take tests, submit feedback (incl. NPS + PMF questions), earn FCFA
- CSV report export
- Seed/demo data on first run
- Fully responsive, multi-page, premium design

## Deploy to the cloud (free)

1. Create a free Postgres database at [Neon](https://neon.tech) → copy the **connection string**.
2. Deploy this repo on [Render](https://render.com) → **New → Blueprint** (it reads `render.yaml`).
3. When prompted, paste your Neon connection string into the `DATABASE_URL` variable.
4. Done — share your `https://<app>.onrender.com` link.

## Tech stack

Node.js · Express · better-sqlite3 (local) / pg + Neon Postgres (cloud) · Vanilla HTML/CSS/JS

## Documentation

See `BUILD_PROCESS_DOCUMENTATION.md` for the full build process, architecture and data model.