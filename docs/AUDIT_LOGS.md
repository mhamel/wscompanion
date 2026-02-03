# Audit logs (SEC-004)

Objectif: conserver une trace des actions sensibles (sécurité, support, debug) sans stocker de PII/secrets.

Réf classification: `docs/DATA_CLASSIFICATION.md`

## 1) Implémentation (source de vérité)

- Table: `AuditEvent` (Prisma) — `apps/backend/prisma/schema.prisma`
- Migration: `apps/backend/prisma/migrations/20260203000008_audit_events/migration.sql`
- Helper d’écriture: `apps/backend/src/audit.ts` (`recordAuditEvent`)
- Endpoint user (lecture): `GET /v1/audit/events` — `apps/backend/src/routes/audit.ts`

Notes:

- IP et User-Agent sont stockés **hashés** (`sha256`) (`ipHashHex`, `userAgentHashHex`).
- Les `payload` doivent rester “safe” (ids internes, types, compteurs) — pas de PII/finance brute.

## 2) Événements enregistrés (MVP)

- `connections.disconnect` (entity: `broker_connection`)
- `exports.create` (entity: `export_job`)
- Wheel (entity: `wheel_cycle`)
  - `wheel.cycle_create`
  - `wheel.cycle_patch`
  - `wheel.cycle_close`
  - `wheel.cycle_merge`
  - `wheel.cycle_split`
- `auth.logout` (entity: `session`)
- `account.delete_requested` (entity: `user`)

Note: les wheel actions ont aussi un historique détaillé via `WheelAuditEvent` (domain-specific).

## 3) Rétention (MVP)

MVP: conserver 30–90 jours selon besoins support.

À implémenter plus tard:

- purge worker planifiée (job BullMQ) ou policy DB
- export “mes logs” si requis
