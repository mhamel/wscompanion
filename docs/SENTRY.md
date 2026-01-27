# Sentry (observabilité) — Setup

Objectif: capter les erreurs/crash **mobile + backend** avec un identifiant de **release** partagé, et permettre la symbolication backend via **sourcemaps**.

## Mobile (Expo)

Déjà câblé côté app (voir `apps/mobile/src/observability/sentry.ts`).

Variables:
- `EXPO_PUBLIC_SENTRY_DSN` — DSN Sentry (si vide: no-op)
- `EXPO_PUBLIC_APP_ENV` — ex: `development`, `staging`, `production`

## Backend (API + worker)

Déjà câblé côté backend (voir `apps/backend/src/observability/sentry.ts`).

Variables runtime:
- `SENTRY_DSN` — DSN Sentry (si vide: no-op)
- `SENTRY_ENVIRONMENT` — ex: `development`, `staging`, `production` (fallback: `NODE_ENV`)
- `SENTRY_RELEASE` — id de release (recommandé: git SHA, identique pour API + worker)
- `SENTRY_SERVER_NAME` — optionnel (nom du host/container)

Tags/attributs utiles (pour filtres & alerting):
- `service=backend` (global)
- `component=api` sur erreurs API
- `component=worker` sur erreurs worker
- `queue=sync|analytics|news|alerts|exports` (worker)
- `job=<job.name>` (worker)

## Sourcemaps backend (CI/CD)

Pré-requis (Sentry CLI):
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_RELEASE`

Commande (PowerShell):

```powershell
npm --workspace apps/backend run build

$env:SENTRY_RELEASE = (git rev-parse HEAD).Trim()
$env:SENTRY_ORG = "your-org"
$env:SENTRY_PROJECT = "your-project"
$env:SENTRY_AUTH_TOKEN = "your-token"

npm --workspace apps/backend run sentry:upload-sourcemaps
```

Note: la symbolication backend suppose que les stacktraces pointent vers `app:///dist/...` (géré par `beforeSend`).

## Alerting (recommandations)

À configurer dans Sentry (côté produit/ops):
- **Error rate** sur `service=backend` (API + worker)
- **New issue** sur `component=worker` (jobs failures)
- **Spike** sur `queue=sync` (indicateur de dégradation provider/sync)

