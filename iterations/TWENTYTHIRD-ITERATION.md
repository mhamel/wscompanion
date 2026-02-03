# TWENTY-THIRD ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Objectif: handoff autonome (objectif produit, livré, où regarder, comment valider, next steps).

## 0) Source de vérité

- Produit: `PRODUIT.md`
- Architecture: `ARCHITECTURE.md`
- Backlog: `docs/TODO_INDEX.md`
- Sécurité/QA/Obs: `docs/TODO_SECURITY_QA_OBS.md`
- Audit logs doc: `docs/AUDIT_LOGS.md`

## 1) Ce qui a été fait

Objectif atteint: **SEC-004** — audit logs (actions sensibles) + base de rétention.

### Backend

- Nouveau modèle Prisma: `AuditEvent` + migration:
  - `apps/backend/prisma/schema.prisma`
  - `apps/backend/prisma/migrations/20260203000008_audit_events/migration.sql`
- Helper d’écriture (anti-PII):
  - `apps/backend/src/audit.ts` (`recordAuditEvent`)
  - IP + User-Agent stockés **hashés** (`sha256`) — pas de PII en clair.
- Endpoint user:
  - `GET /v1/audit/events` (pagination cursor) — `apps/backend/src/routes/audit.ts`
  - Route enregistrée dans `apps/backend/src/server.ts`
- Ajouts d’événements audit (MVP):
  - disconnect SnapTrade: `apps/backend/src/routes/connections.ts`
  - création export: `apps/backend/src/routes/exports.ts`
  - wheel actions (create/patch/close/merge/split): `apps/backend/src/routes/wheel.ts`
  - logout + delete_requested: `apps/backend/src/routes/auth.ts`
- Purge account delete:
  - `DELETE /v1/me` purge aussi `AuditEvent` (`apps/backend/src/routes/auth.ts`)
  - Test DB mis à jour: `apps/backend/src/routes/meDelete.test.ts`

### Contrat

- OpenAPI export mis à jour (`/v1/audit/events`) + types mobile régénérés:
  - `packages/contract/openapi.json`
  - `apps/mobile/src/api/schema.ts`

### Docs / backlog

- Nouveau doc: `docs/AUDIT_LOGS.md`
- `docs/TODO_SECURITY_QA_OBS.md`: `SEC-004` coché
- `docs/LOGGING.md` renvoie vers `docs/AUDIT_LOGS.md`

## 2) Comment valider

```powershell
npm --workspace apps/backend run db:generate
npm --workspace apps/backend run build
npm --workspace apps/backend test
npm --workspace apps/backend run lint
npm --workspace apps/backend run format
npm run api:check
npx tsc -p apps/mobile/tsconfig.json --noEmit
```

## 3) Notes importantes

- Les audit logs sont “support/debug”, pas une preuve légale (pas d’horodatage signé).
- La rétention est documentée mais pas encore purgée automatiquement (worker job à faire plus tard).

## 4) Next steps

1) `trustProxy` / IP handling (rate limiting derrière proxy).
2) `PL-011` CI breaking-change OpenAPI (diff PR).
3) Ask MVP (`BE-120` / `FE-090`).

## 5) Git

- Branche: `main`
- Commit: voir `git log -1` (message: `sec: add audit logs (SEC-004)`)

