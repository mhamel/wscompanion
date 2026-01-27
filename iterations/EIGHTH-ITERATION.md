# EIGHTH ITERATION (Knowledge Transfer)

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

Objectif atteint: `FE-112` + `QA-001` (offline/timeout + observabilité mobile, et base de tests + intégration purge compte).

### Mobile (FE-112)

- Offline:
  - Bannière “Hors ligne” affichée globalement via `Screen`.
  - React Query branché sur NetInfo via `onlineManager` (évite refetch inutile quand offline).
- Timeouts:
  - Client API: timeout global (AbortController + fallback) + normalisation des erreurs réseau/timeout en `ApiError` (codes `NETWORK_ERROR` / `TIMEOUT`).
  - Config: `EXPO_PUBLIC_API_TIMEOUT_MS` (par défaut 15000ms).
- Sentry (observabilité mobile):
  - Ajout `sentry-expo` + plugin Expo.
  - Init + wrap du root component si `EXPO_PUBLIC_SENTRY_DSN` est défini.
  - Config: `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_APP_ENV`.

### Backend / QA (QA-001)

- Tests:
  - Ajout d’un test d’intégration `DELETE /v1/me` qui valide la purge DB + email “scrambled”.
  - Nouveau doc `docs/TESTING.md` (stratégie + commandes).
- CI:
  - Workflow CI démarre Postgres + Redis (services), applique `prisma migrate deploy` avant `vitest`.

## 3) Où regarder (entry points “haute valeur”)

Mobile:
- Timeout + normalisation erreurs: `apps/mobile/src/api/client.ts`
- Online/offline:
  - Hook: `apps/mobile/src/network/useIsOffline.ts`
  - UI banner: `apps/mobile/src/ui/Screen.tsx`
  - React Query onlineManager: `apps/mobile/src/query/queryClient.ts`
- Sentry:
  - Init/wrap: `apps/mobile/src/observability/sentry.ts`
  - Wiring: `apps/mobile/App.tsx`
  - Plugin: `apps/mobile/app.json`
  - Env exemple: `apps/mobile/.env.example`

Backend:
- Test purge `DELETE /v1/me`: `apps/backend/src/routes/meDelete.test.ts`
- Handler purge: `apps/backend/src/routes/auth.ts`
- CI: `.github/workflows/ci.yml`

Docs:
- Stratégie tests: `docs/TESTING.md`
- Backlog coché: `docs/TODO_MOBILE.md`, `docs/TODO_SECURITY_QA_OBS.md`

## 4) Comment valider rapidement

### Local infra

```powershell
docker-compose up -d
```

### Backend

```powershell
npm --workspace apps/backend run db:migrate
npm --workspace apps/backend test
npm --workspace apps/backend run build
```

### Mobile (typecheck)

```powershell
npx tsc -p apps/mobile/tsconfig.json --noEmit
```

### Contrat OpenAPI

```powershell
npm run api:check
```

## 5) Notes importantes / limites connues

- Sentry mobile: activé uniquement si `EXPO_PUBLIC_SENTRY_DSN` est renseigné (sinon no-op).
- Tests backend: nécessitent Postgres up + migrations appliquées (cf `docs/TESTING.md`).
- Encodage: le repo contient plusieurs chaînes/docs avec caractères “garbled” (ex: `Ã©`). À corriger plus tard si priorité UX/docs.

## 6) Prochaines étapes (priorisées)

Priorité A (observabilité complète / prod-ready):
1) `OBS-003` + `PL-032` — Sentry backend + release/sourcemaps + alerting.
2) `QA-002` — Fixtures “golden files” P&L 360 + wheel (non-régression).

Priorité B (monétisation):
3) `M3-03` + `BE-110..111` + `FE-100..101` — RevenueCat entitlements + gating + paywall.

Priorité C (assistant premium):
4) `BE-120..121` + `FE-090..091`.

## 7) Git / livraison

- Branche: `main`
- Commit(s): à renseigner après merge/commit final de cette itération (voir `git log -1`).

