<a id="todo-secqaobs-top"></a>
# TODO Sécurité, Privacy, QA, Observabilité, Analytics

## Références

- [PRODUIT.md](../PRODUIT.md#prd-confiance)
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-securite)
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-observabilite)
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-deploiement)

## Conventions

- IDs: `SEC-###`, `QA-###`, `OBS-###`, `AN-###`
- Objectif: construire la confiance (chiffres fiables, sécurité, transparence) dès le MVP.

<a id="sec-top"></a>
## Sécurité & conformité

- [ ] SEC-001 — Threat model (mobile + API + worker + providers) + surfaces + mitigations. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-securite).
- [ ] SEC-002 — Stratégie chiffrement (tokens SnapTrade, secrets) + rotation clés + redaction logs. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-securite).
- [ ] SEC-003 — Rate limiting (OTP, API) + anti-bruteforce + lockout progressif. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-securite).
- [ ] SEC-004 — Audit logs (accès aux données sensibles, overrides wheel) + rétention. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-securite).
- [ ] SEC-005 — Review ToS SnapTrade + providers news + disclaimers “not financial advice”. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-securite), [PRODUIT.md](../PRODUIT.md#prd-top).

<a id="sec-privacy"></a>
## Privacy (données minimales, contrôle utilisateur)

- [x] SEC-010 — Politique “Disconnect SnapTrade”: purge tokens + stop sync + message UX. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-securite), [PRODUIT.md](../PRODUIT.md#prd-confiance).
- [x] SEC-011 — Suppression compte: soft-delete + purge données selon politique + export “mes données”. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-securite), [PRODUIT.md](../PRODUIT.md#prd-confiance).
- [ ] SEC-012 — Classification données (PII, secrets, finance) + règles de logging/monitoring. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-securite).

<a id="qa-top"></a>
## QA & tests

- [x] QA-001 — Stratégie tests: unitaires (calculs) + intégration (DB/jobs) + contract tests (OpenAPI). Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-deploiement).
- [x] QA-002 — Jeux de fixtures P&L 360 + wheel (golden files) + non-régression. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-data-pnl360), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-data-wheel).
- [ ] QA-003 — Tests sync SnapTrade en sandbox + idempotence + retries + DLQ. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-sync).
- [ ] QA-004 — Plan QA mobile (device matrix, offline, perf, crash) + tests e2e (Detox si pertinent). Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-stack-mobile).
- [ ] QA-005 — Definition of Done (DoD) par feature: perf, logs, métriques, tests, docs, empty states. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-mobile-patterns).

<a id="obs-top"></a>
## Observabilité (tech)

- [x] OBS-001 — Conventions logs (JSON), `request_id`, niveaux, redaction. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-observabilite), [LOGGING.md](./LOGGING.md).
- [ ] OBS-002 — Tracing OpenTelemetry (API→DB→providers) + propagation context. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-observabilite).
- [x] OBS-003 — Sentry (backend + mobile): release, sourcemaps, alerting. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-observabilite).
- [ ] OBS-004 — SLOs MVP: disponibilité API, latence endpoints clés, succès jobs sync/export. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-performance).

<a id="an-top"></a>
## Analytics produit (croissance)

- [x] AN-001 — Plan d’événements (PostHog/Segment): signup, connect start/complete, first sync, first wow, paywall shown, upgrade. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-observabilite), [PRODUIT.md](../PRODUIT.md#prd-wow), [ANALYTICS_EVENTS.md](./ANALYTICS_EVENTS.md).
- [x] AN-010 — Implémenter le tracking + wiring PostHog (API `POST /v1/analytics/event`, worker events, kill switch). Réf: [ANALYTICS.md](./ANALYTICS.md), [ANALYTICS_EVENTS.md](./ANALYTICS_EVENTS.md).
- [x] AN-002 — Funnels & dashboards: time-to-wow, rétention hebdo, conversion pro, causes d’échec sync. Réf: [PRODUIT.md](../PRODUIT.md#prd-wow).
