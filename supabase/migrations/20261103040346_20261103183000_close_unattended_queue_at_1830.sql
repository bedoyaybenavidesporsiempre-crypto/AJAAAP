/*
# Cierre automático de jornada para turnos no atendidos

1. Objetivo
- Habilita el programador interno de Supabase.
- Añade un cierre diario automático a las 6:30 PM, hora de Colombia.
- Elimina de `appointments` únicamente los turnos que siguen ocupando la sala de espera sin haber sido atendidos.
- Conserva los turnos atendidos, ausentes ya registrados y citas futuras programadas.

2. Estados limpiados
- `checked-in`: paciente en espera sin atención.
- `rescheduled`: paciente que no fue atendido y quedó nuevamente en la cola.
- `called`: paciente llamado que no llegó a atención antes del cierre.
- No se elimina `in-attendance`, porque representa una consulta que ya comenzó.

3. Modo de pruebas
- Cuando `sede_config.same_day_booking` está activo, la limpieza se omite por completo.
- Esto permite conservar los registros mientras se realizan demostraciones o pruebas.

4. Estado de la cola
- Después de eliminar los turnos pendientes, se limpian `current_called_id` y `countdown_ends_at` en `queue_state`.
- No se reinicia el contador de turnos ni las métricas históricas.

5. Automatización
- Programa `pg_cron` para ejecutar la función diariamente a las 23:30 UTC, equivalente a las 6:30 PM en Colombia.
- El nombre del trabajo se reemplaza de forma idempotente para evitar duplicados.

6. Seguridad
- La función usa `SECURITY DEFINER` con `search_path` fijo para ejecutar la limpieza del servidor sin depender de permisos del navegador.
- Se revoca su ejecución remota para `PUBLIC`, `anon` y `authenticated`; solo `pg_cron` debe invocarla.
*/

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE OR REPLACE FUNCTION public.close_unattended_queue()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  deleted_count integer;
BEGIN
  IF COALESCE(
    (SELECT same_day_booking FROM public.sede_config WHERE id = 1),
    false
  ) THEN
    RETURN 0;
  END IF;

  DELETE FROM public.appointments
  WHERE status IN ('checked-in', 'rescheduled', 'called');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  UPDATE public.queue_state
  SET current_called_id = NULL,
      countdown_ends_at = NULL,
      updated_at = now()
  WHERE id = 1;

  RETURN deleted_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.close_unattended_queue() FROM PUBLIC, anon, authenticated;

DO $do$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'close_unattended_queue';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'close_unattended_queue',
    '30 23 * * *',
    'SELECT public.close_unattended_queue();'
  );
END
$do$;