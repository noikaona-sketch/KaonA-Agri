-- Delivery tracking fields (idempotent)
ALTER TABLE public.sale_appointments
  ADD COLUMN IF NOT EXISTS actual_price_per_kg numeric(10,4);

DO $$
BEGIN
  ALTER TABLE public.sale_appointments
    DROP CONSTRAINT IF EXISTS sale_appointments_status_check;
  ALTER TABLE public.sale_appointments
    ADD CONSTRAINT sale_appointments_status_check
    CHECK (status IN ('pending','confirmed','departed','arrived','queued','weighing','billed','cancelled'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_sale_appt_date
  ON public.sale_appointments(appointment_date, status);
