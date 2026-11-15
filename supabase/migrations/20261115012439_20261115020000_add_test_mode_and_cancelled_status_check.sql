/*
# Add test_mode column and allow 'cancelled' status

1. Modified Tables
- `appointments`
  - Updated CHECK constraint `appointments_status_check` to include 'cancelled'.
- `sede_config`
  - `test_mode` (boolean, default false): When true, bypasses time-based blocking
    (check-in cutoff and doctor waiting room 5 PM limit).

2. Security
- No new tables. No new grants needed. Existing policies and grants cover the new column.

3. Notes
- The old status constraint is dropped and recreated with 'cancelled' added.
- test_mode is nullable-safe: defaults to false, existing rows unaffected.
*/

ALTER TABLE sede_config
  ADD COLUMN IF NOT EXISTS test_mode boolean NOT NULL DEFAULT false;

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status = ANY (ARRAY['scheduled', 'checked-in', 'called', 'in-attendance', 'attended', 'absent', 'rescheduled', 'cancelled']));
