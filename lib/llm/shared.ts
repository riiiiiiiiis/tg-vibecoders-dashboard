import { PreviewType } from '../report/schema';

// SYSTEM_PROMPT для структуры дайджеста (JSON схема)
export const SYSTEM_PROMPT = `Ты — редактор ежедневного дайджеста чата. Вход — только список сообщений с авторами и ответами.
Задача: выдать структурированный JSON (DAILY_DIGEST_SCHEMA) с максимальной пользой для читателя утреннего дайджеста.

Требования к полям:
- discussions: выдели ключевые обсуждения. Для каждого:
  - topic: краткое название темы
  - question: главный вопрос обсуждения
  - participants: основные участники чётко по авторам сообщений (используй @username или «Имя Фамилия (@username)», если доступно во входе; не используй числовые id)
  - outcome: конкретный итог. Если есть предложения/решения — перечисли кратко и добавь релевантные ссылки ИЗ сообщений inline. Не пиши просто «открыт». Если итог не финальный — сформулируй текущее предложенное решение/направление.
- resources: верни пустой массив [] (ссылки давай только inline в outcome по месту).
- unanswered_questions: верни пустой массив [].
- stats: только вычислимые метрики из входных данных (messages_count, participants_count, и др. при наличии).
- insights (опционально): краткие сигналы/тренды, если явно следуют из сообщений.

Правила:
- Только факты из входных сообщений. Никаких внешних знаний и догадок.
- Участники — строго из авторов сообщений.
- Ссылки — только из текста сообщений и только в контексте соответствующего outcome.
- Возвращай РОВНО один JSON-объект без markdown и без дополнительных полей.`;

// INSIGHTS_SYSTEM_PROMPT — свободный текст инсайтов (без строгой схемы)
export const INSIGHTS_SYSTEM_PROMPT = `Ты — аналитик чата. Тебе передают только список сообщений за окно времени.
Задача: кратко сформулировать «Инсайты дня» — ключевые темы, выводы, нерешённые вопросы, важные ссылки. Никаких домыслов вне входных сообщений.
Правила:
- Используй только факты и формулировки, которые явно следуют из сообщений.
- Если чего-то мало/нет — не выдумывай.
- Пиши кратко, по делу. Можно использовать маркеры/подзаголовки. Вывод — обычный текст/Markdown, помещающийся в одно Telegram-сообщение (целись в 800–1200 символов).`;

// Приводим preview к минимальному payload для LLM: только окно и сообщения с непустым текстом
export function trimPreviewForModel(preview: PreviewType): PreviewType {
  const original = preview as any;
  const messages = Array.isArray(original.messages) ? original.messages.filter((m: any) => !!(m?.text && String(m.text).trim() !== '')) : undefined;
  if (!messages) return preview;
  // Последние 400, при превышении порога токенов — 250
  let sliced = messages.slice(-400);
  let minimal = { kpi: { window_utc: original?.kpi?.window_utc }, messages: sliced } as any;
  let approxTokens = JSON.stringify(minimal).length / 4;
  if (approxTokens > 18000) {
    sliced = messages.slice(-250);
    minimal = { kpi: { window_utc: original?.kpi?.window_utc }, messages: sliced } as any;
  }
  return minimal as PreviewType;
}

// Формирует messages-only payload
export function buildMessagesOnlyPayload(preview: PreviewType, date: string): { date: string; window_utc: [string, string]; messages: Array<any> } {
  const p = trimPreviewForModel(preview) as any;
  const sinceUtc = p?.kpi?.window_utc?.[0];
  const untilUtc = p?.kpi?.window_utc?.[1];
  const messages = Array.isArray(p?.messages)
    ? p.messages.map((m: any) => ({
        id: m.id,
        author: m.author ?? (m.user_id ? `@${m.user_id}` : 'unknown'),
        text: m.text,
        reply_to: m.reply_to ?? null,
        sent_at: m.sent_at,
      }))
    : [];
  return { date, window_utc: [sinceUtc, untilUtc], messages } as any;
}

// User prompt для дайджеста (JSON)
export function buildDigestUserPrompt(preview: PreviewType, date: string): string {
  const payload = buildMessagesOnlyPayload(preview, date);
  const jsonStr = JSON.stringify(payload);
  return [
    `Дата отчёта: ${payload.date}, окно: ${payload.window_utc[0]} — ${payload.window_utc[1]}.`,
    `Входные данные (только сообщения):`,
    '```',
    jsonStr,
    '```',
    `Верни РОВНО один JSON-объект по DAILY_DIGEST_SCHEMA (без markdown и без дополнительных полей).`,
    `Все ссылки и факты бери исключительно из входных сообщений.`,
  ].join('\n');
}

// User prompt для инсайтов (свободный текст)
export function buildInsightsUserPrompt(preview: PreviewType, date: string): string {
  const payload = buildMessagesOnlyPayload(preview, date);
  const jsonStr = JSON.stringify(payload);
  return [
    `Дата отчёта: ${payload.date}, окно: ${payload.window_utc[0]} — ${payload.window_utc[1]}.`,
    `Входные данные (только сообщения):`,
    '```',
    jsonStr,
    '```',
    `Сформулируй «Утренний дайджест»:`,
    `- Что решили/сделали: 3–7 пунктов с конкретными результатами и ссылками, если были; укажи ключевых участников (@username).`,
    `- Ключевые обсуждения: 2–5 тем, по 1–2 строки каждая: суть, главный вопрос, участники, предложенные решения/ссылки.`,
    `Требования: только по входным сообщениям; без JSON; 800–1200 символов.`,
  ].join('\n');
}

export function estimateTokensForGeneration(args: { date: string; preview: PreviewType }): { approxInputTokens: number; details: { instructions: number; input: number } } {
  const instructions = SYSTEM_PROMPT;
  const input = buildDigestUserPrompt(args.preview, args.date);
  const instructionsTokens = Math.round(instructions.length / 4);
  const inputTokens = Math.round(input.length / 4);
  return {
    approxInputTokens: instructionsTokens + inputTokens,
    details: { instructions: instructionsTokens, input: inputTokens },
  };
}


