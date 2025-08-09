// Shared dashboard logic (DRY)
const nf = new Intl.NumberFormat('ru-RU');

function formatHourLocal(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function build24hRange(sinceIso) {
  const out = [];
  const since = new Date(sinceIso);
  const start = new Date(since);
  start.setMinutes(0, 0, 0);
  for (let i = 0; i < 24; i++) {
    const d = new Date(start.getTime() + i * 3600_000);
    out.push(d.toISOString().slice(0, 13) + ':00:00.000Z');
  }
  return out;
}

function renderKPI(kpi) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('k_total', nf.format(kpi.total_msgs));
  set('k_unique', nf.format(kpi.unique_users));
  set('k_avg', (Math.round(kpi.avg_per_user * 100) / 100).toFixed(2));
  set('k_replies', nf.format(kpi.replies));
  set('k_links', nf.format(kpi.with_links));
}

function renderSummary(summaryBullets) {
  const ul = document.getElementById('summary');
  if (!ul) return;
  ul.innerHTML = '';
  summaryBullets.forEach(s => {
    const li = document.createElement('li');
    li.textContent = s;
    ul.appendChild(li);
  });
}

function renderTables(data) {
  const rows = (arr, mapFn) => arr.map(mapFn).join('');
  const topUsers = document.getElementById('topUsers');
  if (topUsers) topUsers.innerHTML = '<tr><th>Пользователь</th><th>Сообщений</th></tr>' + rows(data.topUsers, u => `<tr><td>${u.user}</td><td>${nf.format(u.cnt)}</td></tr>`);
  const topLinks = document.getElementById('topLinks');
  if (topLinks) topLinks.innerHTML = '<tr><th>Ссылка</th><th>Кол-во</th></tr>' + rows(data.topLinks, l => `<tr><td><a href="${l.url}" target="_blank" rel="noreferrer noopener">${l.url}</a></td><td>${nf.format(l.cnt)}</td></tr>`);
  const topWords = document.getElementById('topWords');
  if (topWords) topWords.innerHTML = '<tr><th>Слово</th><th>Кол-во</th></tr>' + rows(data.topWords, w => `<tr><td>${w.word}</td><td>${nf.format(w.cnt)}</td></tr>`);
  const topThreads = document.getElementById('topThreads');
  if (topThreads) topThreads.innerHTML = '<tr><th>Root ID</th><th>Ответов</th><th>Превью</th></tr>' + rows(data.topThreads, t => `<tr><td>${t.root_id}</td><td>${nf.format(t.replies)}</td><td>${t.root_preview}</td></tr>`);

  // New tables
  const unanswered = document.getElementById('unanswered');
  if (unanswered) unanswered.innerHTML = '<tr><th>ID</th><th>Превью</th><th>Часов</th></tr>' + rows(data.unanswered || [], r => `<tr><td>${r.id}</td><td>${r.preview}</td><td>${nf.format(r.hours)}</td></tr>`);

  const topHelpers = document.getElementById('topHelpers');
  if (topHelpers) topHelpers.innerHTML = '<tr><th>Пользователь</th><th>Ответов</th></tr>' + rows(data.topHelpers || [], h => `<tr><td>${h.user}</td><td>${nf.format(h.cnt)}</td></tr>`);

  const topErrors = document.getElementById('topErrors');
  if (topErrors) topErrors.innerHTML = '<tr><th>Токен</th><th>Кол-во</th></tr>' + rows(data.topErrors || [], e => `<tr><td>${e.token}</td><td>${nf.format(e.cnt)}</td></tr>`);

  const artifacts = document.getElementById('artifacts');
  if (artifacts) artifacts.innerHTML = '<tr><th>ID</th><th>Артефакт</th><th>Превью</th></tr>' + rows(data.artifacts || [], a => {
    const badge = a.url ? `<a href="${a.url}" target="_blank" rel="noreferrer noopener">${a.url}</a>` : (a.hasCode ? 'code snippet' : '');
    return `<tr><td>${a.id}</td><td>${badge}</td><td>${a.preview}</td></tr>`;
  });

  const topHashtags = document.getElementById('topHashtags');
  if (topHashtags) topHashtags.innerHTML = '<tr><th>#Хэштег</th><th>Кол-во</th></tr>' + rows(data.topHashtags || [], h => `<tr><td>${h.token}</td><td>${nf.format(h.cnt)}</td></tr>`);

  const topMentions = document.getElementById('topMentions');
  if (topMentions) topMentions.innerHTML = '<tr><th>@Упоминание</th><th>Кол-во</th></tr>' + rows(data.topMentions || [], m => `<tr><td>${m.token}</td><td>${nf.format(m.cnt)}</td></tr>`);
}

function renderHourlyChart(data) {
  const ctx = document.getElementById('hourlyChart');
  if (!ctx || !window.Chart) return;
  const rangeHours = build24hRange(data.since);
  const map = new Map(data.hourly.map(h => [new Date(h.hour).toISOString().slice(0, 13) + ':00:00.000Z', h.cnt]));
  const labels = rangeHours.map(h => formatHourLocal(h));
  const series = rangeHours.map(h => map.get(h) || 0);
  if (ctx._chartInstance) { ctx._chartInstance.destroy(); }
  ctx.parentElement.style.height = '240px';
  ctx.parentElement.style.minHeight = '240px';
  const chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Сообщений/час', data: series, tension: 0.3, borderColor: '#7c9cff', backgroundColor: 'rgba(124,156,255,0.15)', fill: true, pointRadius: 2 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: '#1f2432' } }, y: { grid: { color: '#1f2432' } } } }
  });
  ctx._chartInstance = chart;
}

function renderDailyChart(data) {
  const ctx = document.getElementById('dailyChart');
  if (!ctx || !window.Chart || !Array.isArray(data.daily)) return;
  const labels = data.daily.map(d => new Date(d.day).toLocaleDateString());
  const series = data.daily.map(d => d.cnt);
  new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Сообщений/день', data: series, backgroundColor: 'rgba(124,156,255,0.6)' }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#1f2432' } } } }
  });
}

async function initDashboard(days = 1) {
  const qs = days && days !== 1 ? `?days=${encodeURIComponent(days)}` : '';
  const res = await fetch(`/api/overview${qs}`);
  const data = await res.json();
  const sinceEl = document.getElementById('since');
  if (sinceEl) sinceEl.textContent = new Date(data.since).toLocaleString();
  const untilEl = document.getElementById('until');
  if (untilEl && data.until) untilEl.textContent = new Date(data.until).toLocaleString();

  renderKPI(data.kpi);
  renderSummary(data.summaryBullets || []);
  renderHourlyChart(data);
  renderDailyChart(data);
  renderTables(data);
}

function refresh() {
  let days = 1;
  const carrier = document.querySelector('[data-days]');
  if (carrier) {
    const v = parseInt(carrier.getAttribute('data-days'), 10);
    if (!Number.isNaN(v) && v > 0) days = v;
  }
  initDashboard(days);
}

// Deprecated: handled by React client component now
// This file is retained only for backward compatibility. Safe to delete once old pages are removed.


