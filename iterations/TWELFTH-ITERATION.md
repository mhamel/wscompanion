# TWELFTH ITERATION (Knowledge Transfer)

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

Règle d’or: **un TODO à la fois**. Implémenter → valider → cocher le TODO → commit → suivant.

## 1) Objectif du projet (rappel)

Companion mobile (Expo) connecté à Wealthsimple via SnapTrade (lecture seule par défaut) avec:
- P&L 360 par ticker (time-to-wow < 2 min après connexion)
- Wheel / covered calls tracker
- Exports “comptable-friendly”
- News + alertes (push)

## 2) Ce qui a été fait dans cette itération

Objectif atteint: `DA-016` — **extension des fixtures P&L 360** (golden files) pour couvrir davantage de cas “difficiles” (non-régression).

- Ajout de 7 nouveaux fixtures P&L (JSON) → total = 13 cas.
- Nouveaux cas couverts (en plus des fixtures existants):
  - FX: override explicite dans `tx.raw.fx` + conversions CAD→USD sur trades + snapshots.
  - Options/assignations: call exercise sans `optionContract` (dérivation `right` + `symbol` via `raw`).
  - Dividendes: `dividend_reinvest` traité comme dividend + symbole dérivé via `raw`.
  - Fees: transaction “commission” qui n’a que `grossAmountMinor` (pas `feesAmountMinor`).
  - Shorts: short sell → buy-to-cover (P&L réalisé).
- Backlog mis à jour: `DA-016` coché dans `docs/TODO_DATA_ANALYTICS.md`.

## 3) Où regarder (entry points “haute valeur”)

Backend:
- P&L 360 (pure): `apps/backend/src/analytics/pnl.ts`
- Tests P&L fixtures: `apps/backend/src/analytics/pnl.test.ts`
- Fixtures P&L: `apps/backend/src/analytics/__fixtures__/pnl/*.json`

Docs:
- Backlog Data/Analytics: `docs/TODO_DATA_ANALYTICS.md`
- Guide tests: `docs/TESTING.md`

## 4) Comment valider rapidement

### Backend (tests + build + lint)

```powershell
npm --workspace apps/backend test
npm --workspace apps/backend run build
npm --workspace apps/backend run lint
```

## 5) Notes importantes / limites connues

- `computeTickerPnl360()` est **agnostique aux comptes**: il prend une liste de transactions + snapshots déjà “mergés” côté user. Les fixtures valident le calcul par ticker, pas la requête multi-accounts en DB.
- Modèle options = MVP: P&L des options = premiums (sell = +, buy = -), et assignation/exercise → événement stock (buy/sell). Les autres events options restent “unknown/ignored”.

## 6) Prochaines étapes (priorisées)

Priorité A (spec + qualité P&L):
1) `DA-010..015` — clarifier la spec P&L (conventions, FX, FIFO vs average, timeline daily) et aligner la doc avec l’implémentation.

Priorité B (monétisation):
2) `M3-03` + `BE-110..111` + `FE-100..101` — RevenueCat entitlements + gating + paywall.

Priorité C (observabilité):
3) `OBS-002` — OpenTelemetry traces/métriques (API→DB→providers).

## 7) Git / livraison

- Branche: `main`
- Commit principal (cette itération): `b80dad3` (DA-016 fixtures P&L + backlog)
