'use client';

type ExportCSVProps = {
  data     : Record<string, unknown>[]
  filename : string
  label?   : string
  disabled?: boolean
};

export function ExportCSV({ data, filename, label = '📥 Export CSV', disabled }: ExportCSVProps) {
  function download() {
    if (!data.length) return;
    const keys    = Object.keys(data[0]!);
    const csvRows = [
      keys.join(','),
      ...data.map(row =>
        keys.map(k => {
          const v = row[k];
          const s = v == null ? '' : String(v);
          return `"${s.replace(/"/g, '""')}"`;
        }).join(',')
      ),
    ];
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type:'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button className="admin-btn admin-btn--secondary" onClick={download}
      disabled={disabled || !data.length} style={{ fontSize:13 }}>
      {label}
    </button>
  );
}
