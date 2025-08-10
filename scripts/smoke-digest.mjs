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
  const instructions = 'Верни ОДИН JSON строго по DAILY_DIGEST_SCHEMA. Без markdown, без лишних полей.';
  const schema = {
    type: 'object',
    additionalProperties: false,
    // Responses strict mode requires listing every property in required
    required: ['discussions', 'resources', 'unanswered_questions', 'stats', 'insights'],
    properties: {
      discussions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['topic', 'question', 'participants', 'outcome'],
          properties: {
            topic: { type: 'string' },
            question: { type: 'string' },
            participants: { type: 'array', items: { type: 'string' } },
            outcome: { type: 'string' },
          },
        },
      },
      resources: { type: 'array', items: { type: 'string' } },
      unanswered_questions: { type: 'array', items: { type: 'string' } },
      stats: {
        type: 'object',
        additionalProperties: { type: ['integer', 'number'] },
        required: ['messages_count', 'participants_count'],
        properties: {
          messages_count: { type: 'integer' },
          participants_count: { type: 'integer' },
        },
      },
      insights: { type: 'array', items: { type: 'string' } },
    },
  };
  const minimal = {
    messages: [
      { id: '1', author: '@alice', text: 'Запустили релиз Kiro ✅' },
      { id: '2', author: '@bob', text: 'Ссылка: https://example.com/kiro' },
      { id: '3', author: '@alice', text: 'Готов ли релиз к деплою? Кто протестирует?' }
    ]
  };
  const input = [
    'Собери обсуждения, вопросы без ответа и ресурсы только из этих сообщений по DAILY_DIGEST_SCHEMA.',
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


