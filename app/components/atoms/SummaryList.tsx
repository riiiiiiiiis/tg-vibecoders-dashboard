"use client";

type SummaryListProps = { items: string[] };

export function SummaryList({ items }: SummaryListProps) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <section className="panel lg:col-span-1 space-y-2">
      <div className="text-xs uppercase font-bold text-gray-500 tracking-wider">Короткое саммари</div>
      <ul className="list-disc pl-5 text-sm text-gray-800">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </section>
  );
}


