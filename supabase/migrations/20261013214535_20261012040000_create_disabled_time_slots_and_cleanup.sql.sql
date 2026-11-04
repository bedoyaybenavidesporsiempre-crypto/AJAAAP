CREATE TABLE IF NOT EXISTS disabled_time_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_cedula text NOT NULL REFERENCES users(cedula) ON DELETE CASCADE,
  schedule_date date NOT NULL,
  slot_time text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(doctor_cedula, schedule_date, slot_time)
);

ALTER TABLE disabled_time_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_disabled_time_slots" ON disabled_time_slots;
CREATE POLICY "anon_select_disabled_time_slots" ON disabled_time_slots FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_disabled_time_slots" ON disabled_time_slots;
CREATE POLICY "anon_insert_disabled_time_slots" ON disabled_time_slots FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_disabled_time_slots" ON disabled_time_slots;
CREATE POLICY "anon_update_disabled_time_slots" ON disabled_time_slots FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_disabled_time_slots" ON disabled_time_slots;
CREATE POLICY "anon_delete_disabled_time_slots" ON disabled_time_slots FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_disabled_slots_cedula ON disabled_time_slots(doctor_cedula);
CREATE INDEX IF NOT EXISTS idx_disabled_slots_date ON disabled_time_slots(schedule_date);

DELETE FROM appointments
WHERE status IN ('attended', 'absent')
  AND scheduled_date IS NOT NULL
  AND scheduled_date < date_trunc('month', now());