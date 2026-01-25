<a id="todo-data-top"></a>
# TODO Données & Analytics — Modèle, calculs, perf

Ce document formalise les règles de données et de calcul (P&L, wheel, news) pour réduire l’ambiguïté et permettre des implémentations parallèles (backend/worker/DB).

## Références

- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-data-model)
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-data-pnl360)
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-data-wheel)
- [PRODUIT.md](../PRODUIT.md#prd-pnl360)

## Conventions

- IDs: `DA-###`
- Priorité: **correctness > perf**, puis perf via agrégats/caches. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-performance).

<a id="da-schema"></a>
## Schéma & normalisation (source de vérité)

- [ ] DA-001 — Valider le schéma minimal MVP (tables noyau + portefeuille + transactions) + champs obligatoires/optionnels. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-data-model).
- [ ] DA-002 — Spécifier la stratégie “append-only” des transactions + mécanisme de dédup (idempotency). Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-sync).
- [ ] DA-003 — Définir la normalisation instruments: `symbol`, `exchange`, `currency`, et résolution des collisions (classes d’actions, suffixes). Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-data-instruments).
- [ ] DA-004 — Multi-devises: définir “devise de base” user + sources FX + règles de conversion/arrondi. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-data-pnl360).
- [ ] DA-005 — Qualité des données: invariants (somme des lots, cashflows, timestamps) + rapport d’incohérences (observabilité). Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-observabilite).

<a id="da-pnl360"></a>
## P&L 360° (spec de calcul)

- [ ] DA-010 — Définir le modèle de calcul (cashflows) et les métriques exposées: réalisé, non-réalisé, primes options, dividendes, fees, total. Réf: [PRODUIT.md](../PRODUIT.md#prd-pnl360), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-data-pnl360).
- [ ] DA-011 — Options: conventions de signe (premium reçu vs payé), assignations, expirations, close-to-open, roll. Réf: [PRODUIT.md](../PRODUIT.md#prd-pnl360).
- [ ] DA-012 — Réalisé/non-réalisé: choix FIFO vs average cost (ou alignement SnapTrade) + traçabilité “sources”. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-mobile-patterns).
- [ ] DA-013 — Timeline quotidienne: règles d’agrégation `ticker_pnl_daily` + backfill + recalcul ciblé. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-performance).
- [ ] DA-014 — “Cash vs rendement”: définition rendement (sur capital engagé) + limites. Réf: [PRODUIT.md](../PRODUIT.md#prd-pnl360).
- [ ] DA-015 — Comparatif “si j’avais juste hold”: hypothèses (premier achat, DCA, splits?) + doc. Réf: [PRODUIT.md](../PRODUIT.md#prd-pnl360).
- [ ] DA-016 — Jeux de tests (fixtures) couvrant cas difficiles: multi-comptes, options, assignations, dividendes, conversions FX. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-deploiement).

<a id="da-wheel"></a>
## Wheel / Covered Calls (spec de détection)

- [ ] DA-020 — Définir le “cycle” wheel: événements, début/fin, états open/closed, métriques net premiums/stock P&L/fees. Réf: [PRODUIT.md](../PRODUIT.md#prd-wheel), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-data-wheel).
- [ ] DA-021 — Heuristiques MVP de grouping des legs (par symbol + dates + strike + type) + tolérances. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-data-wheel).
- [ ] DA-022 — Overrides: modèle de patch (merge/split, relabel) + audit + replays. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-securite).
- [ ] DA-023 — Jeux de tests wheel (fixtures) pour 10–20 scénarios réels. Réf: [PRODUIT.md](../PRODUIT.md#prd-wheel).

<a id="da-news"></a>
## News (ingestion & mapping ticker↔article)

- [ ] DA-030 — Dédup: hash URL canonique + gestion redirect/utm + TTL. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-news).
- [ ] DA-031 — Extraction tickers: règles MVP (regex + liste watchlist/positions) + réduction faux positifs. Réf: [PRODUIT.md](../PRODUIT.md#prd-news).
- [ ] DA-032 — “Pertinence”: scoring (récence + matching + source) + paramètres. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-news).

<a id="da-perf"></a>
## Performance (indices, caches, coûts)

- [ ] DA-040 — Indices Postgres alignés sur endpoints (transactions/news/alerts) + validation via EXPLAIN. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-performance).
- [ ] DA-041 — Stratégie cache Redis: clés (user, symbol), TTL, invalidation après sync/recalc. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-performance).
- [ ] DA-042 — Pagination cursor: format, stabilité, tri déterministe (executed_at/id). Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-performance).

<a id="da-governance"></a>
## Gouvernance données (audit, privacy)

- [ ] DA-050 — Stockage `raw` (payload providers) + politique de rétention + purge. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-securite), [PRODUIT.md](../PRODUIT.md#prd-confiance).
- [ ] DA-051 — Exportabilité/portabilité: définir format export “données utilisateur” (RGPD-like) même si non requis. Réf: [PRODUIT.md](../PRODUIT.md#prd-confiance).
