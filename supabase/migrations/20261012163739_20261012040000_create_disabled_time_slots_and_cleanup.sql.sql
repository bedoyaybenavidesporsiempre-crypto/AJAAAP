/*
# Create disabled_time_slots table + cleanup old attended appointments

## Overview
1. Creates a new `disabled_time_slots` table so doctors can deactivate specific
   30-minute intervals on their working days (e.g. they'll attend in the morning
   but want to block 10:00-10:30 because of a meeting).
2. Deletes appointments from previous months that have status 'attended' or
   'absent' to free database space (keeps only the current month's records).

## New Tables
- `disabled_time_slots`
  - `id` (uuid, PK) — unique row ID
  - `doctor_cedula` (text, FK → users.cedula ON DELETE CASCADE) — which doctor
  - `schedule_date` (date) — the calendar day the slot belongs to
  - `slot_time` (text) — the 30-min interval in HH:MM format (e.g. '10:00')
  - `created_at` (timestamptz) — row creation time
  - Unique constraint on (doctor_cedula, schedule_date, slot_time) so the same
    slot can't be disabled twice

## Security
- RLS enabled on `disabled_time_slots` with full CRUD for `anon, authenticated`
  (same shared-data model as all other tables in this app)

## Data Cleanup
- Deletes all appointments with status 'attended' or 'absent' whose
  scheduled_date is in a month prior to the current month. This keeps the
  database lean while preserving the current month's history for reporting.
*/

-- ============================================================
-- 1. Create disabled_time_slots table
-- ============================================================
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

-- ============================================================
-- 2. Delete attended/absent appointments from previous months
-- ============================================================
DELETE FROM appointments
WHERE status IN ('attended', 'absent')
  AND scheduled_date IS NOT NULL
  AND scheduled_date < date_trunc('month', now());