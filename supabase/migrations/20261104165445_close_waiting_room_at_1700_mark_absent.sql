/*
# Cierre de sala de espera a las 5:00 PM (marcar como ausentes)

1. Objetivo
- Cambia la hora de cierre automático de la sala de espera de 6:30 PM a 5:00 PM (hora de Colombia).
- Los turnos que no fueron atendidos ya no se eliminan; su estado cambia a `absent` para que el paciente vea el mensaje de reagendar con secretaría.

2. Estados afectados
- `checked-in`, `rescheduled` y `called` pasan a `absent`.
- `in-attendance` no se modifica, porque la consulta ya comenzó.
- Las citas `scheduled`, `attended` y `absent` previas no se tocan.

3. Modo de pruebas
- Cuando `sede_config.same_day_booking` está activo, el cierre se omite por completo.

4. Estado de la cola
- Se limpian `current_called_id` y `countdown_ends_at` en `queue_state`.
- No se reinicia el contador de turnos ni las métricas históricas.

5. Automatización
- `pg_cron` ejecuta la función todos los días a las 22:00 UTC, equivalente a las 5:00 PM en Colombia.
- El trabajo se reemplaza de forma idempotente.

6. Seguridad
- La función sigue usando `SECURITY DEFINER` con `search_path` fijo.
- La ejecución remota sigue revocada para `PUBLIC`, `anon` y `authenticated`.
*/

CREATE OR REPLACE FUNCTION public.close_unattended_queue()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  updated_count integer;
BEGIN
  IF COALESCE(
    (SELECT same_day_booking FROM public.sede_config WHERE id = 1),
    false
  ) THEN
    RETURN 0;
  END IF;

  UPDATE public.appointments
  SET status = 'absent'
  WHERE status IN ('checked-in', 'rescheduled', 'called');

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  UPDATE public.queue_state
  SET current_called_id = NULL,
      countdown_ends_at = NULL,
      updated_at = now()
  WHERE id = 1;

  RETURN updated_count;
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
    '0 22 * * *',
    'SELECT public.close_unattended_queue();'
  );
END
$do$;
