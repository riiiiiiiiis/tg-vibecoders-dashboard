import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
});

function normalizeUsernameOrId(row: any): string {
  const usernameRaw = row.username && row.username.trim();
  const username = usernameRaw ? (usernameRaw.startsWith('@') ? usernameRaw : '@' + usernameRaw) : '';
  const firstName = row.first_name && row.first_name.trim();
  const lastName = row.last_name && row.last_name.trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  if (fullName && username) return `${fullName} (${username})`;
  if (username) return username;
  if (fullName) return fullName;
  return `id:${row.user_id}`;
}

function extractLinks(text?: string): string[] {
  if (!text) return [];
  const re = /(https?:\/\/\S+)/g;
  return (text.match(re) || []).map((u) => u.replace(/[),.;!?]+$/, ''));
}

const STOPWORDS = new Set<string>([
  'the','and','for','with','that','this','you','your','are','not','have','has','but','was','were','from','http','https','com','www','into','out','our','his','her','him','she','they','them','their','about','over','under','after','before','then','than','can','could','would','should','will','just','into','like','one','two','three','four','five','six','seven','eight','nine','ten','there','here','what','when','where','who','why','how','all','any','both','each','few','more','most','other','some','such','no','nor','only','own','same','so','too','very',
  'и','в','во','не','что','он','на','я','с','со','как','а','то','все','она','так','его','но','да','ты','к','у','же','вы','за','бы','по','ее','мне','есть','нет','его','их','из','мы','мой','моя','моё','мои','твой','твоя','твоё','твои','наш','наша','наше','наши','ваш','ваша','ваше','ваши','кто','он','она','оно','они','быть','если','или','ли','для','до','после','при','ок','наверное','ну','ага','давай','ещё','еще'
]);

