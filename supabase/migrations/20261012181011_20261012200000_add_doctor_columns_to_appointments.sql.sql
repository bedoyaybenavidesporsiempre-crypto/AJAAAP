/*
# Add doctor columns to appointments table

1. Modified Tables
- `appointments`: adds three new nullable columns to persist the assigned doctor's info at the time the secretary schedules the appointment.
  - `doctor_cedula` (text, nullable) — the cédula of the assigned doctor.
  - `doctor_name` (text, nullable) — the full name of the assigned doctor.
  - `doctor_specialty` (text, nullable) — the specialty of the assigned doctor.

2. Security
- No RLS policy changes. The existing policies on `appointments` remain unchanged.

3. Important Notes
- These columns are nullable so existing appointment rows are not affected.
- The secretary panel already passes doctorCedula, doctorName, and doctorSpecialty when scheduling; this migration ensures they are persisted in the database instead of only existing in memory.
- On load, the app will use these columns to display the assigned doctor's name in the patient's appointment card. If a column is null, the app falls back to joining with the `users` table via `doctor_cedula`.
*/