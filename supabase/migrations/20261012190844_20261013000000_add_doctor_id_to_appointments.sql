/*
# Add doctor_id and doctor info columns to appointments

## Overview
The appointments table was missing the doctor-related columns that the application
needs to store the assigned doctor's information at the time the secretary schedules
an appointment. This migration adds three nullable columns:
- `doctor_id` (text, FK → users.cedula) — replaces the non-existent `doctor_cedula` column.
- `doctor_name` (text) — denormalized doctor name for quick display.
- `doctor_specialty` (text) — denormalized doctor specialty for quick display.

## Modified Tables
- `appointments`: adds `doctor_id`, `doctor_name`, `doctor_specialty` (all nullable).

## Security
- No RLS policy changes. Existing policies remain unchanged.

## Important Notes
1. `doctor_id` is a text FK to `users.cedula` (ON DELETE SET NULL) since users uses
   cedula as its primary key, not a uuid.
2. These columns are nullable so existing appointment rows are not affected.
3. The application will use `doctor_id` to JOIN with `users` for doctor info when
   `doctor_name` or `doctor_specialty` are null.
4. The previous migration that was supposed to add these columns only contained
   comments and no SQL — this is the actual column addition.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'doctor_id'
  ) THEN
    ALTER TABLE appointments ADD COLUMN doctor_id text REFERENCES users(cedula) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'doctor_name'
  ) THEN
    ALTER TABLE appointments ADD COLUMN doctor_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'doctor_specialty'
  ) THEN
    ALTER TABLE appointments ADD COLUMN doctor_specialty text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);