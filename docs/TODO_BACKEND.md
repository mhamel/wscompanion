<a id="todo-backend-top"></a>
# TODO Backend — API/Worker (Fastify + TypeScript)

## Références

- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-stack-backend)
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-api-backend)
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-sync)
- [PRODUIT.md](../PRODUIT.md#prd-top)

## Conventions

- IDs: `BE-###`
- Chaque tâche inclut: livrable(s), dépendances, et une référence vers `PRODUIT.md` et/ou `ARCHITECTURE.md`.

<a id="be-foundations"></a>
## Foundations (repo, qualité, conventions)

- [x] BE-001 — Bootstrap backend (Fastify + TS) + lint/format/test + structure “monolithe modulaire”. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-stack-backend), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-architecture-logique).
  - Livrables: serveur Fastify, config TS, ESLint/Prettier, tests (Vitest/Jest), scripts `dev/test/build`.
- [x] BE-002 — Gestion de configuration (env) validée (zod) + secrets management (12-factor). Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-securite).
- [x] BE-003 — Logging structuré (pino) + `request_id` + redaction des champs sensibles. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-observabilite).
- [x] BE-004 — Error handling unifié (codes, messages, mapping) + format d’erreur stable. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-api-backend).

<a id="be-api"></a>
## Contrat API (OpenAPI-first)

- [x] BE-010 — Exposer OpenAPI `/v1` (swagger) + versionnement + conventions de pagination (cursor). Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-api-backend).
- [x] BE-011 — Définir schémas `ProblemDetails` + `PaginationCursor` + `Money` (multi-devises) partagés. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-performance).
- [x] BE-012 — Générer un client typé (pour mobile) à partir d’OpenAPI + CI qui bloque si contrat cassé. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-deploiement).

<a id="be-db"></a>
## Base de données & migrations (PostgreSQL + ORM)

- [x] BE-020 — Mettre en place Prisma (ou ORM choisi) + migrations + seed dev. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-data-model).
- [x] BE-021 — Implémenter le schéma “noyau” (users/sessions/devices/entitlements). Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-data-core), [PRODUIT.md](../PRODUIT.md#prd-confiance).
- [x] BE-022 — Implémenter les entités portefeuille (accounts/instruments/positions/transactions). Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-data-portfolio).
- [x] BE-023 — Implémenter les tables d’agrégats (P&L, wheel, news, alerts, exports). Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-data-pnl360), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-data-wheel).
- [x] BE-024 — Indexes/counters alignés sur les queries (user_id, symbol, executed_at, published_at) + contraintes d’intégrité. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-performance).

<a id="be-auth"></a>
## Auth, sessions, devices, entitlements

- [x] BE-030 — OTP/magic link: génération, hash, expiration, rate limit, verrouillage progressif. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-securite).
- [x] BE-031 — Sessions: JWT access court + refresh long, rotation, révocation, device binding. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-api-auth).
- [x] BE-032 — Devices/push: enregistrement token push, opt-in, invalidation. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-api-devices).
- [x] BE-033 — Middleware d’entitlements (free/pro) + cache Redis + overrides admin (si besoin). Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-monetisation), [PRODUIT.md](../PRODUIT.md#prd-monetisation).

<a id="be-snaptrade"></a>
## SnapTrade: connexion + sync (worker)

- [x] BE-040 — Flow connexion SnapTrade: endpoints start/callback + création `broker_connection` + stockage tokens chiffrés. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-onboarding), [PRODUIT.md](../PRODUIT.md#prd-connexion).
- [x] BE-041 — Chiffrement applicatif des tokens (`*_enc`) + rotation des clés + redaction logs. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-securite).
- [x] BE-042 — Worker BullMQ: orchestrer sync initial (jobs idempotents, retries, DLQ). Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-sync).
- [x] BE-043 — Ingestion “append-only” des transactions + dédup (idempotency keys) + journal `raw` (payload). Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-sync), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-data-transactions).
- [x] BE-044 — Sync incrémental (schedule + manuel + webhook si dispo) + stratégie de recalcul ciblé. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-sync).

<a id="be-portfolio"></a>
## API Portfolio (accounts, positions, transactions)

- [x] BE-050 — Endpoints comptes + positions + snapshots, paginés. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-api-portfolio).
- [x] BE-051 — Endpoint transactions avec filtres (symbol/type/date) + pagination cursor. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-data-transactions).
- [x] BE-052 — “Sources partout”: endpoints pour relier une métrique (P&L, primes, dividendes) aux transactions sources. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-mobile-patterns).

