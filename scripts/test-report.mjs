#!/usr/bin/env node
// Lightweight smoke test for /api/report/preview and /api/report/generate
// Usage: node scripts/test-report.mjs [YYYY-MM-DD] [chat_id]

import fs from 'fs';
import path from 'path';

function ymd(date = new Date(Date.now() - 24*3600_000)) {
  const d = new Date(date);
  const m = String(d.getUTCMonth()+1).padStart(2,'0');
  const day = String(d.getUTCDate()).padStart(2,'0');
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(to);
  }
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

function getBaseUrl() {
  return process.env.BASE_URL || 'http://localhost:3000/';
}

function q(params) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k,v]) => { if (v!==undefined && v!==null && String(v).trim()!=='') usp.set(k, String(v)); });
  const s = usp.toString();
  return s ? ('?'+s) : '';
}

async function main() {
  const dateArg = process.argv[2];
  const chatArg = process.argv[3];
  const date = dateArg && /^\d{4}-\d{2}-\d{2}$/.test(dateArg) ? dateArg : ymd();
  const chat_id = chatArg || undefined;
  const base = getBaseUrl().replace(/\/?$/, '/');
  await waitForServer(base);

  // Preview
  const previewUrl = new URL(`api/report/preview${q({ date, chat_id })}`, base).toString();
  const pr = await fetchWithTimeout(previewUrl, {}, 10000);
  const pj = await pr.json();
  if (!pr.ok) {
    console.error('preview_failed', pr.status, pj);
    process.exit(1);
  }
  const hourlyLen = Array.isArray(pj.hourly) ? pj.hourly.length : 0;
  const metaOk = pj?.meta?.date === date;
  console.log('preview_ok', { hourlyLen, metaOk, kpi: pj?.kpi ?? null });

  // Generate
  const genUrl = new URL(`api/report/generate${q({ date, chat_id })}`, base).toString();
  const gr = await fetchWithTimeout(genUrl, {}, 120000);
  const gjText = await gr.text();
  let gj;
  try { gj = JSON.parse(gjText); } catch { gj = { raw: gjText }; }
  if (!gr.ok) {
    console.error('generate_failed', gr.status, gj);
    process.exit(2);
  }
  const ok = gj && typeof gj === 'object' && gj.json && typeof gj.markdown === 'string';
  if (!ok) {
    console.error('generate_invalid_shape', gj);
    process.exit(3);
  }
  console.log('generate_ok', { jsonKeys: Object.keys(gj.json || {}), markdownLen: (gj.markdown||'').length });
}

main().catch((e) => {
  console.error('test_script_error', e?.message || String(e));
  process.exit(10);
});


