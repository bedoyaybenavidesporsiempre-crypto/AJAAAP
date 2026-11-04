/*
# Create notifications and specialties tables

## 1. New Tables

### notifications
- Stores real-time notifications sent to doctors when appointments are scheduled.
- `id` (uuid, primary key)
- `doctor_cedula` (text, FK to users.cedula) — the doctor who receives the notification
- `appointment_id` (uuid, FK to appointments.id, nullable) — the related appointment
- `message` (text) — the notification message text
- `patient_name` (text) — patient name for quick display
- `scheduled_date` (text) — appointment date
- `scheduled_time` (text) — appointment time
- `is_read` (boolean, default false) — whether the doctor has read it
- `created_at` (timestamptz, default now())

### specialties
- Stores medical specialties that can be dynamically created by admins.
- `id` (uuid, primary key)
- `name` (text, unique, not null) — the specialty name
- `created_at` (timestamptz, default now())

## 2. Seed Data
- Inserts the 4 default specialties that were previously hardcoded:
  'Médico General', 'Médico Especialista', 'Laboratorio - Ejecución', 'Laboratorio - Entrega de Resultados'

## 3. Security (RLS)
- Both tables use `TO anon, authenticated` policies (no Supabase Auth — the app uses cedula-based login).
- All CRUD operations allowed for anon + authenticated since the app manages access control in the frontend by role.
*/

-- ============================================================
-- notifications table
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_cedula text NOT NULL REFERENCES users(cedula) ON DELETE CASCADE,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  message text NOT NULL,
  patient_name text NOT NULL,
  scheduled_date text,
  scheduled_time text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_notifications" ON notifications;
CREATE POLICY "anon_select_notifications" ON notifications FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_notifications" ON notifications;
CREATE POLICY "anon_insert_notifications" ON notifications FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_notifications" ON notifications;
CREATE POLICY "anon_update_notifications" ON notifications FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_notifications" ON notifications;
CREATE POLICY "anon_delete_notifications" ON notifications FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- specialties table
-- ============================================================
CREATE TABLE IF NOT EXISTS specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE specialties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_specialties" ON specialties;
CREATE POLICY "anon_select_specialties" ON specialties FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_specialties" ON specialties;
CREATE POLICY "anon_insert_specialties" ON specialties FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_specialties" ON specialties;
CREATE POLICY "anon_update_specialties" ON specialties FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_specialties" ON specialties;
CREATE POLICY "anon_delete_specialties" ON specialties FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- Seed default specialties (idempotent)
-- ============================================================
INSERT INTO specialties (name) VALUES
  ('Médico General'),
  ('Médico Especialista'),
  ('Laboratorio - Ejecución'),
  ('Laboratorio - Entrega de Resultados')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- Index for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_notifications_doctor_cedula ON notifications(doctor_cedula);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(doctor_cedula, is_read);
