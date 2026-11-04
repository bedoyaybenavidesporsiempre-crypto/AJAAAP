/*
# Add checkin_method column to appointments

1. Purpose
- Records how each patient checked in: by GPS geolocation or by QR/PIN code.
- Lets the doctor panel show the patient's live distance ONLY when check-in was by GPS,
  and hide it when the patient used QR/PIN (no GPS position to show).

2. Changes
- ALTER TABLE appointments ADD COLUMN checkin_method text NOT NULL DEFAULT 'gps'
  CHECK (checkin_method IN ('gps','code'))
- Existing rows default to 'gps' (the original check-in method before QR/PIN existed).

3. Security
- No new tables, no RLS changes. Existing policies on appointments already cover
  INSERT/UPDATE/SELECT/DELETE for authenticated users.
*/

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS checkin_method text NOT NULL DEFAULT 'gps'
  CHECK (checkin_method IN ('gps','code'));
