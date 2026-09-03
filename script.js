/* =====================================================
   CONSUMER TEST LAB — Functional Platform (multi-page)
   Frontend talks to the Server API (server.js),
   which reads/writes a REAL SQLite database (server/db/ctl.db).
   ===================================================== */

/* ---------- API base & session ---------- */
const API = '';
const SESSION_KEY = 'ctl_session';

const $  = (sel, ctx) => (ctx || document).querySelector(sel);
const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
const PAGE = document.body.dataset.page || 'home';

async function api(path, opts) {
  const res = await fetch(API + path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts));
  return res.json();
}

/* ---------- Session (localStorage only) ---------- */
function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; } catch(e) { return null; }
}
function setSession(s) { if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY); }

/* ---------- Global cache of tests ---------- */
let tests = [];
async function refreshTests() { tests = await api('/api/tests'); return tests; }

/* ---------- Modal management ---------- */
function openModal(id) { const m = $(id); if (m) m.classList.add('open'); }
function closeModals() { $$('.modal-overlay').forEach(m => m.classList.remove('open')); }

/* ---------- Navbar: active link state ---------- */
function initNav() {
  $$('.nav-links a').forEach(a => {
    if (a.getAttribute('href') === PAGE + '.html') a.classList.add('active');
  });
  // Nav scrolled shadow
  const nav = $('.nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('nav-scrolled', window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll);
  }
}

/* ---------- Create-test intent from any page ---------- */
function handleStartTest() {
  const sess = getSession();
  if (sess && sess.role === 'company') {
    // already a company — go straight to business portal
    location.href = 'business.html';
    return;
  }
  location.href = 'business.html';
}

function initStartTestButtons() {
  $$('[data-open="create"]').forEach(el => el.addEventListener('click', e => {
    e.preventDefault();
    if (PAGE === 'business') { openModal('#create-modal'); }
    else { handleStartTest(); }
  }));
}

/* =====================================================
   HOME PAGE
   ===================================================== */
function renderPublicTests() {
  const grid = $('#public-test-grid');
  if (!grid) return;
  const live = tests.filter(t => t.stats.n < t.sample_size);
  grid.innerHTML = live.map(t => {
    const s = t.stats;
    const fill = Math.min(100, Math.round((s.n / t.sample_size) * 100));
    const ai = t.ai || {};
    const score = typeof ai.score === 'number' ? ai.score : null;
    const scoreBadge = score !== null
      ? `<span class="meta-chip ${score >= 55 ? 'chip-good' : score >= 35 ? 'chip-mid' : 'chip-bad'}">Readiness ${score}/100</span>`
      : '';
    return `
      <div class="test-card">
        <div class="tag">● ${esc(t.type).toUpperCase()}</div>
        <h3>${esc(t.product)}</h3>
        <div class="meta">
          <span>${esc(t.location)}</span>
          <span>Age ${esc(t.age_range)}</span>
          <span>${s.n}/${t.sample_size} responses</span>
        </div>
        ${scoreBadge}
        <div class="fill"><i style="width:${fill}%"></i></div>
        <div class="reward">${Number(t.reward).toLocaleString()} FCFA</div>
        <a class="button button-lime btn" href="testers.html">Apply to test →</a>
      </div>`;
  }).join('');
  if (!live.length) grid.innerHTML = '<p style="color:#94a29b">No live tests right now. Check back soon!</p>';
}

function renderHero() {
  const t = tests[0];
  if (!t) return;
  const hs = $('#hero-study'); if (hs) hs.innerHTML = `${esc(t.product)} <small>•</small> ${esc(t.type)} test`;
  const s = t.stats;
  const hm = $('#hero-metrics'); if (hm) hm.innerHTML = `
    <article><small>PURCHASE INTENT</small><strong><span class="val">${s.buyPct}</span><em>%</em></strong><p class="up">↑ Based on live responses</p></article>
    <article><small>OVERALL SENTIMENT</small><strong><span class="val">${s.avg}</span><em>/10</em></strong><p class="${ s.avg>=7 ? 'up' : '' }">${ s.avg>=7 ? '↑ Strong acceptance' : 'Review needed' }</p></article>
    <article><small>RESPONSES</small><strong><span class="val">${s.n}</span><em>/${t.sample_size}</em></strong><p>Updated live</p></article>`;
  const ai = t.ai || {};
  const hit = $('#hero-insight-text'); if (hit) hit.textContent = ai.signal ? ai.signal.split(' Collected')[0] : '';
}

