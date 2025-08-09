"use client";

type Chat = { chat_id: string | number; title?: string; cnt?: number };

type ChatSelectProps = {
  chats?: Chat[];
  value: string | null;
  onChange: (next: string | null) => void;
};

export function ChatSelect({ chats = [], value, onChange }: ChatSelectProps) {
  return (
    <div className="lg:col-span-3 flex items-center gap-2">
      <label className="muted">Чат:</label>
      <select
        className="bg-[#1a1f2b] border border-[color:var(--border)] rounded-md px-2 py-1 text-sm"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
      >
        <option value="">Все</option>
        {chats.map((c) => (
          <option key={String(c.chat_id)} value={String(c.chat_id)}>
            {c.title ? `${c.title} (${c.chat_id})` : c.chat_id}
            {typeof c.cnt === "number" ? ` — ${c.cnt}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}


