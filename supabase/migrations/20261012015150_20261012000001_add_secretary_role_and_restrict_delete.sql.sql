/*
# Add secretary role, admin-only delete, and secretary seed data

## Changes
1. Updates the `users` table role CHECK constraint to include 'secretary'
2. Adds a new SECURITY DEFINER function `delete_user_as_admin(p_cedula text, p_admin_cedula text)`
   that only allows deletion when p_admin_cedula matches the global admin (cedula = '1082917595')
3. Removes the anon DELETE policy on `users` so direct deletes from the client are blocked
4. Grants EXECUTE on the function to anon and authenticated roles
5. Seeds: updates admin user to Maicol Benavides (1082917595), adds secretary seed user
6. Adds `scheduled_date` column to `appointments` for appointment scheduling

## Security
- Direct DELETE from `users` table via anon key is now BLOCKED (policy removed)
- User deletion is only possible through the `delete_user_as_admin` RPC function
- The RPC function checks that the caller provides the admin's cedula, which must match '1082917595'
- Secretary role can register patients and schedule appointments but CANNOT delete users
*/

-- ============================================================
-- 1. Update role CHECK constraint to include 'secretary'
-- ============================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('doctor', 'patient', 'admin', 'secretary'));

-- ============================================================
-- 2. Add scheduled_date column to appointments
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'scheduled_date'
  ) THEN
    ALTER TABLE appointments ADD COLUMN scheduled_date date;
  END IF;
END $$;

-- ============================================================
-- 3. Remove anon DELETE policy on users (block direct deletes)
-- ============================================================
DROP POLICY IF EXISTS "anon_delete_users" ON users;

-- ============================================================
-- 4. Create SECURITY DEFINER function for admin-only user deletion
-- ============================================================
DROP FUNCTION IF EXISTS delete_user_as_admin(text, text);
CREATE OR REPLACE FUNCTION delete_user_as_admin(p_cedula text, p_admin_cedula text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_admin_cedula = '1082917595' THEN
    DELETE FROM users WHERE cedula = p_cedula;
    RETURN true;
  ELSE
    RAISE EXCEPTION 'No autorizado: solo el Administrador Global puede eliminar usuarios';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_user_as_admin(text, text) TO anon, authenticated;

-- ============================================================
-- 5. Seed data: update admin, add secretary
-- ============================================================
INSERT INTO users (cedula, name, role, sede_name) VALUES
  ('1082917595', 'Maicol Benavides', 'admin', NULL),
  ('1001', 'Secretaría', 'secretary', 'Batallón de Infantería N.5 Córdova - Santa Marta')
ON CONFLICT (cedula) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  sede_name = EXCLUDED.sede_name;