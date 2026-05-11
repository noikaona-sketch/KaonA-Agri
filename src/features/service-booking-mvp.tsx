'use client';

import { useMemo, useState } from 'react';

import { EmptyState } from '@/shared/components/empty-state';
import { ErrorState } from '@/shared/components/error-state';
import { FormSheet } from '@/shared/components/form-sheet';
import { LoadingState } from '@/shared/components/loading-state';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';

type DemoState = 'default' | 'loading' | 'error' | 'empty';

type ServiceOption = {
  id: string;
  label: string;
  duration: string;
};

type TimeSlot = {
  id: string;
  label: string;
  available: boolean;
};

const services: ServiceOption[] = [
  { id: 'tractor', label: 'รถไถเตรียมดิน', duration: 'ประมาณ 2-3 ชั่วโมง' },
  { id: 'spray', label: 'ฉีดพ่น/หว่านปุ๋ย', duration: 'ประมาณ 1-2 ชั่วโมง' },
  { id: 'transport', label: 'รถขนส่งผลผลิต', duration: 'ตามระยะทางและปริมาณ' },
];

const slotsByDate: Record<string, TimeSlot[]> = {
  '2026-05-11': [
    { id: '0900', label: '09:00 - 11:00', available: true },
    { id: '1300', label: '13:00 - 15:00', available: false },
    { id: '1600', label: '16:00 - 18:00', available: true },
  ],
  '2026-05-12': [
    { id: '0830', label: '08:30 - 10:30', available: true },
    { id: '1030', label: '10:30 - 12:30', available: true },
    { id: '1500', label: '15:00 - 17:00', available: false },
  ],
};

export function ServiceBookingMVP() {
  const [selectedServiceId, setSelectedServiceId] = useState<string>(services[0].id);
  const [selectedDate, setSelectedDate] = useState<string>('2026-05-11');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('0900');
  const [notes, setNotes] = useState<string>('ช่วยเข้าทางฝั่งคลอง มีพื้นที่กลับรถ');
  const [submittedRef, setSubmittedRef] = useState<string>('');
  const [demoState, setDemoState] = useState<DemoState>('default');

  const selectedService = services.find((service) => service.id === selectedServiceId) ?? services[0];

  const slots = useMemo(() => {
    if (demoState === 'empty') return [];
    return slotsByDate[selectedDate] ?? [];
  }, [selectedDate, demoState]);

  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId && slot.available);

  function submitBooking() {
    if (!selectedSlot) return;
    const ref = `BK-${selectedDate.replaceAll('-', '').slice(2)}-${selectedSlot.id}`;
    setSubmittedRef(ref);
  }

  return (
    <>
      <FormSheet title="จองบริการเกษตร (MVP)">
        <p style={{ marginTop: 0 }}>ลำดับ: เลือกบริการ → เลือกวันที่ → ดูคิวว่าง → ส่งคำขอ (รอยืนยันจากผู้ให้บริการ)</p>

        <label>
          โหมดแสดงผล
          <select value={demoState} onChange={(event) => setDemoState(event.target.value as DemoState)}>
            <option value="default">ปกติ</option>
            <option value="loading">กำลังโหลดคิว</option>
            <option value="error">เกิดข้อผิดพลาด</option>
            <option value="empty">คิวเต็ม/ไม่มีคิว</option>
          </select>
        </label>

        {demoState === 'loading' ? <LoadingState label="กำลังโหลดคิวว่างของผู้ให้บริการ..." /> : null}
        {demoState === 'error' ? <ErrorState title="โหลดคิวไม่สำเร็จ" detail="กรุณาลองใหม่อีกครั้ง หรือติดต่อเจ้าหน้าที่" /> : null}
        {demoState === 'empty' ? <EmptyState title="ยังไม่มีคิวว่างในวันที่เลือก" detail="ลองเปลี่ยนวันที่ หรือเปลี่ยนประเภทบริการ" /> : null}

        <label>
          1) เลือกบริการ
          <select value={selectedServiceId} onChange={(event) => setSelectedServiceId(event.target.value)} disabled={demoState === 'loading'}>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.label}
              </option>
            ))}
          </select>
        </label>
        <p className="service-booking__meta">ระยะเวลางานโดยประมาณ: {selectedService.duration}</p>

        <label>
          2) เลือกวันที่ต้องการใช้บริการ
          <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} disabled={demoState === 'loading'} />
        </label>

        <p style={{ marginBottom: 8 }}>3) คิวว่างในวันที่เลือก</p>
        <div className="service-booking__card-list">
          {slots.map((slot) => (
            <button
              key={slot.id}
              type="button"
              className="service-booking__slot"
              disabled={!slot.available || demoState === 'loading'}
              onClick={() => setSelectedSlotId(slot.id)}
              data-active={selectedSlotId === slot.id}
            >
              <span>{slot.label}</span>
              <StatusChip status={slot.available ? 'approved' : 'under_review'} />
            </button>
          ))}
        </div>

        <label>
          หมายเหตุถึงผู้ให้บริการ
          <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="เช่น จุดนัดหมาย ลักษณะพื้นที่" />
        </label>

        <UIButton fullWidth onClick={submitBooking} disabled={!selectedSlot || demoState !== 'default'}>
          4) ส่งคำขอจองบริการ
        </UIButton>
      </FormSheet>

      <FormSheet title="สถานะคำขอ">
        {!submittedRef ? (
          <EmptyState title="ยังไม่ได้ส่งคำขอ" detail="เมื่อส่งคำขอแล้ว ระบบจะแสดงเลขอ้างอิงและสถานะรอยืนยัน" />
        ) : (
          <article className="service-booking__card">
            <div className="service-booking__row">
              <p className="service-booking__id">เลขคำขอ: {submittedRef}</p>
              <StatusChip status="submitted" />
            </div>
            <p className="service-booking__service">{selectedService.label}</p>
            <p className="service-booking__meta">วันที่: {selectedDate}</p>
            <p className="service-booking__meta">ช่วงเวลา: {selectedSlot?.label ?? '-'}</p>
            <p className="service-booking__meta">หมายเหตุ: {notes || 'ไม่มี'}</p>
            <p className="service-booking__meta">สถานะ: รอผู้ให้บริการยืนยันคิว</p>
          </article>
        )}
      </FormSheet>
    </>
  );
}