/* =====================================================
   BUSINESS PAGE
   ===================================================== */
async function showCompanyDash(session) {
  const auth = $('#company-auth'); if (auth) auth.classList.add('hidden');
  const dash = $('#company-dash'); if (dash) dash.classList.remove('hidden');
  const nm = $('#company-dash-name'); if (nm) nm.textContent = session.name;
  const insights = await api('/api/company/' + session.companyId + '/insights');
  const mine = insights;
  const total = mine.length;
  const totalResp = mine.reduce((a, t) => a + t.stats.n, 0);
  const withResp = mine.filter(t => t.stats.n > 0);
  const avg = withResp.length ? (withResp.reduce((a, t) => a + Number(t.stats.avg), 0) / withResp.length) : 0;
  const cs = $('#company-stats'); if (cs) cs.innerHTML = `
    <div class="stat"><small>STUDIES</small><strong>${total}</strong><p>total tests created</p></div>
    <div class="stat"><small>RESPONSES</small><strong>${totalResp}</strong><p>collected across studies</p></div>
    <div class="stat"><small>AVG SCORE</small><strong>${avg ? avg.toFixed(1) : '—'}</strong><p>out of 10</p></div>`;
  const cl = $('#company-list'); if (!cl) return;
  if (!mine.length) {
    cl.innerHTML = '<p style="color:var(--muted)">You haven\'t created any tests yet. Click "+ New test".</p>';
  } else {
    cl.innerHTML = mine.map(t => {
      const s = t.stats;
      const live = s.n < t.sample_size;
      const ai = t.ai || {};
      const score = typeof ai.score === 'number' ? ai.score : null;
      return `
        <div class="study-row">
          <div><h4>${esc(t.product)}</h4><div class="meta">${esc(t.type)} · ${esc(t.location)} · Age ${esc(t.age_range)} · ${s.n}/${t.sample_size} responses</div>
          ${score !== null ? `<div class="meta stats-line">
            <span class="mini-stat">Readiness <b>${score}</b>/100</span>
            <span class="mini-stat">NPS <b>${s.nps ?? '—'}</b></span>
            <span class="mini-stat">PMF <b>${s.pmf ?? '—'}%</b></span>
            <span class="mini-stat">Buy <b>${s.buyPct}%</b></span>
          </div>` : ''}</div>
          <div class="actions">
            <span class="r-score">${s.avg}<small>/10</small></span>
            <span class="status ${live ? 'live' : 'closed'}">${live ? '● LIVE' : 'CLOSED'}</span>
          </div>
        </div>`;
    }).join('');
    cl.innerHTML += '<br><h4 style="margin:.6rem 0 .2rem">AI insight</h4>' + mine.map(t => `
      <div class="study-row">
        <div><h4>${esc(t.product)}</h4><div class="meta">${esc((t.ai.signal||'').split(' Collected')[0])}</div></div>
      </div>`).join('');
  }
}

function initBusiness() {
  const signin = $('#company-signin');
  if (signin) signin.addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#company-name').value.trim();
    const email = $('#company-email').value.trim();
    if (!name || !email) return;
    $('.form-message', signin).textContent = 'Signing in…';
    const c = await api('/api/company', { method: 'POST', body: JSON.stringify({ name, email }) });
    setSession({ role: 'company', name: c.name, email: c.email, companyId: c.id });
    showCompanyDash(getSession());
  });
  const logout = $('#company-logout');
  if (logout) logout.addEventListener('click', () => {
    setSession(null);
    const dash = $('#company-dash'); if (dash) dash.classList.add('hidden');
    const auth = $('#company-auth'); if (auth) auth.classList.remove('hidden');
  });

  const create = $('#create-form');
  if (create) create.addEventListener('submit', async e => {
    e.preventDefault();
    const product = $('#create-product').value.trim();
    if (!product) { const m = $('#create-message'); if (m) m.textContent = 'Please enter a product name.'; return; }
    const sess = getSession();
    if (!sess || sess.role !== 'company') { location.href = 'business.html'; return; }
    const body = {
      companyId: sess.companyId,
      product,
      type: $('#create-type').value,
      age_range: $('#create-age').value,
      location: $('#create-location').value,
      sample_size: parseInt($('#create-size').value) || 50,
      brief: $('#create-brief').value,
      reward: parseInt($('#create-reward').value) || 0
    };
    const m = $('#create-message'); if (m) m.textContent = 'Creating…';
    await api('/api/tests', { method: 'POST', body: JSON.stringify(body) });
    if (m) m.textContent = `Test "${product}" created! It now appears in the live panel.`;
    create.reset();
    await refreshTests();
    showCompanyDash(sess);
  });

  // Auto-open dashboard if already signed in
  const sess = getSession();
  if (sess && sess.role === 'company') showCompanyDash(sess);
  else closeModals();
}

