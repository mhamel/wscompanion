# EIGHTEENTH ITERATION (Knowledge Transfer)

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
- Guide tests: `docs/TESTING.md`
- Logging: `docs/LOGGING.md`
- OpenTelemetry (nouveau): `docs/OPENTELEMETRY.md`

Règle d’or: **un TODO à la fois**. Implémenter → valider → cocher le TODO → commit → suivant.

## 1) Objectif du projet (rappel)

Companion mobile (Expo) connecté à Wealthsimple via SnapTrade (lecture seule par défaut) avec:
- P&L 360 par ticker (time-to-wow < 2 min après connexion)
- Wheel / covered calls tracker
- Exports “comptable-friendly”
- News + alertes (push)
- Paywall Pro (RevenueCat) + entitlements côté backend

## 2) Ce qui a été fait dans cette itération

Objectif atteint: **OBS-002 / BE-131** — Tracing OpenTelemetry (API → DB → providers) + **propagation context** vers BullMQ.

### Backend: OpenTelemetry SDK + auto-instrumentations

- Ajout d’un preload OTel sur **API** et **worker** (activable par env).
- Export traces via OTLP HTTP (compatible Jaeger local).
- Instrumentations Node auto (HTTP/Fastify/undici/redis/etc.) + instrumentation Prisma.
- Ajout d’attributs de corrélation:
  - `http.request_id` (reprend `x-request-id`)
  - `enduser.id` après auth (UUID user)

### Worker: traces BullMQ + propagation API → jobs

- Nouveau mécanisme de propagation: le payload des jobs reçoit un champ `__otel` (W3C `traceparent`/`tracestate`).
- Les jobs sont exécutés sous un span `bullmq.process` (queue/job/id/attempt) afin de relier:
  - requête API d’origine → enqueue → job worker → DB/providers
- DLQ enqueue traceables aussi (utile quand un job “meurt” au dernier retry).

### Infra locale: Jaeger dans docker-compose

- `docker-compose.yml` inclut désormais un service `jaeger` exposé sur:
  - UI: `http://localhost:16686`
  - OTLP: `4317` (gRPC) / `4318` (HTTP)

### Documentation / backlog

- `docs/OPENTELEMETRY.md`: setup local + variables env + notes propagation BullMQ.
- `docs/LOGGING.md`: ajout d’un renvoi vers le tracing.
- `docs/TODO_SECURITY_QA_OBS.md`: `OBS-002` coché.
- `docs/TODO_BACKEND.md`: `BE-131` coché.

## 3) Où regarder (entry points “haute valeur”)

Backend:
- OTel init/shutdown: `apps/backend/src/observability/otel.ts`
- Propagation + spans BullMQ: `apps/backend/src/observability/bullmqTracing.ts`
- Correlation spans ↔ request_id/user: `apps/backend/src/server.ts`
- Entrypoints:
  - API: `apps/backend/src/api.ts`
  - Worker: `apps/backend/src/worker.ts`

Docs:
- Setup OTel local: `docs/OPENTELEMETRY.md`
- Logs: `docs/LOGGING.md`

## 4) Comment valider rapidement

### Backend (build + tests)

```powershell
npm --workspace apps/backend run build
npm --workspace apps/backend test
```

### Traces (local)

```powershell
docker-compose up -d
```

Puis dans `apps/backend/.env`:

```bash
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=justlovethestocks-backend
```

Lancer:

```powershell
npm --workspace apps/backend run dev
npm --workspace apps/backend run dev:worker
```

Déclencher un flow:
- `POST /v1/connections/:id/sync` (enqueue sync)
- `POST /v1/exports` (enqueue export)
- `POST /v1/wheel/detect` (enqueue analytics)

Vérifier dans Jaeger que:
- la requête HTTP et le job BullMQ partagent le même trace id (si déclenché via API).

## 5) Notes importantes / limites connues

- OTel est **désactivé par défaut** (env `OTEL_ENABLED=true` ou endpoint OTLP présent).
- Les jobs planifiés (repeatables) n’ont pas de parent request → nouvelle trace racine (normal).
- `__otel` est injecté dans les payloads jobs: pas de PII, uniquement W3C headers.
- `npm install` a signalé des vulnérabilités via `npm audit` (non traitées ici pour éviter du scope creep). À faire plus tard si on veut durcir la supply-chain.

## 6) Prochaines étapes (priorisées)

Priorité A (sécurité):
1) `SEC-003 / BE-130` — rate limiting (IP + user) sur endpoints sensibles (OTP, auth, analytics ingest) + anti-bruteforce.

Priorité B (assistant):
2) `BE-120` / `FE-090` — MVP “Ask” (réponse structurée + citations internes/externes).

Priorité C (infra):
3) `PL-031` — OTel collector “vrai” (sampling, export vers vendor) + dashboards.

## 7) Git / livraison

- Branche: `main`
- Commit principal (cette itération): voir `git log -1` (message: `obs: add OpenTelemetry tracing + BullMQ context propagation`)
