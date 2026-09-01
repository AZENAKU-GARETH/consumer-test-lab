/* =====================================================
   CONSUMER TEST LAB — Functional Platform
   Frontend talks to the Server API (server.js),
   which reads/writes a REAL SQLite database (server/db/ctl.db).
   ===================================================== */

/* ---------- API base ---------- */
const API = '';                       // same origin (served by server.js)
const SESSION_KEY = 'ctl_session';    // only who is logged in (localStorage)

/* ---------- Helpers ---------- */
const $ = (sel, ctx) => (ctx || document).querySelector(sel);
const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

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
function testStats(n, avg, buyPct) {
  return { n, avg: n ? Number(avg).toFixed(1) : '0.0', buyPct };
}

/* =====================================================
   RENDERING
   ===================================================== */

/* --- Public test grid --- */
function renderPublicTests() {
  const grid = $('#public-test-grid');
  if (!grid) return;
  const live = tests.filter(t => t.stats.n < t.sample_size);
  grid.innerHTML = live.map(t => {
    const s = t.stats;
    const fill = Math.min(100, Math.round((s.n / t.sample_size) * 100));
    return `
      <div class="test-card">
        <div class="tag">● ${esc(t.type).toUpperCase()}</div>
        <h3>${esc(t.product)}</h3>
        <div class="meta">
          <span>${esc(t.location)}</span>
          <span>Age ${esc(t.age_range)}</span>
          <span>${s.n}/${t.sample_size} responses</span>
        </div>
        <div class="fill"><i style="width:${fill}%"></i></div>
        <div class="reward">Reward ${Number(t.reward).toLocaleString()} FCFA</div>
        <button class="button button-lime btn" data-apply="${t.id}">Apply to test →</button>
      </div>`;
  }).join('');
  if (!live.length) grid.innerHTML = '<p style="color:#94a29b">No live tests right now. Check back soon!</p>';
}

/* --- Hero live dashboard --- */
function renderHero() {
  const t = tests[0];
  if (!t) return;
  $('#hero-study').innerHTML = `${esc(t.product)} <small>•</small> ${esc(t.type)} test`;
  const s = t.stats;
  $('#hero-metrics').innerHTML = `
    <article><small>PURCHASE INTENT</small><strong><span class="val">${s.buyPct}</span><em>%</em></strong><p class="up">↑ Based on live responses</p></article>
    <article><small>OVERALL SENTIMENT</small><strong><span class="val">${s.avg}</span><em>/10</em></strong><p class="${ s.avg>=7 ? 'up' : '' }">${ s.avg>=7 ? '↑ Strong acceptance' : 'Review needed' }</p></article>
    <article><small>RESPONSES</small><strong><span class="val">${s.n}</span><em>/${t.sample_size}</em></strong><p>Updated live</p></article>`;
  const ai = t.ai || {};
  $('#hero-insight-text').textContent = ai.signal ? ai.signal.split(' Collected')[0] : '';
}

/* --- Dashboard study overview (insights section) --- */
function renderInsights() {
  const withResponses = tests.filter(t => t.stats.n > 0);
  const t = withResponses[0] || tests[0];
  if (!t) return;
  const s = t.stats;
  const ai = t.ai || {};
  $('#dash-study').innerHTML = `${esc(t.product)}<br /><small>${esc(t.type).toUpperCase()} TEST · 2026</small>`;
  $('#dash-title-text').textContent = `${t.product} launch test`;
  $('#dash-responses').textContent = s.n;
  $('#dash-score').textContent = s.avg;
  $('#dash-ai').textContent = ai.signal ? ai.signal.split(' Collected')[0] : '';
  $('#dash-quote').innerHTML = `“${esc(ai.quote)}”<br /><span>${esc(ai.author || '')}</span>`;
  const tags = ['Taste','Pricing','Packaging','Availability'];
  $('#dash-tags').innerHTML = tags.map(x => `<b>${x}</b>`).join('');
}

