import { NextResponse } from 'next/server';
import { buildDailyPreview } from '../../../../lib/report/slice';
import { generateInsightsFromMessages } from '../../../../lib/llm/report';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  const chatIdParam = url.searchParams.get('chat_id');
  const sinceUtc = url.searchParams.get('since');
  const untilUtc = url.searchParams.get('until');

  if (!date) return badRequest('missing_date');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest('invalid_date');

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'missing_openai_key' }, { status: 503 });
  }

  const chatId = chatIdParam && chatIdParam.trim() !== ''
    ? chatIdParam
    : (process.env.DEFAULT_CHAT_ID && process.env.DEFAULT_CHAT_ID.trim() !== '' ? process.env.DEFAULT_CHAT_ID : null);

  try {
    const windowOverride = (sinceUtc && untilUtc) ? { sinceUtc, untilUtc } : undefined;
    const preview = await buildDailyPreview(date, chatId, windowOverride);
    const out = await generateInsightsFromMessages({ date, preview });
    return NextResponse.json(out, { status: 200 });
  } catch (e: any) {
    const reqId = e?.requestId || e?._request_id || e?.headers?.get?.('x-request-id');
    if (e?.name === 'AbortError') {
      return NextResponse.json({ error: 'openai_timeout', request_id: reqId || null }, { status: 504 });
    }
    if (e?.message === 'missing_openai_key') {
      return NextResponse.json({ error: 'missing_openai_key', request_id: reqId || null }, { status: 503 });
    }
    return NextResponse.json({ error: 'internal_error', detail: String(e?.message || e), request_id: reqId || null }, { status: 500 });
  }
}


