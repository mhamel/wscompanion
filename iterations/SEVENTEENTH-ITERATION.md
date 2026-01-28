# SEVENTEENTH ITERATION (Knowledge Transfer)

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
- Analytics:
  - Plan events: `docs/ANALYTICS_EVENTS.md`
  - Impl PostHog + insights: `docs/ANALYTICS.md`

Règle d’or: **un TODO à la fois**. Implémenter → valider → cocher le TODO → commit → suivant.

## 1) Objectif du projet (rappel)

Companion mobile (Expo) connecté à Wealthsimple via SnapTrade (lecture seule par défaut) avec:
- P&L 360 par ticker (time-to-wow < 2 min après connexion)
- Wheel / covered calls tracker
- Exports “comptable-friendly”
- News + alertes (push)
- Paywall Pro (RevenueCat) + entitlements côté backend

## 2) Ce qui a été fait dans cette itération

Objectif atteint: **AN-002** — funnels & dashboards PostHog (guides) + ajout d’un event récurrent pour mesurer la rétention.

### Event récurrent: `app_opened` (mobile)

- Nouvel event `app_opened` (sans PII) émis côté mobile:
  - au démarrage (“startup”)
  - au retour en foreground (“foreground”)
  - seulement si l’utilisateur est authentifié (JWT requis par `POST /v1/analytics/event`)
- Throttle simple (5s) pour éviter les doublons immédiats.
- Event autorisé côté backend (enum des events analytics produit) → export OpenAPI mis à jour.

### Documentation / backlog

- `docs/ANALYTICS_EVENTS.md` inclut maintenant `app_opened` (rétention/sessions) + couverture mise à jour.
- `docs/ANALYTICS.md` décrit maintenant l’insight “Rétention hebdo” basé sur `app_opened`.
- `docs/TODO_SECURITY_QA_OBS.md`: `AN-002` est coché.

## 3) Où regarder (entry points “haute valeur”)

Mobile:
- Emission `app_opened`: `apps/mobile/src/navigation/RootNavigator.tsx`
- Liste/type des events: `apps/mobile/src/analytics/analytics.ts`

Backend:
- Liste/validation des events: `apps/backend/src/observability/productAnalytics.ts`
- Endpoint ingest events: `apps/backend/src/routes/analytics.ts`

Contract:
- OpenAPI: `packages/contract/openapi.json`
- Client types: `apps/mobile/src/api/schema.ts`

Docs:
- Events: `docs/ANALYTICS_EVENTS.md`
- Dashboards/insights: `docs/ANALYTICS.md`

## 4) Comment valider rapidement

### API/contract

```powershell
npm run api:generate
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

### Smoke PostHog (optionnel)

Pré-requis:
- Backend: définir `POSTHOG_API_KEY` (+ `POSTHOG_HOST` si besoin), `ANALYTICS_DISABLED=false`
- Mobile: définir `EXPO_PUBLIC_ANALYTICS_ENABLED=true`

Puis:
1) Ouvrir l’app (déjà login) → vérifier `app_opened` (avec `reason=startup`)
2) Mettre l’app en background puis revenir → vérifier `app_opened` (avec `reason=foreground`)

## 5) Notes importantes / limites connues

- `app_opened` est émis **après auth** (par design: endpoint analytics auth-only). Donc pas de “app opened” avant session.
- L’event peut arriver plusieurs fois par jour (retours foreground). C’est OK pour PostHog (rétention/stickiness se base sur utilisateurs actifs, pas le nombre brut d’events).

## 6) Prochaines étapes (priorisées)

Priorité A (observabilité):
1) `OBS-002` / `BE-131` — OpenTelemetry (API → DB → providers) + propagation context.

Priorité B (sécurité):
2) `SEC-001` threat model + `SEC-012` classification données (PII/secrets/finance) + règles de logging/analytics.

Priorité C (analytics):
3) Ajouter `app_version` / `build_number` aux events si besoin (segmentation releases).

## 7) Git / livraison

- Branche: `main`
- Commit principal (cette itération): `458a221` (analytics: app_opened + retention dashboards (AN-002))

