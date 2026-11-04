/*
# Create doctor_availability table for weekly schedule management

## Changes
1. New table `doctor_availability` stores each doctor's weekly availability
   - One row per doctor (keyed by doctor cedula)
   - JSONB columns for available days and time slots
   - `daily_capacity` controls how many appointments per day before it shows as "full" (red)
2. RLS enabled with anon+authenticated CRUD (single-tenant app, no auth)
3. Seed data: Dr. Mario (12345678) available Mon-Fri 08:00-12:00 with capacity 10

## Security
- RLS enabled, anon+authenticated full CRUD (app uses anon key, no sign-in)
*/

CREATE TABLE IF NOT EXISTS doctor_availability (
  doctor_cedula text PRIMARY KEY REFERENCES users(cedula) ON DELETE CASCADE,
  available_days integer[] NOT NULL DEFAULT '{}',
  start_hour text NOT NULL DEFAULT '08:00',
  end_hour text NOT NULL DEFAULT '12:00',
  daily_capacity integer NOT NULL DEFAULT 10,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE doctor_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_doctor_availability" ON doctor_availability;
CREATE POLICY "anon_select_doctor_availability" ON doctor_availability FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_doctor_availability" ON doctor_availability;
CREATE POLICY "anon_insert_doctor_availability" ON doctor_availability FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_doctor_availability" ON doctor_availability;
CREATE POLICY "anon_update_doctor_availability" ON doctor_availability FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_doctor_availability" ON doctor_availability;
CREATE POLICY "anon_delete_doctor_availability" ON doctor_availability FOR DELETE
  TO anon, authenticated USING (true);

-- Seed: Dr. Mario available Mon-Fri (1-5), 08:00-12:00, capacity 10
INSERT INTO doctor_availability (doctor_cedula, available_days, start_hour, end_hour, daily_capacity)
VALUES ('12345678', '{1,2,3,4,5}', '08:00', '12:00', 10)
ON CONFLICT (doctor_cedula) DO NOTHING;