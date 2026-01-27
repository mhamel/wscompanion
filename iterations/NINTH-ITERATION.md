# NINTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Objectif de ce document: donner au prochain une reprise **autonome** (objectif produit, ce qui est livré, où regarder, comment valider, et quoi faire ensuite).

## 0) Source de vérité (à lire en premier)

- Vision produit: `PRODUIT.md`
- Architecture + contrats + flows: `ARCHITECTURE.md`
- Backlog global (entrypoint): `docs/TODO_INDEX.md`
- TODOs détaillés:
  - Backend: `docs/TODO_BACKEND.md`
  - Mobile: `docs/TODO_MOBILE.md`
  - Data/Analytics: `docs/TODO_DATA_ANALYTICS.md`
  - Platform/DevOps: `docs/TODO_PLATFORM_DEVOPS.md`
  - Security/QA/Obs: `docs/TODO_SECURITY_QA_OBS.md`
- Historique des itérations (handoffs): `iterations/*.md`
- Guide tests (QA-001): `docs/TESTING.md`

Règle d’or: **un TODO à la fois**. Implémenter → valider → cocher le TODO → commit → suivant.

## 1) Objectif du projet (rappel)

Companion mobile (Expo) connecté à Wealthsimple via SnapTrade (lecture seule par défaut) avec:
- P&L 360 par ticker (time-to-wow < 2 min après connexion)
- Wheel / covered calls tracker
- Exports “comptable-friendly”
- News + alertes (push)

## 2) Ce qui a été fait dans cette itération

Objectif atteint: `OBS-003` + `PL-032` — **Sentry backend** (API + worker) + release/sourcemaps + base d’alerting.

### Backend (API + worker)

- Ajout Sentry backend (no-op si `SENTRY_DSN` absent).
- Capture:
  - API: capture des erreurs 5xx + contexte (route, method, requestId, userId si dispo).
  - Worker: capture sur **dernier attempt** des jobs (tags `queue` + `job`).
- Sourcemaps backend:
  - `tsconfig` génère maintenant des sourcemaps (`dist/*.map`, `inlineSources`).
  - Script d’upload Sentry CLI (release + upload + finalize).

### Docs / backlog

- Nouveau doc `docs/SENTRY.md` (setup + variables + upload sourcemaps + alerting).
- Backlog mis à jour: `OBS-003` et `PL-032` cochés.

## 3) Où regarder (entry points “haute valeur”)

Backend:
- Init + capture + rewrite stackframes: `apps/backend/src/observability/sentry.ts`
- API wiring + capture startup: `apps/backend/src/api.ts`
- Capture erreurs API (5xx): `apps/backend/src/server.ts`
- Worker wiring + capture jobs: `apps/backend/src/worker.ts`
- Upload sourcemaps: `apps/backend/src/scripts/uploadSentrySourcemaps.ts`
- Env exemple: `apps/backend/.env.example`

Docs:
- Setup Sentry: `docs/SENTRY.md`
- Backlogs: `docs/TODO_SECURITY_QA_OBS.md`, `docs/TODO_PLATFORM_DEVOPS.md`

## 4) Comment valider rapidement

### Backend (tests + build)

```powershell
docker-compose up -d
npm --workspace apps/backend run db:migrate
npm --workspace apps/backend test
npm --workspace apps/backend run build
```

### Sourcemaps upload (manuel)

```powershell
npm --workspace apps/backend run build

$env:SENTRY_RELEASE = (git rev-parse HEAD).Trim()
$env:SENTRY_ORG = "your-org"
$env:SENTRY_PROJECT = "your-project"
$env:SENTRY_AUTH_TOKEN = "your-token"

npm --workspace apps/backend run sentry:upload-sourcemaps
```

## 5) Notes importantes / limites connues

- Sentry backend: activé uniquement si `SENTRY_DSN` est renseigné (sinon no-op).
- Worker: capture uniquement sur le **dernier attempt** (réduit le bruit; les retries ne spamment pas Sentry).
- Observabilité “complète” (OpenTelemetry traces/métriques) toujours à faire (cf `OBS-002`, `PL-031`, `BE-131`).

## 6) Prochaines étapes (priorisées)

Priorité A (qualité / non-régression):
1) `QA-002` — Golden files P&L 360 + wheel (non-régression calculs).

Priorité B (monétisation):
2) `M3-03` + `BE-110..111` + `FE-100..101` — RevenueCat entitlements + gating + paywall.

Priorité C (assistant premium):
3) `BE-120..121` + `FE-090..091`.

## 7) Git / livraison

- Branche: `main`
- Commit principal (cette itération): `<fill-me-after-merge>` (Sentry backend + sourcemaps + docs)

