/*
# Add doctor_disabled_days table

## Changes
1. New table `doctor_disabled_days`
   - Composite PK (doctor_cedula, disabled_date)
   - Stores weekdays the doctor explicitly deselected from their default-available schedule
   - FK to users(cedula) with cascade delete
2. RLS enabled with anon+authenticated CRUD (single-tenant app, no auth)

## Security
- RLS enabled, anon+authenticated full CRUD (app uses anon key, no sign-in)
- 4 separate policies (select/insert/update/delete), no FOR ALL

## Notes
1. Weekdays (Mon-Fri) are considered available by default.
2. When a doctor deselects a weekday, a row is added here so the auto-seed
   does not re-enable it on the next calendar open.
3. When a doctor re-selects a disabled weekday, the row is removed and a
   doctor_schedule row is inserted so appointments can be booked.
*/

CREATE TABLE IF NOT EXISTS doctor_disabled_days (
  doctor_cedula text NOT NULL REFERENCES users(cedula) ON DELETE CASCADE,
  disabled_date text NOT NULL,
  PRIMARY KEY (doctor_cedula, disabled_date)
);

ALTER TABLE doctor_disabled_days ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON doctor_disabled_days TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_doctor_disabled_days" ON doctor_disabled_days;
CREATE POLICY "anon_select_doctor_disabled_days" ON doctor_disabled_days FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_doctor_disabled_days" ON doctor_disabled_days;
CREATE POLICY "anon_insert_doctor_disabled_days" ON doctor_disabled_days FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_doctor_disabled_days" ON doctor_disabled_days;
CREATE POLICY "anon_update_doctor_disabled_days" ON doctor_disabled_days FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_doctor_disabled_days" ON doctor_disabled_days;
CREATE POLICY "anon_delete_doctor_disabled_days" ON doctor_disabled_days FOR DELETE
  TO anon, authenticated USING (true);
