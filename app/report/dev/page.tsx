"use client";
import { useCallback, useEffect, useState } from 'react';

export default function ReportDevPage() {
  const [date, setDate] = useState<string>('');
  const [chatId, setChatId] = useState<string>('');
  const [sinceUtc, setSinceUtc] = useState<string | null>(null);
  const [untilUtc, setUntilUtc] = useState<string | null>(null);
  const [loadingGen, setLoadingGen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gen, setGen] = useState<{ json: any; markdown: string } | null>(null);
  const [llmTab, setLlmTab] = useState<'json' | 'md'>('md');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    const localYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setDate(localYmd);
    // rolling last 24h window in UTC
    const until = new Date();
    const since = new Date(until.getTime() - 24 * 3600_000);
    setSinceUtc(since.toISOString());
    setUntilUtc(until.toISOString());
  }, []);

  // авто-генерации нет: пользователь запускает вручную кнопкой

  const generate = useCallback(async () => {
    setError(null);
    setLoadingGen(true);
    try {
      const params = new URLSearchParams();
      params.set('date', date);
      if (chatId && chatId.trim() !== '') params.set('chat_id', chatId.trim());
      if (sinceUtc && untilUtc) {
        params.set('since', sinceUtc);
        params.set('until', untilUtc);
      }
      const res = await fetch(`/api/report/generate?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error || 'generate_failed';
        const detail = data?.detail ? `: ${String(data.detail).slice(0, 500)}` : '';
        throw new Error(`${msg}${detail}`);
      }
      setGen(data);
      setGeneratedAt(new Date().toLocaleString());
    } catch (e: any) {
      setError(e?.message || 'generate_failed');
    } finally {
      setLoadingGen(false);
    }
  }, [date, chatId, sinceUtc, untilUtc]);

  // Синхронизация параметров в URL (шаринг/перезагрузка)
  useEffect(() => {
    const usp = new URLSearchParams();
    if (date) usp.set('date', date);
    const trimmed = (chatId || '').trim();
    if (trimmed) usp.set('chat_id', trimmed);
    const qs = usp.toString();
    const url = window.location.pathname + (qs ? ('?' + qs) : '');
    window.history.replaceState(null, '', url);
  }, [date, chatId]);

  // Горячие клавиши: Cmd/Ctrl+Enter — сгенерировать, Esc — сброс
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        generate();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setGen(null);
        setError(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [generate]);

  function setDateOffset(daysOffset: number) {
    const base = new Date();
    base.setUTCDate(base.getUTCDate() + daysOffset);
    const y = base.getUTCFullYear();
    const m = String(base.getUTCMonth() + 1).padStart(2, '0');
    const d = String(base.getUTCDate()).padStart(2, '0');
    setDate(`${y}-${m}-${d}`);
  }

  return (
    <div className="">
      <div className="max-w-4xl mx-auto p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-black">Ежедневный отчёт</h2>
          <div className="flex items-center gap-2">
            {loadingGen ? (
              <span className="px-2 py-0.5 rounded-md border border-gray-200 bg-gray-100 text-[12px] inline-flex items-center gap-2 text-gray-600">
                <span className="inline-block h-3 w-3 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
                Генерация…
              </span>
            ) : error ? (
              <span className="px-2 py-0.5 rounded-md border border-red-200 bg-red-50 text-[12px] text-red-800">Ошибка</span>
            ) : gen ? (
              <span className="px-2 py-0.5 rounded-md border border-gray-200 bg-gray-100 text-[12px] text-gray-600" title={generatedAt || undefined}>Готово</span>
            ) : (
              <span className="px-2 py-0.5 rounded-md border border-gray-200 bg-gray-100 text-[12px] text-gray-600">Готов к генерации</span>
            )}
            <button onClick={() => { setGen(null); setError(null); }} className="px-4 py-2 text-sm font-bold text-gray-900 bg-gray-100 rounded-md hover:bg-gray-200">Сброс</button>
            <button onClick={generate} disabled={loadingGen || !date} className="px-5 py-2 text-sm font-bold text-white bg-gray-900 rounded-md hover:bg-gray-700 focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50" title="Cmd/Ctrl+Enter">
              {loadingGen ? 'Генерация…' : (gen ? 'Повторить' : 'Сгенерировать отчёт')}
            </button>
          </div>
        </div>

      <div className="panel">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <div className="flex flex-col gap-2">
            <div className="text-xs uppercase font-bold text-gray-500 tracking-wider">Date (UTC day)</div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full p-3 bg-white border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
            />
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 text-[11px] font-bold text-gray-900 bg-gray-100 rounded-md hover:bg-gray-200" onClick={() => setDateOffset(0)} title="Сегодня (UTC)">Сегодня</button>
              <button className="px-4 py-2 text-[11px] font-bold text-gray-900 bg-gray-100 rounded-md hover:bg-gray-200" onClick={() => setDateOffset(-1)} title="Вчера (UTC)">Вчера</button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-xs uppercase font-bold text-gray-500 tracking-wider">chat_id (optional)</div>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="-100..."
              className="w-full p-3 bg-white border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          Ошибка: {error}
          <button className="ml-3 underline" onClick={() => setError(null)}>Скрыть</button>
        </div>
      )}

      <div className="panel space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-black">LLM Output</h3>
          {gen && (
            <div className="flex gap-2">
              <button className={`px-4 py-2 text-sm font-bold rounded-md ${llmTab === 'json' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`} onClick={() => setLlmTab('json')}>JSON</button>
              <button className={`px-4 py-2 text-sm font-bold rounded-md ${llmTab === 'md' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`} onClick={() => setLlmTab('md')}>Markdown</button>
            </div>
          )}
        </div>

        {!gen ? (
          loadingGen ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-gray-100 rounded" />
              <div className="h-4 bg-gray-100 rounded w-11/12" />
              <div className="h-4 bg-gray-100 rounded w-10/12" />
              <div className="h-4 bg-gray-100 rounded w-9/12" />
            </div>
          ) : (
            <div className="text-sm text-gray-600">Нажми «Сгенерировать отчёт», чтобы получить результат.</div>
          )
        ) : (
          <div className="space-y-3">
            {llmTab === 'json' ? (
              <div className="space-y-2">
                <div className="flex justify-end gap-2">
                  <button
                    className="px-4 py-2 text-sm font-bold text-gray-900 bg-gray-100 rounded-md hover:bg-gray-200"
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(gen.json, null, 2)).catch(() => {})}
                  >Скопировать</button>
                </div>
                <pre className="bg-gray-900 text-white text-[11px] p-3 rounded-md overflow-auto max-h-[480px]">{JSON.stringify(gen.json, null, 2)}</pre>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-end gap-2">
                  <button
                    className="px-4 py-2 text-sm font-bold text-gray-900 bg-gray-100 rounded-md hover:bg-gray-200"
                    onClick={() => navigator.clipboard.writeText(gen.markdown).catch(() => {})}
                  >Скопировать</button>
                  <button
                    className="px-4 py-2 text-sm font-bold text-gray-900 bg-gray-100 rounded-md hover:bg-gray-200"
                    onClick={() => {
                      const blob = new Blob([gen.markdown || ''], { type: 'text/markdown;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `report-${date || 'daily'}.md`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                    }}
                  >Скачать .md</button>
                </div>
                <div className="whitespace-pre-wrap text-sm text-gray-800">{gen.markdown}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}


