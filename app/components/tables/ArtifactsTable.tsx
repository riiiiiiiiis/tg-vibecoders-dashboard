"use client";

type Row = { id: number | string; url?: string; hasCode?: boolean; preview?: string };
type ArtifactsTableProps = { rows?: Row[] };

export function ArtifactsTable({ rows = [] }: ArtifactsTableProps) {
  if (rows.length === 0) return null;
  return (
    <section className="panel overflow-auto max-h-64">
      <h2>Артефакты / Ship-it</h2>
      <table>
        <thead><tr><th>ID</th><th>Артефакт</th><th>Превью</th></tr></thead>
        <tbody>
          {rows.map((a, i) => (
            <tr key={i}><td>{a.id}</td><td>{a.url ? <a href={a.url} target="_blank" rel="noreferrer noopener">{a.url}</a> : (a.hasCode ? 'code snippet' : '')}</td><td>{a.preview}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}