/* =====================================================
   COMPANY PORTAL
   ===================================================== */
async function showCompanyDash(session) {
  $('#company-auth').classList.add('hidden');
  $('#company-dash').classList.remove('hidden');
  $('#company-dash-name').textContent = session.name;
  const insights = await api('/api/company/' + session.companyId + '/insights');
  const mine = insights;
  const total = mine.length;
  const totalResp = mine.reduce((a, t) => a + t.stats.n, 0);
  const withResp = mine.filter(t => t.stats.n > 0);
  const avg = withResp.length ? (withResp.reduce((a, t) => a + Number(t.stats.avg), 0) / withResp.length) : 0;
  $('#company-stats').innerHTML = `
    <div class="stat"><small>STUDIES</small><strong>${total}</strong><p>total tests created</p></div>
    <div class="stat"><small>RESPONSES</small><strong>${totalResp}</strong><p>collected across studies</p></div>
    <div class="stat"><small>AVG SCORE</small><strong>${avg ? avg.toFixed(1) : '—'}</strong><p>out of 10</p></div>`;
  if (!mine.length) {
    $('#company-list').innerHTML = '<p style="color:var(--muted)">You haven\'t created any tests yet. Click "+ New test".</p>';
  } else {
    $('#company-list').innerHTML = mine.map(t => {
      const s = t.stats;
      const live = s.n < t.sample_size;
      return `
        <div class="study-row">
          <div><h4>${esc(t.product)}</h4><div class="meta">${esc(t.type)} · ${esc(t.location)} · Age ${esc(t.age_range)} · ${s.n}/${t.sample_size} responses</div></div>
          <div class="actions">
            <span class="r-score">${s.avg}<small>/10</small></span>
            <span class="status ${live ? 'live' : 'closed'}">${live ? '● LIVE' : 'CLOSED'}</span>
          </div>
        </div>`;
    }).join('');
    // append AI insights summary per study
    $('#company-list').innerHTML += '<br><h4 style="margin:.6rem 0 .2rem">AI insight</h4>' + mine.map(t => `
      <div class="study-row">
        <div><h4>${esc(t.product)}</h4><div class="meta">${esc((t.ai.signal||'').split(' Collected')[0])}</div></div>
      </div>`).join('');
  }
}

/* =====================================================
   CONSUMER PORTAL
   ===================================================== */
function showConsumerDash(session) {
  $('#consumer-auth').classList.add('hidden');
  $('#consumer-dash').classList.remove('hidden');
  $('#consumer-dash-name').textContent = session.name.split(' ')[0];
  // balance is stored on the session from the server response
  let balance = session.earned || 0;
  $('#consumer-balance').textContent = Number(balance).toLocaleString();

  // available tests: have a consumerId, so the server tracked submissions
  const available = (session.tests || []).filter(t => t.stats.n < t.sample_size);
  $('#consumer-test-list').innerHTML = available.length ? available.map(t => `
    <div class="study-row">
      <div><h4>${esc(t.product)}</h4><div class="meta">${esc(t.type)} · ${esc(t.location)} · ~${t.sample_size} testers · ${t.stats.n}/${t.sample_size} full</div></div>
      <div class="actions"><span class="r-score">${Number(t.reward).toLocaleString()} FCFA</span>
      <button class="mini-btn" data-take="${t.id}">Take test</button></div>
    </div>`).join('') : '<p style="color:var(--muted)">No tests available for you right now. Check back soon!</p>';

  // submissions (earnings history not persisted per-browser — reward total shown above)
  $('#consumer-submissions').innerHTML = session.submissions && session.submissions.length
    ? session.submissions.map(s => `
        <div class="study-row"><div><h4>${esc(s.product)}</h4><div class="meta">Your rating: ${s.rating}/10 · ${s.buy}</div></div>
        <div class="actions"><span class="r-score">+${Number(s.earned).toLocaleString()} FCFA</span></div></div>`).join('')
    : '<p style="color:var(--muted)">No submissions yet. Complete a test to earn rewards.</p>';
}

