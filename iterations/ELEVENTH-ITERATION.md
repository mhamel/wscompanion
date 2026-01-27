# ELEVENTH ITERATION (Knowledge Transfer)

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

Objectif atteint: `DA-023` — **jeux de tests wheel (fixtures) pour 10–20 scénarios** (non-régression).

- Ajout de 12 nouveaux fixtures wheel (JSON) → total = 17 cas.
- Variantes couvertes en plus: `commission`→`fee`, `dividend_reinvest`→`dividend`, `STO`/`exercise`, split sur 2e `sold_put`, transactions inconnues ignorées, option `right` dérivé du `type` quand `optionContract` est absent.
- Backlog mis à jour: `DA-023` coché dans `docs/TODO_DATA_ANALYTICS.md`.

## 3) Où regarder (entry points “haute valeur”)

Backend:
- Wheel detection (pure): `apps/backend/src/analytics/wheel.ts`
- Tests wheel fixtures: `apps/backend/src/analytics/wheel.test.ts`
- Fixtures wheel: `apps/backend/src/analytics/__fixtures__/wheel/*.json`

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

- Wheel detection reste une heuristique MVP (ex: split sur 2e `sold_put`; fermeture uniquement sur `called_away`). Si tu changes l’algo, il faudra mettre à jour les fixtures correspondantes.
- La classification actuelle ne modélise pas tous les types d’events options (ex: buy-to-close d’un call = ignoré). Si tu ajoutes un nouveau `WheelLegKind`, pense à: `wheel.ts` + fixtures + UI.

## 6) Prochaines étapes (priorisées)

Priorité A (qualité / analytics):
1) `DA-016` — Étendre les fixtures P&L (multi-comptes, options edge cases, conversions FX, anomalies) et clarifier la spec P&L (DA-010..015).

Priorité B (monétisation):
2) `M3-03` + `BE-110..111` + `FE-100..101` — RevenueCat entitlements + gating + paywall.

Priorité C (observabilité):
3) `OBS-002` — OpenTelemetry traces/métriques (API→DB→providers).

## 7) Git / livraison

- Branche: `main`
- À livrer: commit + push contenant les nouveaux fixtures wheel + backlog `DA-023` coché.

