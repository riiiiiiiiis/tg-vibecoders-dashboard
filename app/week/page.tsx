import DashboardClient from '../components/DashboardClient';
export default function Page() {
  return (
    <div className="max-w-[1400px] mx-auto p-4" data-days="7">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="m-0 text-[18px]">Telegram Dashboard — последние 7 дней</h1>
          <div className="muted">срез с <span id="since">…</span> по <span id="until">…</span></div>
        </div>
        <div><a className="btn" href="/">За 24 часа</a></div>
      </div>

      <div className="panel my-3">
        <DashboardClient days={7} />
      </div>
    </div>
  );
}


