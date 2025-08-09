"use client";

import { useNumberFormatter } from "../../hooks/useNumberFormatter";

type Row = { token: string; cnt: number };
type TopErrorsTableProps = { rows?: Row[] };

export function TopErrorsTable({ rows = [] }: TopErrorsTableProps) {
  const { formatNumber } = useNumberFormatter();
  if (rows.length === 0) return null;
  return (
    <section className="panel lg:col-span-1 overflow-auto max-h-64">
      <h2>Ошибки дня</h2>
      <table>
        <thead><tr><th>Токен</th><th>Кол-во</th></tr></thead>
        <tbody>
          {rows.map((e, i) => (
            <tr key={i}><td>{e.token}</td><td>{formatNumber(e.cnt)}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}


