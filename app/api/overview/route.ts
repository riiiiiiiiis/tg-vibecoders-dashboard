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
  const chatIdParam = url.searchParams.get('chat_id');
  const chatFilterEnabled = !!(chatIdParam && chatIdParam.trim() !== '' && chatIdParam.toLowerCase() !== 'all');

  const now = new Date();
  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const until = now;
  const baseWhere = `sent_at >= $1 AND sent_at < $2` + (chatFilterEnabled ? ` AND chat_id::text = $3` : '');
  const baseWhereChatsOnly = `sent_at >= $1 AND sent_at < $2`;

  const client = await pool.connect();
  try {
    const paramsBase: any[] = [since, until];
    if (chatFilterEnabled) paramsBase.push(chatIdParam);
    const extraOffset = chatFilterEnabled ? 1 : 0;

    const [qTotal, qUnique, qReplies, qWithLinks, chatsRes] = await Promise.all([
      client.query(`SELECT COUNT(*)::int AS cnt FROM messages WHERE ${baseWhere}`, paramsBase),
      client.query(`SELECT COUNT(DISTINCT user_id)::int AS cnt FROM messages WHERE ${baseWhere}`, paramsBase),
      client.query(`SELECT COUNT(*)::int AS cnt FROM messages WHERE ${baseWhere} AND raw_message ? 'reply_to_message'`, paramsBase),
      client.query(`SELECT COUNT(*)::int AS cnt FROM messages WHERE ${baseWhere} AND text ILIKE '%http%'`, paramsBase),
      client.query(
        `SELECT chat_id,
                COALESCE(NULLIF(TRIM((raw_message->'chat'->>'title')), ''), NULL) AS title,
                COUNT(*)::int AS cnt
         FROM messages
         WHERE ${baseWhereChatsOnly}
         GROUP BY chat_id, title
         ORDER BY cnt DESC
         LIMIT 100`,
        [since, until]
      ),
    ]);

    const totalMsgs = qTotal.rows[0].cnt;
    const uniqueUsers = qUnique.rows[0].cnt;
    const replies = qReplies.rows[0].cnt;
    const withLinks = qWithLinks.rows[0].cnt;
    const avgPerUser = uniqueUsers > 0 ? totalMsgs / uniqueUsers : 0;

    const hourlyRes = await client.query(
      `SELECT date_trunc('hour', sent_at) AS hour, COUNT(*)::int AS cnt
       FROM messages WHERE ${baseWhere} GROUP BY 1 ORDER BY 1 ASC`,
      paramsBase
    );
    const hourly = hourlyRes.rows.map((r) => ({ hour: r.hour.toISOString(), cnt: r.cnt }));

    const dailyRes = await client.query(
      `SELECT date_trunc('day', sent_at) AS day, COUNT(*)::int AS cnt
       FROM messages WHERE ${baseWhere} GROUP BY 1 ORDER BY 1 ASC`,
      paramsBase
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
      paramsBase
    );
    const topUsers = topUsersRes.rows.map((r) => ({ user: normalizeUsernameOrId(r), cnt: r.cnt }));

    const textsRes = await client.query(
      `SELECT message_id AS id,
              text,
              user_id,
              sent_at,
              (raw_message->'reply_to_message'->>'message_id') AS reply_to_message_id
       FROM messages WHERE ${baseWhere}`,
      paramsBase
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
          const params = chunk.map((_, idx) => `$${idx + 3 + extraOffset}`).join(', ');
        const q = `SELECT message_id AS id, COALESCE(NULLIF(TRIM(text), ''), '[no text]') AS text
                   FROM messages WHERE ${baseWhere} AND message_id::text IN (${params})`;
          const r = await client.query(q, [...paramsBase, ...chunk]);
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

    // Unanswered questions (>12h), root messages matching question heuristics with no replies within the window
    const nowTs = now.getTime();
    const questionRootsRes = await client.query(
      `SELECT m.message_id AS id,
              COALESCE(NULLIF(TRIM(m.text), ''), '[no text]') AS text,
              m.sent_at
       FROM messages m
       WHERE ${baseWhere}
         AND NOT (m.raw_message ? 'reply_to_message')
         AND m.text IS NOT NULL
         AND (
           position('?' in m.text) > 0 OR
           lower(m.text) LIKE '%как%' OR
           lower(m.text) LIKE '%почему%' OR
           lower(m.text) LIKE '%ошибк%' OR
           lower(m.text) LIKE '%не работает%'
         )`,
      paramsBase
    );
    const directReplyToRootCountsRes = await client.query(
      `SELECT (raw_message->'reply_to_message'->>'message_id') AS parent_id, COUNT(*)::int AS cnt
       FROM messages
       WHERE ${baseWhere} AND raw_message ? 'reply_to_message'
       GROUP BY 1`,
      paramsBase
    );
    const directReplyMap = new Map<string, number>(directReplyToRootCountsRes.rows.map((r: any) => [String(r.parent_id), Number(r.cnt)]));
    const unanswered = questionRootsRes.rows
      .filter((r: any) => !directReplyMap.has(String(r.id)))
      .map((r: any) => {
        const hours = Math.floor((nowTs - new Date(r.sent_at).getTime()) / 3600_000);
        return {
          id: String(r.id),
          preview: (r.text as string).length > 160 ? (r.text as string).slice(0, 157) + '…' : r.text,
          hours,
        };
      })
      .filter((r: any) => r.hours >= 12)
      .sort((a: any, b: any) => b.hours - a.hours)
      .slice(0, 30);

    // Helpers leaderboard (answers in other people's threads)
    const helpersRes = await client.query(
      `WITH RECURSIVE chain AS (
         SELECT m.message_id::text AS reply_id,
                m.user_id AS reply_user_id,
                m.message_id::text AS current_id,
                (m.raw_message->'reply_to_message'->>'message_id')::text AS parent_id
         FROM messages m
         WHERE ${baseWhere} AND m.raw_message ? 'reply_to_message'
       UNION ALL
         SELECT chain.reply_id,
                chain.reply_user_id,
                p.message_id::text AS current_id,
                (p.raw_message->'reply_to_message'->>'message_id')::text AS parent_id
         FROM chain
         JOIN messages p ON p.message_id::text = chain.parent_id
       )
       SELECT c.reply_user_id AS helper_user_id,
              COALESCE(NULLIF(TRIM(u.username), ''), NULL) AS username,
              COALESCE(NULLIF(TRIM(u.first_name), ''), NULL) AS first_name,
              COALESCE(NULLIF(TRIM(u.last_name), ''), NULL) AS last_name,
              COUNT(*)::int AS cnt
       FROM (
         SELECT reply_id, reply_user_id, current_id AS root_id
         FROM chain
         WHERE parent_id IS NULL
       ) c
       JOIN messages root_msg ON root_msg.message_id::text = c.root_id
       LEFT JOIN users u ON u.id = c.reply_user_id
       WHERE c.reply_user_id <> root_msg.user_id
       GROUP BY c.reply_user_id, username, first_name, last_name
       ORDER BY cnt DESC
       LIMIT 10`,
      paramsBase
    );
    const topHelpers = helpersRes.rows.map((r: any) => ({ user: normalizeUsernameOrId(r), cnt: Number(r.cnt) }));

    // Error digest
    const errorTokenCounts = new Map<string, number>();
    const errorRegex = /([A-Z_]{3,}|[Ee]rror|Exception|ECONN|429|403|Forbidden|timeout|rate limit)/g;
    for (const row of textsRes.rows) {
      if (!row.text) continue;
      const matches = (row.text as string).match(errorRegex) || [];
      for (const m of matches) {
        const token = /[A-Z_]{3,}/.test(m) ? m : m.toLowerCase();
        errorTokenCounts.set(token, (errorTokenCounts.get(token) || 0) + 1);
      }
    }
    const topErrors = Array.from(errorTokenCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([token, cnt]) => ({ token, cnt }));

    // Artifacts / Ship-it
    const artifactsDomains = ['github', 'vercel', 'netlify', 'replit', 'pages.dev'];
    const artifacts = [] as Array<{ id: string; url?: string; hasCode?: boolean; preview: string }>;
    for (const row of textsRes.rows) {
      const text: string | undefined = row.text || undefined;
      if (!text) continue;
      const links = extractLinks(text);
      const rel = links.find((u) => artifactsDomains.some((d) => u.includes(d)));
      const hasCode = text.includes('```');
      if (rel || hasCode) {
        artifacts.push({
          id: String(row.id),
          url: rel,
          hasCode: hasCode || undefined,
          preview: text.length > 140 ? text.slice(0, 137) + '…' : text,
        });
      }
    }
    const artifactsLimited = artifacts.slice(0, 20);

    // Hashtags and mentions
    const hashtagCounts = new Map<string, number>();
    const mentionCounts = new Map<string, number>();
    for (const row of textsRes.rows) {
      const t: string | undefined = row.text || undefined;
      if (!t) continue;
      const hashtags = t.match(/#[A-Za-zА-Яа-я0-9_]+/g) || [];
      const mentions = t.match(/@[A-Za-zA-Яа-я0-9_]+/g) || [];
      for (const h of hashtags) hashtagCounts.set(h.toLowerCase(), (hashtagCounts.get(h.toLowerCase()) || 0) + 1);
      for (const m of mentions) mentionCounts.set(m.toLowerCase(), (mentionCounts.get(m.toLowerCase()) || 0) + 1);
    }
    const topHashtags = Array.from(hashtagCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([token, cnt]) => ({ token, cnt }));
    const topMentions = Array.from(mentionCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([token, cnt]) => ({ token, cnt }));

    const hourlyPeak = hourly.length > 0 ? hourly.reduce((a, b) => (b.cnt > a.cnt ? b : a)) : null;
    const summaryBullets: string[] = [
      `Всего ${totalMsgs} сообщений`,
      ...(hourlyPeak ? [`Пик активности в ${new Date(hourlyPeak.hour).toISOString().slice(11, 16)} UTC — ${hourlyPeak.cnt}`] : []),
      ...(topUsers[0] ? [`Топ-юзер ${topUsers[0].user} — ${topUsers[0].cnt} сообщений`] : []),
      ...(withLinks > 0 ? [`${withLinks} сообщений со ссылками`] : []),
      ...(replies > 0 ? [`${replies} ответов в тредах`] : []),
    ];

    return NextResponse.json({
      chats: chatsRes.rows.map((r: any) => ({ chat_id: String(r.chat_id), title: r.title || null, cnt: Number(r.cnt) })),
      selected_chat_id: chatFilterEnabled ? String(chatIdParam) : null,
      kpi: { total_msgs: totalMsgs, unique_users: uniqueUsers, avg_per_user: avgPerUser, replies, with_links: withLinks },
      hourly,
      daily,
      topUsers,
      topLinks,
      topWords,
      topThreads,
      unanswered,
      topHelpers,
      topErrors,
      artifacts: artifactsLimited,
      topHashtags,
      topMentions,
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


