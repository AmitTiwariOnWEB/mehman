# Architecture

Mehman is structured as a society- and corporate-focused multi-tenant SaaS platform. Mehman creates only the Admin username and password for a new client. Internally, that action creates or links the client tenant so data remains isolated. The client Admin then creates guard IDs, resident or office IDs, receptionist users, gates, towers, flats/offices, and operational settings.

## Core Boundaries

- Authentication issues short-lived access tokens and long-lived refresh tokens.
- Prisma middleware and API middleware enforce society/tenant ownership at the service layer.
- QR gatepasses contain a signed token and public pass identifier. Validation checks ownership, status, expiry, blacklist state, and duplicate entry/exit rules.
- Audit logs record security-relevant actions for enterprise traceability.
- Flat Owner users can invite visitors, while guards and receptionists handle scanning, approval, and entry/exit logging.

## Future Extensions

- AI analytics can subscribe to `entry_logs`, `visitors`, and `audit_logs`.
- OCR, face recognition, biometric, RFID, and WhatsApp integrations should live behind provider interfaces in `backend/src/services/integrations`.
- Mobile apps consume the same REST API and role-aware payloads.
