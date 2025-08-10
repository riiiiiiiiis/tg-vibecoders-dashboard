"use client";

import { KpiCard } from "./KpiCard";

type KpiRowProps = {
  kpi: {
    total_msgs: number;
    unique_users: number;
    avg_per_user: number;
    replies: number;
    with_links: number;
  };
};

export function KpiRow({ kpi }: KpiRowProps) {
  return (
    <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <KpiCard title="Всего сообщений" value={kpi.total_msgs} id="k_total" />
      <KpiCard title="Уникальные пользователи" value={kpi.unique_users} id="k_unique" />
      <KpiCard
        title="Среднее на пользователя"
        value={kpi.avg_per_user}
        id="k_avg"
        format={(v) => (Math.round((v || 0) * 100) / 100).toFixed(2)}
      />
      <KpiCard title="Ответы" value={kpi.replies} id="k_replies" />
      <KpiCard title="Сообщений со ссылками" value={kpi.with_links} id="k_links" />
    </div>
  );
}


