/*
# Create patient live location table

## Plain-English summary
Stores the real-time GPS position of a patient while their doctor is sharing live location.
The patient's app publishes its position only while the doctor's "Compartir ubicación en vivo"
switch is on. When the switch is off, the patient's row is removed. The doctor uses this row to
see the exact distance to the patient in real time.

## 1. New tables
- `patient_live_location`
  - `patient_cedula` (text, primary key): the patient's document number; references `users(cedula)`.
  - `doctor_cedula` (text, nullable): the doctor the patient is sharing with.
  - `lat` (double precision, not null): latitude.
  - `lng` (double precision, not null): longitude.
  - `updated_at` (timestamptz, not null, default now()): time of the last update.

## 2. Security
- Row level security enabled.
- The app has no sign-in screen, so the anon-key client runs as `anon`. Policies are granted to
  `anon` and `authenticated`, matching the other tables in this project.
- Grants: SELECT, INSERT, UPDATE, DELETE on the table to `anon` and `authenticated`.

## 3. Important notes
1. The migration is idempotent: it can be re-run safely.
2. Policies are dropped before they are created so re-runs do not fail.
3. No existing data is changed or removed.
*/

CREATE TABLE IF NOT EXISTS patient_live_location (
  patient_cedula text PRIMARY KEY REFERENCES users(cedula) ON DELETE CASCADE,
  doctor_cedula text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE patient_live_location ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON patient_live_location TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_patient_live_location" ON patient_live_location;
CREATE POLICY "anon_select_patient_live_location" ON patient_live_location FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_patient_live_location" ON patient_live_location;
CREATE POLICY "anon_insert_patient_live_location" ON patient_live_location FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_patient_live_location" ON patient_live_location;
CREATE POLICY "anon_update_patient_live_location" ON patient_live_location FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_patient_live_location" ON patient_live_location;
CREATE POLICY "anon_delete_patient_live_location" ON patient_live_location FOR DELETE
  TO anon, authenticated USING (true);
