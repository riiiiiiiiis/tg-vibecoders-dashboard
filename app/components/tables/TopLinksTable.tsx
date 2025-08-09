"use client";

import { useNumberFormatter } from "../../hooks/useNumberFormatter";

type TopLinksTableProps = {
  rows?: Array<{ url: string; cnt: number }>;
};

export function TopLinksTable({ rows = [] }: TopLinksTableProps) {
  const { formatNumber } = useNumberFormatter();
  if (rows.length === 0) return null;
  return (
    <section className="panel overflow-auto max-h-64">
      <h2>Топ ссылок</h2>
      <table>
        <thead><tr><th>Ссылка</th><th>Кол-во</th></tr></thead>
        <tbody>
          {rows.map((l, i) => (
            <tr key={i}><td><a href={l.url} target="_blank" rel="noreferrer noopener">{l.url}</a></td><td>{formatNumber(l.cnt)}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}


