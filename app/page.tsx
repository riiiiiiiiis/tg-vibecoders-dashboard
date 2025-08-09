import DashboardShell from './components/DashboardShell';
export default function Page() {
  return (
    <main className="min-h-screen">
      <header className="sticky top-0 h-14 backdrop-blur bg-[rgba(11,12,16,0.6)] border-b border-[color:var(--border)] z-10">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div>
            <h1 className="m-0 text-[18px] tracking-[0.2px]">Telegram Dashboard — последние 24 часа</h1>
            <div className="muted">срез от <span id="since">…</span></div>
          </div>
          <div className="flex items-center gap-2">
            <a className="btn" href="/week">За 7 дней</a>
            <a className="btn" href="/">Обновить</a>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto p-3">
        <DashboardShell days={1} />
      </div>
    </main>
  );
}


