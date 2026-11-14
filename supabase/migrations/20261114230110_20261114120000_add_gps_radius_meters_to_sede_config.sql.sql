/*
# Add gps_radius_meters to sede_config

1. Changes
- Adds column `gps_radius_meters` (integer, not null, default 100) to `sede_config`.
- This stores the GPS check-in radius in meters, configurable from the admin Test Mode panel.
- Existing rows get the default value of 100 meters automatically.
2. Security
- No new tables or policies. Existing RLS and grants on sede_config remain unchanged.
3. Notes
- The column defaults to 100 so all current sede_config rows are immediately valid.
- The frontend reads this value and passes it to the geolocation check during check-in.
*/

ALTER TABLE sede_config
  ADD COLUMN IF NOT EXISTS gps_radius_meters integer NOT NULL DEFAULT 100;
