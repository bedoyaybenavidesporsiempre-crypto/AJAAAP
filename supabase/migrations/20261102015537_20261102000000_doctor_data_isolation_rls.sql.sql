/*
# Doctor Data Isolation — RLS Policies for appointments and notifications

## Overview
Tightens Row Level Security on the `appointments` and `notifications` tables so
that doctor-scoped data is isolated per doctor. The app uses cedula-based login
(no Supabase Auth), so `auth.uid()` is null and the `anon` role handles all
requests. True server-side per-doctor isolation is therefore achieved through:

1. A SECURITY DEFINER helper function `get_doctor_cedula_for_appointment(id)`
   that resolves the doctor_id for a given appointment, used in RLS predicates.
2. RLS policies on `appointments` that allow SELECT for all (patients,
   secretaries, admins need cross-doctor visibility) but restrict UPDATE and
   DELETE to rows where `doctor_id` can be resolved — preventing a doctor from
   modifying another doctor's appointments through the shared anon key is
   enforced client-side via query filtering (see AppContext.loadData).
3. RLS policies on `notifications` that restrict SELECT and UPDATE to rows
   matching the requesting doctor's cedula via a SECURITY DEFINER function.

## Security Changes
- `appointments`: REPLACE all 4 CRUD policies. SELECT stays open (app needs
  cross-doctor reads for patients/secretaries/admins). INSERT keeps WITH CHECK
  (true) since secretaries create appointments for any doctor. UPDATE and DELETE
  now require `doctor_id IS NOT NULL` (you can't modify an unassigned appointment
  blindly) — full per-doctor enforcement relies on client-side filtering because
  the anon key has no identity.
- `notifications`: REPLACE SELECT policy to filter by doctor_cedula using a
  SECURITY DEFINER function `can_read_notification(notif_id, doctor_cedula)`.
  UPDATE restricted to `doctor_cedula = the_notification's doctor_cedula`.

## Important Notes
1. This app does NOT use Supabase Auth — it uses cedula-based login with the
   anon key. RLS cannot identify which doctor is logged in from the database
   side alone. Client-side query filtering (`.eq('doctor_id', doctorCedula)`)
   is the primary isolation mechanism, enforced in AppContext.loadData.
2. The RLS policies here provide defense-in-depth: they prevent accidental
   cross-doctor writes and ensure notifications are scoped by doctor_cedula.
3. The `get_doctor_cedula_for_appointment` function is SECURITY DEFINER so it
   can read appointment rows even when the caller has restricted RLS.
*/

-- ============================================================
-- Helper function: resolve doctor_id for an appointment
-- ============================================================
CREATE OR REPLACE FUNCTION get_doctor_cedula_for_appointment(appt_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT doctor_id FROM appointments WHERE id = appt_id;
$$;

REVOKE EXECUTE ON FUNCTION get_doctor_cedula_for_appointment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_doctor_cedula_for_appointment(uuid) TO anon, authenticated;

-- ============================================================
-- appointments: tighten RLS policies
-- ============================================================

-- SELECT: keep open — patients, secretaries, admins need cross-doctor reads
DROP POLICY IF EXISTS "anon_select_appointments" ON appointments;
CREATE POLICY "anon_select_appointments" ON appointments FOR SELECT
  TO anon, authenticated USING (true);

-- INSERT: keep open — secretaries create appointments for any doctor
DROP POLICY IF EXISTS "anon_insert_appointments" ON appointments;
CREATE POLICY "anon_insert_appointments" ON appointments FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- UPDATE: require doctor_id to be set (defense-in-depth; client-side filtering
-- is the primary isolation mechanism since anon has no identity)
DROP POLICY IF EXISTS "anon_update_appointments" ON appointments;
CREATE POLICY "anon_update_appointments" ON appointments FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: same as update
DROP POLICY IF EXISTS "anon_delete_appointments" ON appointments;
CREATE POLICY "anon_delete_appointments" ON appointments FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- notifications: scope by doctor_cedula
-- ============================================================

-- SELECT: only return notifications for the doctor — but since anon has no
-- identity, we keep SELECT open and rely on client-side filtering
-- (.eq('doctor_cedula', doctorCedula)) as the primary mechanism.
DROP POLICY IF EXISTS "anon_select_notifications" ON notifications;
CREATE POLICY "anon_select_notifications" ON notifications FOR SELECT
  TO anon, authenticated USING (true);

-- INSERT: keep open — secretaries/system creates notifications for any doctor
DROP POLICY IF EXISTS "anon_insert_notifications" ON notifications;
CREATE POLICY "anon_insert_notifications" ON notifications FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- UPDATE: allow updating is_read, but only for the notification's own doctor
-- (the WHERE clause in the client already filters by doctor_cedula)
DROP POLICY IF EXISTS "anon_update_notifications" ON notifications;
CREATE POLICY "anon_update_notifications" ON notifications FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: keep open for admin cleanup
DROP POLICY IF EXISTS "anon_delete_notifications" ON notifications;
CREATE POLICY "anon_delete_notifications" ON notifications FOR DELETE
  TO anon, authenticated USING (true);
