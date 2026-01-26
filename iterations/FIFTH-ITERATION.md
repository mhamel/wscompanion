# FIFTH ITERATION (Knowledge Transfer)

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
- Exports CSV “comptable-friendly”
- News + alertes (push) pour rétention + confiance

Critères de succès:
- “Time to wow” < 2 minutes après connexion SnapTrade (sync initial → P&L visible).
- Confiance: posture privacy claire (disconnect/purge), pas de fuite de secrets.

## 2) État actuel (ce qui est livré)

Monorepo avec:
- Backend API (Fastify + TS + Prisma) + worker (BullMQ)
- App mobile (Expo + React Native + TS)

### Snapshot TODO (rapide)

La source de vérité = checkboxes dans `docs/TODO_*.md`. Orientation:

- Roadmap: `docs/TODO_INDEX.md`
  - `M3-02` est **checké** (alertes end-to-end: règles + events + push + screens).
- Backend: `docs/TODO_BACKEND.md`
  - Done: Foundations, OpenAPI-first, Auth, SnapTrade connect+sync, P&L 360, Wheel, News, Alerts (incl. push delivery), Exports
  - Not done yet: `BE-082`, `BE-110..111`, `BE-120..121`, `BE-130..133`
- Mobile: `docs/TODO_MOBILE.md`
  - Done: Foundations, Auth, Home/search-first, Ticker/Transactions/Wheel/News, Alerts screens, Exports screens, Push opt-in (`FE-072`)
  - Not done yet: `FE-090..091`, `FE-100..101`, `FE-110..112`
- Privacy/Security: `docs/TODO_SECURITY_QA_OBS.md`
  - Not done yet: `SEC-010` (“Disconnect SnapTrade”: purge tokens + stop sync + UX)

## 3) Ce qui a été fait dans cette itération (delta vs FOURTH-ITERATION.md)

Cette itération est un “cleanup & validation” pour rendre le WIP prêt à être commit et repris:

- Validations OK:
  - Backend tests: `npm --workspace apps/backend test`
  - Backend build: `npm --workspace apps/backend run build`
  - Mobile typecheck: `cd apps/mobile; npx tsc --noEmit`
- Documentation alignée:
  - `ARCHITECTURE.md` précise que `apps/backend/prisma/schema.prisma` est la source de vérité (implémentation) pour le modèle de données.
  - La section conceptuelle `devices` dans `ARCHITECTURE.md` reflète maintenant la contrainte réelle (`unique(user_id, push_token)` + `last_seen_at`/`updated_at`).
- Nouveau handoff: `iterations/FIFTH-ITERATION.md`.

## 4) État git (important) + commits suggérés

Actuellement, le repo a **des changements locaux non commit**.

Résumé (non exhaustif):
- Docs: `ARCHITECTURE.md`, `docs/TODO_INDEX.md`, `docs/TODO_BACKEND.md`, `docs/TODO_MOBILE.md`
- Mobile (push opt-in): `apps/mobile/src/notifications/*`, `apps/mobile/src/screens/AlertsScreen.tsx`, `apps/mobile/src/providers/AppProviders.tsx`, `apps/mobile/src/api/client.ts`, `apps/mobile/package.json`, `package-lock.json`
- Backend (push delivery): `apps/backend/src/notifications/*`, `apps/backend/src/worker.ts`, `apps/backend/.env.example`
- Iterations: `iterations/*` (nouveau dossier) + suppression de l’ancien `FIRST-ITERATION.md` à la racine

Suggestion de découpe (après review):

1) `FE-072 push opt-in flow + notifications settings`
   - `apps/mobile/package.json`
   - `apps/mobile/src/api/client.ts`
   - `apps/mobile/src/providers/AppProviders.tsx`
   - `apps/mobile/src/screens/AlertsScreen.tsx`
   - `apps/mobile/src/notifications/*`
   - `docs/TODO_MOBILE.md`
   - `package-lock.json`

2) `BE-093 alerts push delivery worker (Expo) + docs`
   - `apps/backend/src/worker.ts`
   - `apps/backend/src/notifications/*` (+ tests)
   - `apps/backend/.env.example`
   - `docs/TODO_BACKEND.md`
   - `docs/TODO_INDEX.md` (M3-02 check)

