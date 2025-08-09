export function build24hRange(sinceIso?: string): string[] {
  const out: string[] = [];
  const sinceParsed = sinceIso ? new Date(sinceIso) : new Date(NaN);
  const base = isNaN(sinceParsed.getTime())
    ? new Date(Date.now() - 24 * 3600_000)
    : sinceParsed;
  const start = new Date(base);
  start.setMinutes(0, 0, 0);
  for (let i = 0; i < 24; i++) {
    const d = new Date(start.getTime() + i * 3600_000);
    try {
      out.push(d.toISOString().slice(0, 13) + ":00:00.000Z");
    } catch {
      const iso = new Date(Date.now() - (24 - i) * 3600_000).toISOString();
      out.push(iso.slice(0, 13) + ":00:00.000Z");
    }
  }
  return out;
}