function extractWords(text?: string): string[] {
  if (!text) return [];
  const tokens = text.toLowerCase().match(/[a-zA-Zа-яА-Я0-9ё]+/g);
  if (!tokens) return [];
  return tokens.filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'missing_database_url' }, { status: 500 });
  }
  const url = new URL(request.url);
  const daysParam = parseInt(url.searchParams.get('days') || '1', 10);
  const windowDays = Number.isFinite(daysParam) && daysParam > 0 && daysParam <= 30 ? daysParam : 1;

  const now = new Date();
  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const until = now;
  const baseWhere = `sent_at >= $1 AND sent_at < $2`;

  const client = await pool.connect();
  try {
    const [qTotal, qUnique, qReplies, qWithLinks] = await Promise.all([
      client.query(`SELECT COUNT(*)::int AS cnt FROM messages WHERE ${baseWhere}`, [since, until]),
      client.query(`SELECT COUNT(DISTINCT user_id)::int AS cnt FROM messages WHERE ${baseWhere}`, [since, until]),
      client.query(`SELECT COUNT(*)::int AS cnt FROM messages WHERE ${baseWhere} AND raw_message ? 'reply_to_message'`, [since, until]),
      client.query(`SELECT COUNT(*)::int AS cnt FROM messages WHERE ${baseWhere} AND text ILIKE '%http%'`, [since, until]),
    ]);

    const totalMsgs = qTotal.rows[0].cnt;
    const uniqueUsers = qUnique.rows[0].cnt;
    const replies = qReplies.rows[0].cnt;
    const withLinks = qWithLinks.rows[0].cnt;
    const avgPerUser = uniqueUsers > 0 ? totalMsgs / uniqueUsers : 0;

    const hourlyRes = await client.query(
      `SELECT date_trunc('hour', sent_at) AS hour, COUNT(*)::int AS cnt
       FROM messages WHERE ${baseWhere} GROUP BY 1 ORDER BY 1 ASC`,
      [since, until]
    );
    const hourly = hourlyRes.rows.map((r) => ({ hour: r.hour.toISOString(), cnt: r.cnt }));

    const dailyRes = await client.query(
      `SELECT date_trunc('day', sent_at) AS day, COUNT(*)::int AS cnt
       FROM messages WHERE ${baseWhere} GROUP BY 1 ORDER BY 1 ASC`,
      [since, until]
    );
    const daily = dailyRes.rows.map((r) => ({ day: r.day.toISOString(), cnt: r.cnt }));

    const topUsersRes = await client.query(
      `SELECT m.user_id,
              COALESCE(NULLIF(TRIM(u.username), ''), NULL) AS username,
              COALESCE(NULLIF(TRIM(u.first_name), ''), NULL) AS first_name,
              COALESCE(NULLIF(TRIM(u.last_name), ''), NULL) AS last_name,
              COUNT(*)::int AS cnt
       FROM messages m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE ${baseWhere}
       GROUP BY 1, 2, 3, 4
       ORDER BY cnt DESC
       LIMIT 10`,
      [since, until]
    );
    const topUsers = topUsersRes.rows.map((r) => ({ user: normalizeUsernameOrId(r), cnt: r.cnt }));

    const textsRes = await client.query(
      `SELECT message_id AS id, text, (raw_message->'reply_to_message'->>'message_id') AS reply_to_message_id
       FROM messages WHERE ${baseWhere}`,
      [since, until]
    );

    const linkCountMap = new Map<string, number>();
    for (const row of textsRes.rows) {
      const links = extractLinks(row.text);
      for (const url of links) linkCountMap.set(url, (linkCountMap.get(url) || 0) + 1);
    }
    const topLinks = Array.from(linkCountMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([url, cnt]) => ({ url, cnt }));

    const wordCountMap = new Map<string, number>();
    for (const row of textsRes.rows) {
      const words = extractWords(row.text);
      for (const w of words) wordCountMap.set(w, (wordCountMap.get(w) || 0) + 1);
    }
    const topWords = Array.from(wordCountMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([word, cnt]) => ({ word, cnt }));

    const replyCountMap = new Map<string, number>();
    for (const row of textsRes.rows) {
      const root = row.reply_to_message_id;
      if (root) replyCountMap.set(root, (replyCountMap.get(root) || 0) + 1);
    }
    const rootIds = Array.from(replyCountMap.keys());
    let rootPreviews = new Map<string, string>();
    if (rootIds.length > 0) {
      const chunkSize = 1000;
      for (let i = 0; i < rootIds.length; i += chunkSize) {
        const chunk = rootIds.slice(i, i + chunkSize);
        const params = chunk.map((_, idx) => `$${idx + 3}`).join(', ');
        const q = `SELECT message_id AS id, COALESCE(NULLIF(TRIM(text), ''), '[no text]') AS text
                   FROM messages WHERE ${baseWhere} AND message_id::text IN (${params})`;
        const r = await client.query(q, [since, until, ...chunk]);
        for (const row of r.rows) {
          const t = row.text as string;
          rootPreviews.set(row.id, t.length > 120 ? t.slice(0, 117) + '…' : t);
        }
      }
    }
    const topThreads = Array.from(replyCountMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([root_id, replies]) => ({ root_id, replies, root_preview: rootPreviews.get(root_id) || '[outside window/no text]' }));

    const hourlyPeak = hourly.length > 0 ? hourly.reduce((a, b) => (b.cnt > a.cnt ? b : a)) : null;
    const summaryBullets: string[] = [
      `Всего ${totalMsgs} сообщений`,
      ...(hourlyPeak ? [`Пик активности в ${new Date(hourlyPeak.hour).toISOString().slice(11, 16)} UTC — ${hourlyPeak.cnt}`] : []),
      ...(topUsers[0] ? [`Топ-юзер ${topUsers[0].user} — ${topUsers[0].cnt} сообщений`] : []),
      ...(withLinks > 0 ? [`${withLinks} сообщений со ссылками`] : []),
      ...(replies > 0 ? [`${replies} ответов в тредах`] : []),
    ];

    return NextResponse.json({
      kpi: { total_msgs: totalMsgs, unique_users: uniqueUsers, avg_per_user: avgPerUser, replies, with_links: withLinks },
      hourly,
      daily,
      topUsers,
      topLinks,
      topWords,
      topThreads,
      since: since.toISOString(),
      until: until.toISOString(),
      window_days: windowDays,
      summaryBullets,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  } finally {
    client.release();
  }
}


