"use client";

import { useNumberFormatter } from "../../hooks/useNumberFormatter";

type TopHelpersTableProps = { rows?: Array<{ user: string; cnt: number }> };

export function TopHelpersTable({ rows = [] }: TopHelpersTableProps) {
  const { formatNumber } = useNumberFormatter();
  if (rows.length === 0) return null;
  return (
    <section className="panel lg:col-span-1 overflow-auto max-h-64">
      <h2>Helpers — лидеры</h2>
      <table>
        <thead><tr><th>Пользователь</th><th>Ответов</th></tr></thead>
        <tbody>
          {rows.map((h, i) => (
            <tr key={i}><td>{h.user}</td><td>{formatNumber(h.cnt)}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}


