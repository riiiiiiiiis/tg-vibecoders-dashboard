"use client";

import { useNumberFormatter } from "../../hooks/useNumberFormatter";

type Row = { url?: string; title?: string; chat_id: string | number; username?: string; cnt: number };
type ForwardedFromTableProps = { rows?: Row[] };

export function ForwardedFromTable({ rows = [] }: ForwardedFromTableProps) {
  const { formatNumber } = useNumberFormatter();
  return (
    <section className="panel lg:col-span-3 overflow-auto space-y-2">
      <div className="text-xs uppercase font-bold text-gray-500 tracking-wider">Переслано из каналов (выбранный чат)</div>
      <table>
        <thead><tr><th>Канал</th><th>Кол-во</th></tr></thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((c, i) => (
              <tr key={i}>
                <td>
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noreferrer noopener">
                      {c.title ? `${c.title} (${c.chat_id})` : (c.username ? `@${c.username}` : c.chat_id)}
                    </a>
                  ) : (
                    c.title ? `${c.title} (${c.chat_id})` : (c.username ? `@${c.username}` : c.chat_id)
                  )}
                </td>
                <td>{formatNumber(c.cnt)}</td>
              </tr>
            ))
          ) : (
            <tr><td colSpan={2} className="text-xs text-gray-500">Нет пересылок в выбранном чате за окно</td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
}


