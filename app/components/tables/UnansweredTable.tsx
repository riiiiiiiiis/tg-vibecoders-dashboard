"use client";

import { useNumberFormatter } from "../../hooks/useNumberFormatter";
import { useState } from "react";

type Row = { id: number | string; preview: string; hours: number; text?: string };
type UnansweredTableProps = { rows?: Row[] };

export function UnansweredTable({ rows = [] }: UnansweredTableProps) {
  const { formatNumber } = useNumberFormatter();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  if (rows.length === 0) return null;
  return (
    <section className="panel lg:col-span-2 overflow-auto max-h-[360px] space-y-2">
      <div className="text-xs uppercase font-bold text-gray-500 tracking-wider">Вопросы без ответа (&gt;12ч)</div>
      <table>
        <thead><tr><th>ID</th><th>Превью</th><th>Часов</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="cursor-pointer" onClick={() => setExpanded((s) => ({ ...s, [i]: !s[i] }))}>
              <td>{r.id}</td><td>{r.preview}</td><td>{formatNumber(r.hours)}</td>
            </tr>
          ))}
          {rows.map((r, i) => (
            <tr key={`f-${i}`} style={{ display: expanded[i] ? "" : "none" }}>
              <td colSpan={3} className="text-xs text-gray-500 whitespace-pre-wrap">{r.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}


