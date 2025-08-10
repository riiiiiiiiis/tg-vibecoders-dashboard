#!/usr/bin/env node
// Smoke test for /api/report/insights (messages-only → free-form insights)
// Usage: node scripts/smoke-insights.mjs [YYYY-MM-DD] [chat_id]

function ymd(date = new Date(Date.now() - 24*3600_000)) {
  const d = new Date(date);
  const m = String(d.getUTCMonth()+1).padStart(2,'0');
  const day = String(d.getUTCDate()).padStart(2,'0');
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(to);
  }
}

function getBaseUrl() {
  return process.env.BASE_URL || 'http://localhost:3000/';
}

function q(params) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k,v]) => { if (v!==undefined && v!==null && String(v).trim()!=='') usp.set(k, String(v)); });
  const s = usp.toString();
  return s ? ('?'+s) : '';
}

async function waitForServer(baseUrl, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetchWithTimeout(baseUrl, {}, 2000);
      if (r.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`server_not_ready: ${baseUrl}`);
}

async function main() {
  const dateArg = process.argv[2];
  const chatArg = process.argv[3];
  const date = dateArg && /^\d{4}-\d{2}-\d{2}$/.test(dateArg) ? dateArg : ymd();
  const chat_id = chatArg || undefined;
  const base = getBaseUrl().replace(/\/?$/, '/');
  await waitForServer(base);

  const url = new URL(`api/report/insights${q({ date, chat_id })}`, base).toString();
  const r = await fetchWithTimeout(url, {}, 120000);
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = { raw: t }; }
  if (!r.ok) {
    console.error('insights_failed', r.status, j);
    process.exit(1);
  }
  const m = (j && typeof j.markdown === 'string') ? j.markdown.trim() : '';
  if (!m || m.length < 50) {
    console.error('insights_too_short', { length: m.length, snippet: m.slice(0, 120) });
    process.exit(2);
  }
  console.log('insights_ok', { length: m.length, snippet: m.slice(0, 100) + '...' });
}

main().catch((e) => {
  console.error('smoke_error', e?.message || String(e));
  process.exit(10);
});


