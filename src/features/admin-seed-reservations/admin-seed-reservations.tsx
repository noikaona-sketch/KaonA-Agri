'use client';

import { useEffect, useState }                        from 'react';
import { LoadingState }                                from '@/shared/components/loading-state';
import { ErrorState }                                  from '@/shared/components/error-state';
import { ReservationTableRow, type Reservation }       from './reservation-table-row';
import { ReservationCloseModal }                       from './reservation-close-modal';
import { ReservationAttachmentUpload }                 from './reservation-attachment-upload';
import type { UploadResult }                           from '@/shared/utils/compress-and-upload';

const SOURCE_CHANNELS = ['หน้าร้าน','โทรศัพท์','Line','Facebook','อื่นๆ'];

export function AdminSeedReservations() {
  const [items,        setItems]        = useState<Reservation[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [acting,       setActing]       = useState<string | null>(null);
  const [notice,       setNotice]       = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [closeTarget,  setCloseTarget]  = useState<Reservation | null>(null);
  // confirm modal extras
  const [confirmId,    setConfirmId]    = useState<string | null>(null);
  const [sourceChannel, setSourceChannel] = useState('หน้าร้าน');
  const [attachment,   setAttachment]   = useState<UploadResult | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/seed-reservations${statusFilter ? `?status=${statusFilter}` : ''}`);
    const payload = (await res.json()) as { items?: Reservation[]; error?: string };
    if (!res.ok) { setError(payload.error ?? 'โหลดไม่สำเร็จ'); setLoading(false); return; }
    setItems(payload.items ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [statusFilter]);

  async function doAction(action: 'confirm' | 'cancel', id: string) {
    if (action === 'confirm') { setConfirmId(id); return; }   // open confirm modal
    if (!window.confirm('ยกเลิกการจองนี้?')) return;
    setActing(id); setNotice(null);
    const res = await fetch('/api/admin/seed-reservations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel', reservation_id: id }),
    });
    const payload = (await res.json()) as { ok?: boolean; error?: string };
    setActing(null);
    if (!res.ok) { setNotice(`❌ ${payload.error}`); return; }
    setNotice('⛔ ยกเลิกแล้ว');
    await load();
  }

  async function submitConfirm() {
    if (!confirmId) return;
    setActing(confirmId); setNotice(null);
    const res = await fetch('/api/admin/seed-reservations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'confirm', reservation_id: confirmId,
        source_channel:  sourceChannel,
        attachment_url:  attachment?.url  ?? null,
        attachment_path: attachment?.path ?? null,
      }),
    });
    const payload = (await res.json()) as { ok?: boolean; error?: string };
    setActing(null); setConfirmId(null); setAttachment(null);
    if (!res.ok) { setNotice(`❌ ${payload.error}`); return; }
    setNotice('✅ ยืนยันแล้ว');
    await load();
  }

  const pendingCount = items.filter((i) => i.status === 'pending').length;
  const pending = items.find((i) => i.id === confirmId);

  return (
    <div>
      {notice && (
        <div style={{ background: notice.startsWith('✅') ? '#e8f5e9' : '#ffebee', border: `1px solid ${notice.startsWith('✅') ? '#a5d6a7' : '#ef9a9a'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontWeight: 600, color: notice.startsWith('✅') ? '#1b5e20' : '#c62828' }}>
          {notice}
        </div>
      )}
      {pendingCount > 0 && (
        <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontWeight: 600, color: '#e65100', fontSize: 14 }}>
          ⏳ รอยืนยัน {pendingCount} รายการ
        </div>
      )}

      <div className="admin-filter-bar">
        <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          <option value="pending">⏳ รอยืนยัน</option>
          <option value="confirmed">✅ ยืนยัน</option>
          <option value="partial">⏳ ค้างบางส่วน</option>
          <option value="converted">💰 ขายแล้ว</option>
          <option value="completed">🏁 รับแล้ว</option>
          <option value="cancelled">⛔ ยกเลิก</option>
        </select>
      </div>

      {loading && <LoadingState label="กำลังโหลด…" />}
      {error   && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}

      {!loading && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>เลขที่/ช่องทาง</th><th>สมาชิก</th><th>สินค้า</th>
                <th>จำนวน</th><th>ยอด</th><th>วันนัดรับ</th>
                <th>สถานะ</th><th style={{ textAlign: 'center' }}>การดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>ไม่มีรายการจอง</td></tr>
              )}
              {items.map((r) => (
                <ReservationTableRow key={r.id} r={r} acting={acting} onAction={doAction} onClose={setCloseTarget} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm modal — with source_channel + attachment */}
      {confirmId && pending && (
        <div className="admin-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setConfirmId(null)}>
          <div className="admin-modal" style={{ maxWidth: 420 }}>
            <div className="admin-modal__header">
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>ยืนยันการจอง — {pending.reservation_no}</h2>
              <button className="admin-modal__close" onClick={() => setConfirmId(null)}>×</button>
            </div>
            <div className="admin-modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label className="reg-label">ช่องทางการจอง <span className="reg-required">*</span>
                <select className="reg-input" value={sourceChannel} onChange={(e) => setSourceChannel(e.target.value)}>
                  {SOURCE_CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <ReservationAttachmentUpload
                reservationNo={pending.reservation_no}
                value={attachment}
                onChange={setAttachment}
              />
            </div>
            <div className="admin-modal__footer">
              <button className="admin-btn admin-btn--secondary" onClick={() => setConfirmId(null)}>ยกเลิก</button>
              <button className="admin-btn admin-btn--success" onClick={submitConfirm} disabled={acting !== null}>
                {acting ? 'กำลังบันทึก…' : '✅ ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close modal — partial or full */}
      {closeTarget && (
        <ReservationCloseModal
          reservation={closeTarget}
          onClose={() => setCloseTarget(null)}
          onDone={() => { setCloseTarget(null); setNotice('✅ บันทึกสถานะจองแล้ว'); void load(); }}
        />
      )}
    </div>
  );
}