/* =====================================================
   TESTERS PAGE
   ===================================================== */
function showConsumerDash(session) {
  const auth = $('#consumer-auth'); if (auth) auth.classList.add('hidden');
  const dash = $('#consumer-dash'); if (dash) dash.classList.remove('hidden');
  const nm = $('#consumer-dash-name'); if (nm) nm.textContent = session.name.split(' ')[0];
  let balance = session.earned || 0;
  const cb = $('#consumer-balance'); if (cb) cb.textContent = Number(balance).toLocaleString();

  const available = (session.tests || []).filter(t => t.stats.n < t.sample_size);
  const tl = $('#consumer-test-list'); if (tl) tl.innerHTML = available.length ? available.map(t => `
    <div class="study-row">
      <div><h4>${esc(t.product)}</h4><div class="meta">${esc(t.type)} · ${esc(t.location)} · ~${t.sample_size} testers · ${t.stats.n}/${t.sample_size} full</div></div>
      <div class="actions"><span class="r-score">${Number(t.reward).toLocaleString()} FCFA</span>
      <button class="mini-btn primary" data-take="${t.id}">Take test</button></div>
    </div>`).join('') : '<p style="color:var(--muted)">No tests available for you right now. Check back soon!</p>';

  const sub = $('#consumer-submissions'); if (sub) sub.innerHTML = session.submissions && session.submissions.length
    ? session.submissions.map(s => `
        <div class="study-row"><div><h4>${esc(s.product)}</h4><div class="meta">Your rating: ${s.rating}/10 · ${s.buy}</div></div>
        <div class="actions"><span class="r-score">+${Number(s.earned).toLocaleString()} FCFA</span></div></div>`).join('')
    : '<p style="color:var(--muted)">No submissions yet. Complete a test to earn rewards.</p>';
}

