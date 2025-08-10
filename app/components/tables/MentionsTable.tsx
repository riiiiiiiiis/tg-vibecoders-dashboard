"use client";

import { useNumberFormatter } from "../../hooks/useNumberFormatter";

type Row = { token: string; cnt: number };
type MentionsTableProps = { rows?: Row[] };

export function MentionsTable({ rows = [] }: MentionsTableProps) {
  const { formatNumber } = useNumberFormatter();
  if (rows.length === 0) return null;
  return (
    <section className="panel overflow-auto max-h-64 space-y-2">
      <div className="text-xs uppercase font-bold text-gray-500 tracking-wider">Упоминания</div>
      <table>
        <thead><tr><th>@Упоминание</th><th>Кол-во</th></tr></thead>
        <tbody>
          {rows.map((m, i) => (
            <tr key={i}><td>{m.token}</td><td>{formatNumber(m.cnt)}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}


