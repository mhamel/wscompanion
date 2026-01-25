# ADR-0003 — News provider: RSS/Atom (MVP) → API (évolutif)

## Statut

Accepté

## Contexte

Le produit veut un onglet “News” par ticker pour donner du contexte (sans conseil financier) et augmenter la rétention.

Contraintes:

- coût faible au MVP,
- stabilité (éviter le scraping fragile),
- conformité ToS/licences des sources.

## Décision

MVP:

- ingestion **RSS/Atom** via une liste de sources “whitelistées” (publishers + feeds officiels),
- mapping ticker↔article via heuristiques (puis amélioration).

Évolution:

- passer à un provider API (Finnhub/Alpha Vantage ou équivalent) si besoin de couverture/fiabilité/quotas.

## Conséquences

- Le worker doit gérer déduplication, cache, et rate limiting.
- On garde une abstraction `news_provider` pour pouvoir changer de source sans refactor massif.
- On documente explicitement les sources + ToS.

## Références

- `PRODUIT.md#prd-news`
- `ARCHITECTURE.md#arch-flux-news`
- `docs/TODO_BACKEND.md#be-news`

