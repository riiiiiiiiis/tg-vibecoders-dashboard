"use client";

import { useNumberFormatter } from "../../hooks/useNumberFormatter";

type TopThreadsTableProps = { rows?: Array<{ root_id: number | string; replies: number; root_preview: string }> };

export function TopThreadsTable({ rows = [] }: TopThreadsTableProps) {
  const { formatNumber } = useNumberFormatter();
  if (rows.length === 0) return null;
  return (
    <section className="panel lg:col-span-2 overflow-auto max-h-64 space-y-2">
      <div className="text-xs uppercase font-bold text-gray-500 tracking-wider">Треды с наиб. числом ответов</div>
      <table>
        <thead><tr><th>Root ID</th><th>Ответов</th><th>Превью</th></tr></thead>
        <tbody>
          {rows.map((t, i) => (
            <tr key={i}><td>{t.root_id}</td><td>{formatNumber(t.replies)}</td><td>{t.root_preview}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}


