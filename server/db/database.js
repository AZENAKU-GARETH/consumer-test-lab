/* =====================================================
   Consumer Test Lab — Database Layer (dual-driver)
   Local mode:     SQLite file at server/db/ctl.db
   Cloud mode:     PostgreSQL via DATABASE_URL (e.g. Neon)
   Choose by setting the DATABASE_URL environment variable.
   ===================================================== */
const path = require('path');
const fs = require('fs');

const DATABASE_URL = process.env.DATABASE_URL || '';

const usePg = DATABASE_URL.length > 0;

/* =====================================================
   SHARED HELPERS
   ===================================================== */
function computeStats(responses) {
  const n = responses.length;
  const avg = n ? (responses.reduce((a, b) => a + b.rating, 0) / n) : 0;
  const buyYes = n ? Math.round((responses.filter(x => x.buy === 'yes').length / n) * 100) : 0;

  // NPS (Net Promoter Score): promoters (9-10) minus detractors (0-6), range -100..100
  const withNps = responses.filter(r => typeof r.nps === 'number');
  const npsValid = withNps.length;
  let nps = null;
  if (npsValid) {
    const promoters = withNps.filter(r => r.nps >= 9).length;
    const detractors = withNps.filter(r => r.nps <= 6).length;
    nps = Math.round(((promoters - detractors) / npsValid) * 100);
  }

  // Product-Market Fit (Sean Ellis): % who would be "very disappointed" without it
  const withD = responses.filter(r => r.disappointed !== null && r.disappointed !== undefined);
  const pmfValid = withD.length;
  let pmf = null;
  if (pmfValid) {
    pmf = Math.round((withD.filter(r => r.disappointed === 'yes').length / pmfValid) * 100);
  }

  return { n, avg: n ? Number(avg.toFixed(1)) : 0, buyPct: buyYes, nps, pmf };
}

const SEED_TESTS = [
  { company: 'Rinda Beverages', email: 'rinda@example.com', responseCount: 4 },
];

async function seedTestData(insertCompany, insertTest, insertResponse, lastId) {
  const ids = {};
  ids.rinda = lastId(insertCompany('Rinda Beverages', 'rinda@example.com'));
  ids.kora = lastId(insertCompany('Kora Cosmetics', 'kora@example.com'));
  ids.baobab = lastId(insertCompany('Baobab Foods', 'baobab@example.com'));
  ids.novus = lastId(insertCompany('Novus Telecom', 'novus@example.com'));

  ids.t1 = lastId(insertTest(ids.rinda, 'Rinda Energy', 'Product', '18-55', 'All Cameroon', 200,
    'New energy drink launching in urban retail. Validate taste, packaging and price.', 2000));
  ids.t2 = lastId(insertTest(ids.kora, 'Shea Glow Serum', 'Product', '20-35', 'Yaoundé', 120,
    'Skincare serum for women 20-35 in Yaoundé. Validate texture and purchase intent.', 2500));
  ids.t3 = lastId(insertTest(ids.baobab, 'Plantain Snack Bites', 'Concept', '18-55', 'All Cameroon', 100,
    'New healthy plantain snack concept. Test interest and ideal position.', 2000));
  insertTest(ids.novus, 'Flexi Data Plan', 'Concept', '18-34', 'Yaoundé', 150,
    'New flexible data plan for young professionals. Test willingness to switch.', 3000);

  insertResponse(ids.t1, 'Amina N.', '25-34', 'Yaoundé', 9, 'yes', 10, 'yes',
    'The taste is really good. I would buy it every week if it was a little more affordable.', 2000);
  insertResponse(ids.t1, 'Jean-Paul K.', '25-34', 'Douala', 8, 'yes', 9, 'yes',
    'Love the energy boost. Packaging feels premium but price is a concern.', 2000);
  insertResponse(ids.t1, 'Sandra M.', '35-44', 'Yaoundé', 7, 'maybe', 7, 'no',
    'Taste is decent. Hard to justify at this price point.', 2000);
  insertResponse(ids.t1, 'David T.', '18-24', 'Douala', 10, 'yes', 10, 'yes',
    'Best energy drink I have tried from a local brand!', 2000);
  insertResponse(ids.t2, 'Fatima B.', '25-34', 'Yaoundé', 8, 'yes', 9, 'yes',
    'Absorbs quickly and no residue. Would love a bigger size.', 2500);
  insertResponse(ids.t2, 'Marie-Laure D.', '35-44', 'Yaoundé', 7, 'maybe', 6, 'no',
    'Nice scent but I want to see results before repurchasing.', 2500);
  insertResponse(ids.t3, 'Emmanuel O.', '18-24', 'Bafoussam', 6, 'maybe', 5, 'no',
    'Interesting idea but I prefer something savoury over sweet.', 2000);
}

