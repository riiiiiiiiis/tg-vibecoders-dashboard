import { DailyDigest } from './digest_schema';

export function renderDigest(d: DailyDigest): string {
  const discussions = (d.discussions || [])
    .map((t, i) => {
      const parts = [
        `${i + 1}. ${t.topic}`,
        `Вопрос: ${t.question}`,
        `Участники: ${(t.participants || []).join(', ')}`,
        `Итог: ${t.outcome}`,
      ];
      return parts.join('\n');
    })
    .join('\n\n');

  const insights = (d.insights || []).map((i) => `– ${i}`).join('\n');

  const total = (d as any).stats?.messages_count ?? 0;
  const participants = (d as any).stats?.participants_count ?? 0;

  // Компактный формат для одного Telegram-сообщения
  return [
    `📊 Ежедневный дайджест`,
    '',
    '💬 Ключевые обсуждения',
    discussions,
    '',
    ...(insights ? ['💡 Инсайты', insights, ''] : []),
    '📈 Статистика',
    `Сообщений: ${total}`,
    `Участников: ${participants}`,
  ].join('\n');
}


