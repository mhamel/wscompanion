# SEVENTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Objectif de ce document: donner au prochain une reprise **autonome** (objectif produit, ce qui est livré, où regarder, comment lancer, état git, quoi faire ensuite).

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

Règle d’or: **un TODO à la fois**. Implémenter → valider → cocher le TODO → commit → suivant.

Note (Windows/encoding): si le Markdown semble “garbled” dans PowerShell, lire avec `Get-Content -Encoding utf8 ...`.

## 1) Objectif du projet (le “pourquoi”)

App compagnon (mobile) qui se connecte à Wealthsimple via **SnapTrade** (lecture seule par défaut) et donne 2–3 features “power user”:

- P&L 360 par ticker (le “wow”)
- Wheel / covered calls tracker
- Exports “comptable-friendly”
- News + alertes (push) pour rétention + confiance

Critères de succès:
- “Time to wow” < 2 minutes après connexion SnapTrade (sync initial → P&L visible).
- Confiance: posture privacy claire (disconnect/purge), pas de fuite de secrets.

## 2) Ce qui a été fait dans cette itération

Objectif atteint: `SEC-011` + `FE-111` (trust/privacy + Settings).

### Backend (API + worker)

- `DELETE /v1/me` (suppression compte):
  - soft-delete (`User.deletedAt`) + **purge** des données user-owned (sessions/devices/entitlements/preferences, portefeuille, agrégats, wheel, alerts, exports, connections, sync runs).
  - email “scrambled” (`deleted+...@deleted.invalid`) pour permettre un futur re-signup sur la même adresse.
  - suppression best-effort des objets exports S3 (keys DB).
  - suppression des OTPs (`AuthOtp`) liés à l’email d’origine (PII).
- Auth guard:
  - `authenticate` refuse un user `deletedAt != null` (401 `ACCOUNT_DELETED`).
- Preferences:
  - `GET /v1/preferences` → `baseCurrency`
  - `PUT /v1/preferences` → update `baseCurrency`
- Export “mes données”:
  - Nouveau type export `user_data` + format `json`, via la pipeline existante `/v1/exports` + worker.

### Mobile (Expo)

- Nouveau `SettingsScreen`:
  - mise à jour `baseCurrency`
  - export “mes données” (crée un job `user_data` JSON puis ouvre `Exports`)
  - accès `Connexions SnapTrade`
  - suppression compte (confirmation + logout local)
- Wiring navigation:
  - `Paramètres` accessible depuis `Portfolio` → bouton `Paramètres`.

### Docs / contrat

- Backlog mis à jour:
  - `docs/TODO_SECURITY_QA_OBS.md` → `SEC-011` coché.
  - `docs/TODO_MOBILE.md` → `FE-111` coché.
- Doc arch:
  - `ARCHITECTURE.md` inclut désormais `DELETE /v1/me` et `/v1/preferences`.
- Contrat OpenAPI + types régénérés via `npm run api:generate`:
  - `packages/contract/openapi.json`
  - `apps/mobile/src/api/schema.ts`

## 3) Où regarder (entry points “haute valeur”)

Backend:
- Auth + suppression compte: `apps/backend/src/routes/auth.ts`
- Preferences: `apps/backend/src/routes/preferences.ts`
- Exports (type/format): `apps/backend/src/routes/exports.ts`, `apps/backend/src/exports/types.ts`
- Export JSON generator: `apps/backend/src/exports/json.ts`
- S3 delete helper: `apps/backend/src/exports/s3.ts`
- Auth guard deleted user: `apps/backend/src/server.ts`
- Worker export/sync safeguards: `apps/backend/src/worker.ts`

Mobile:
- Screen: `apps/mobile/src/screens/SettingsScreen.tsx`
- Navigation: `apps/mobile/src/navigation/MainStack.tsx`
- Entrée UX: `apps/mobile/src/screens/PortfolioScreen.tsx`
- Client API: `apps/mobile/src/api/client.ts`

## 4) Comment valider rapidement

### Contrat

```powershell
npm run api:generate
```

### Backend

```powershell
npm --workspace apps/backend test
npm --workspace apps/backend run build
```

### Mobile

```powershell
cd apps/mobile; npx tsc --noEmit
```

## 5) Comment lancer en local (happy path)

Prérequis:
- Node + npm
- Docker

Infra (Postgres + Redis + MinIO + Mailhog):

```powershell
docker-compose up -d
```

Backend env:
- Copier `apps/backend/.env.example` → `apps/backend/.env` (créer bucket MinIO si nécessaire).

DB migrate:

```powershell
npm --workspace apps/backend run db:migrate
```

Run API:

```powershell
npm --workspace apps/backend run dev
```

Run worker:

```powershell
npm --workspace apps/backend run dev:worker
```

Run mobile:

```powershell
npm --workspace apps/mobile start
```

Swagger UI: http://localhost:3000/docs

## 6) Notes importantes / limites connues

- Export `user_data`:
  - volontairement “MVP” (gros payload) et **capé** via `take` sur certaines tables dans `apps/backend/src/exports/json.ts`.
  - nécessite S3/MinIO configuré (cf `apps/backend/.env.example`) + bucket existant.
- Suppression compte:
  - purge DB synchronement; suppression S3 best-effort (failures loggées, mais on continue).
  - les données globales non user-owned (ex: `NewsItem`) ne sont pas supprimées (pas du scope privacy).
- Support:
  - email `support@justlovethestocks.local` est un placeholder.

## 7) Prochaines étapes (priorisées)

Priorité A (qualité/obs):
1) `FE-112` Observabilité mobile (Sentry) + états offline/timeout.
2) `QA-001` Stratégie tests + ajouter tests d’intégration pour `DELETE /v1/me` (DB + purge).

Priorité B (monétisation):
3) `M3-03` RevenueCat entitlements + gating clair (`BE-110..111`, `FE-100..101`).

Priorité C (assistant premium):
4) `BE-120..121` + `FE-090..091`.
