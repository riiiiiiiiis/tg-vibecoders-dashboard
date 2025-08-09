#!/usr/bin/env node
// Smoke test for DailyLiveDigest JSON Schema with OpenAI Responses API
// Usage: node scripts/smoke-digest.mjs

import 'dotenv/config';
import OpenAI from 'openai';

function fail(code, msg, extra) {
  const out = { error: msg, ...(extra || {}) };
  console.error(JSON.stringify(out));
  process.exit(code);
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
  if (!apiKey) fail(1, 'missing_openai_key');

  const client = new OpenAI({ apiKey });
  const instructions = 'Верни ОДИН JSON по DAILY_DIGEST_SCHEMA строго. Без markdown, без лишних полей.';
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'hot_topics', 'tools_resources', 'insights', 'awards', 'stats', 'bonus'],
    properties: {
      title: { type: 'string' },
      hot_topics: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'description', 'examples'],
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            examples: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      tools_resources: { type: 'array', items: { type: 'string' } },
      insights: { type: 'array', items: { type: 'string' } },
      awards: { type: 'array', items: { type: 'string' } },
      stats: {
        type: 'object',
        additionalProperties: false,
        required: ['total_messages', 'new_members', 'peak_activity'],
        properties: {
          total_messages: { type: 'integer' },
          new_members: { type: ['integer', 'null'] },
          peak_activity: { type: ['string', 'null'] },
        },
      },
      bonus: { type: ['string', 'null'] },
    },
  };
  const minimal = {
    messages: [
      { id: '1', author: '@alice', text: 'Kiro вышел, огонь! скачала уже ✅' },
      { id: '2', author: '@bob', text: 'Ссылка: https://example.com/kiro' },
      { id: '3', author: '@alice', text: 'Кто ставил на Mac? впечатления?' }
    ]
  };
  const input = [
    'Сгенерируй дайджест (3 горячих темы и т.д.) только из этих сообщений.',
    '```json',
    JSON.stringify(minimal, null, 2),
    '```'
  ].join('\n');

  let res = await client.responses.create({
    model,
    instructions,
    input,
    text: {
      format: {
        type: 'json_schema',
        name: 'DailyLiveDigest',
        schema,
        strict: true,
      },
    },
    max_output_tokens: 800,
  });
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
        const jsonPart = content.find((c) => c?.type === 'json' && c?.json);
        if (jsonPart) { text = JSON.stringify(jsonPart.json); break; }
        const ot = content.find((c) => c?.type === 'output_text' && typeof c?.text === 'string');
        if (ot) { text = ot.text; break; }
        const t = content.find((c) => typeof c?.text === 'string' || typeof c?.text?.value === 'string');
        if (t) { text = (typeof t.text === 'string' ? t.text : t.text.value); break; }
      }
    } catch {}
  }
  if (!text) fail(2, 'empty_output_text', { request_id: res?._request_id || null, status: res?.status || null, error: res?.error || null });
  let parsed;
  try { parsed = JSON.parse(text); } catch (e) {
    fail(3, 'invalid_json_from_model', { request_id: res?._request_id || null, snippet: String(text).slice(0, 300) });
  }
  const keys = Object.keys(parsed || {});
  console.log(JSON.stringify({ ok: true, request_id: res?._request_id || null, keys }));
}

main().catch((e) => {
  fail(10, 'script_error', { detail: String(e?.message || e), stack: e?.stack });
});


