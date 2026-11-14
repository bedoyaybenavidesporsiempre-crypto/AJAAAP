# Project memory

## Product intent & audience

- Appointment/booking app with a patient or client check-in flow.
- Users can check in to appointments via three methods: **GPS**, **PIN**, and **QR code**.

## Brand personality & voice

- Technical/internal communication is in **Spanish**.

## Visual design & UX direction

- Check-in screen presents **all three methods simultaneously** as selectable tabs (GPS, PIN, QR), each in its own panel.
- Tab-based component pattern for switching between check-in methods.

## Decisions, constraints & rationale

- Tech stack: **Vite + React + TypeScript** (`MyAppointments.tsx`).
- `CheckInMethods` was originally referenced but undefined; resolved by **defining it inline within `MyAppointments.tsx`** rather than a separate file.
- All three check-in methods are available at once (user picks a tab) rather than being mutually exclusive or sequential.

## Open questions & assumptions

- Should `CheckInMethods` be extracted into its own file for reuse across other screens?
- Are all three methods always enabled, or should availability be conditional (e.g., location permissions, appointment type)?
- Is there a shared/unified check-in component elsewhere, or is the inline version now the canonical implementation?