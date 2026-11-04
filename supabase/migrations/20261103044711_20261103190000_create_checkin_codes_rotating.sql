/*
# Sistema de Check-in Rotatorio con Códigos QR / PIN

1. Obósito
- Crea la tabla `checkin_codes` que almacena un código de check-in rotatorio (PIN de 4 dígitos + QR).
- El código se actualiza automáticamente cada 5 minutos mediante pg_cron.
- La aplicación de paciente valida la llegada comparando el PIN o el QR contra esta tabla.
- La vista `/pantalla` (TV/tablet) muestra el código activo en grande para que los pacientes hagan check-in.

2. Nueva Tabla: `checkin_codes`
- `id` (integer, primary key, siempre 1 — singleton)
- `pin` (text, 4 dígitos numéricos, NOT NULL)
- `qr_code` (text, identificador único, NOT NULL)
- `expires_at` (timestamptz, NOT NULL) — fecha/hora de expiración del código actual
- `updated_at` (timestamptz, NOT NULL, default now())

3. Función: `rotate_checkin_code()`
- Genera un nuevo PIN aleatorio de 4 dígitos y un código QR único.
- Actualiza `expires_at` a ahora + 5 minutos.
- Retorna el nuevo PIN.
- Usa `SECURITY DEFINER` con `search_path = public` para ejecutarse desde pg_cron.

4. Programación con pg_cron
- Ejecuta `rotate_checkin_code()` cada 5 minutos.
- El trabajo se reemplaza de forma idempotente para evitar duplicados.

5. Seguridad
- RLS habilitado en `checkin_codes`.
- Acceso completo para `anon` y `authenticated` (la app de paciente y la vista TV necesitan leer el código actual).
- La función `rotate_checkin_code()` se revoca de PUBLIC/anon/authenticated — solo pg_cron la invoca.
*/

CREATE TABLE IF NOT EXISTS checkin_codes (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pin text NOT NULL,
  qr_code text NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE checkin_codes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON checkin_codes TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_checkin_codes" ON checkin_codes;
CREATE POLICY "anon_select_checkin_codes" ON checkin_codes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_checkin_codes" ON checkin_codes;
CREATE POLICY "anon_insert_checkin_codes" ON checkin_codes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_checkin_codes" ON checkin_codes;
CREATE POLICY "anon_update_checkin_codes" ON checkin_codes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_checkin_codes" ON checkin_codes;
CREATE POLICY "anon_delete_checkin_codes" ON checkin_codes FOR DELETE
  TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.rotate_checkin_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_pin text;
  new_qr text;
  chars text[] := ARRAY['0','1','2','3','4','5','6','7','8','9'];
BEGIN
  -- Generar PIN de 4 dígitos
  new_pin := '';
  FOR i IN 1..4 LOOP
    new_pin := new_pin || chars[1 + floor(random() * 10)::int];
  END LOOP;

  -- Generar código QR único (alfanumérico de 12 caracteres)
  new_qr := '';
  FOR i IN 1..12 LOOP
    new_qr := new_qr || substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
                              1 + floor(random() * 36)::int, 1);
  END LOOP;

  -- Upsert del singleton
  INSERT INTO checkin_codes (id, pin, qr_code, expires_at, updated_at)
  VALUES (1, new_pin, new_qr, now() + interval '5 minutes', now())
  ON CONFLICT (id) DO UPDATE
  SET pin = new_pin,
      qr_code = new_qr,
      expires_at = now() + interval '5 minutes',
      updated_at = now();

  RETURN new_pin;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.rotate_checkin_code() FROM PUBLIC, anon, authenticated;

-- Inicializar el primer código
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM checkin_codes WHERE id = 1) THEN
    PERFORM public.rotate_checkin_code();
  END IF;
END
$do$;

-- Programar rotación cada 5 minutos con pg_cron
DO $do$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'rotate_checkin_code';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'rotate_checkin_code',
    '*/5 * * * *',
    'SELECT public.rotate_checkin_code();'
  );
END
$do$;