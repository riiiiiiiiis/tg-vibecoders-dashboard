import { DailyDigest } from './digest_schema';

export function renderDigest(d: DailyDigest): string {
  const hot = (d.hot_topics || []).map((t, i) => {
    const examples = Array.isArray(t.examples) && t.examples.length > 0
      ? `\n💬 Примеры:\n${t.examples.map((e) => `– ${e}`).join('\n')}`
      : '';
    return `${i + 1}. ${t.title}\n${t.description}${examples}`;
  }).join('\n\n');

  const tools = (d.tools_resources || []).map((r) => `– ${r}`).join('\n');
  const insights = (d.insights || []).map((i) => `– ${i}`).join('\n');
  const awards = (d.awards || []).map((a) => `– ${a}`).join('\n');

  const total = d.stats?.total_messages ?? 0;
  const newMembers = d.stats?.new_members ?? '-';
  const peak = d.stats?.peak_activity ?? '-';

  const bonus = d.bonus ?? '-';

  return `📊 ${d.title}

🔥 **Топ-3 самых горячих тем**
${hot}

🛠 **Полезные инструменты и ресурсы**
${tools}

💡 **Инсайты и лайфхаки дня**
${insights}

🏆 **Награды сообщества**
${awards}

📈 **Статистика активности**
Всего сообщений: ${total}
Новых участников: ${newMembers}
Пиковое время: ${peak}

🎪 **Бонус**
${bonus}
`;
}