3) `docs(iterations) move iteration docs under iterations/`
   - `iterations/*` (incl. ce fichier)
   - supprimer `FIRST-ITERATION.md` (racine)
   - `ARCHITECTURE.md` (note “source de vérité” + section devices)

Note: `npm run api:check` exige un `git diff` clean; il échouera tant que la working tree n’est pas clean.

## 5) Où regarder (entry points “haute valeur”)

Backend:
- API bootstrap: `apps/backend/src/api.ts`
- Routes: `apps/backend/src/server.ts`
- Worker (queues/schedules/jobs): `apps/backend/src/worker.ts`
- Alerts API: `apps/backend/src/routes/alerts.ts`
- Devices API: `apps/backend/src/routes/devices.ts`
- Expo push client: `apps/backend/src/notifications/expoPush.ts`
- Prisma schema: `apps/backend/prisma/schema.prisma`

Mobile:
- Navigation: `apps/mobile/src/navigation/MainStack.tsx`, `apps/mobile/src/navigation/MainTabs.tsx`
- Alerts UI + push toggle: `apps/mobile/src/screens/AlertsScreen.tsx`
- Push helpers/state: `apps/mobile/src/notifications/push.ts`, `apps/mobile/src/notifications/notificationsStore.ts`
- API client: `apps/mobile/src/api/client.ts`

Contrat (OpenAPI-first):
- OpenAPI export: `packages/contract/openapi.json`
- Types mobile générés: `apps/mobile/src/api/schema.ts`
- Sync: `npm run api:generate`

## 6) Comment lancer en local (happy path)

Prérequis:
- Node + npm
- Docker

Infra (Postgres + Redis + MinIO + Mailhog):

```powershell
docker-compose up -d
```

Backend env:
- Copier `apps/backend/.env.example` → `apps/backend/.env`

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

Note (téléphone physique): `http://localhost:3000` pointe vers le téléphone, pas ton laptop.
Pour tester sur device, mettre `EXPO_PUBLIC_API_BASE_URL` sur l’IP LAN (ex: `http://192.168.x.x:3000`) via `apps/mobile/.env` (cf `apps/mobile/.env.example`).

Swagger UI: http://localhost:3000/docs

## 7) Vérif rapide push “alerts” (end-to-end)

1) Sur un device physique, ouvrir `Alerts` → activer `Push` (crée un `Device` en DB via `POST /v1/devices/register`).
2) Créer une règle `news_spike` avec seuils faibles (ex: `minArticles=1`).
3) Configurer `NEWS_RSS_FEEDS_JSON` (dans `apps/backend/.env`) et laisser tourner le worker:
   - `news-scan` ingère des items
   - `alerts-evaluate` crée `AlertEvent`
   - `alerts-deliver` envoie la push + set `AlertEvent.deliveredAt`

Env knobs (delivery):
- `ALERTS_DELIVERY_SCHEDULE_EVERY_SECONDS` (default 60)
- `ALERTS_DELIVERY_MAX_AGE_HOURS` (default 48)
- `EXPO_PUSH_ACCESS_TOKEN` (optionnel; utile prod)

## 8) Limitations connues (à garder en tête)

- Alerts evaluation: seul `news_spike` est réellement déclenché par le worker aujourd’hui.
- Delivery: au niveau “event” (pas de tracking par device). Un ticket Expo `ok` marque l’event comme livré.
- Mobile: pas de deep link au tap de notification, pas de custom foreground handler.
- Trust/privacy: `SEC-010` Disconnect SnapTrade n’est pas implémenté.

## 9) Prochaines étapes (priorisées)

Priorité A (trust + rétention):
1) `SEC-010` Disconnect SnapTrade (purge tokens + stop sync + UX mobile).
2) Étendre alerts (earnings/expiry/price move), améliorer copy push + deep links.

Priorité B (exports qualité):
3) Fix “prepare my year” sur `pnl_realized_by_ticker` (year slicing depuis transactions) — voir `apps/backend/src/exports/csv.ts`.

Priorité C (monétisation):
4) RevenueCat entitlements + feature gates (`BE-110..111`, `FE-100..101`).

## 10) Commandes de validation

- Backend tests: `npm --workspace apps/backend test`
- Backend build: `npm --workspace apps/backend run build`
- Mobile typecheck: `cd apps/mobile; npx tsc --noEmit`

