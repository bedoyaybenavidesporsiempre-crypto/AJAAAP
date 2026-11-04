/*
# Create doctor live location table

## Plain-English summary
Stores the real-time GPS position a doctor chooses to share with patients. A doctor turns on the
"Compartir ubicación en vivo" switch in their panel; while it is on, their position is kept up to date
here. Patients only see this position when the switch is on. When it is off, the row stays with
is_sharing = false so patients fall back to the fixed care center location.

## 1. New tables
- `doctor_live_location`
  - `doctor_cedula` (text, primary key): the doctor's document number; references `users(cedula)`.
  - `lat` (double precision, nullable): last shared latitude.
  - `lng` (double precision, nullable): last shared longitude.
  - `is_sharing` (boolean, not null, default false): whether the doctor is currently sharing.
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

CREATE TABLE IF NOT EXISTS doctor_live_location (
  doctor_cedula text PRIMARY KEY REFERENCES users(cedula) ON DELETE CASCADE,
  lat double precision,
  lng double precision,
  is_sharing boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE doctor_live_location ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON doctor_live_location TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_doctor_live_location" ON doctor_live_location;
CREATE POLICY "anon_select_doctor_live_location" ON doctor_live_location FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_doctor_live_location" ON doctor_live_location;
CREATE POLICY "anon_insert_doctor_live_location" ON doctor_live_location FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_doctor_live_location" ON doctor_live_location;
CREATE POLICY "anon_update_doctor_live_location" ON doctor_live_location FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_doctor_live_location" ON doctor_live_location;
CREATE POLICY "anon_delete_doctor_live_location" ON doctor_live_location FOR DELETE
  TO anon, authenticated USING (true);
