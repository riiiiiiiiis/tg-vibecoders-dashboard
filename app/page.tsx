export default function Page() {
  return (
    <main className="fullscreen">
      <header>
        <div className="inner container">
          <div>
            <h1>Telegram Dashboard — последние 24 часа</h1>
            <div className="muted">срез от <span id="since">…</span></div>
          </div>
          <div className="toolbar">
            <a className="btn" href="/week">За 7 дней</a>
            <a className="btn" href="/">Обновить</a>
          </div>
        </div>
      </header>
      <div className="dashboard container">
        <div className="kpi">
          <div className="card"><h3>Всего сообщений</h3><div className="v" id="k_total">–</div></div>
          <div className="card"><h3>Уникальные пользователи</h3><div className="v" id="k_unique">–</div></div>
          <div className="card"><h3>Среднее на пользователя</h3><div className="v" id="k_avg">–</div></div>
          <div className="card"><h3>Ответы</h3><div className="v" id="k_replies">–</div></div>
          <div className="card"><h3>Сообщений со ссылками</h3><div className="v" id="k_links">–</div></div>
        </div>
        <section className="panel" style={{ minHeight: 0 }}>
          <h2>Короткое саммари</h2>
          <ul id="summary"></ul>
        </section>
        <section className="panel" style={{ minHeight: 0 }}>
          <h2>Почасовая активность</h2>
          <div className="chartBox" style={{ height: 240 }}>
            <canvas id="hourlyChart"></canvas>
          </div>
        </section>
        <section className="panel">
          <h2>Топ пользователей</h2>
          <table id="topUsers"></table>
        </section>
        <section className="panel">
          <h2>Топ ссылок</h2>
          <table id="topLinks"></table>
        </section>
        <section className="panel">
          <h2>Топ слов</h2>
          <table id="topWords"></table>
        </section>
        <section className="panel">
          <h2>Треды с наиб. числом ответов</h2>
          <table id="topThreads"></table>
        </section>
      </div>
    </main>
  );
}


