# Plan de travail (TODO) — Companion Wealthsimple (via SnapTrade)

Ce dépôt ne contient pour l’instant que la vision **Produit** et l’**Architecture**. Ce document (et ceux liés) découpent le travail en lots actionnables, conçus pour être parallélisés entre plusieurs agents IA.

## Références (sources de vérité)

- [PRODUIT.md](../PRODUIT.md#prd-top) — intention produit, “wow”, scope, monétisation, confiance.
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-top) — architecture cible, domaines, modèle de données, API, écrans, NFRs.

## Documents de backlog (à exécuter)

- [TODO_BACKEND.md](./TODO_BACKEND.md#todo-backend-top) — API + workers + intégrations + calculs.
- [TODO_MOBILE.md](./TODO_MOBILE.md#todo-mobile-top) — app mobile (React Native/Expo), UX “search-first”.
- [TODO_DATA_ANALYTICS.md](./TODO_DATA_ANALYTICS.md#todo-data-top) — modèle de données, P&L 360°, wheel, règles de calcul.
- [TODO_PLATFORM_DEVOPS.md](./TODO_PLATFORM_DEVOPS.md#todo-platform-top) — infra, CI/CD, déploiements, environnements.
- [TODO_SECURITY_QA_OBS.md](./TODO_SECURITY_QA_OBS.md#todo-secqaobs-top) — sécurité, privacy, QA, observabilité, analytics produit.

## Règles de coordination multi-agents (très important)

- **Contrat d’abord**: commencer par figer `OpenAPI` + schémas (même si incomplets), puis itérer. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-api-backend).
- **Frontières de domaine**: ne pas “mélanger” `auth/snaptrade/portfolio/analytics/wheel/news/alerts/exports`. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-architecture-logique).
- **Backlog traçable**: chaque tâche ci-dessous doit pointer vers une section de `PRODUIT.md` ou `ARCHITECTURE.md`.
- **Livrables atomiques**: une tâche = un livrable vérifiable (endpoint, table, écran, job, test, ADR…).

## Roadmap (incréments de valeur)

### M0 — Foundations (débloque le parallélisme)

- [x] M0-01 — Décider mono-repo vs multi-repos (mobile/backend) + conventions (naming, env, versions). Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-deploiement), [TODO_PLATFORM_DEVOPS.md](./TODO_PLATFORM_DEVOPS.md#pl-top).
- [x] M0-02 — Créer un squelette backend + worker + DB/Redis locaux + Swagger/OpenAPI. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-stack-backend), [TODO_BACKEND.md](./TODO_BACKEND.md#be-foundations).
- [x] M0-03 — Créer un squelette mobile (Expo) + navigation + auth placeholder + client API typé. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-stack-mobile), [TODO_MOBILE.md](./TODO_MOBILE.md#fe-foundations).
- [x] M0-04 — ADRs “structurants” (choix ORM, cache, provider news, billing). Réf: [TODO_PLATFORM_DEVOPS.md](./TODO_PLATFORM_DEVOPS.md#pl-adr).

### M1 — “Time-to-wow” (P&L 360° minimal)

Objectif: “connexion SnapTrade → sync initial → top tickers P&L visibles” (≤ 2 min). Réf: [PRODUIT.md](../PRODUIT.md#prd-pnl360), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-onboarding).

- [ ] M1-01 — Flow SnapTrade end-to-end (callback backend + état de sync + écran mobile). Réf: [PRODUIT.md](../PRODUIT.md#prd-connexion), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-onboarding).
- [ ] M1-02 — Ingestion transactions/positions + normalisation + idempotence (worker). Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-sync), [TODO_BACKEND.md](./TODO_BACKEND.md#be-snaptrade).
- [ ] M1-03 — Calcul P&L 360° (version MVP) + endpoints “top tickers”. Réf: [PRODUIT.md](../PRODUIT.md#prd-pnl360), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-data-pnl360).
- [ ] M1-04 — Home + Ticker (mobile) avec “sources” cliquables vers transactions. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-mobile-ecrans).

### M2 — Wheel tracker + Exports (valeur “power user”)

- [ ] M2-01 — Détection wheel (heuristiques MVP) + UI cycles + override manuel. Réf: [PRODUIT.md](../PRODUIT.md#prd-wheel), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-data-wheel).
- [ ] M2-02 — Exports (CSV d’abord) via jobs + stockage S3 + download mobile. Réf: [PRODUIT.md](../PRODUIT.md#prd-exports), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-exports).

### M3 — News + Alerts + Paywall (rétention & monétisation)

- [ ] M3-01 — News par ticker (RSS/Atom) + dédup + endpoints + onglet mobile. Réf: [PRODUIT.md](../PRODUIT.md#prd-news), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-news).
- [ ] M3-02 — Alertes (règles + évaluations worker + push) + écrans. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-api-alerts).
- [ ] M3-03 — Entitlements (RevenueCat) + paywall “non intrusif” + gating clair. Réf: [PRODUIT.md](../PRODUIT.md#prd-monetisation), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-monetisation).

### M4 — Assistant premium (optionnel / différenciant)

- [ ] M4-01 — “Ask” avec réponses structurées + citations (sources internes + news) + sécurité. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-ask), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-api-assistant).

## Découpage recommandé par agent IA

- **Agent Backend**: [TODO_BACKEND.md](./TODO_BACKEND.md#todo-backend-top) (API/worker/SnapTrade/exports/alerts).
- **Agent Mobile**: [TODO_MOBILE.md](./TODO_MOBILE.md#todo-mobile-top) (UX, navigation, écrans, paywall).
- **Agent Data**: [TODO_DATA_ANALYTICS.md](./TODO_DATA_ANALYTICS.md#todo-data-top) (schéma, calculs, edge cases, perf).
- **Agent Platform**: [TODO_PLATFORM_DEVOPS.md](./TODO_PLATFORM_DEVOPS.md#todo-platform-top) (compose, CI/CD, déploiement).
- **Agent Sec/QA/Obs**: [TODO_SECURITY_QA_OBS.md](./TODO_SECURITY_QA_OBS.md#todo-secqaobs-top) (threat model, tests, SLOs).

## Matrice de traçabilité (couverture)

### Produit → Backlog

- [PRODUIT.md](../PRODUIT.md#prd-objectif) → [TODO_INDEX.md](./TODO_INDEX.md) + [TODO_PLATFORM_DEVOPS.md](./TODO_PLATFORM_DEVOPS.md#pl-top).
- [PRODUIT.md](../PRODUIT.md#prd-non-goals) → [TODO_SECURITY_QA_OBS.md](./TODO_SECURITY_QA_OBS.md#sec-top) (disclaimers, ToS, limites).
- [PRODUIT.md](../PRODUIT.md#prd-connexion) → [TODO_BACKEND.md](./TODO_BACKEND.md#be-snaptrade) + [TODO_MOBILE.md](./TODO_MOBILE.md#fe-auth).
- [PRODUIT.md](../PRODUIT.md#prd-features) → [TODO_BACKEND.md](./TODO_BACKEND.md#todo-backend-top) + [TODO_MOBILE.md](./TODO_MOBILE.md#todo-mobile-top) + [TODO_DATA_ANALYTICS.md](./TODO_DATA_ANALYTICS.md#todo-data-top).
- [PRODUIT.md](../PRODUIT.md#prd-parcours) → [TODO_MOBILE.md](./TODO_MOBILE.md#fe-auth) + [TODO_MOBILE.md](./TODO_MOBILE.md#fe-home) + [TODO_MOBILE.md](./TODO_MOBILE.md#fe-ticker) + [TODO_MOBILE.md](./TODO_MOBILE.md#fe-alerts) + [TODO_MOBILE.md](./TODO_MOBILE.md#fe-exports).
- [PRODUIT.md](../PRODUIT.md#prd-pnl360) → [TODO_DATA_ANALYTICS.md](./TODO_DATA_ANALYTICS.md#da-pnl360) + [TODO_BACKEND.md](./TODO_BACKEND.md#be-analytics) + [TODO_MOBILE.md](./TODO_MOBILE.md#fe-ticker).
- [PRODUIT.md](../PRODUIT.md#prd-wheel) → [TODO_DATA_ANALYTICS.md](./TODO_DATA_ANALYTICS.md#da-wheel) + [TODO_BACKEND.md](./TODO_BACKEND.md#be-wheel) + [TODO_MOBILE.md](./TODO_MOBILE.md#fe-wheel).
- [PRODUIT.md](../PRODUIT.md#prd-exports) → [TODO_BACKEND.md](./TODO_BACKEND.md#be-exports) + [TODO_MOBILE.md](./TODO_MOBILE.md#fe-exports).
- [PRODUIT.md](../PRODUIT.md#prd-news) → [TODO_BACKEND.md](./TODO_BACKEND.md#be-news) + [TODO_MOBILE.md](./TODO_MOBILE.md#fe-news).
- [PRODUIT.md](../PRODUIT.md#prd-monetisation) → [TODO_BACKEND.md](./TODO_BACKEND.md#be-entitlements) + [TODO_MOBILE.md](./TODO_MOBILE.md#fe-paywall).
- [PRODUIT.md](../PRODUIT.md#prd-wow) → [TODO_SECURITY_QA_OBS.md](./TODO_SECURITY_QA_OBS.md#an-top) + [TODO_INDEX.md](./TODO_INDEX.md) (M1 “time-to-wow”).
- [PRODUIT.md](../PRODUIT.md#prd-confiance) → [TODO_SECURITY_QA_OBS.md](./TODO_SECURITY_QA_OBS.md#sec-privacy).

### Architecture → Backlog

- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-objectifs-produit) → [TODO_INDEX.md](./TODO_INDEX.md) (M1–M4).
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-perimetre-principes) → [TODO_SECURITY_QA_OBS.md](./TODO_SECURITY_QA_OBS.md#sec-top).
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-stack-backend) → [TODO_BACKEND.md](./TODO_BACKEND.md#be-foundations).
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-stack-mobile) → [TODO_MOBILE.md](./TODO_MOBILE.md#fe-foundations).
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-stack-integrations) → [TODO_BACKEND.md](./TODO_BACKEND.md#be-auth) + [TODO_PLATFORM_DEVOPS.md](./TODO_PLATFORM_DEVOPS.md#pl-adr).
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-architecture-logique) → [TODO_BACKEND.md](./TODO_BACKEND.md#be-foundations).
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-onboarding) → [TODO_BACKEND.md](./TODO_BACKEND.md#be-snaptrade) + [TODO_MOBILE.md](./TODO_MOBILE.md#fe-auth).
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-sync) → [TODO_BACKEND.md](./TODO_BACKEND.md#be-snaptrade) + [TODO_DATA_ANALYTICS.md](./TODO_DATA_ANALYTICS.md#da-schema).
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-news) → [TODO_BACKEND.md](./TODO_BACKEND.md#be-news) + [TODO_DATA_ANALYTICS.md](./TODO_DATA_ANALYTICS.md#da-news) + [TODO_MOBILE.md](./TODO_MOBILE.md#fe-news).
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-exports) → [TODO_BACKEND.md](./TODO_BACKEND.md#be-exports) + [TODO_MOBILE.md](./TODO_MOBILE.md#fe-exports) + [TODO_PLATFORM_DEVOPS.md](./TODO_PLATFORM_DEVOPS.md#pl-cd).
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-ask) → [TODO_BACKEND.md](./TODO_BACKEND.md#be-assistant) + [TODO_MOBILE.md](./TODO_MOBILE.md#fe-ask).
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-data-model) → [TODO_DATA_ANALYTICS.md](./TODO_DATA_ANALYTICS.md#da-schema).
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-api-backend) → [TODO_BACKEND.md](./TODO_BACKEND.md#be-api).
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-securite) → [TODO_SECURITY_QA_OBS.md](./TODO_SECURITY_QA_OBS.md#sec-top).
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-performance) → [TODO_DATA_ANALYTICS.md](./TODO_DATA_ANALYTICS.md#da-perf) + [TODO_BACKEND.md](./TODO_BACKEND.md#be-nfr).
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-observabilite) → [TODO_SECURITY_QA_OBS.md](./TODO_SECURITY_QA_OBS.md#obs-top).
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-deploiement) → [TODO_PLATFORM_DEVOPS.md](./TODO_PLATFORM_DEVOPS.md#pl-top).
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-monetisation) → [TODO_BACKEND.md](./TODO_BACKEND.md#be-entitlements) + [TODO_MOBILE.md](./TODO_MOBILE.md#fe-paywall) + [TODO_PLATFORM_DEVOPS.md](./TODO_PLATFORM_DEVOPS.md#pl-adr).