/* =====================================================
   MODAL MANAGEMENT
   ===================================================== */
function openModal(id) { const m = $(id); if (m) m.classList.add('open'); }
function closeModals() { $$('.modal-overlay').forEach(m => m.classList.remove('open')); }

/* =====================================================
   EVENT BINDING
   ===================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const $open = $('#open-nav'); // (optional)

  // Public nav triggers
  $$('[data-open]').forEach(el => el.addEventListener('click', e => {
    e.preventDefault();
    const target = el.dataset.open;
    const role = el.dataset.role;
    if (target === 'create') {
      const s = getSession();
      if (s && s.role === 'company') { openModal('#create-modal'); }
      else { openModal('#portal'); activateTab('company'); }
      return;
    }
    if (target === 'panel') { document.querySelector('#panel').scrollIntoView(); return; }
    if (target === 'portal') {
      openModal('#portal');
      const sess = getSession();
      if (sess && sess.role === 'company') { activateTab('company'); showCompanyDash(sess); }
      else if (sess && sess.role === 'consumer') { activateTab('consumer'); showConsumerDash(sess); }
      else if (role === 'company') activateTab('company');
      else if (role === 'consumer') activateTab('consumer');
      return;
    }
    if (target === 'consumer-signup') { openModal('#portal'); activateTab('consumer'); }
  }));

  // Portal tabs
  function activateTab(role) {
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.portalTab === role));
    $('#portal-company').classList.toggle('hidden', role !== 'company');
    $('#portal-consumer').classList.toggle('hidden', role !== 'consumer');
  }
  $$('[data-portal-tab]').forEach(t => t.addEventListener('click', () => {
    activateTab(t.dataset.portalTab);
  }));

  // Close buttons
  $$('[data-close]').forEach(el => el.addEventListener('click', closeModals));
  $$('.modal-overlay').forEach(ov => ov.addEventListener('click', e => {
    if (e.target === ov) closeModals();
  }));

  // Company sign in (calls API to get-or-create in the database)
  $('#company-signin').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#company-name').value.trim();
    const email = $('#company-email').value.trim();
    if (!name || !email) return;
    $('#company-signin .form-message').textContent = 'Signing in…';
    const c = await api('/api/company', { method: 'POST', body: JSON.stringify({ name, email }) });
    const sess = { role: 'company', name: c.name, email: c.email, companyId: c.id };
    setSession(sess);
    showCompanyDash(sess);
  });
  $('#company-logout').addEventListener('click', () => { setSession(null); $('#company-dash').classList.add('hidden'); $('#company-auth').classList.remove('hidden'); });

  // Consumer sign up (calls API to get-or-create in the database)
  $('#consumer-signup').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#consumer-name').value.trim();
    const age = $('#consumer-age').value;
    const location = $('#consumer-location').value;
    if (!name) return;
    const email = 'panel_' + Date.now() + '@ctl.test';
    $('#consumer-signup .form-message').textContent = 'Joining panel…';
    const consumer = await api('/api/consumer', { method: 'POST', body: JSON.stringify({ name, email, age_range: age, location }) });
    const sess = { role: 'consumer', name: consumer.name, email: consumer.email, age, location, consumerId: consumer.id, earned: consumer.earned, submissions: consumer.submissions || [], tests: consumer.tests };
    setSession(sess);
    showConsumerDash(sess);
  });
  $('#consumer-logout').addEventListener('click', () => { setSession(null); $('#consumer-dash').classList.add('hidden'); $('#consumer-auth').classList.remove('hidden'); });

  // Create test form (calls API)
  $('#create-form').addEventListener('submit', async e => {
    e.preventDefault();
    const product = $('#create-product').value.trim();
    if (!product) { $('#create-message').textContent = 'Please enter a product name.'; return; }
    const sess = getSession();
    if (!sess || sess.role !== 'company') { openModal('#portal'); activateTab('company'); return; }
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
    $('#create-message').textContent = 'Creating…';
    await api('/api/tests', { method: 'POST', body: JSON.stringify(body) });
    $('#create-message').textContent = `Test "${product}" created! It now appears in the live panel.`;
    $('#create-form').reset();
    await refreshTests();
    renderPublicTests(); renderHero(); renderInsights();
    showCompanyDash(sess);
  });

  // Delegate for apply / take test / export
  document.addEventListener('click', e => {
    const applyBtn = e.target.closest('[data-apply]');
    if (applyBtn) {
      e.preventDefault();
      const sess = getSession();
      if (!sess || sess.role !== 'consumer') { openModal('#portal'); activateTab('consumer'); return; }
      openFeedback(applyBtn.dataset.apply, sess);
      return;
    }
    const takeBtn = e.target.closest('[data-take]');
    if (takeBtn) { openFeedback(takeBtn.dataset.take, getSession()); }
    if (e.target.closest('#dash-export')) { exportReport(); }
  });

  // Feedback modal
  let currentFeedback = null;
  function openFeedback(testId, sess) {
    if (!sess || sess.role !== 'consumer') { openModal('#portal'); activateTab('consumer'); return; }
    const t = tests.find(x => String(x.id) === String(testId));
    if (!t) return;
    currentFeedback = { testId: Number(testId), name: sess.name, consumerId: sess.consumerId };
    $('#feedback-title').textContent = `${t.product} — feedback`;
    $('#feedback-sub').textContent = `Complete this test to earn ${Number(t.reward).toLocaleString()} FCFA.`;
    $('#feedback-form').reset();
    $('#feedback-message').textContent = '';
    openModal('#feedback-modal');
  }

  $('#feedback-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!currentFeedback) return;
    const rating = parseInt($('#feedback-rating').value);
    const buy = $('#feedback-buy').value;
    const comment = $('#feedback-comment').value.trim();
    const sess = getSession();
    const body = {
      consumerId: sess.consumerId,
      name: sess.name,
      age_range: sess.age || '',
      location: sess.location || '',
      rating, buy, comment
    };
    $('#feedback-message').textContent = 'Submitting…';
    const result = await api('/api/tests/' + currentFeedback.testId + '/responses', { method: 'POST', body: JSON.stringify(body) });
    closeModals();
    // refresh session with new earnings
    const consumer = await api('/api/consumer', { method: 'POST', body: JSON.stringify({ name: sess.name, email: sess.email, age_range: sess.age || '', location: sess.location || '' }) });
    setSession({ ...sess, earned: consumer.earned, submissions: consumer.submissions, tests: consumer.tests });
    await refreshTests();
    renderPublicTests(); renderHero(); renderInsights();
    showConsumerDash(getSession());
    alert(`Thanks ${sess.name}! Your feedback was submitted. +${result.earned.toLocaleString()} FCFA (new balance ${consumer.earned.toLocaleString()} FCFA).`);
  });

  // Contact form
  $('#contact-form').addEventListener('submit', e => {
    e.preventDefault();
    const type = $('#contact-type').value;
    $('#contact-form .form-message').textContent = `Thanks — your ${type.toLowerCase()} brief is ready for the Consumer Test Lab team.`;
    $('#contact-form').reset();
  });

  // Export (CSV) from the server data
  async function exportReport() {
    const withResp = tests.filter(t => t.stats.n > 0);
    const t = withResp[0] || tests[0];
    if (!t) return;
    const detail = await api('/api/tests/' + t.id);
    const rows = [['Name','Age','Location','Rating','Buy','Comment'],
      ...(detail.responses || []).map(r => [r.name, r.age_range, r.location, r.rating, r.buy, '"' + (r.comment||'').replace(/"/g,'""') + '"'])];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${t.product.replace(/\s+/g, '_')}_report.csv`;
    a.click();
  }

  // Initial render (fetch from server DB)
  (async function init() {
    await refreshTests();
    renderPublicTests();
    renderHero();
    renderInsights();
  })();
});
