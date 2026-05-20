// ─────────────────────────────────────────────────────────────────────────────
// harvest-export.ts — P2 PR10
//
// Client-side CSV generation for completed harvest records.
// UTF-8 BOM included for Excel Thai character support.
// No xlsx dependency. No server API. No migration.
// ─────────────────────────────────────────────────────────────────────────────

export type ExportRow = {
  actual_completed_at:    string | null;
  member_name:            string;
  member_phone:           string | null;
  plot_name:              string;
  crop_name:              string;
  actual_yield_kg:        number | null;  // farmer estimate (PR1 pre-fill)
  actual_received_kg:     number | null;
  estimated_moisture_pct: number | null;  // PR1 field (null when from view)
  actual_moisture_pct:    number | null;  // PR5 field (null when from view)
  quality_moisture:       number | null;  // view fallback for actual moisture
  status:                 string;
  admin_note:             string | null;
};

function varPct(est: number | null, act: number | null): string {
  if (est == null || act == null || est === 0) return '';
  return ((act - est) / est * 100).toFixed(1) + '%';
}

function escapeCell(val: string | number | null | undefined): string {
  if (val == null) return '';
  const s = String(val);
  // Quote cells containing comma, newline, or double-quote
  if (s.includes(',') || s.includes('\n') || s.includes('"')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('th-TH', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch { return iso; }
}

const HEADERS = [
  'วันที่เสร็จ',
  'ชื่อสมาชิก',
  'เบอร์โทร',
  'แปลง',
  'พืช',
  'น้ำหนักประมาณ (กก.)',
  'น้ำหนักจริง (กก.)',
  'ต่างน้ำหนัก %',
  'ความชื้นประมาณ %',
  'ความชื้นจริง %',
  'ต่างความชื้น %',
  'สถานะ',
  'หมายเหตุผู้ดูแล',
];

export function buildHarvestCsv(rows: ExportRow[]): string {
  const lines: string[] = [HEADERS.map(escapeCell).join(',')];

  for (const r of rows) {
    const kgVar   = varPct(r.actual_yield_kg, r.actual_received_kg);
    const moistVar = varPct(r.estimated_moisture_pct, r.actual_moisture_pct ?? r.quality_moisture);
    lines.push([
      formatDate(r.actual_completed_at),
      r.member_name,
      r.member_phone ?? '',
      r.plot_name,
      r.crop_name,
      r.actual_yield_kg ?? '',
      r.actual_received_kg ?? '',
      kgVar,
      r.estimated_moisture_pct ?? '',
      (r.actual_moisture_pct ?? r.quality_moisture) ?? '',
      moistVar,
      r.status,
      r.admin_note ?? '',
    ].map(escapeCell).join(','));
  }

  // UTF-8 BOM (\uFEFF) for Excel Thai support
  return '\uFEFF' + lines.join('\r\n');
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function todayFilename(): string {
  const d   = new Date();
  const ymd = d.getFullYear().toString()
    + String(d.getMonth() + 1).padStart(2, '0')
    + String(d.getDate()).padStart(2, '0');
  return `harvest_completed_${ymd}.csv`;
}
