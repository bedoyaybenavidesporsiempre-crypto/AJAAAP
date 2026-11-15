/*
# Add cancellation tracking columns to appointments

1. Modified Tables
- `appointments`
  - `cancelled_at` (timestamptz, nullable): Timestamp when the appointment was cancelled. NULL means not cancelled.
  - `cancelled_by` (text, nullable): Role of the user who cancelled ('patient', 'secretary'). NULL means not cancelled.

2. Security
- No new tables. Existing RLS policies on `appointments` cover UPDATE, which is what cancellation uses.
- No new grants needed.

3. Notes
- The `status` column is already `text`, so setting it to 'cancelled' works without a type change.
- These columns are nullable so existing rows are unaffected.
*/

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by text;
