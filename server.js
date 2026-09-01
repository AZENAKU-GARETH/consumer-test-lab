/* =====================================================
   Consumer Test Lab — API Server
   Express REST API backed by a real SQLite database.
   Run with:  node server.js   (then open http://localhost:4000)
   ===================================================== */
const express = require('express');
const cors = require('cors');
const path = require('path');
const {
  db,
  getAllTests,
  getTest,
  getResponses,
  getTestStats,
} = require('./server/db/database');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // serve index.html / styles.css / script.js

/* -----------------------------------------------------
   AI insight engine (rule-based, computed on the server)
   ----------------------------------------------------- */
function aiInsight(test) {
  const { n, avg, buyPct } = getTestStats(test.id);
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
app.get('/api/health', (req, res) => res.json({ ok: true, db: 'SQLite' }));

// All tests (public grid)
app.get('/api/tests', (req, res) => {
  const tests = getAllTests().map(t => ({ ...t, stats: getTestStats(t.id), ai: aiInsight(t) }));
  res.json(tests);
});

// One test with responses + stats + AI insight
app.get('/api/tests/:id', (req, res) => {
  const t = getTest(req.params.id);
  if (!t) return res.status(404).json({ error: 'Test not found' });
  res.json({
    ...t,
    responses: getResponses(t.id),
    stats: getTestStats(t.id),
    ai: aiInsight(t),
  });
});

// Company sign-in / get-or-create
app.post('/api/company', (req, res) => {
  const { name, email } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'name and email required' });
  let c = db.prepare('SELECT * FROM companies WHERE email = ?').get(email);
  if (!c) {
    const info = db.prepare('INSERT INTO companies (name, email) VALUES (?, ?)').run(name, email);
    c = db.prepare('SELECT * FROM companies WHERE id = ?').get(info.lastInsertRowid);
  } else {
    db.prepare('UPDATE companies SET name = ? WHERE id = ?').run(name, c.id);
    c.name = name;
  }
  res.json(c);
});

// Consumer sign-in / get-or-create
app.post('/api/consumer', (req, res) => {
  const { name, email, age_range, location } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'name and email required' });
  let c = db.prepare('SELECT * FROM consumers WHERE email = ?').get(email);
  if (!c) {
    const info = db.prepare('INSERT INTO consumers (name, email, age_range, location) VALUES (?, ?, ?, ?)')
      .run(name, email, age_range || '', location || '');
    c = db.prepare('SELECT * FROM consumers WHERE id = ?').get(info.lastInsertRowid);
  } else {
    db.prepare('UPDATE consumers SET name = ?, age_range = ?, location = ? WHERE id = ?')
      .run(name, age_range || '', location || '', c.id);
    c.name = name; c.age_range = age_range || ''; c.location = location || '';
  }
  // consumer's usable tests + earnings + submissions
  const tests = getAllTests().filter(t => t.active);
  const earned = Number(db.prepare(
    'SELECT COALESCE(SUM(earned),0) AS t FROM responses WHERE consumer_id = ?'
  ).get(c.id).t || 0);
  const submissions = db.prepare(`
    SELECT r.rating, r.buy, r.earned, t.product, r.created_at
    FROM responses r JOIN tests t ON t.id = r.test_id
    WHERE r.consumer_id = ? ORDER BY r.created_at DESC
  `).all(c.id);
  res.json({ ...c, earned, tests, submissions });
});

// Create a test (company)
app.post('/api/tests', (req, res) => {
  const { companyId, product, type, age_range, location, sample_size, brief, reward } = req.body || {};
  if (!companyId || !product) return res.status(400).json({ error: 'companyId and product required' });
  const info = db.prepare(`INSERT INTO tests
    (company_id, product, type, age_range, location, sample_size, brief, reward)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    companyId, product, type || 'Product', age_range || '', location || 'All Cameroon',
    Number(sample_size) || 50, brief || '', Number(reward) || 0
  );
  res.json(getTest(info.lastInsertRowid));
});

// Submit a response (consumer takes a test)
app.post('/api/tests/:id/responses', (req, res) => {
  const t = getTest(req.params.id);
  if (!t) return res.status(404).json({ error: 'Test not found' });
  const { consumerId, name, age_range, location, rating, buy, comment } = req.body || {};
  const earned = t.reward || 0;
  const info = db.prepare(`INSERT INTO responses
    (test_id, consumer_id, name, age_range, location, rating, buy, comment, earned)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    Number(t.id), consumerId || null, name || '', age_range || '', location || '',
    Number(rating) || 0, buy || 'maybe', comment || '', earned
  );
  res.json({
    id: info.lastInsertRowid,
    earned,
    stats: getTestStats(t.id),
    ai: aiInsight(t),
  });
});

// Insights for a company (all their tests with stats + AI)
app.get('/api/company/:id/insights', (req, res) => {
  const tests = db.prepare('SELECT id FROM tests WHERE company_id = ?').all(req.params.id)
    .map(r => getTest(r.id));
  res.json(tests.map(t => ({ ...t, stats: getTestStats(t.id), ai: aiInsight(t) })));
});

// Start server
app.listen(PORT, () => {
  console.log(`\n  ✔ Consumer Test Lab server running`);
  console.log(`  ✔ Database: ${path.join(__dirname, 'server', 'db', 'ctl.db')}`);
  console.log(`  ➜ Open http://localhost:${PORT} in your browser\n`);
});
