"use client";

import { useNumberFormatter } from "../../hooks/useNumberFormatter";

type KpiCardProps = {
  title: string;
  value: number;
  id?: string;
  format?: (v: number) => string;
};

export function KpiCard({ title, value, id, format }: KpiCardProps) {
  const { formatNumber } = useNumberFormatter();
  const display = typeof format === "function" ? format(value) : formatNumber(value);
  return (
    <div className="card">
      <h3 className="m-0 mb-1 text-[11px] text-[color:var(--muted)] font-semibold tracking-[0.3px] uppercase">{title}</h3>
      <div className="text-[20px] font-extrabold bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] bg-clip-text text-transparent" id={id}>{display}</div>
    </div>
  );
}


