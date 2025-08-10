import { NextResponse } from 'next/server';
import { buildDailyPreview } from '../../../../lib/report/slice';

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

  const chatId = chatIdParam && chatIdParam.trim() !== ''
    ? chatIdParam
    : (process.env.DEFAULT_CHAT_ID && process.env.DEFAULT_CHAT_ID.trim() !== '' ? process.env.DEFAULT_CHAT_ID : null);

  try {
    const windowOverride = (sinceUtc && untilUtc) ? { sinceUtc, untilUtc } : undefined;
    const preview = await buildDailyPreview(date, chatId, windowOverride);
    return NextResponse.json(preview, { status: 200 });
  } catch (e: any) {
    if (e?.message === 'missing_database_url') {
      return NextResponse.json({ error: 'missing_database_url' }, { status: 500 });
    }
    if (e?.message === 'invalid_date_param') {
      return badRequest('invalid_date');
    }
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}


