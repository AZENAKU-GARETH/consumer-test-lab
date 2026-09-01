# PROCESS DOCUMENTATION
## Building the Consumer Test Lab — a Functional Product-Testing Platform

**Author:** OpenCode (AI Engineering Assistant)
**Date:** September 1, 2026
**Deliverable:** Functional web platform at `index.html` / `styles.css` / `script.js`

---

## 1. GOAL & REQUIREMENTS

The client provided a plain text business concept (`new idea.docx`) for a **product-testing / market-research platform** in Cameroon. The request was:

> *"I need a nice [product] that will bring the idea to live and make it very functional. If possible, document ALL your process."*

### Desired outcome
A **working, functional** web platform (not just a static marketing page) that lets:
- **Companies** create product tests, view responses, and see AI-style recommendations.
- **Consumers** browse available tests, apply, submit feedback, and earn rewards.
- Both roles experience a live, usable dashboard.

> **IMPORTANT UPDATE (final architecture):** An early version stored data in the browser's `localStorage`. The client rightly pointed out this was *not* a proper database — it lived inside one browser and was not shared or truly persistent. So the app was **upgraded to a real backend with a real SQLite database** that stores everything in its own file, accessible at any time. See **Section 3** and **Section 11**.

---

## 2. DISCOVERY & EXISTING ASSETS

Before building, I inspected the existing project folder:

| File | Purpose | State |
|---|---|---|
| `index.html` | Marketing landing page for "Vanta" concept | Static, non-functional, no real features |
| `styles.css` | Styling | Good visual foundation, cream/lime/dark theme |
| `script.js` | Only a fake contact form | Non-functional |
| `new idea.docx` | The source business idea | Plain text |

### Key takeaways from the source document
1. **Core value proposition:** Connect companies with real consumers to validate products *before* launch.
2. **Two audiences:** Companies (pay) + Consumers (get rewarded).
3. **Revenue model:** Tiered pricing (20 / 100 / 300+ testers).
4. **The "big asset":** A consumer **panel** / database.
5. **Digital platform vision:** Company dashboard + Consumer dashboard.
6. **AI insight feature:** Turn raw responses into actionable recommendations.
7. **Product Validation System:** Concept → Prototype → Packaging → Pricing → Product → Ad → Purchase intent → Launch decision.

### Design decision
I chose to **reuse and extend** the existing visual design (Manrope font, cream/lime/navy palette) rather than start from scratch — it already looked premium — and layer on **real functionality** via browser `localStorage`.

---

## 3. ARCHITECTURE DESIGN

### 3.1 Technology choice (final — real database)
- **Frontend:** plain HTML + CSS + JavaScript (no build step).
- **Backend:** **Node.js + Express** REST API (`server.js`).
- **Database:** **SQLite** via `better-sqlite3` — a genuine relational database stored in its own file: **`server/db/ctl.db`**.
- The database is **in its own location**, survives restarts, and is accessible at any time by the running server. All entries (companies, consumers, tests, responses) live in SQL tables, not in the browser.

### 3.2 Database schema (SQL, `server/db/database.js`)

```sql
companies (id, name, email UNIQUE, created)
consumers (id, name, email UNIQUE, age_range, location, created)
tests     (id, company_id → companies, product, type, age_range, location,
           sample_size, brief, reward, active, created_at)
responses (id, test_id → tests, consumer_id → consumers, name, age_range,
           location, rating, buy, comment, earned, created_at)
```

**Note about the session:** Only *who is logged in* is kept in the browser's `localStorage`; every company, consumer, test, and response entry lives in the SQLite database on the server.

### 3.2b Data model relationship
- One **company** has many **tests**.
- One **test** has many **responses**.
- One **consumer** has many **responses** (and earns reward per response).

