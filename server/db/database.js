/* =====================================================
   Consumer Test Lab — Database Layer
   Real SQLite database stored in a dedicated file.
   The database lives at: server/db/ctl.db
   ===================================================== */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// The actual database FILE lives in its own folder: server/db/ctl.db
const DB_DIR = path.join(__dirname);
const DB_PATH = path.join(DB_DIR, 'ctl.db');

// Ensure the db folder exists
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

// Open (create if not exists) the real SQLite database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');   // concurrent reads + reliable writes
db.pragma('foreign_keys = ON');    // enforce referential integrity

/* -----------------------------------------------------
   SCHEMA
   ----------------------------------------------------- */
db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT NOT NULL,
    email    TEXT NOT NULL UNIQUE,
    created  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS consumers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL UNIQUE,
    age_range  TEXT,
    location   TEXT,
    created    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tests (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id   INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    product      TEXT NOT NULL,
    type         TEXT,
    age_range    TEXT,
    location     TEXT,
    sample_size  INTEGER NOT NULL,
    brief        TEXT,
    reward       INTEGER NOT NULL DEFAULT 0,
    active       INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS responses (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id    INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    consumer_id INTEGER REFERENCES consumers(id) ON DELETE SET NULL,
    name       TEXT,
    age_range  TEXT,
    location   TEXT,
    rating     INTEGER NOT NULL,
    buy        TEXT,
    comment    TEXT,
    earned     INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_responses_test ON responses(test_id);
  CREATE INDEX IF NOT EXISTS idx_tests_company ON tests(company_id);
`);

/* -----------------------------------------------------
   SEED DATA (only runs once, on first ever launch)
   ----------------------------------------------------- */
function seed() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM tests').get().c;
  if (count > 0) return; // already seeded

  const insertCompany = db.prepare('INSERT INTO companies (name, email) VALUES (?, ?)');
  const insertTest = db.prepare(`INSERT INTO tests
    (company_id, product, type, age_range, location, sample_size, brief, reward)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertResponse = db.prepare(`INSERT INTO responses
    (test_id, consumer_id, name, age_range, location, rating, buy, comment, earned)
    VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)`);

  const seed = db.transaction(() => {
    const rinda = insertCompany.run('Rinda Beverages', 'rinda@example.com').lastInsertRowid;
    const kora = insertCompany.run('Kora Cosmetics', 'kora@example.com').lastInsertRowid;
    const baobab = insertCompany.run('Baobab Foods', 'baobab@example.com').lastInsertRowid;
    const novus = insertCompany.run('Novus Telecom', 'novus@example.com').lastInsertRowid;

    const t1 = insertTest.run(rinda, 'Rinda Energy', 'Product', '18-55', 'All Cameroon', 200,
      'New energy drink launching in urban retail. Validate taste, packaging and price.', 2000).lastInsertRowid;
    const t2 = insertTest.run(kora, 'Shea Glow Serum', 'Product', '20-35', 'Yaoundé', 120,
      'Skincare serum for women 20-35 in Yaoundé. Validate texture and purchase intent.', 2500).lastInsertRowid;
    const t3 = insertTest.run(baobab, 'Plantain Snack Bites', 'Concept', '18-55', 'All Cameroon', 100,
      'New healthy plantain snack concept. Test interest and ideal position.', 2000).lastInsertRowid;
    insertTest.run(novus, 'Flexi Data Plan', 'Concept', '18-34', 'Yaoundé', 150,
      'New flexible data plan for young professionals. Test willingness to switch.', 3000);

    insertResponse.run(t1, 'Amina N.', '25-34', 'Yaoundé', 9, 'yes',
      'The taste is really good. I would buy it every week if it was a little more affordable.', 2000);
    insertResponse.run(t1, 'Jean-Paul K.', '25-34', 'Douala', 8, 'yes',
      'Love the energy boost. Packaging feels premium but price is a concern.', 2000);
    insertResponse.run(t1, 'Sandra M.', '35-44', 'Yaoundé', 7, 'maybe',
      'Taste is decent. Hard to justify at this price point.', 2000);
    insertResponse.run(t1, 'David T.', '18-24', 'Douala', 10, 'yes',
      'Best energy drink I have tried from a local brand!', 2000);
    insertResponse.run(t2, 'Fatima B.', '25-34', 'Yaoundé', 8, 'yes',
      'Absorbs quickly and no residue. Would love a bigger size.', 2500);
    insertResponse.run(t2, 'Marie-Laure D.', '35-44', 'Yaoundé', 7, 'maybe',
      'Nice scent but I want to see results before repurchasing.', 2500);
    insertResponse.run(t3, 'Emmanuel O.', '18-24', 'Bafoussam', 6, 'maybe',
      'Interesting idea but I prefer something savoury over sweet.', 2000);
  });
  seed();
}
seed();

/* -----------------------------------------------------
   PUBLIC QUERIES (used by the API routes)
   ----------------------------------------------------- */
function getAllTests() {
  return db.prepare(`
    SELECT t.id, t.product, t.type, t.age_range, t.location, t.sample_size,
           t.brief, t.reward, t.active, t.created_at,
           c.name AS company
    FROM tests t JOIN companies c ON c.id = t.company_id
    ORDER BY t.created_at DESC
  `).all();
}

function getTest(id) {
  return db.prepare(`
    SELECT t.*, c.name AS company
    FROM tests t JOIN companies c ON c.id = t.company_id
    WHERE t.id = ?
  `).get(id);
}

function getResponses(testId) {
  return db.prepare(`
    SELECT id, name, age_range, location, rating, buy, comment, earned, created_at
    FROM responses WHERE test_id = ? ORDER BY created_at DESC
  `).all(testId);
}

function getTestStats(testId) {
  const r = getResponses(testId);
  const n = r.length;
  const avg = n ? (r.reduce((a, b) => a + b.rating, 0) / n) : 0;
  const buyYes = n ? Math.round((r.filter(x => x.buy === 'yes').length / n) * 100) : 0;
  return { n, avg: n ? Number(avg.toFixed(1)) : 0, buyPct: buyYes };
}

module.exports = {
  db,
  getAllTests,
  getTest,
  getResponses,
  getTestStats,
};
