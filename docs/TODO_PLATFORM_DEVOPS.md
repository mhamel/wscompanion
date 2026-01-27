<a id="todo-platform-top"></a>
# TODO Platform/DevOps — Environnements, CI/CD, déploiement

## Références

- [PRODUIT.md](../PRODUIT.md#prd-top)
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-deploiement)
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-observabilite)

## Conventions

- IDs: `PL-###`
- Objectif: rendre “facile” le travail parallèle (environnements reproductibles + pipelines).

<a id="pl-top"></a>
## Environnements & bootstrap

- [x] PL-001 — Décider mono-repo vs multi-repos (mobile/backend) + conventions versionning. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-architecture-logique).
- [x] PL-002 — Environnement local reproductible (docker-compose): Postgres + Redis + S3-compatible (MinIO) + mails (mailhog). Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-stack-backend).
- [x] PL-003 — Gestion secrets/config: `.env` templates, validation, séparation dev/staging/prod. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-securite).

<a id="pl-ci"></a>
## CI (qualité & contrats)

- [x] PL-010 — CI backend: lint + typecheck + tests unitaires + migrations check. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-deploiement).
- [ ] PL-011 — CI OpenAPI: vérifier compatibilité (breaking changes) + génération client. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-api-backend).
- [ ] PL-012 — CI mobile: lint + typecheck + build (EAS si Expo) sur PR. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-stack-mobile).

<a id="pl-cd"></a>
## CD (déploiements)

- [ ] PL-020 — Déploiement backend API (container) + autoscaling + health checks. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-deploiement).
- [ ] PL-021 — Déploiement worker BullMQ séparé (même codebase) + gestion DLQ. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-sync).
- [ ] PL-022 — Postgres managé + backups + PITR + stratégie de migrations “expand/contract”. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-deploiement).
- [ ] PL-023 — Redis managé + policies (persistence, eviction) alignées sur caches. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-performance).
- [ ] PL-024 — S3-compatible + lifecycle policy (rétention exports) + URLs signées. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-exports).

<a id="pl-obs"></a>
## Observabilité (infra)

- [ ] PL-030 — Centraliser logs (pino) + corrélation `request_id` + dashboards. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-observabilite).
- [ ] PL-031 — Mettre en place OpenTelemetry (collector + traces) + sampling. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-observabilite).
- [x] PL-032 — Sentry (backend + mobile) + alerting (taux erreurs, jobs failures). Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-observabilite).

<a id="pl-adr"></a>
## ADRs (décisions à consigner)

- [x] PL-040 — ADR-001 ORM (Prisma vs Drizzle) + raisons + impacts. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-stack-backend).
- [x] PL-041 — ADR-002 Provider news (RSS vs API) + ToS/quotas + roadmap. Réf: [PRODUIT.md](../PRODUIT.md#prd-news).
- [x] PL-042 — ADR-003 Billing (RevenueCat vs autre) + modèle d’entitlements. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-monetisation).