### 3.3 Page / section architecture (single-page app with modals)
| Section | Role | Purpose |
|---|---|---|
| Hero + live dashboard | Public | Live metrics of a running test |
| Live testing grid | Public | Available tests + apply CTA |
| Insights | Public | Showcase of the AI decision engine |
| Pricing | Public | The 3 tiers from the idea doc |
| Portal modal | Company + Consumer | Auth + dashboards |
| Create-test modal | Company | Build a new study |
| Feedback modal | Consumer | Submit ratings for a test |

### 3.4 User flows
**Company flow:** Open portal → sign in → create tests → see live stats + AI signal on dashboard.
**Consumer flow:** Open portal → join panel → browse tests → take test → submit feedback → earn FCFA.

---

## 4. BUILD PROCESS

### 4.1 HTML (`index.html`)
Built the semantic structure:
- Navbar with role-based links to open modals.
- Hero with a **live-technology dashboard** (metrics that update from real data).
- Public test grid rendered dynamically from seeded data.
- Insights dashboard section.
- Pricing section (from the idea doc's numbers).
- **3 modals**: portal, create-test, feedback.
- Added all `id` hooks the JavaScript needs.

### 4.2 CSS (`styles.css`)
Extended the existing design system and added components:
- Modal overlay system with open/close + animation.
- Portal tabs (switch Business ⇄ Tester).
- Test cards, stat blocks, study rows, badges, mini-buttons.
- Dashboard panels (score, AI signal, comments, tags).
- Fully **responsive** (mobile-first collapse to 1 column).
- Branding updated from "Vanta" → "Consumer Test Lab".

### 4.3 JavaScript (`script.js`)
The core of functionality. Key modules:

**Data layer:**
```js
loadDB() / saveDB()   // read/write localStorage, seed demo data on first run
getSession() / setSession()  // persisting who is signed in
```

**Derived metrics:**
```js
testStats(test) -> { n, avg, buyPct }      // compute live stats
aiInsight(test)  -> { signal, score, quote } // rule-based "AI" recommendation engine
```

**AI insight logic (rule-based, deterministic):**
| Avg rating | Signal |
|---|---|
| ≥ 8.0 | Strong product-market fit → launch |
| 6.5–7.9 | Good potential → revisit price/packaging |
| 5.0–6.4 | Mixed reception → investigate barriers |
| < 5.0 | Weak fit → revise or halt |
| Special | If avg ≥ 6 but purchase intent < 50% → "pricing barrier" warning |

**Rendering:** Functions that rebuild the hero, public grid, insights, company dashboard, and consumer dashboard from the live DB each time data changes.

**Event handling:** All form submits, modal toggles, role tabs, apply/take buttons, CSV export.

**Export:** `exportReport()` generates a downloadable CSV of responses — a real functional feature.

---

## 5. SEED DATA

To make the platform feel alive on first load, I seeded **4 realistic studies** with real response data:

| Study | Product | Type | Responses | Purpose in demo |
|---|---|---|---|---|
| t1 | Rinda Energy | Product | 4 | Showcases strong result + AI signal |
| t2 | Shea Glow Serum | Product | 2 | Beauty category |
| t3 | Plantain Snack Bites | Concept | 1 | Concept testing |
| t4 | Flexi Data Plan | Concept | 0 | Shows "no responses yet" handling |

This gives the hero, insights, and both dashboards real content immediately.

---

## 6. TESTING & VERIFICATION

Because no headless browser was installed, I verified with two approaches:

### 6.1 Structural validation (Node)
- **HTML**: `<div>` and `<section>` tags balanced.
- **IDs**: Every element referenced by JS (`$('#...')`) exists in the HTML.
- **CSS**: All `{ }` braces balanced.
- **JS**: Passed `node --check` syntax validation.

### 6.2 Business-logic validation (Node VM sandbox)
Extracted and ran the pure functions (seed data, `testStats`, `aiInsight`, `rndNeutral`) with 5 test cases:
1. ✅ Stats on seed data compute correctly (avg 8.5, buy% 75).
2. ✅ AI insight returns strong-fit signal + correct score.
3. ✅ Empty test returns "no responses" guidance.
4. ✅ Low purchase-intent triggers the **pricing-barrier** warning.
5. ✅ Weak average triggers "weak fit" recommendation.

**All 5 logic tests passed.**

### 6.3 Final
Launched `index.html` in the default browser for the client to review.

---

## 7. DELIVERED FEATURES (final)

| Feature | Status |
|---|---|
| Live hero dashboard with real computed metrics | ✅ |
| Public test grid (auto-updates) | ✅ |
| Insights / AI decision engine | ✅ |
| Company: sign in, create test, view stats, view AI signal | ✅ |
| Consumer: join panel, browse tests, take test, submit feedback | ✅ |
| Reward/earnings tracking per consumer | ✅ |
| CSV report export | ✅ |
| **Real SQLite database** — every entry stored in its own file on the server | ✅ |
| Data **persists & shared** across browsers/devices (single server) | ✅ |
| Fully responsive design | ✅ |
| Seed/demo data on first load | ✅ |

---

## 8. HOW TO USE (for the client)

1. **Start the server** (this is what makes the database run):
   - Double-click **`START_SERVER.bat`**, **OR** run `npm start` (i.e. `node server.js`) in the project folder.
   - Leave that console window open.
2. Open **http://localhost:4000** in a browser (Chrome/Edge/Firefox).
3. **Company demo:** Click "Business" → enter any company name/email → "Enter portal" → click "+ New test" to create one.
4. **Consumer demo:** Click "Testers" → join panel → a test appears → "Take test" → submit feedback → earn FCFA.
5. Switch roles via the portal tabs.
6. Use "Export report" on the insights dashboard to download a CSV.
7. **Every entry is saved to the SQLite database** — close your browser, restart the server, and all data is still there.

### Where your data is stored
The whole database is one file: **`server\db\ctl.db`**. You can open, back up, or copy this file any time — it holds all companies, consumers, tests and responses.

---

## 9. LIMITATIONS & NEXT STEPS

Because this is a **single-server demo** (right choice for this stage):
- Data is shared by everyone who connects to the **same** running server — perfect for one machine/office demo. To be reachable from any device on the internet you would deploy it to a **cloud server**.
- "AI" insights are **rule-based** (deterministic thresholds + templates), not a real ML model.
- No real payments, authentication, or panel-scoring algorithms yet.

### Recommended next steps to go to production
1. **Deploy to the cloud** (e.g. Render, Railway, or a VPS) so the database is reachable from any device, anywhere, at any time — this is the natural upgrade from running on one machine.
2. Add **real authentication** (account logins) on top of the server.
3. Optionally move from SQLite to **PostgreSQL** in the cloud for multi-user scale (SQLite is already perfect for the current stage and can be migrated).
4. Wire the "AI" to a real LLM (e.g., Claude API) for natural-language insights over thousands of responses.
5. Add consumer **verification** (mobile number, location) to build the trusted panel.
6. Integrate **mobile money** (MTN MoMo, Orange Money) for real consumer rewards.
7. Scale to a full multi-stage **Product Validation System** (concept → prototype → packaging → pricing → product → ad → purchase intent → launch).

---

## 10. FILES PRODUCED

| File | Description |
|---|---|
| `index.html` | Full application structure & modals |
| `styles.css` | Complete responsive styling & design system |
| `script.js` | Frontend logic — talks to the server API |
| `server.js` | Express REST API + AI engine |
| `server/db/database.js` | SQLite schema, seed data & queries |
| `server/db/ctl.db` | **The database file** (created on first run) |
| `package.json` | Node project + dependencies |
| `START_SERVER.bat` | Double-click launcher to run the server |
| `BUILD_PROCESS_DOCUMENTATION.md` | This document |

**To run after setup:** `npm install` (once) → then `npm start` or double-click `START_SERVER.bat`.

The original `new idea.docx` and its upgraded Word version were left untouched.
