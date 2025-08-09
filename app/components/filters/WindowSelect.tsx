"use client";

type WindowSelectProps = {
  value: number;
  onChange: (days: number) => void;
};

export function WindowSelect({ value, onChange }: WindowSelectProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="muted">Окно:</label>
      <select
        className="bg-[#1a1f2b] border border-[color:var(--border)] rounded-md px-2 py-1 text-sm"
        value={String(value)}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
      >
        <option value="1">24 часа</option>
        <option value="7">7 дней</option>
      </select>
    </div>
  );
}


