/*
# Add weekend booking switch to sede configuration

1. Modified Tables
- `sede_config`: new column `same_day_booking` already exists; this adds `allow_weekend_booking` (boolean, not null, default false).

2. Behavior
- When false (default), Saturday and Sunday are not offered for appointments.
- When true, the app may schedule doctor availability on weekends.

3. Security
- No new tables, policies, or grants. Existing row level security on `sede_config` is unchanged.

4. Notes
- Idempotent: safe to re-run.
- No existing data is modified.
*/

ALTER TABLE sede_config ADD COLUMN IF NOT EXISTS allow_weekend_booking boolean NOT NULL DEFAULT false;
