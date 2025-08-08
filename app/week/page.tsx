export default function Page() {
  return (
    <div className="container" data-days="7">
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12}}>
        <div>
          <h1>Telegram Dashboard — последние 7 дней</h1>
          <div className="muted">срез с <span id="since">…</span> по <span id="until">…</span></div>
        </div>
        <div><a className="btn" href="/">За 24 часа</a></div>
      </div>

      <div className="kpi" style={{margin:'12px 0 16px'}}>
        <div className="card"><h3>Всего сообщений</h3><div className="v" id="k_total">–</div></div>
        <div className="card"><h3>Уникальные пользователи</h3><div className="v" id="k_unique">–</div></div>
        <div className="card"><h3>Среднее на пользователя</h3><div className="v" id="k_avg">–</div></div>
        <div className="card"><h3>Ответы</h3><div className="v" id="k_replies">–</div></div>
        <div className="card"><h3>Сообщений со ссылками</h3><div className="v" id="k_links">–</div></div>
      </div>

      <div className="panel" style={{margin:'12px 0'}}>
        <div className="chartBox" style={{height:240}}><canvas id="dailyChart"></canvas></div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
        <div className="panel">
          <h2>Топ пользователей</h2>
          <table id="topUsers"></table>
        </div>
        <div className="panel">
          <h2>Топ ссылок</h2>
          <table id="topLinks"></table>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12}}>
        <div className="panel">
          <h2>Топ слов</h2>
          <table id="topWords"></table>
        </div>
        <div className="panel">
          <h2>Треды с наиб. числом ответов</h2>
          <table id="topThreads"></table>
        </div>
      </div>
    </div>
  );
}