/* =====================================================
   POSTGRES DRIVER (used when DATABASE_URL is set)
   ===================================================== */
let pgDriver = null;
if (usePg) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('sslmode') || true ? { rejectUnauthorized: false } : false,
  });

  pgDriver = {
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS companies (
          id       SERIAL PRIMARY KEY,
          name     TEXT NOT NULL,
          email    TEXT NOT NULL UNIQUE,
          created  TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS consumers (
          id         SERIAL PRIMARY KEY,
          name       TEXT NOT NULL,
          email      TEXT NOT NULL UNIQUE,
          age_range  TEXT,
          location   TEXT,
          created    TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS tests (
          id           SERIAL PRIMARY KEY,
          company_id   INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          product      TEXT NOT NULL,
          type         TEXT,
          age_range    TEXT,
          location     TEXT,
          sample_size  INTEGER NOT NULL,
          brief        TEXT,
          reward       INTEGER NOT NULL DEFAULT 0,
          active       INTEGER NOT NULL DEFAULT 1,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS responses (
          id            SERIAL PRIMARY KEY,
          test_id       INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
          consumer_id   INTEGER REFERENCES consumers(id) ON DELETE SET NULL,
          name          TEXT,
          age_range     TEXT,
          location      TEXT,
          rating        INTEGER NOT NULL,
          buy           TEXT,
          nps           INTEGER,
          disappointed  TEXT,
          comment       TEXT,
          earned        INTEGER NOT NULL DEFAULT 0,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_responses_test ON responses(test_id);
        CREATE INDEX IF NOT EXISTS idx_tests_company ON tests(company_id);
      `);
      // Migration: add columns to existing responses tables (safe no-op if already present)
      try { await pool.query('ALTER TABLE responses ADD COLUMN IF NOT EXISTS nps INTEGER'); } catch (e) {}
      try { await pool.query('ALTER TABLE responses ADD COLUMN IF NOT EXISTS disappointed TEXT'); } catch (e) {}
      // Seed if empty
      const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM tests');
      if (rows[0].c > 0) return;
      const insertCompany = async (n, e) => (await pool.query(
        'INSERT INTO companies (name, email) VALUES ($1, $2) RETURNING id', [n, e])).rows[0].id;
      const insertTest = async (cid, p, ty, ag, lo, ss, br, rw) => (await pool.query(
        `INSERT INTO tests (company_id, product, type, age_range, location, sample_size, brief, reward)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [cid, p, ty, ag, lo, ss, br, rw])).rows[0].id;
      const insertResponse = async (tid, n, ag, lo, rt, by, np, di, co, ea) => {
        await pool.query(
          `INSERT INTO responses (test_id, consumer_id, name, age_range, location, rating, buy, nps, disappointed, comment, earned)
           VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [tid, n, ag, lo, rt, by, np, di, co, ea]);
      };
      await seedTestData(insertCompany, insertTest, insertResponse, id => id);
    },

    async getAllTests() {
      const { rows } = await pool.query(`
        SELECT t.id, t.product, t.type, t.age_range, t.location, t.sample_size,
               t.brief, t.reward, t.active, t.created_at, t.company_id,
               c.name AS company
        FROM tests t JOIN companies c ON c.id = t.company_id
        ORDER BY t.created_at DESC`);
      return rows;
    },

    async getTest(id) {
      const { rows } = await pool.query(`
        SELECT t.*, c.name AS company
        FROM tests t JOIN companies c ON c.id = t.company_id
        WHERE t.id = $1`, [Number(id)]);
      return rows[0] || null;
    },

    async getResponses(testId) {
      const { rows } = await pool.query(`
        SELECT id, name, age_range, location, rating, buy, nps, disappointed, comment, earned, created_at
        FROM responses WHERE test_id = $1 ORDER BY created_at DESC`, [Number(testId)]);
      return rows;
    },

    async getTestStats(testId) { return computeStats(await this.getResponses(testId)); },

    async companySignin(name, email) {
      let { rows } = await pool.query('SELECT * FROM companies WHERE email = $1', [email]);
      if (!rows.length) {
        rows = (await pool.query(
          'INSERT INTO companies (name, email) VALUES ($1, $2) RETURNING *', [name, email])).rows;
      } else {
        await pool.query('UPDATE companies SET name = $1 WHERE id = $2', [name, rows[0].id]);
        rows[0].name = name;
      }
      return rows[0];
    },

    async consumerSignin(name, email, ageRange, location) {
      let { rows } = await pool.query('SELECT * FROM consumers WHERE email = $1', [email]);
      if (!rows.length) {
        rows = (await pool.query(
          `INSERT INTO consumers (name, email, age_range, location) VALUES ($1, $2, $3, $4) RETURNING *`,
          [name, email, ageRange || '', location || ''])).rows;
      } else {
        await pool.query('UPDATE consumers SET name = $1, age_range = $2, location = $3 WHERE id = $4',
          [name, ageRange || '', location || '', rows[0].id]);
        rows[0].name = name; rows[0].age_range = ageRange || ''; rows[0].location = location || '';
      }
      return rows[0];
    },

    async createTest({ companyId, product, type, age_range, location, sample_size, brief, reward }) {
      const { rows } = await pool.query(
        `INSERT INTO tests (company_id, product, type, age_range, location, sample_size, brief, reward)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [companyId, product, type || 'Product', age_range || '', location || 'All Cameroon',
         Number(sample_size) || 50, brief || '', Number(reward) || 0]);
      return this.getTest(rows[0].id);
    },

    async addResponse({ testId, consumerId, name, age_range, location, rating, buy, nps, disappointed, comment, earned }) {
      const { rows } = await pool.query(
        `INSERT INTO responses (test_id, consumer_id, name, age_range, location, rating, buy, nps, disappointed, comment, earned)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [Number(testId), consumerId || null, name || '', age_range || '', location || '',
         Number(rating) || 0, buy || 'maybe',
         nps === null || nps === undefined ? null : Number(nps),
         disappointed === null || disappointed === undefined ? null : (disappointed === 'yes' ? 'yes' : 'no'),
         comment || '', earned]);
      return { id: rows[0].id, earned };
    },

    async getCompanyTests(companyId) {
      const { rows } = await pool.query(
        `SELECT id FROM tests WHERE company_id = $1`, [Number(companyId)]);
      const out = [];
      for (const r of rows) out.push(await this.getTest(r.id));
      return out;
    },

    async getConsumerSummary(consumerId) {
      const earned = Number((await pool.query(
        'SELECT COALESCE(SUM(earned),0)::int AS t FROM responses WHERE consumer_id = $1',
        [Number(consumerId)])).rows[0].t);
      const { rows } = await pool.query(`
        SELECT r.rating, r.buy, r.earned, t.product, r.created_at
        FROM responses r JOIN tests t ON t.id = r.test_id
        WHERE r.consumer_id = $1 ORDER BY r.created_at DESC`, [Number(consumerId)]);
      return { earned, submissions: rows };
    },

    async close() { await pool.end(); },
  };
}

/* =====================================================
   SQLITE DRIVER (local file — used when no DATABASE_URL)
   ===================================================== */
function createSqliteDriver() {
  const Database = require('better-sqlite3');
  const DB_DIR = path.join(__dirname);
  const DB_PATH = path.join(DB_DIR, 'ctl.db');
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

  const raw = new Database(DB_PATH);
  raw.pragma('journal_mode = WAL');
  raw.pragma('foreign_keys = ON');

  raw.exec(`
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
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id       INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
      consumer_id   INTEGER REFERENCES consumers(id) ON DELETE SET NULL,
      name          TEXT,
      age_range     TEXT,
      location      TEXT,
      rating        INTEGER NOT NULL,
      buy           TEXT,
      nps           INTEGER,
      disappointed  TEXT,
      comment       TEXT,
      earned        INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_responses_test ON responses(test_id);
    CREATE INDEX IF NOT EXISTS idx_tests_company ON tests(company_id);
  `);

  // Migration: add columns to existing responses tables (safe no-op if already present)
  const respCols = raw.prepare("PRAGMA table_info(responses)").all().map(c => c.name);
  if (!respCols.includes('nps')) { try { raw.exec('ALTER TABLE responses ADD COLUMN nps INTEGER'); } catch (e) {} }
  if (!respCols.includes('disappointed')) { try { raw.exec('ALTER TABLE responses ADD COLUMN disappointed TEXT'); } catch (e) {} }

  const driver = {
    async init() {
      const c = raw.prepare('SELECT COUNT(*) AS c FROM tests').get().c;
      if (c > 0) return;
      const insertCompany = (n, e) => raw.prepare('INSERT INTO companies (name, email) VALUES (?, ?)').run(n, e).lastInsertRowid;
      const insertTest = (cid, p, ty, ag, lo, ss, br, rw) => raw.prepare(
        `INSERT INTO tests (company_id, product, type, age_range, location, sample_size, brief, reward)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(cid, p, ty, ag, lo, ss, br, rw).lastInsertRowid;
      const insertResponse = (tid, nm, ag, lo, rt, by, np, di, co, ea) => raw.prepare(
        `INSERT INTO responses (test_id, consumer_id, name, age_range, location, rating, buy, nps, disappointed, comment, earned)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(tid, nm, ag, lo, rt, by, np, di, co, ea);
      seedTestData(insertCompany, insertTest, insertResponse, id => id);
    },

    async getAllTests() {
      return raw.prepare(`
        SELECT t.id, t.product, t.type, t.age_range, t.location, t.sample_size,
               t.brief, t.reward, t.active, t.created_at, t.company_id,
               c.name AS company
        FROM tests t JOIN companies c ON c.id = t.company_id
        ORDER BY t.created_at DESC`).all();
    },

    async getTest(id) {
      return raw.prepare(`
        SELECT t.*, c.name AS company
        FROM tests t JOIN companies c ON c.id = t.company_id
        WHERE t.id = ?`).get(Number(id)) || null;
    },

    async getResponses(testId) {
      return raw.prepare(`
        SELECT id, name, age_range, location, rating, buy, nps, disappointed, comment, earned, created_at
        FROM responses WHERE test_id = ? ORDER BY created_at DESC`).all(Number(testId));
    },

    async getTestStats(testId) { return computeStats(await this.getResponses(testId)); },

    async companySignin(name, email) {
      let c = raw.prepare('SELECT * FROM companies WHERE email = ?').get(email);
      if (!c) {
        const info = raw.prepare('INSERT INTO companies (name, email) VALUES (?, ?)').run(name, email);
        c = raw.prepare('SELECT * FROM companies WHERE id = ?').get(info.lastInsertRowid);
      } else {
        raw.prepare('UPDATE companies SET name = ? WHERE id = ?').run(name, c.id);
        c.name = name;
      }
      return c;
    },

    async consumerSignin(name, email, ageRange, location) {
      let c = raw.prepare('SELECT * FROM consumers WHERE email = ?').get(email);
      if (!c) {
        const info = raw.prepare('INSERT INTO consumers (name, email, age_range, location) VALUES (?, ?, ?, ?)')
          .run(name, email, ageRange || '', location || '');
        c = raw.prepare('SELECT * FROM consumers WHERE id = ?').get(info.lastInsertRowid);
      } else {
        raw.prepare('UPDATE consumers SET name = ?, age_range = ?, location = ? WHERE id = ?')
          .run(name, ageRange || '', location || '', c.id);
        c.name = name; c.age_range = ageRange || ''; c.location = location || '';
      }
      return c;
    },

    async createTest({ companyId, product, type, age_range, location, sample_size, brief, reward }) {
      const info = raw.prepare(
        `INSERT INTO tests (company_id, product, type, age_range, location, sample_size, brief, reward)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        companyId, product, type || 'Product', age_range || '', location || 'All Cameroon',
        Number(sample_size) || 50, brief || '', Number(reward) || 0);
      return this.getTest(info.lastInsertRowid);
    },

    async addResponse({ testId, consumerId, name, age_range, location, rating, buy, nps, disappointed, comment, earned }) {
      const info = raw.prepare(
        `INSERT INTO responses (test_id, consumer_id, name, age_range, location, rating, buy, nps, disappointed, comment, earned)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        Number(testId), consumerId || null, name || '', age_range || '', location || '',
        Number(rating) || 0, buy || 'maybe',
        nps === null || nps === undefined ? null : Number(nps),
        disappointed === null || disappointed === undefined ? null : (disappointed === 'yes' ? 'yes' : 'no'),
        comment || '', earned);
      return { id: info.lastInsertRowid, earned };
    },

    async getCompanyTests(companyId) {
      const ids = raw.prepare('SELECT id FROM tests WHERE company_id = ?').all(Number(companyId));
      const out = [];
      for (const r of ids) out.push(await this.getTest(r.id));
      return out;
    },

    async getConsumerSummary(consumerId) {
      const earned = Number(raw.prepare(
        'SELECT COALESCE(SUM(earned),0) AS t FROM responses WHERE consumer_id = ?').get(Number(consumerId)).t || 0);
      const submissions = raw.prepare(`
        SELECT r.rating, r.buy, r.earned, t.product, r.created_at
        FROM responses r JOIN tests t ON t.id = r.test_id
        WHERE r.consumer_id = ? ORDER BY r.created_at DESC`).all(Number(consumerId));
      return { earned, submissions };
    },

    async close() { raw.close(); },
  };
  return driver;
}

/* =====================================================
   EXPORT the active driver
   ===================================================== */
const db = usePg ? pgDriver : createSqliteDriver();

module.exports = {
  db,
  usePg,
  computeStats,
};