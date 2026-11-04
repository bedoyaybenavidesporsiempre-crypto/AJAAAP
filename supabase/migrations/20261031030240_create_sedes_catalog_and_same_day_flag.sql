/*
# Create sedes catalog and same-day booking test flag

## Plain-English summary
Adds a list of selectable sedes (care locations) so the administrator can switch the active
sede from a menu. The seed list includes the Batallón center and the test sede "Universidad del
Magdalena". It also adds an on/off flag for the "Prueba Test" mode, which lets the secretary
book appointments for the current day during live demonstrations.

## 1. New tables
- `sedes`
  - `id` (uuid, primary key, generated automatically).
  - `name` (text, unique, required): sede name.
  - `address` (text, required): sede address.
  - `lat` / `lng` (double precision, required): sede coordinates.
  - `created_at` (timestamptz, default now()).

## 2. Modified tables
- `sede_config`: new column `same_day_booking` (boolean, not null, default false). When true,
  appointments may be booked for today. Existing rows are unchanged.

## 3. Security
- `sedes`: row level security enabled. The app has no sign-in, so policies and grants target
  `anon` and `authenticated`, matching the other tables.

## 4. Important notes
1. The migration is idempotent: it can be re-run safely.
2. Seed rows are inserted with ON CONFLICT DO NOTHING, so re-runs do not duplicate them.
3. No existing data is removed.
*/

CREATE TABLE IF NOT EXISTS sedes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  address text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sedes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON sedes TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_sedes" ON sedes;
CREATE POLICY "anon_select_sedes" ON sedes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_sedes" ON sedes;
CREATE POLICY "anon_insert_sedes" ON sedes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_sedes" ON sedes;
CREATE POLICY "anon_update_sedes" ON sedes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_sedes" ON sedes;
CREATE POLICY "anon_delete_sedes" ON sedes FOR DELETE
  TO anon, authenticated USING (true);

INSERT INTO sedes (name, address, lat, lng) VALUES
  ('Batallón de Infantería N.5 Córdova - Santa Marta', 'Calle 24 # 7-100 / Av. Ferrocarril, Santa Marta, Magdalena', 11.2358, -74.2083),
  ('Universidad del Magdalena', 'Santa Marta, Magdalena', 11.2255, -74.1864)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE sede_config ADD COLUMN IF NOT EXISTS same_day_booking boolean NOT NULL DEFAULT false;
