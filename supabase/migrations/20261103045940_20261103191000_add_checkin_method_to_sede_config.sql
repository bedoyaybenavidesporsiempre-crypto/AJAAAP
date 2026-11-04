/*
# Añadir columna checkin_method a sede_config

1. Cambios
- Añade `checkin_method` (text, default 'gps') a `sede_config`.
- Valores permitidos: 'gps' o 'code'.
- 'gps' = check-in por geolocalización (comportamiento existente).
- 'code' = check-in por código rotatorio PIN/QR (nuevo).

2. Seguridad
- Sin cambios en RLS ni políticas. La columna es accesible mediante los grants existentes.
*/

ALTER TABLE sede_config
  ADD COLUMN IF NOT EXISTS checkin_method text NOT NULL DEFAULT 'gps'
  CHECK (checkin_method IN ('gps', 'code'));
