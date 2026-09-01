/* =====================================================
   Consumer Test Lab — API Server
   Express REST API backed by a real database.
   - Local: SQLite file (server/db/ctl.db)
   - Cloud: PostgreSQL via DATABASE_URL (e.g. Neon)
   Run with:  node server.js   (then open http://localhost:4000)
   ===================================================== */
const express = require('express');
const cors = require('cors');
const path = require('path');
const { db, usePg } = require('./server/db/database');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // serve index.html / styles.css / script.js

/* -----------------------------------------------------
   AI insight engine (rule-based, computed on the server)
   ----------------------------------------------------- */
function aiInsight(test, stats) {
  const { n, avg, buyPct } = stats;
  let signal, quote;
  let pending;
  if (n === 0) {
    signal = 'No responses yet. Share this study with your testers to start collecting feedback.';
    quote = '"The lack of data is your real risk — validate before you launch."';
  } else if (avg >= 8) {
    signal = 'Strong product-market fit. Recommend launch with minor refinements.';
    quote = '"Strong and repeatable validation. Move to launch."';
  } else if (avg >= 6.5 && buyPct < 60) {
    signal = 'Consumers like the product, but purchase intent is low — pricing is the likely barrier. Reconsider price before launch.';
    quote = '"Liked, but will they pay? Test the price point."';
  } else if (avg >= 6.5) {
    signal = 'Good potential. Refine the offer and positioning, then run a packaging test.';
    quote = '"Good foundation. Polish the packaging and story."';
  } else if (avg >= 5) {
    signal = 'Mixed reception. Investigate the barriers before investing in production.';
    quote = '"You have their attention, but not their conviction."';
  } else {
    signal = 'Weak fit. Revise the concept significantly or consider halting.';
    quote = '"Low scores early save you from a costly launch."';
  }
  pending = test.sample_size - n;
  signal += ` Collected ${n}/${test.sample_size} responses.`;
  return {
    n, avg, buyPct, signal, quote,
    author: pending > 0 ? `Based on ${n} responses so far` : 'Based on all responses',
  };
}

/* -----------------------------------------------------
   API ROUTES
   ----------------------------------------------------- */

// Welcome / health
app.get('/api/health', (req, res) => res.json({ ok: true, db: usePg ? 'PostgreSQL (cloud)' : 'SQLite (local)' }));

// All tests (public grid)
app.get('/api/tests', async (req, res) => {
  try {
    const tests = await db.getAllTests();
    const out = [];
    for (const t of tests) {
      const stats = await db.getTestStats(t.id);
      out.push({ ...t, stats, ai: aiInsight(t, stats) });
    }
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// One test with responses + stats + AI insight
app.get('/api/tests/:id', async (req, res) => {
  try {
    const t = await db.getTest(req.params.id);
    if (!t) return res.status(404).json({ error: 'Test not found' });
    const responses = await db.getResponses(t.id);
    const stats = await db.getTestStats(t.id);
    res.json({ ...t, responses, stats, ai: aiInsight(t, stats) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Company sign-in / get-or-create
app.post('/api/company', async (req, res) => {
  try {
    const { name, email } = req.body || {};
    if (!name || !email) return res.status(400).json({ error: 'name and email required' });
    res.json(await db.companySignin(name, email));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Consumer sign-in / get-or-create
app.post('/api/consumer', async (req, res) => {
  try {
    const { name, email, age_range, location } = req.body || {};
    if (!name || !email) return res.status(400).json({ error: 'name and email required' });
    const c = await db.consumerSignin(name, email, age_range, location);
    const tests = (await db.getAllTests()).filter(t => t.active);
    const { earned, submissions } = await db.getConsumerSummary(c.id);
    res.json({ ...c, earned, tests, submissions });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Create a test (company)
app.post('/api/tests', async (req, res) => {
  try {
    const { companyId, product } = req.body || {};
    if (!companyId || !product) return res.status(400).json({ error: 'companyId and product required' });
    res.json(await db.createTest(req.body));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Submit a response (consumer takes a test)
app.post('/api/tests/:id/responses', async (req, res) => {
  try {
    const t = await db.getTest(req.params.id);
    if (!t) return res.status(404).json({ error: 'Test not found' });
    const { consumerId, name, age_range, location, rating, buy, comment } = req.body || {};
    const earned = t.reward || 0;
    const saved = await db.addResponse({
      testId: t.id, consumerId, name, age_range, location, rating, buy, comment, earned,
    });
    const stats = await db.getTestStats(t.id);
    res.json({ ...saved, stats, ai: aiInsight(t, stats) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Insights for a company (all their tests with stats + AI)
app.get('/api/company/:id/insights', async (req, res) => {
  try {
    const tests = await db.getCompanyTests(req.params.id);
    const out = [];
    for (const t of tests) {
      const stats = await db.getTestStats(t.id);
      out.push({ ...t, stats, ai: aiInsight(t, stats) });
    }
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* -----------------------------------------------------
   START
   ----------------------------------------------------- */
db.init().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  ✔ Consumer Test Lab server running`);
    console.log(`  ✔ Database: ${usePg ? 'PostgreSQL (cloud, DATABASE_URL)' : path.join(__dirname, 'server', 'db', 'ctl.db')}`);
    console.log(`  ➜ Open http://localhost:${PORT} in your browser\n`);
  });
}).catch(err => {
  console.error('Database init failed:', err.message);
  process.exit(1);
});