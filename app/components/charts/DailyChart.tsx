"use client";

import { useEffect, useRef } from "react";
import { Chart, BarController, BarElement, LinearScale, Title, CategoryScale, type ChartData, type ChartOptions } from "chart.js";
import { useTimeFormatting } from "../../hooks/useTimeFormatting";

Chart.register(BarController, BarElement, LinearScale, Title, CategoryScale);

type DailyChartProps = {
  dailyRows?: Array<{ day: string; cnt: number }>;
};

export function DailyChart({ dailyRows = [] }: DailyChartProps) {
  const { formatDateLocal } = useTimeFormatting();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const instance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (instance.current) instance.current.destroy();
    const labels = dailyRows.map((d) => formatDateLocal(d.day));
    const series = dailyRows.map((d) => d.cnt);
    const data: ChartData<'bar', number[], string> = {
      labels,
      datasets: [{ label: 'Сообщений/день', data: series, backgroundColor: 'rgba(124,156,255,0.6)' }],
    };
    const options: ChartOptions<'bar'> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: '#1f2432' } } },
    };
    instance.current = new Chart(canvasRef.current, { type: 'bar', data, options });
    return () => instance.current?.destroy();
  }, [dailyRows, formatDateLocal]);

  return (
    <section className="panel lg:col-span-2">
      <h2>Дневная активность</h2>
      <div className="h-60"><canvas ref={canvasRef} /></div>
    </section>
  );
}


