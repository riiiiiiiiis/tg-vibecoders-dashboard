import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { Pool } from 'pg';
import { DailyDigestSchema, DailyDigestJsonSchemaForLLM } from '../../../../lib/report/digest_schema';
import { renderDigest } from '../../../../lib/report/digest_render';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
});

function bad(msg: string, code = 400) {
  return NextResponse.json({ error: msg }, { status: code });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  const chatId = url.searchParams.get('chat_id');
  const cap = Math.min(parseInt(url.searchParams.get('limit') || '350', 10) || 350, 800);

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad('invalid_date');
  if (!process.env.OPENAI_API_KEY) return bad('missing_openai_key', 503);
  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

  const since = new Date(`${date}T00:00:00.000Z`);
  const until = new Date(since.getTime() + 24 * 3600_000);

  const where = `sent_at >= $1 AND sent_at < $2` + (chatId ? ` AND chat_id::text = $3` : '');
  const params: any[] = chatId ? [since, until, chatId] : [since, until];

  const db = await pool.connect();
  try {
    const q = `
      SELECT
        message_id::text AS id,
        COALESCE(NULLIF(TRIM(u.username), ''), NULL) AS username,
        COALESCE(NULLIF(TRIM(u.first_name), ''), NULL) AS first_name,
        COALESCE(NULLIF(TRIM(u.last_name), ''), NULL) AS last_name,
        COALESCE(NULLIF(TRIM(m.text), ''), NULL) AS text
      FROM messages m
      LEFT JOIN users u ON u.id = m.user_id
      WHERE ${where}
        AND m.text IS NOT NULL
      ORDER BY m.sent_at ASC
      LIMIT $${params.length + 1}
    `;
    const rows = (await db.query(q, [...params, cap])).rows as Array<{
      id: string; username: string | null; first_name: string | null; last_name: string | null; text: string | null;
    }>;

    const msgs = rows.map((r) => {
      const name = [r.first_name, r.last_name].filter(Boolean).join(' ');
      const at = r.username ? (r.username.startsWith('@') ? r.username : `@${r.username}`) : '';
      const author = name && at ? `${name} (${at})` : (name || at || 'unknown');
      const text = (r.text || '').slice(0, 1200);
      return { id: r.id, author, text };
    });

    const system = `Ты — редактор чат-дайджеста. Пиши в живом стиле с эмодзи.\nФормат и тон — как в примере, но никаких домыслов: только из данных.\nВернёшь ровно один JSON по схеме.`;
    const user = [
      `Дата: ${date}. Ниже сообщения за сутки (${msgs.length} шт.).`,
      `Возьми только это содержимое и собери дайджест как в примере (3 горячие темы, ресурсы, инсайты, награды, статистика — если можешь оценить по входу).`,
      `К каждой теме добавь 1–3 короткие цитаты вида "message_id: текст" или "author: текст".`,
      `Данные:`,
      '```json',
      JSON.stringify({ messages: msgs }, null, 2),
      '```',
      `Верни строго один JSON по DAILY_DIGEST_SCHEMA (без markdown и без лишних полей).`,
    ].join('\n');

    const OpenAI = (await import('openai')).default;
    const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const res = await ai.responses.create({
      model,
      instructions: system,
      input: user,
      text: {
        format: {
          type: 'json_schema',
          name: 'DailyLiveDigest',
          schema: DailyDigestJsonSchemaForLLM,
          strict: true,
        },
      },
    });
    let raw = (res.output_text || '').trim();
    if (!raw) {
      try {
        const items = Array.isArray((res as any)?.output) ? (res as any).output : [];
        for (const it of items as any[]) {
          const content = Array.isArray((it as any)?.content) ? (it as any).content : [];
          const jsonPart = (content as any[]).find((c: any) => c?.type === 'json' && c?.json);
          if (jsonPart) { raw = JSON.stringify(jsonPart.json); break; }
          const ot = (content as any[]).find((c: any) => c?.type === 'output_text' && typeof c?.text === 'string');
          if (ot) { raw = ot.text; break; }
          const t = (content as any[]).find((c: any) => typeof c?.text === 'string' || typeof c?.text?.value === 'string');
          if (t) { raw = (typeof t.text === 'string' ? t.text : t.text.value); break; }
        }
      } catch {}
    }
    if (!raw) return bad('openai_empty_content', 502);
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { return NextResponse.json({ error: 'invalid_json_from_model', snippet: raw.slice(0, 200) }, { status: 422 }); }

    const check = DailyDigestSchema.safeParse(parsed);
    if (!check.success) return NextResponse.json({ error: 'json_schema_validation_failed', issues: check.error.issues }, { status: 422 });

    const markdown = renderDigest(check.data);
    return NextResponse.json({ json: check.data, markdown }, { status: 200 });
  } catch (e: any) {
    const msg = e?.message || String(e);
    return NextResponse.json({ error: 'internal_error', detail: msg }, { status: 500 });
  } finally {
    db.release();
  }
}


