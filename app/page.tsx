import DashboardShell from './components/DashboardShell';
export default function Page() {
  return (
    <main>
      <header className="border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 sm:px-8 py-4">
          <h1 className="text-2xl font-bold text-black">Telegram Dashboard — последние 24 часа</h1>
          <div className="text-sm text-gray-600">срез от <span id="since">…</span></div>
          <div className="mt-2 flex items-center gap-2">
            <a className="btn" href="/week">За 7 дней</a>
            <a className="btn" href="/">Обновить</a>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 sm:p-8">
        <DashboardShell days={1} />
      </div>
    </main>
  );
}


