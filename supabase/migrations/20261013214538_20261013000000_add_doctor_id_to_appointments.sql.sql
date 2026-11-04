DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'doctor_id'
  ) THEN
    ALTER TABLE appointments ADD COLUMN doctor_id text REFERENCES users(cedula) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'doctor_name'
  ) THEN
    ALTER TABLE appointments ADD COLUMN doctor_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'appointments' AND column_name = 'doctor_specialty'
  ) THEN
    ALTER TABLE appointments ADD COLUMN doctor_specialty text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);