"use client";

type SummaryListProps = { items: string[] };

export function SummaryList({ items }: SummaryListProps) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <section className="panel lg:col-span-1">
      <h2>Короткое саммари</h2>
      <ul className="mt-1 ml-5 text-[13px]">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </section>
  );
}


