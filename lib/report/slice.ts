import { Pool, PoolClient } from 'pg';

export type ReportPreview = {
  kpi: {
    total_msgs: number;
    unique_users: number;
    avg_per_user: number;
    replies: number;
    with_links: number;
    peak_hour_utc: string; // "HH:00"
    window_utc: [string, string];
  };
  hourly: Array<{ hour: string; cnt: number }>; // 24 points
  topThreads: Array<{ root_id: string; replies: number; root_preview: string }>;
  unanswered: Array<{ id: string; hours: number; preview: string }>;
  topLinks: Array<{ url: string; cnt: number }>;
  topErrors: Array<{ token: string; cnt: number }>;
  messages?: Array<{
    id: string;
    user_id: string;
    sent_at: string;
    text: string | null;
    reply_to: string | null;
    author?: string; // Pre-resolved display name like "Имя Фамилия (@username)" or "@username"
  }>;
  meta: { date: string; chat_id: string | null; generated_at: string };
};

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

function isValidDateParam(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function truncatePreview(text: string, limit = 180): string {
  const t = text.trim();
  if (t.length <= limit) return t;
  return t.slice(0, limit - 1) + '…';
}

function normalizeUrl(urlRaw: string): string | null {
  if (!urlRaw) return null;
  let u = urlRaw.trim().replace(/[),.;!?]+$/, '');
  try {
    const parsed = new URL(u);
    // lower-case protocol + host; drop default ports; keep path/search/hash
    const protocol = parsed.protocol.toLowerCase();
    const host = parsed.hostname.toLowerCase();
    const port = parsed.port;
    const isDefaultPort = (protocol === 'http:' && port === '80') || (protocol === 'https:' && port === '443');
    const portPart = port && !isDefaultPort ? `:${port}` : '';
    let pathname = parsed.pathname || '/';
    if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
    const normalized = `${protocol}//${host}${portPart}${pathname}${parsed.search}${parsed.hash}`;
    return normalized;
  } catch {
    // not a URL we can parse, fallback to sanitized string if it looks like a url
    if (/^https?:\/\//i.test(u)) return u;
    return null;
  }
}

function extractLinksFromText(text?: string | null): string[] {
  if (!text) return [];
  const re = /(https?:\/\/\S+)/g;
  const list = text.match(re) || [];
  const out: string[] = [];
  for (const raw of list) {
    const n = normalizeUrl(raw);
    if (n) out.push(n);
  }
  return out;
}

function extractErrorTokens(text?: string | null): string[] {
  if (!text) return [];
  const errorRegex = /([A-Z_]{3,}|[Ee]rror|Exception|ECONN|429|403|Forbidden|timeout|rate\s*limit)/g;
  const matches = text.match(errorRegex) || [];
  return matches.map((m) => (/^[A-Z_]{3,}$/.test(m) ? m : m.toLowerCase()));
}

export function getUtcWindow(dateStr: string): { since: Date; until: Date } {
  const since = new Date(`${dateStr}T00:00:00.000Z`);
  const until = new Date(since.getTime() + 24 * 3600_000);
  return { since, until };
}

type WindowOverride = { sinceUtc?: string; untilUtc?: string };

export async function buildDailyPreview(dateStr: string, chatId: string | null, windowOverride?: WindowOverride): Promise<ReportPreview> {
  if (!process.env.DATABASE_URL) {
    throw new Error('missing_database_url');
  }
  if (!isValidDateParam(dateStr)) {
    throw new Error('invalid_date_param');
  }

  // Resolve window: default to UTC day window; allow override for rolling windows
  let { since, until } = getUtcWindow(dateStr);
  if (windowOverride?.sinceUtc && windowOverride?.untilUtc) {
    const s = new Date(windowOverride.sinceUtc);
    const u = new Date(windowOverride.untilUtc);
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(u.getTime()) && u > s) {
      since = s;
      until = u;
    }
  }
  const sinceIso = since.toISOString();
  const untilIso = until.toISOString();
  const chatFilterEnabled = !!(chatId && chatId.trim() !== '' && chatId.toLowerCase() !== 'all');

  const pool = getPool();
  const client = await pool.connect();
  try {
    // Resolve default chat id if not provided: env DEFAULT_CHAT_ID, else top chat within window
    let resolvedChatId: string | null = chatId && chatId.trim() !== '' ? chatId : null;
    if (!resolvedChatId) {
      const envDefault = process.env.DEFAULT_CHAT_ID && process.env.DEFAULT_CHAT_ID.trim() !== '' ? process.env.DEFAULT_CHAT_ID : null;
      if (envDefault) {
        resolvedChatId = envDefault;
      } else {
        const topRes = await client.query(
          `SELECT chat_id::text AS chat_id
           FROM messages
           WHERE sent_at >= $1 AND sent_at < $2
           GROUP BY chat_id
           ORDER BY COUNT(*) DESC
           LIMIT 1`,
          [since, until]
        );
        resolvedChatId = topRes.rows[0]?.chat_id ? String(topRes.rows[0].chat_id) : null;
      }
    }

    const paramsBase: any[] = [since, until];
    const useChatId = !!(resolvedChatId && resolvedChatId.trim() !== '' && resolvedChatId.toLowerCase() !== 'all');
    if (useChatId) paramsBase.push(resolvedChatId);
    const baseWhere = `sent_at >= $1 AND sent_at < $2` + (useChatId ? ` AND chat_id::text = $3` : '');

    // KPI in a single query
    const kpiQ = `
      SELECT
        COUNT(*)::int AS total_msgs,
        COUNT(DISTINCT user_id)::int AS unique_users,
        COUNT(*) FILTER (WHERE raw_message ? 'reply_to_message')::int AS replies,
        COUNT(*) FILTER (WHERE text ILIKE '%http%')::int AS with_links
      FROM messages
      WHERE ${baseWhere}
    `;

    // Hourly with generate_series (UTC aligned)
    const hourlyQ = `
      WITH hours AS (
        SELECT generate_series($1::timestamptz, $2::timestamptz - interval '1 hour', interval '1 hour') AS hour
      ),
      counts AS (
        SELECT date_trunc('hour', sent_at)::timestamptz AS hour, COUNT(*)::int AS cnt
        FROM messages
        WHERE ${baseWhere}
        GROUP BY 1
      )
      SELECT h.hour AS hour, COALESCE(c.cnt, 0)::int AS cnt
      FROM hours h
      LEFT JOIN counts c ON c.hour = h.hour
      ORDER BY h.hour ASC
    `;

    // Top threads (roots in window, replies counted within window)
    const topThreadsQ = `
      WITH reply_counts AS (
        SELECT (m.raw_message->'reply_to_message'->>'message_id') AS root_id, COUNT(*)::int AS replies
        FROM messages m
        WHERE ${baseWhere} AND m.raw_message ? 'reply_to_message'
        GROUP BY 1
      )
      SELECT rc.root_id,
             rc.replies,
             COALESCE(NULLIF(TRIM(root.text), ''), '[no text]') AS root_text
      FROM reply_counts rc
      JOIN messages root ON root.message_id::text = rc.root_id
      WHERE root.sent_at >= $1 AND root.sent_at < $2 ${useChatId ? ' AND root.chat_id::text = $3' : ''}
      ORDER BY rc.replies DESC
      LIMIT 5
    `;

    // Unanswered (roots in window, no replies across entire DB)
    const unansweredQ = `
      SELECT root.message_id::text AS id,
             COALESCE(NULLIF(TRIM(root.text), ''), '[no text]') AS text,
             root.sent_at
      FROM messages root
      WHERE ${baseWhere}
        AND NOT (root.raw_message ? 'reply_to_message')
        AND NOT EXISTS (
          SELECT 1 FROM messages r
          WHERE (r.raw_message ? 'reply_to_message')
            AND (r.raw_message->'reply_to_message'->>'message_id') = root.message_id::text
        )
      ORDER BY root.sent_at ASC
      LIMIT 10
    `;

    // Texts to compute links/errors in memory (keeps SQL simple and fast for small window)
    const textsQ = `
      SELECT
        m.message_id::text AS id,
        m.user_id::text AS user_id,
        m.sent_at,
        m.text,
        (m.raw_message->'reply_to_message'->>'message_id')::text AS reply_to,
        COALESCE(NULLIF(TRIM(u.username), ''), NULL) AS username,
        COALESCE(NULLIF(TRIM(u.first_name), ''), NULL) AS first_name,
        COALESCE(NULLIF(TRIM(u.last_name), ''), NULL) AS last_name
      FROM messages m
      LEFT JOIN users u ON u.id = m.user_id
      WHERE ${baseWhere}
      ORDER BY m.sent_at ASC
    `;

    const [kpiRes, hourlyRes, topThreadsRes, unansweredRes, textsRes] = await Promise.all([
      client.query(kpiQ, paramsBase),
      client.query(hourlyQ, paramsBase),
      client.query(topThreadsQ, paramsBase),
      client.query(unansweredQ, paramsBase),
      client.query(textsQ, paramsBase),
    ]);

    const totalMsgs = Number(kpiRes.rows[0]?.total_msgs || 0);
    const uniqueUsers = Number(kpiRes.rows[0]?.unique_users || 0);
    const replies = Number(kpiRes.rows[0]?.replies || 0);
    const withLinks = Number(kpiRes.rows[0]?.with_links || 0);
    const avgPerUser = uniqueUsers > 0 ? totalMsgs / uniqueUsers : 0;

    const hourly: Array<{ hour: string; cnt: number }> = hourlyRes.rows.map((r: any) => ({
      hour: new Date(r.hour).toISOString(),
      cnt: Number(r.cnt || 0),
    }));
    // Ensure exactly 24 points
    if (hourly.length !== 24) {
      // fill from since by 1 hour steps as fallback
      const map = new Map(hourly.map((h) => [h.hour, h.cnt] as const));
      const filled: Array<{ hour: string; cnt: number }> = [];
      for (let i = 0; i < 24; i++) {
        const d = new Date(since.getTime() + i * 3600_000).toISOString().slice(0, 13) + ':00:00.000Z';
        filled.push({ hour: d, cnt: map.get(d) || 0 });
      }
      hourly.splice(0, hourly.length, ...filled);
    }

    const hourlyPeak = hourly.reduce<{ hour: string; cnt: number } | null>((acc, cur) => {
      if (!acc || cur.cnt > acc.cnt) return cur;
      return acc;
    }, null);
    const peakHourUtc = hourlyPeak ? new Date(hourlyPeak.hour).toISOString().slice(11, 13) + ':00' : '00:00';

    const topThreads = topThreadsRes.rows.map((r: any) => ({
      root_id: String(r.root_id),
      replies: Number(r.replies || 0),
      root_preview: truncatePreview(String(r.root_text || '')),
    }));

    const nowTs = Date.now();
    const unanswered = unansweredRes.rows.map((r: any) => ({
      id: String(r.id),
      hours: Math.max(0, Math.floor((nowTs - new Date(r.sent_at).getTime()) / 3600_000)),
      preview: truncatePreview(String(r.text || '')),
    }));

    // Links and Errors from texts
    const linkCountMap = new Map<string, number>();
    const errorTokenCounts = new Map<string, number>();
    for (const row of textsRes.rows as Array<{ id: string; text?: string | null }>) {
      const links = extractLinksFromText((row as any).text);
      for (const u of links) linkCountMap.set(u, (linkCountMap.get(u) || 0) + 1);
      const tokens = extractErrorTokens((row as any).text);
      for (const t of tokens) errorTokenCounts.set(t, (errorTokenCounts.get(t) || 0) + 1);
    }

    const topLinks = Array.from(linkCountMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([url, cnt]) => ({ url, cnt }));

    const topErrors = Array.from(errorTokenCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([token, cnt]) => ({ token, cnt }));

    function formatAuthor(row: any): string | undefined {
      const username = row?.username ? (String(row.username).startsWith('@') ? String(row.username) : `@${row.username}`) : '';
      const first = row?.first_name && String(row.first_name).trim();
      const last = row?.last_name && String(row.last_name).trim();
      const full = [first, last].filter(Boolean).join(' ');
      if (full && username) return `${full} (${username})`;
      if (username) return username;
      if (full) return full;
      return undefined;
    }

    const messages = (textsRes.rows as Array<any>).map((r) => ({
      id: String(r.id),
      user_id: String(r.user_id),
      sent_at: new Date(r.sent_at).toISOString(),
      text: r.text == null ? null : String(r.text),
      reply_to: r.reply_to ? String(r.reply_to) : null,
      author: formatAuthor(r),
    }));

    return {
      kpi: {
        total_msgs: totalMsgs,
        unique_users: uniqueUsers,
        avg_per_user: avgPerUser,
        replies,
        with_links: withLinks,
        peak_hour_utc: peakHourUtc,
        window_utc: [sinceIso, untilIso],
      },
      hourly,
      topThreads,
      unanswered,
      topLinks,
      topErrors,
      messages,
      meta: {
        date: dateStr,
        chat_id: useChatId ? String(resolvedChatId) : null,
        generated_at: new Date().toISOString(),
      },
    };
  } finally {
    (client as PoolClient).release();
  }
}


