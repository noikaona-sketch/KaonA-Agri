-- เพิ่ม columns สำหรับ delivery tracking MVP
ALTER TABLE public.sale_appointments
  ADD COLUMN IF NOT EXISTS truck_plate         text,
  ADD COLUMN IF NOT EXISTS estimated_trucks    int       DEFAULT 1,
  ADD COLUMN IF NOT EXISTS estimated_arrival   time,
  ADD COLUMN IF NOT EXISTS departure_at        timestamptz,
  ADD COLUMN IF NOT EXISTS arrived_at          timestamptz,
  ADD COLUMN IF NOT EXISTS queue_number        text,
  ADD COLUMN IF NOT EXISTS queued_at           timestamptz,
  ADD COLUMN IF NOT EXISTS weighing_at         timestamptz,
  ADD COLUMN IF NOT EXISTS billed_at           timestamptz,
  ADD COLUMN IF NOT EXISTS actual_qty_kg       numeric(10,2),
  ADD COLUMN IF NOT EXISTS actual_price_per_kg numeric(10,4),
  ADD COLUMN IF NOT EXISTS actual_total        numeric(12,2),
  ADD COLUMN IF NOT EXISTS bill_number         text,
  ADD COLUMN IF NOT EXISTS delivery_note       text;

-- status เพิ่ม values ใหม่
-- pending → confirmed → departed → arrived → queued → weighing → billed → cancelled
ALTER TABLE public.sale_appointments
  DROP CONSTRAINT IF EXISTS sale_appointments_status_check;

ALTER TABLE public.sale_appointments
  ADD CONSTRAINT sale_appointments_status_check
  CHECK (status IN ('pending','confirmed','departed','arrived','queued','weighing','billed','cancelled'));

-- index สำหรับ query รายวัน
CREATE INDEX IF NOT EXISTS idx_sale_appt_date ON public.sale_appointments(scheduled_date, status);
