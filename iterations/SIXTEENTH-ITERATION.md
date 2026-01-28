# SIXTEENTH ITERATION (Knowledge Transfer)

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
- Sentry (setup): `docs/SENTRY.md`
- Analytics (events + impl): `docs/ANALYTICS_EVENTS.md`, `docs/ANALYTICS.md`

Règle d’or: **un TODO à la fois**. Implémenter → valider → cocher le TODO → commit → suivant.

## 1) Objectif du projet (rappel)

Companion mobile (Expo) connecté à Wealthsimple via SnapTrade (lecture seule par défaut) avec:
- P&L 360 par ticker (time-to-wow < 2 min après connexion)
- Wheel / covered calls tracker
- Exports “comptable-friendly”
- News + alertes (push)
- Paywall Pro (RevenueCat) + entitlements côté backend

## 2) Ce qui a été fait dans cette itération

Objectif atteint: **AN-010** — implémentation du tracking produit + wiring PostHog (kill switch) + événements “système” côté worker/backend.

### Produit analytics (PostHog)

- Nouveau endpoint: `POST /v1/analytics/event`
  - Auth requise (JWT)
  - Backend enrichit automatiquement: `user_id` + `plan` (entitlements)
  - Forward vers PostHog (no-op si non configuré)
- Kill switch:
  - Mobile: `EXPO_PUBLIC_ANALYTICS_ENABLED=false` (défaut)
  - Backend: `POSTHOG_API_KEY` vide ou `ANALYTICS_DISABLED=true`

### Events émis (couverture code)

Mobile:
- Auth: `auth_signup_succeeded` / `auth_login_succeeded` (via `/v1/auth/verify` + `isNewUser`)
- SnapTrade connect: `connect_snaptrade_started|completed|failed`
- Paywall: `paywall_shown`, `purchase_*`, `restore_*` avec `source`
- Time-to-wow: `wow_first_pnl_viewed` (dédup côté device + `time_since_connect_ms` si dispo)

Backend/worker:
- Sync initial (worker): `sync_initial_started|completed|failed` (avec `sync_run_id`, `duration_ms`, `tx_count`, `reason`)
- Entitlements (backend): `entitlement_pro_activated` sur activation Pro via webhook RevenueCat

### Changement contract (API)

- `POST /v1/auth/verify` retourne maintenant `{ accessToken, refreshToken, isNewUser }` (backward compatible côté app, mais **contract changé**).

### Documentation

- `docs/ANALYTICS_EVENTS.md` mis à jour (couverture + kill switch).
- Nouveau: `docs/ANALYTICS.md` (implémentation PostHog + dashboards recommandés).
- `ARCHITECTURE.md` pointe vers `docs/ANALYTICS.md`.
- Backlog: ajout de `AN-010` coché dans `docs/TODO_SECURITY_QA_OBS.md`.

## 3) Où regarder (entry points “haute valeur”)

Backend:
- Endpoint tracking: `apps/backend/src/routes/analytics.ts`
- Client PostHog (API + worker): `apps/backend/src/observability/productAnalytics.ts`
- Auth verify (`isNewUser`): `apps/backend/src/routes/auth.ts`
- Sync initial events: `apps/backend/src/worker.ts`
- RevenueCat webhook event: `apps/backend/src/routes/billing.ts`

Mobile:
- Tracking wrapper: `apps/mobile/src/analytics/analytics.ts`
- Auth events: `apps/mobile/src/screens/AuthScreen.tsx`
- SnapTrade connect events: `apps/mobile/src/screens/ConnectionsScreen.tsx`
- Paywall events: `apps/mobile/src/screens/PaywallScreen.tsx` (+ navigation param `source`)
- Wow event: `apps/mobile/src/screens/HomeScreen.tsx`, `apps/mobile/src/screens/TickerScreen.tsx`

Contract:
- OpenAPI export: `packages/contract/openapi.json`
- Client types: `apps/mobile/src/api/schema.ts`

## 4) Comment valider rapidement

### API/contract

```powershell
npm run api:check
```

### Backend (tests + build + lint)

```powershell
npm --workspace apps/backend test
npm --workspace apps/backend run build
npm --workspace apps/backend run lint
```

### Mobile (typecheck)

```powershell
npx tsc -p apps/mobile/tsconfig.json --noEmit
```

### Smoke analytics (PostHog)

Pré-requis:
- Backend: définir `POSTHOG_API_KEY` (+ `POSTHOG_HOST` si besoin)
- Mobile: définir `EXPO_PUBLIC_ANALYTICS_ENABLED=true`

Puis:
1) Login → vérifier `auth_*_succeeded`
2) Connect SnapTrade → vérifier `connect_snaptrade_*` + (worker) `sync_initial_*`
3) Ouvrir Home/Ticker avec données → vérifier `wow_first_pnl_viewed`
4) Ouvrir Paywall depuis `Settings|Wheel|Alerts|Exports` → vérifier `paywall_shown` + `purchase_*`/`restore_*`

## 5) Notes importantes / limites connues

- `auth_signup_started` n’est pas émis (auth requise; nécessite `anonymous_id`/alias si on veut un vrai “started”).
- La “rétention hebdo” (AN-002) reste approximative avec les events actuels: ajouter un event récurrent type `app_opened`/`home_viewed` si on veut une vraie rétention.
- Le tracking est “best effort”: si PostHog est down, l’API ne doit pas casser (events drop).

## 6) Prochaines étapes (priorisées)

Priorité A (croissance / mesure):
1) `AN-002` — définir + créer dashboards/funnels PostHog (time-to-wow, conversion Pro, causes sync fail, rétention) + ajouter un event récurrent si besoin.

Priorité B (observabilité):
2) `OBS-002` / `BE-131` — OpenTelemetry (API → DB → providers) + propagation context.

Priorité C (sécurité / QA):
3) `SEC-001` threat model + `SEC-012` classification données (et aligner règles de logging/analytics).

## 7) Git / livraison

- Branche: `main`
- Commit principal (cette itération): `096fd6b` (analytics: PostHog tracking + /v1/analytics/event)
