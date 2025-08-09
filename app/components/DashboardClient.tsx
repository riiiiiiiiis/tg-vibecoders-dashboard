"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chart, LineController, LineElement, PointElement, LinearScale, Title, CategoryScale, Filler, BarController, BarElement, type ChartData, type ChartOptions } from "chart.js";

Chart.register(LineController, LineElement, PointElement, LinearScale, Title, CategoryScale, Filler, BarController, BarElement);

type ApiData = any;

function formatHourLocal(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function build24hRange(sinceIso?: string) {
  const out: string[] = [];
  const sinceParsed = sinceIso ? new Date(sinceIso) : new Date(NaN);
  const base = isNaN(sinceParsed.getTime())
    ? new Date(Date.now() - 24 * 3600_000)
    : sinceParsed;
  const start = new Date(base);
  start.setMinutes(0, 0, 0);
  for (let i = 0; i < 24; i++) {
    const d = new Date(start.getTime() + i * 3600_000);
    try {
      out.push(d.toISOString().slice(0, 13) + ":00:00.000Z");
    } catch (_) {
      // Fallback in exotic envs
      const iso = new Date(Date.now() - (24 - i) * 3600_000).toISOString();
      out.push(iso.slice(0, 13) + ":00:00.000Z");
    }
  }
  return out;
}

const nf = new Intl.NumberFormat("ru-RU");

export default function DashboardClient({ days = 1 }: { days?: number }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);
  const dailyRef = useRef<HTMLCanvasElement | null>(null);
  const dailyInstance = useRef<Chart | null>(null);
  const defaultApplied = useRef<boolean>(false);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (days && days !== 1) params.set('days', String(days));
    if (chatId) params.set('chat_id', chatId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    fetch(`/api/overview${qs}`, { signal: controller.signal })
      .then((r) => r.json())
      .then(setData)
      .catch((e) => { if (e.name !== "AbortError") setError("load_error"); });
    return () => controller.abort();
  }, [days, chatId]);

  // Apply default chat (top by messages) only on first load if user didn't choose anything
  useEffect(() => {
    if (defaultApplied.current) return;
    if (!data || chatId !== null) return;
    const chats: any[] = Array.isArray(data.chats) ? data.chats : [];
    if (chats.length > 0) {
      setChatId(String(chats[0].chat_id));
      defaultApplied.current = true;
    }
  }, [data, chatId]);

  const hourly = useMemo(() => {
    if (!data || !Array.isArray(data.hourly)) return { labels: [], series: [] };
    const rangeHours = build24hRange(data.since);
    const hourlyRows: any[] = Array.isArray(data.hourly) ? data.hourly : [];
    const map = new Map(hourlyRows.map((h: any) => [new Date(h.hour).toISOString().slice(0, 13) + ":00:00.000Z", h.cnt]));
    const labels = rangeHours.map((h) => formatHourLocal(h));
    const series = rangeHours.map((h) => map.get(h) || 0);
    return { labels, series };
  }, [data]);

  useEffect(() => {
    if (!chartRef.current || !data) return;
    if (chartInstance.current) chartInstance.current.destroy();
    const chartData: ChartData<'line', number[], string> = {
      labels: hourly.labels,
      datasets: [
        {
          label: "Сообщений/час",
          data: hourly.series as number[],
          tension: 0.3,
          borderColor: "#7c9cff",
          backgroundColor: "rgba(124,156,255,0.15)",
          fill: true,
          pointRadius: 2,
        },
      ],
    };
    const options: ChartOptions<'line'> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { grid: { color: "#1f2432" } }, y: { grid: { color: "#1f2432" } } },
    };
    chartInstance.current = new Chart(chartRef.current, {
      type: "line",
      data: chartData,
      options,
    });
    return () => { chartInstance.current?.destroy(); };
  }, [hourly, data]);

  useEffect(() => {
    if (!data || days <= 1) return;
    if (!dailyRef.current) return;
    if (dailyInstance.current) dailyInstance.current.destroy();
    const dailyRows: any[] = Array.isArray(data.daily) ? data.daily : [];
    const labels: string[] = dailyRows.map((d: any) => new Date(d.day).toLocaleDateString());
    const series: number[] = dailyRows.map((d: any) => d.cnt as number);
    const chartData: ChartData<'bar', number[], string> = {
      labels,
      datasets: [{ label: 'Сообщений/день', data: series, backgroundColor: 'rgba(124,156,255,0.6)' }],
    };
    const options: ChartOptions<'bar'> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: '#1f2432' } } },
    };
    dailyInstance.current = new Chart(dailyRef.current, { type: 'bar', data: chartData, options });
    return () => { dailyInstance.current?.destroy(); };
  }, [data, days]);

  if (error) return <div className="panel">Ошибка загрузки</div>;
  if (!data) return <div className="panel">Загрузка…</div>;

  const kpi = data?.kpi ?? { total_msgs: 0, unique_users: 0, avg_per_user: 0, replies: 0, with_links: 0 };
  const summaryBullets: string[] = Array.isArray(data?.summaryBullets) ? data.summaryBullets : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div className="lg:col-span-2 flex items-center gap-2">
        <label className="muted">Чат:</label>
        <select className="bg-[#1a1f2b] border border-[color:var(--border)] rounded-md px-2 py-1 text-sm" value={chatId ?? ''} onChange={(e) => setChatId(e.target.value === '' ? null : e.target.value)}>
          <option value="">Все</option>
          {(data.chats || []).map((c: any) => (
            <option key={c.chat_id} value={c.chat_id}>{c.title ? `${c.title} (${c.chat_id})` : c.chat_id} — {c.cnt}</option>
          ))}
        </select>
      </div>
      <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <div className="card"><h3 className="m-0 mb-1 text-[11px] text-[color:var(--muted)] font-semibold tracking-[0.3px] uppercase">Всего сообщений</h3><div className="text-[20px] font-extrabold bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] bg-clip-text text-transparent" id="k_total">{nf.format(kpi.total_msgs)}</div></div>
        <div className="card"><h3 className="m-0 mb-1 text-[11px] text-[color:var(--muted)] font-semibold tracking-[0.3px] uppercase">Уникальные пользователи</h3><div className="text-[20px] font-extrabold bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] bg-clip-text text-transparent" id="k_unique">{nf.format(kpi.unique_users)}</div></div>
        <div className="card"><h3 className="m-0 mb-1 text-[11px] text-[color:var(--muted)] font-semibold tracking-[0.3px] uppercase">Среднее на пользователя</h3><div className="text-[20px] font-extrabold bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] bg-clip-text text-transparent" id="k_avg">{(Math.round((kpi.avg_per_user || 0) * 100) / 100).toFixed(2)}</div></div>
        <div className="card"><h3 className="m-0 mb-1 text-[11px] text-[color:var(--muted)] font-semibold tracking-[0.3px] uppercase">Ответы</h3><div className="text-[20px] font-extrabold bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] bg-clip-text text-transparent" id="k_replies">{nf.format(kpi.replies)}</div></div>
        <div className="card"><h3 className="m-0 mb-1 text-[11px] text-[color:var(--muted)] font-semibold tracking-[0.3px] uppercase">Сообщений со ссылками</h3><div className="text-[20px] font-extrabold bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] bg-clip-text text-transparent" id="k_links">{nf.format(kpi.with_links)}</div></div>
      </div>

      <section className="panel">
        <h2>Короткое саммари</h2>
        <ul className="mt-1 ml-5 text-[13px]">
          {summaryBullets.map((s: string, i: number) => <li key={i}>{s}</li>)}
        </ul>
      </section>

      {days > 1 ? (
        <section className="panel">
          <h2>Дневная активность</h2>
          <div className="h-60"><canvas ref={dailyRef} /></div>
        </section>
      ) : (
        <section className="panel">
          <h2>Почасовая активность</h2>
          <div className="h-60"><canvas ref={chartRef} /></div>
        </section>
      )}

      <section className="panel overflow-x-auto">
        <h2>Топ пользователей</h2>
        <table>
          <thead><tr><th>Пользователь</th><th>Сообщений</th></tr></thead>
          <tbody>
            {(data.topUsers || []).map((u: any, i: number) => (
              <tr key={i}><td>{u.user}</td><td>{nf.format(u.cnt)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel overflow-x-auto">
        <h2>Вопросы без ответа (&gt;12ч)</h2>
        <table>
          <thead><tr><th>ID</th><th>Превью</th><th>Часов</th></tr></thead>
          <tbody>
            {(data.unanswered || []).map((r: any, i: number) => (
              <tr key={i}><td>{r.id}</td><td>{r.preview}</td><td>{nf.format(r.hours)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel overflow-x-auto">
        <h2>Топ ссылок</h2>
        <table>
          <thead><tr><th>Ссылка</th><th>Кол-во</th></tr></thead>
          <tbody>
            {(data.topLinks || []).map((l: any, i: number) => (
              <tr key={i}><td><a href={l.url} target="_blank" rel="noreferrer noopener">{l.url}</a></td><td>{nf.format(l.cnt)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel overflow-x-auto">
        <h2>Топ слов</h2>
        <table>
          <thead><tr><th>Слово</th><th>Кол-во</th></tr></thead>
          <tbody>
            {(data.topWords || []).map((w: any, i: number) => (
              <tr key={i}><td>{w.word}</td><td>{nf.format(w.cnt)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel overflow-x-auto">
        <h2>Треды с наиб. числом ответов</h2>
        <table>
          <thead><tr><th>Root ID</th><th>Ответов</th><th>Превью</th></tr></thead>
        <tbody>
          {(data.topThreads || []).map((t: any, i: number) => (
            <tr key={i}><td>{t.root_id}</td><td>{nf.format(t.replies)}</td><td>{t.root_preview}</td></tr>
          ))}
        </tbody>
        </table>
      </section>

      <section className="panel overflow-x-auto">
        <h2>Helpers — лидеры</h2>
        <table>
          <thead><tr><th>Пользователь</th><th>Ответов</th></tr></thead>
          <tbody>
            {(data.topHelpers || []).map((h: any, i: number) => (
              <tr key={i}><td>{h.user}</td><td>{nf.format(h.cnt)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel overflow-x-auto">
        <h2>Ошибки дня</h2>
        <table>
          <thead><tr><th>Токен</th><th>Кол-во</th></tr></thead>
          <tbody>
            {(data.topErrors || []).map((e: any, i: number) => (
              <tr key={i}><td>{e.token}</td><td>{nf.format(e.cnt)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel overflow-x-auto">
        <h2>Артефакты / Ship-it</h2>
        <table>
          <thead><tr><th>ID</th><th>Артефакт</th><th>Превью</th></tr></thead>
          <tbody>
            {(data.artifacts || []).map((a: any, i: number) => (
              <tr key={i}><td>{a.id}</td><td>{a.url ? <a href={a.url} target="_blank" rel="noreferrer noopener">{a.url}</a> : (a.hasCode ? 'code snippet' : '')}</td><td>{a.preview}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel overflow-x-auto">
        <h2>Хэштеги</h2>
        <table>
          <thead><tr><th>#Хэштег</th><th>Кол-во</th></tr></thead>
          <tbody>
            {(data.topHashtags || []).map((h: any, i: number) => (
              <tr key={i}><td>{h.token}</td><td>{nf.format(h.cnt)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel overflow-x-auto">
        <h2>Упоминания</h2>
        <table>
          <thead><tr><th>@Упоминание</th><th>Кол-во</th></tr></thead>
          <tbody>
            {(data.topMentions || []).map((m: any, i: number) => (
              <tr key={i}><td>{m.token}</td><td>{nf.format(m.cnt)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}


