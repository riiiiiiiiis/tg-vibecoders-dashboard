"use client";

import { useEffect, useMemo, useRef } from "react";
import { Chart, LineController, LineElement, PointElement, LinearScale, Title, CategoryScale, Filler, type ChartData, type ChartOptions } from "chart.js";
import { useTimeFormatting } from "../../hooks/useTimeFormatting";
import { build24hRange } from "../../utils/time";

Chart.register(LineController, LineElement, PointElement, LinearScale, Title, CategoryScale, Filler);

type HourlyChartProps = {
  since?: string;
  hourlyRows?: Array<{ hour: string; cnt: number }>;
};

export function HourlyChart({ since, hourlyRows = [] }: HourlyChartProps) {
  const { formatHourLocal } = useTimeFormatting();
  const chartRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstance = useRef<Chart | null>(null);

  const hourly = useMemo(() => {
    const rangeHours = build24hRange(since);
    const map = new Map<string, number>(rangeHours.map((h) => [h, 0] as [string, number]));
    for (const h of hourlyRows) {
      const key = new Date(h.hour).toISOString().slice(0, 13) + ":00:00.000Z";
      if (map.has(key)) map.set(key, h.cnt);
    }
    const labels = rangeHours.map((h) => formatHourLocal(h));
    const series = rangeHours.map((h) => map.get(h) || 0);
    return { labels, series };
  }, [since, hourlyRows, formatHourLocal]);

  useEffect(() => {
    if (!chartRef.current) return;
    if (chartInstance.current) chartInstance.current.destroy();
    const data: ChartData<'line', number[], string> = {
      labels: hourly.labels,
      datasets: [
        {
          label: "Сообщений/час",
          data: hourly.series as number[],
          tension: 0.3,
          borderColor: "#7c9cff",
          backgroundColor: "rgba(124,156,255,0.15)",
          fill: true,
          pointRadius: 2,
        },
      ],
    };
    const options: ChartOptions<'line'> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { grid: { color: "#1f2432" } }, y: { grid: { color: "#1f2432" } } },
    };
    chartInstance.current = new Chart(chartRef.current, { type: "line", data, options });
    return () => chartInstance.current?.destroy();
  }, [hourly]);

  return (
    <section className="panel lg:col-span-2">
      <h2>Почасовая активность</h2>
      <div className="h-60"><canvas ref={chartRef} /></div>
    </section>
  );
}


