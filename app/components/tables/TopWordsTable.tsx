"use client";

import { useNumberFormatter } from "../../hooks/useNumberFormatter";

type TopWordsTableProps = { rows?: Array<{ word: string; cnt: number }> };

export function TopWordsTable({ rows = [] }: TopWordsTableProps) {
  const { formatNumber } = useNumberFormatter();
  if (rows.length === 0) return null;
  return (
    <section className="panel overflow-auto max-h-64 space-y-2">
      <div className="text-xs uppercase font-bold text-gray-500 tracking-wider">Топ слов</div>
      <table>
        <thead><tr><th>Слово</th><th>Кол-во</th></tr></thead>
        <tbody>
          {rows.map((w, i) => (
            <tr key={i}><td>{w.word}</td><td>{formatNumber(w.cnt)}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}


