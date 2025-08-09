"use client";

import { useNumberFormatter } from "../../hooks/useNumberFormatter";

type Row = { token: string; cnt: number };
type HashtagsTableProps = { rows?: Row[] };

export function HashtagsTable({ rows = [] }: HashtagsTableProps) {
  const { formatNumber } = useNumberFormatter();
  if (rows.length === 0) return null;
  return (
    <section className="panel overflow-auto max-h-64">
      <h2>Хэштеги</h2>
      <table>
        <thead><tr><th>#Хэштег</th><th>Кол-во</th></tr></thead>
        <tbody>
          {rows.map((h, i) => (
            <tr key={i}><td>{h.token}</td><td>{formatNumber(h.cnt)}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}


