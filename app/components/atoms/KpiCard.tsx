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
      <div className="text-xs uppercase font-bold text-gray-500 tracking-wider mb-1">{title}</div>
      <div className="text-2xl font-bold text-gray-900" id={id}>{display}</div>
    </div>
  );
}


