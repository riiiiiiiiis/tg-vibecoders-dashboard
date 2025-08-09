#!/usr/bin/env node
// Minimal smoke test that calls OpenAI Responses API with strict JSON Schema
// Usage: node scripts/smoke-openai.mjs

import 'dotenv/config';
import OpenAI from 'openai';

function fail(code, msg, extra) {
  const out = { error: msg, ...(extra || {}) };
  console.error(JSON.stringify(out));
  process.exit(code);
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey) fail(1, 'missing_openai_key');
  if (!model) fail(1, 'missing_openai_model');

  const client = new OpenAI({ apiKey });

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['json', 'markdown'],
    properties: {
      json: {
        type: 'object',
        additionalProperties: false,
        required: ['ok'],
        properties: { ok: { type: 'boolean' } },
      },
      markdown: { type: 'string' },
    },
  };

  const instructions = 'Return exactly one JSON object with fields { json: { ok: true }, markdown: "any short text" }. No extra commentary.';

  let res = await client.responses.create({
    model,
    instructions,
    input: 'ping',
    text: {
      format: {
        type: 'json_schema',
        name: 'SmokeTest',
        schema,
        strict: true,
      },
    },
    max_output_tokens: 300,
  });

  const requestId = res?._request_id || null;
  const start = Date.now();
  while (res?.status && res.status !== 'completed' && Date.now() - start < 15000) {
    await new Promise(r => setTimeout(r, 300));
    try { res = await client.responses.retrieve(res.id); } catch {}
  }
  let text = (typeof res?.output_text === 'string' ? res.output_text : '').trim();
  if (!text) {
    try {
      const items = Array.isArray(res?.output) ? res.output : [];
      for (const it of items) {
        const content = Array.isArray(it?.content) ? it.content : [];
        // Prefer structured json
        const jsonPart = content.find((c) => c?.type === 'json' && c?.json);
        if (jsonPart) { text = JSON.stringify(jsonPart.json); break; }
        // Fallback to output_text part
        const ot = content.find((c) => c?.type === 'output_text' && typeof c?.text === 'string');
        if (ot) { text = ot.text; break; }
        // Fallback to generic text shape
        const t = content.find((c) => typeof c?.text === 'string' || typeof c?.text?.value === 'string');
        if (t) { text = (typeof t.text === 'string' ? t.text : t.text.value); break; }
      }
    } catch (e) {
      // no-op
    }
  }
  if (!text) {
    const keys = Object.keys(res || {});
    const outKeys = Array.isArray(res?.output) ? res.output.map((it) => ({
      role: it?.role,
      contentTypes: Array.isArray(it?.content) ? it.content.map((c) => c?.type) : null,
    })) : null;
    fail(2, 'empty_output_text', { request_id: requestId, keys, outKeys });
  }
  let parsed;
  try { parsed = JSON.parse(text); } catch (e) {
    fail(3, 'invalid_json_from_model', { request_id: requestId, snippet: text.slice(0, 200) });
  }
  const ok = parsed && parsed.json && parsed.json.ok === true && typeof parsed.markdown === 'string';
  if (!ok) fail(4, 'shape_mismatch', { request_id: requestId, got_keys: Object.keys(parsed || {}) });
  console.log(JSON.stringify({ ok: true, request_id: requestId, markdown_len: parsed.markdown.length }));
}

main().catch((e) => {
  const reqId = e?._request_id || e?.requestId || e?.headers?.get?.('x-request-id') || null;
  fail(10, 'script_error', { detail: String(e?.message || e), request_id: reqId });
});


