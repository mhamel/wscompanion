# FIFTY-NINTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): better observability/debugging for local/dev/staging, especially when running on devices (iOS).

Iteration goal: add a version endpoint so clients and devs can quickly confirm which backend build is running.

## 1) What changed

### Backend: /v1/version

- `apps/backend/src/server.ts`
  - Adds `GET /v1/version`
  - Response shape:
    - `ok: true`
    - `nodeEnv` (string)
    - optional `gitSha` (from `GIT_SHA` or `SENTRY_RELEASE`)
    - optional `release` (from `APP_RELEASE` or `SENTRY_RELEASE`)

### Tests

- `apps/backend/src/server.test.ts`
  - Adds a test validating `GET /v1/version` returns `{ ok: true, nodeEnv: string }`.

### OpenAPI regenerated

- `packages/contract/openapi.json`
- `apps/mobile/src/api/schema.ts`

## 2) Validation

- `npm --workspace apps/backend test`
- `npm run api:generate`

## 3) Next steps

- Optional: expose `/v1/version` in the mobile Dev diagnostics (Settings) to show backend git SHA/release.
- Optional: add a VS Code task `Backend: Check /v1/version`.

## 4) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

