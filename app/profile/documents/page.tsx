'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter }            from 'next/navigation';
import { useAuth, useCurrentMember } from '@/providers/auth-provider';
import { MobileAppShell }       from '@/shared/components/mobile-app-shell';
import { LoadingState }         from '@/shared/components/loading-state';
import { ProtectedRoute }       from '@/shared/components/protected-route';
import { getAuthHeaders }       from '@/lib/auth/get-auth-headers';
import { compressDocument }     from '@/shared/lib/image-processing';

const DOC_TYPES = [
  { value: 'id_card',     label: '🪪 บัตรประชาชน' },
  { value: 'farmer_card', label: '🌾 บัตรเกษตรกร' },
  { value: 'land_title',  label: '📜 โฉนดที่ดิน' },
  { value: 'land_doc',    label: '📄 เอกสารสิทธิ์อื่น' },
  { value: 'vehicle_reg', label: '🚛 ทะเบียนรถ' },
  { value: 'other',       label: '📎 เอกสารอื่น' },
];

type Doc = {
  id: string; doc_type: string; file_name: string | null;
  file_url: string | null; verified: boolean; created_at: string;
};

function DocumentsContent() {
  const { status } = useAuth();
  const member  = useCurrentMember();
  const router  = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [docs,      setDocs]      = useState<Doc[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [docType,   setDocType]   = useState('id_card');
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [notice,    setNotice]    = useState<string | null>(null);

  async function loadDocs() {
    if (!member?.member_id) return;
    const { headers, url } = await getAuthHeaders(member, '/api/member/documents');
    const res  = await fetch(url, { headers });
    const data = (await res.json()) as { documents?: Doc[] };
    setDocs(data.documents ?? []);
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void loadDocs(); }, [member?.member_id]);

  if (status === 'loading') return <LoadingState label="กำลังโหลด…" />;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !member) return;
    if (fileRef.current) fileRef.current.value = '';

    setUploading(true); setError(null);

    // Compress image files, pass PDF as-is
    let uploadFile = file;
    if (file.type.startsWith('image/')) {
      const { processedFile } = await compressDocument(file);
      uploadFile = processedFile;
    }

    const { headers, url } = await getAuthHeaders(member, '/api/member/documents');
    const form = new FormData();
    form.append('file', uploadFile);
    form.append('doc_type', docType);

    const res  = await fetch(url, { method: 'POST', headers, body: form });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    setUploading(false);

    if (!res.ok) { setError(data.error ?? 'อัปโหลดไม่สำเร็จ'); return; }
    setNotice('✅ อัปโหลดเอกสารแล้ว');
    setTimeout(() => setNotice(null), 3000);
    void loadDocs();
  }

  async function handleDelete(id: string) {
    if (!confirm('ลบเอกสารนี้?') || !member) return;
    const { headers, url } = await getAuthHeaders(member, '/api/member/documents');
    await fetch(url, {
      method: 'DELETE',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_id: id }),
    });
    setDocs(prev => prev.filter(d => d.id !== id));
  }

  const docTypeTH = Object.fromEntries(DOC_TYPES.map(d => [d.value, d.label]));

  return (
    <MobileAppShell title="📎 เอกสารประกอบ" subtitle="อัปโหลดเอกสารของคุณ">
      <div className="mobile-stack" style={{ paddingBottom: 24 }}>
        {notice && <div style={{ padding: '10px 14px', borderRadius: 10, background: '#e8f5e9', color: '#1b5e20', fontWeight: 700, fontSize: 13 }}>{notice}</div>}
        {error  && <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fee2e2', color: '#991b1b', fontSize: 13 }}>{error}</div>}

        {/* Upload section */}
        <div style={{ background: '#f8fafc', border: '1.5px solid #e5e7eb', borderRadius: 14, padding: 16 }}>
          <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: 14 }}>➕ เพิ่มเอกสาร</p>

          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>ประเภทเอกสาร</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {DOC_TYPES.map(t => (
              <button key={t.value} onClick={() => setDocType(t.value)}
                style={{ padding: '7px 12px', borderRadius: 99, border: `1.5px solid ${docType === t.value ? '#2e7d32' : '#e5e7eb'}`, background: docType === t.value ? '#e8f5e9' : '#fff', color: docType === t.value ? '#1b5e20' : '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {t.label}
              </button>
            ))}
          </div>

          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', background: uploading ? '#e5e7eb' : '#2e7d32', color: uploading ? '#9ca3af' : '#fff', fontSize: 14, fontWeight: 800, cursor: uploading ? 'not-allowed' : 'pointer' }}>
            {uploading ? '⏳ กำลังอัปโหลด…' : '📤 เลือกไฟล์ / ถ่ายรูปเอกสาร'}
          </button>
          <p style={{ margin: '6px 0 0', fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
            รองรับ JPG, PNG, HEIC, PDF ขนาดไม่เกิน 10 MB
          </p>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment"
            style={{ display: 'none' }} onChange={handleFile} />
        </div>

        {/* Document list */}
        <p style={{ margin: '4px 0', fontWeight: 700, fontSize: 14 }}>
          เอกสารที่มี ({docs.length})
        </p>

        {loading && <p style={{ color: '#9ca3af', fontSize: 13 }}>กำลังโหลด…</p>}

        {!loading && docs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
            <p style={{ fontSize: 13 }}>ยังไม่มีเอกสาร</p>
          </div>
        )}

        {docs.map(doc => (
          <div key={doc.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Thumbnail */}
            {doc.file_url && (
              <a href={doc.file_url} target="_blank" rel="noreferrer"
                style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', flexShrink: 0, display: 'block', border: '1px solid #e5e7eb' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={doc.file_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </a>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{docTypeTH[doc.doc_type] ?? doc.doc_type}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {doc.file_name ?? 'ไม่มีชื่อ'} · {new Date(doc.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
              {doc.verified
                ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#e8f5e9', color: '#1b5e20', fontWeight: 700 }}>✅ ยืนยันแล้ว</span>
                : <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#fffbeb', color: '#92400e', fontWeight: 700 }}>⏳ รอตรวจ</span>
              }
              <button onClick={() => handleDelete(doc.id)}
                style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                ลบ
              </button>
            </div>
          </div>
        ))}
      </div>
    </MobileAppShell>
  );
}

export default function DocumentsPage() {
  return (
    <ProtectedRoute allowedRoles={['farmer','leader','admin','staff','inspector']}>
      <DocumentsContent />
    </ProtectedRoute>
  );
}
