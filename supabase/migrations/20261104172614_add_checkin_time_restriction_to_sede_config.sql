/*
# Restricción de 30 minutos para check-in (configurable)

1. Objetivo
- Agrega un interruptor en la prueba de la aplicación para activar o desactivar la regla de check-in máximo 30 minutos antes de la cita.

2. Cambios en la tabla `sede_config`
- Nueva columna `checkin_time_restriction` (boolean, obligatoria, por defecto `true`).
- Los registros existentes quedan con la regla activa.

3. Seguridad
- No se modifican políticas ni permisos: la tabla ya tiene los permisos necesarios y la columna hereda las reglas actuales.
*/

ALTER TABLE public.sede_config
  ADD COLUMN IF NOT EXISTS checkin_time_restriction boolean NOT NULL DEFAULT true;