function initTesters() {
  const join = $('#nav-join');
  if (join) join.addEventListener('click', e => {
    e.preventDefault();
    const sess = getSession();
    if (sess && sess.role === 'consumer') { showConsumerDash(sess); }
    else { } // already on page; just scroll to form
    const auth = $('#consumer-auth'); if (auth) auth.scrollIntoView({ behavior: 'smooth' });
  });

  const signup = $('#consumer-signup');
  if (signup) signup.addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#consumer-name').value.trim();
    const age = $('#consumer-age').value;
    const location = $('#consumer-location').value;
    if (!name) return;
    const email = 'panel_' + Date.now() + '@ctl.test';
    $('.form-message', signup).textContent = 'Joining panel…';
    const consumer = await api('/api/consumer', { method: 'POST', body: JSON.stringify({ name, email, age_range: age, location }) });
    const sess = { role: 'consumer', name: consumer.name, email: consumer.email, age, location, consumerId: consumer.id, earned: consumer.earned, submissions: consumer.submissions || [], tests: consumer.tests };
    setSession(sess);
    showConsumerDash(sess);
  });
  const logout = $('#consumer-logout');
  if (logout) logout.addEventListener('click', () => {
    setSession(null);
    const dash = $('#consumer-dash'); if (dash) dash.classList.add('hidden');
    const auth = $('#consumer-auth'); if (auth) auth.classList.remove('hidden');
  });

  // Delegate for take test buttons
  document.addEventListener('click', e => {
    const takeBtn = e.target.closest('[data-take]');
    if (takeBtn) { e.preventDefault(); openFeedback(takeBtn.dataset.take, getSession()); }
  });

  let currentFeedback = null;
  function buildNpsButtons() {
    const row = $('#nps-row');
    if (!row) return;
    row.innerHTML = '';
    for (let i = 0; i <= 10; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'nps-btn';
      b.textContent = i;
      b.dataset.nps = i;
      b.addEventListener('click', () => {
        row.querySelectorAll('.nps-btn').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
        row.dataset.nps = i;
      });
      row.appendChild(b);
    }
  }
  function openFeedback(testId, sess) {
    if (!sess || sess.role !== 'consumer') { const auth = $('#consumer-auth'); if (auth) auth.scrollIntoView({ behavior: 'smooth' }); return; }
    const t = tests.find(x => String(x.id) === String(testId));
    if (!t) return;
    currentFeedback = { testId: Number(testId), name: sess.name, consumerId: sess.consumerId };
    const ft = $('#feedback-title'); if (ft) ft.textContent = `${t.product} — feedback`;
    const fs = $('#feedback-sub'); if (fs) fs.textContent = `Complete this test to earn ${Number(t.reward).toLocaleString()} FCFA.`;
    const ff = $('#feedback-form'); if (ff) ff.reset();
    const npsRow = $('#nps-row'); if (npsRow) delete npsRow.dataset.nps;
    const fm = $('#feedback-message'); if (fm) fm.textContent = '';
    buildNpsButtons();
    openModal('#feedback-modal');
  }

  const fb = $('#feedback-form');
  if (fb) fb.addEventListener('submit', async e => {
    e.preventDefault();
    if (!currentFeedback) return;
    const rating = parseInt($('#feedback-rating').value);
    const buy = $('#feedback-buy').value;
    const npsRow = $('#nps-row');
    const nps = npsRow && npsRow.dataset.nps !== undefined ? parseInt(npsRow.dataset.nps) : null;
    const disappointed = $('#feedback-disappointed').value || null;
    const comment = $('#feedback-comment').value.trim();
    const sess = getSession();
    if (nps === null) { const m = $('#feedback-message'); if (m) m.textContent = 'Please select how likely you would be to recommend it (0–10).'; return; }
    const body = { consumerId: sess.consumerId, name: sess.name, age_range: sess.age || '', location: sess.location || '', rating, buy, nps, disappointed, comment };
    const m = $('#feedback-message'); if (m) m.textContent = 'Submitting…';
    const result = await api('/api/tests/' + currentFeedback.testId + '/responses', { method: 'POST', body: JSON.stringify(body) });
    closeModals();
    const consumer = await api('/api/consumer', { method: 'POST', body: JSON.stringify({ name: sess.name, email: sess.email, age_range: sess.age || '', location: sess.location || '' }) });
    setSession({ ...sess, earned: consumer.earned, submissions: consumer.submissions, tests: consumer.tests });
    await refreshTests();
    showConsumerDash(getSession());
    alert(`Thanks ${sess.name}! Your feedback was submitted. +${result.earned.toLocaleString()} FCFA (new balance ${consumer.earned.toLocaleString()} FCFA).`);
  });

  const sess = getSession();
  if (sess && sess.role === 'consumer') showConsumerDash(sess);
  else closeModals();
}

/* =====================================================
   CONTACT PAGE
   ===================================================== */
function initContact() {
  const form = $('#contact-form');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const type = $('#contact-type').value;
    $('.form-message', form).textContent = `Thanks — your ${type.toLowerCase()} brief is ready for the Consumer Test Lab team.`;
    form.reset();
  });
}

/* =====================================================
   INIT
   ===================================================== */
document.addEventListener('DOMContentLoaded', async () => {
  initNav();
  initStartTestButtons();

  // Close buttons & overlay clicks work on any page with modals
  $$('[data-close]').forEach(el => el.addEventListener('click', closeModals));
  $$('.modal-overlay').forEach(ov => ov.addEventListener('click', e => { if (e.target === ov) closeModals(); }));

  // Load tests once for pages that need them (home, testers)
  if (PAGE === 'home' || PAGE === 'testers') {
    await refreshTests();
  }

  if (PAGE === 'home') {
    renderPublicTests();
    renderHero();
  } else if (PAGE === 'business') {
    initBusiness();
  } else if (PAGE === 'testers') {
    initTesters();
  } else if (PAGE === 'contact') {
    initContact();
  }
});
