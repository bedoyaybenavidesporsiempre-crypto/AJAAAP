/*
# Añadir campo is_active a sede_config

Controla si el check-in está activo o pausado (fin de jornada).
- true (default): check-in activo, funcionalidad normal.
- false: check-in pausado, se muestra "Recepción Cerrada".
*/

ALTER TABLE sede_config
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