<a id="be-analytics"></a>
## Analytics / P&L 360°

- [x] BE-060 — Pipeline de calcul P&L (worker): réalisé/non-réalisé, primes options, assignations, dividendes, frais, multi-devises. Réf: [PRODUIT.md](../PRODUIT.md#prd-pnl360), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-data-pnl360).
- [x] BE-061 — Tables `ticker_pnl_totals` + `ticker_pnl_daily` + invalidation/cache Redis. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-performance).
- [x] BE-062 — Endpoints: top tickers, ticker summary, timeline P&L, breakdown (cash vs rendement). Réf: [PRODUIT.md](../PRODUIT.md#prd-pnl360), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-api-portfolio).
- [x] BE-063 — Comparatif “si j’avais juste hold” (optionnel) + doc des hypothèses. Réf: [PRODUIT.md](../PRODUIT.md#prd-pnl360), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-pnl-hold).

<a id="be-wheel"></a>
## Wheel / Covered Calls

- [x] BE-070 — Détection de cycles wheel (MVP) à partir des legs options + assignations + expirations. Réf: [PRODUIT.md](../PRODUIT.md#prd-wheel), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-data-wheel).
- [x] BE-071 — Endpoints cycles: liste (open/closed), détail (timeline legs), agrégats net premiums/stock P&L. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-api-wheel).
- [x] BE-072 — Overrides manuels (corriger cycle, fusion/scission, tags) + audit. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-securite).

<a id="be-news"></a>
## News & événements par ticker

- [x] BE-080 — Ingestion RSS/Atom (worker) + cache + dédup URL hash + mapping ticker↔article. Réf: [PRODUIT.md](../PRODUIT.md#prd-news), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-news).
- [ ] BE-081 — Endpoint `/tickers/:symbol/news` paginé + tri “pertinence”. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-news).
- [ ] BE-082 — (Plus tard) résumé LLM premium avec citations + garde-fous. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-api-assistant).

<a id="be-alerts"></a>
## Alerts

- [ ] BE-090 — Modèle règles + templates (earnings/expiry/price move/news spike). Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-api-alerts).
- [ ] BE-091 — Worker d’évaluation (planifié) + dédup événements + notifications push/email. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-api-devices).
- [ ] BE-092 — Endpoints CRUD règles + liste événements récents (paginé). Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-api-alerts).

<a id="be-exports"></a>
## Exports (jobs)

- [ ] BE-100 — Créer `export_job` + pipeline BullMQ (CSV d’abord) + états (queued/running/succeeded/failed). Réf: [PRODUIT.md](../PRODUIT.md#prd-exports), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-exports).
- [ ] BE-101 — Génération CSV “réalisé par ticker” + “primes options par année” (MVP) + stockage S3 + URLs signées. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-exports).
- [ ] BE-102 — Endpoint listing jobs + téléchargement + droits (user-only). Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-api-exports).

<a id="be-entitlements"></a>
## Billing / Entitlements

- [ ] BE-110 — Intégration RevenueCat (webhooks ou polling) → table `entitlements` + cache. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-monetisation), [PRODUIT.md](../PRODUIT.md#prd-monetisation).
- [ ] BE-111 — Feature gates côté API (middleware) + réponses “teaser” (pas de blocage brutal). Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-mobile-patterns).

<a id="be-assistant"></a>
## Assistant (premium, optionnel)

- [ ] BE-120 — Endpoint “Ask”: récupération contexte (P&L/news/transactions) + réponse structurée + citations. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-ask), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-api-assistant).
- [ ] BE-121 — Stockage conversations + limites (rate limit, quotas premium) + redaction PII. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-securite).

<a id="be-nfr"></a>
## NFRs: sécurité, performance, observabilité

- [ ] BE-130 — Rate limiting (IP + user) + protections brute-force OTP. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-securite).
- [ ] BE-131 — Observabilité: OpenTelemetry traces + métriques jobs + Sentry. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-observabilite).
- [ ] BE-132 — Performance: caching agrégats chauds + headers cache + pagination cursor partout. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-performance).
- [ ] BE-133 — Fiabilité: jobs idempotents + retries contrôlés + DLQ + playbooks incident. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-securite).
