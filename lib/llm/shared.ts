import { PreviewType } from '../report/schema';

export const SYSTEM_PROMPT = `Ты — редактор чат-дайджеста для комьюнити вайбкодинга.
Пиши ярко, с эмодзи, в дружелюбном стиле, как в примере.
Формат:

📊 Дайджест чата #/ [название] за [даты]
🔥 Топ-3 самых горячих тем
1. [Название] — [краткий итог + эмоция]
[Описание 1-2 предложения]
💬 Примеры: [несколько цитат участников]

🛠 Полезные инструменты и ресурсы
[Список]

💡 Инсайты и лайфхаки дня
[Список с эмодзи и авторами]

🏆 Награды сообщества
[Список с номинациями и победителями]

📈 Статистика активности
[Сообщения, новые участники, пиковое время]

🎪 Бонус
[Мем или забавная цитата]

Требования:
- Используй только данные из входного списка сообщений (message_id, текст, автор).
- Примеры должны быть из сообщений участников (укажи автора или message_id).
- В hot_topics выдели 3 темы по наибольшей вовлеченности.
- Обязательно добавь ссылки из сообщений в раздел «Ресурсы».
- Никакой воды, никакого пересказа дат и таймзон.
Вывод строго в JSON по схеме DAILY_DIGEST_SCHEMA.`;

export function trimPreviewForModel(preview: PreviewType): PreviewType {
  const maxMessages = 400;
  const trimmedMessages = Array.isArray((preview as any).messages)
    ? (preview as any).messages.slice(-maxMessages)
    : undefined;
  const trimmed = { ...(preview as any), messages: trimmedMessages } as PreviewType;
  const approxTokens = JSON.stringify(trimmed).length / 4;
  if (approxTokens > 18000 && trimmedMessages) {
    (trimmed as any).messages = trimmedMessages.slice(-250);
  }
  return trimmed;
}

export function buildUserPrompt(preview: PreviewType, date: string): string {
  const p = trimPreviewForModel(preview);
  const sinceUtc = p.kpi.window_utc[0];
  const untilUtc = p.kpi.window_utc[1];
  const jsonStr = JSON.stringify(p);
  return [
    `Дата отчёта: ${date}, окно: ${sinceUtc} — ${untilUtc}.`,
    `Входные данные (сообщения, ссылки, треды):`,
    '```',
    jsonStr,
    '```',
    `Верни РОВНО один JSON-объект по DAILY_DIGEST_SCHEMA (без markdown и без дополнительных полей).`,
    `Цитаты и ресурсы бери только из входных сообщений (укажи message_id или автора, если доступно).`,
  ].join('\n');
}

export function estimateTokensForGeneration(args: { date: string; preview: PreviewType }): { approxInputTokens: number; details: { instructions: number; input: number } } {
  const instructions = SYSTEM_PROMPT;
  const input = buildUserPrompt(args.preview, args.date);
  const instructionsTokens = Math.round(instructions.length / 4);
  const inputTokens = Math.round(input.length / 4);
  return {
    approxInputTokens: instructionsTokens + inputTokens,
    details: { instructions: instructionsTokens, input: inputTokens },
  };
}


