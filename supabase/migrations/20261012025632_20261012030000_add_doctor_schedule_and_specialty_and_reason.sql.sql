/*
# Add doctor per-day schedule, specialty column, and appointment reason

## Overview
This migration adds three capabilities to TurnoMédico Live:
1. A `doctor_schedule` table so doctors can mark specific calendar days they will
   attend, with a start/end time range per day (replacing the old weekly-pattern
   `doctor_availability` approach).
2. A `specialty` column on `users` so doctors can have a medical specialty
   (e.g. "Medicina General") shown to patients.
3. A `reason` column on `appointments` so the secretary can record the motivo de
   consulta when scheduling, visible to the patient before check-in.

## New Tables
- `doctor_schedule`
  - `id` (uuid, PK) — unique row ID.
  - `doctor_cedula` (text, FK → users.cedula ON DELETE CASCADE) — which doctor.
  - `schedule_date` (date) — the specific calendar day the doctor will attend.
  - `start_hour` (text) — start time HH:MM.
  - `end_hour` (text) — end time HH:MM.
  - `created_at` (timestamptz) — row creation time.
  - Unique constraint on (doctor_cedula, schedule_date) so each doctor has at most
    one availability entry per day.

## Modified Tables
- `users` — adds `specialty` (text, nullable) column. Only meaningful for doctors.
- `appointments` — adds `reason` (text, nullable) column for the motivo de consulta.

## Security
- RLS enabled on `doctor_schedule` with full CRUD for `anon, authenticated`
  (same shared-data model as all other tables in this app).
- No policy changes needed on `users` or `appointments` — existing policies use
  `USING (true)` / `WITH CHECK (true)` which already cover new columns.

## Important Notes
1. The old `doctor_availability` table remains untouched for backwards
   compatibility, but the frontend will now use `doctor_schedule` instead.
2. `specialty` is nullable so existing doctor rows are unaffected.
3. `reason` is nullable so existing appointments are unaffected.
*/

-- ============================================================
-- 1. Add specialty column to users
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'specialty'
  ) THEN
    ALTER TABLE users ADD COLUMN specialty text;
  END IF;
END $$;

-- ============================================================
-- 2. Add reason column to appointments
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'reason'
  ) THEN
    ALTER TABLE appointments ADD COLUMN reason text;
  END IF;
END $$;

-- ============================================================
-- 3. Create doctor_schedule table
-- ============================================================
CREATE TABLE IF NOT EXISTS doctor_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_cedula text NOT NULL REFERENCES users(cedula) ON DELETE CASCADE,
  schedule_date date NOT NULL,
  start_hour text NOT NULL DEFAULT '08:00',
  end_hour text NOT NULL DEFAULT '12:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(doctor_cedula, schedule_date)
);

ALTER TABLE doctor_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_doctor_schedule" ON doctor_schedule;
CREATE POLICY "anon_select_doctor_schedule" ON doctor_schedule FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_doctor_schedule" ON doctor_schedule;
CREATE POLICY "anon_insert_doctor_schedule" ON doctor_schedule FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_doctor_schedule" ON doctor_schedule;
CREATE POLICY "anon_update_doctor_schedule" ON doctor_schedule FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_doctor_schedule" ON doctor_schedule;
CREATE POLICY "anon_delete_doctor_schedule" ON doctor_schedule FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_doctor_schedule_cedula ON doctor_schedule(doctor_cedula);
CREATE INDEX IF NOT EXISTS idx_doctor_schedule_date ON doctor_schedule(schedule_date);

-- ============================================================
-- 4. Set a default specialty for existing doctors
-- ============================================================
UPDATE users SET specialty = 'Medicina General' WHERE role = 'doctor' AND specialty IS NULL;