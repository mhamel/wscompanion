# OpenTelemetry (Tracing) — Local setup

Objectif: avoir des **traces end-to-end** (API → DB/Prisma → Redis/BullMQ → providers HTTP) pour diagnostiquer latence, erreurs, et comprendre le chemin critique (sync, news, exports, etc.).

## 1) Démarrer l'infra locale

Le `docker-compose.yml` inclut Jaeger (UI + collector OTLP).

```powershell
docker-compose up -d
```

UI Jaeger: `http://localhost:16686`

## 2) Activer OTel dans le backend

Dans `apps/backend/.env` (ou variables d'environnement):

```bash
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=justlovethestocks-backend
```

Optionnel (diagnostic SDK OTel):

```bash
OTEL_DIAG_LOG_LEVEL=INFO
```

## 3) Lancer API + worker

```powershell
npm --workspace apps/backend run dev
npm --workspace apps/backend run dev:worker
```

Ensuite, exécuter un flow (ex: `POST /v1/connections/:id/sync`, ou `POST /v1/exports`, ou ingestion news). Les traces apparaissent dans Jaeger.

## 4) Propagation API → jobs BullMQ

Les endpoints qui enqueue des jobs ajoutent automatiquement un champ `__otel` dans le payload des jobs (W3C `traceparent`/`tracestate`) afin que les spans "bullmq.process" soient liés à la requête d'origine.

Notes:
- Les jobs planifiés (repeatables) n'ont pas de parent request — ils créent une trace racine.
- Aucune donnée PII n'est injectée; uniquement les headers W3C de tracing.
