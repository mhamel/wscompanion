# FIFTEENTH ITERATION (Knowledge Transfer)

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

Règle d’or: **un TODO à la fois**. Implémenter → valider → cocher le TODO → commit → suivant.

## 1) Objectif du projet (rappel)

Companion mobile (Expo) connecté à Wealthsimple via SnapTrade (lecture seule par défaut) avec:
- P&L 360 par ticker (time-to-wow < 2 min après connexion)
- Wheel / covered calls tracker
- Exports “comptable-friendly”
- News + alertes (push)

## 2) Ce qui a été fait dans cette itération

Objectif atteint: `OBS-001` + `AN-001` — **conventions de logs + corrélation request_id** et **plan d’événements analytics produit**.

### Backend (observabilité)

- `request_id` standardisé:
  - le backend réutilise `x-request-id` (ou `x-correlation-id`) si fourni
  - sinon génère un UUID
  - renvoie toujours `x-request-id` dans la réponse (utile support/debug)
- Worker: passage à des logs **JSON** via Pino (au lieu de `console.*`) pour faciliter l’agrégation.
- Tests: `apps/backend/src/server.test.ts` vérifie la présence du header et la propagation quand fourni.

### Documentation

- Nouveau guide logs: `docs/LOGGING.md` (niveaux, redaction, corrélation `request_id`, conventions).
- Nouveau plan analytics events (AN-001): `docs/ANALYTICS_EVENTS.md` (funnel minimal + propriétés + règles privacy).
- `ARCHITECTURE.md` pointe vers ces docs (observabilité & analytics).
- Backlog mis à jour: `OBS-001` et `AN-001` cochés dans `docs/TODO_SECURITY_QA_OBS.md`.

## 3) Où regarder (entry points “haute valeur”)

Backend:
- Request id + header: `apps/backend/src/server.ts`
- Tests request id: `apps/backend/src/server.test.ts`
- Worker logs: `apps/backend/src/worker.ts`

Docs:
- Logging: `docs/LOGGING.md`
- Analytics events: `docs/ANALYTICS_EVENTS.md`
- Backlog sec/qa/obs: `docs/TODO_SECURITY_QA_OBS.md`

## 4) Comment valider rapidement

### Backend (tests + build + lint)

```powershell
npm --workspace apps/backend test
npm --workspace apps/backend run build
npm --workspace apps/backend run lint
```

### Smoke (debug request_id)

- Appeler n’importe quel endpoint (ex: `GET /v1/health`) et récupérer `x-request-id` dans la réponse.
- Rejouer avec un header `x-request-id: <valeur>` et vérifier qu’il est propagé dans la réponse.

## 5) Notes importantes / limites connues

- `OBS-002` (OpenTelemetry traces/métriques) n’est pas implémenté: on est sur logs + Sentry + corrélation `request_id`.
- `AN-001` est un **plan**: pas encore de provider (PostHog/Segment) branché ni d’instrumentation dans l’app.

## 6) Prochaines étapes (priorisées)

Priorité A (croissance / conversion):
1) Implémenter le tracking selon `docs/ANALYTICS_EVENTS.md` (choisir PostHog ou Segment) + kill switch.
2) Ajouter instrumentation paywall (shown → purchase → entitlement activé) et dashboards (`AN-002`).

Priorité B (observabilité):
3) `OBS-002` / `BE-131` — OpenTelemetry (API → DB → providers) + propagation context.
4) `OBS-004` — SLOs MVP (latence, taux succès jobs, dispo API).

## 7) Git / livraison

- Branche: `main`
- Commit principal (cette itération): `7a6f959` (obs/an: request_id + logging + analytics plan)

