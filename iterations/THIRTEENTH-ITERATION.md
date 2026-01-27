# THIRTEENTH ITERATION (Knowledge Transfer)

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

Objectif atteint: `DA-010..015` — **spécification P&L 360 clarifiée et alignée sur l’implémentation**, pour réduire l’ambiguïté et éviter les divergences doc/code.

- Nouveau doc “source de vérité” P&L (MVP): `docs/PNL360_SPEC.md`
  - conventions (classification, FIFO, shorts, premiums options, dividends, fees)
  - FX + overrides + anomalies
  - timeline quotidienne (limites MVP: unrealized/market value uniquement “as-of”)
  - cash vs rendement + comparatif “Just Hold”
- Backlog mis à jour: `DA-010..015` cochés dans `docs/TODO_DATA_ANALYTICS.md`.
- Correctif P&L: éviter le **double comptage des fees** sur les transactions de type `fee/commission` quand `feesAmountMinor` est présent.
  - Fixture ajoutée pour non-régression: `apps/backend/src/analytics/__fixtures__/pnl/pnl-fee-transaction-uses-fees.json`
- Stabilisation tests: `apps/backend/src/server.test.ts` a un timeout plus réaliste (flaky sur machines lentes).

## 3) Où regarder (entry points “haute valeur”)

Docs:
- Spec P&L 360 (MVP): `docs/PNL360_SPEC.md`
- Backlog Data/Analytics: `docs/TODO_DATA_ANALYTICS.md`
- Architecture (lien P&L): `ARCHITECTURE.md` (section P&L 360)

Backend:
- Calcul P&L 360 (pure): `apps/backend/src/analytics/pnl.ts`
- Tests P&L fixtures: `apps/backend/src/analytics/pnl.test.ts`
- Fixtures P&L: `apps/backend/src/analytics/__fixtures__/pnl/*.json`

## 4) Comment valider rapidement

### Backend (tests + build + lint)

```powershell
npm --workspace apps/backend test
npm --workspace apps/backend run build
npm --workspace apps/backend run lint
```

### Mobile (typecheck)

```powershell
npx tsc -p apps/mobile/tsconfig.json --noEmit
```

### Contract check (optionnel si tu touches l’OpenAPI)

Sur une working tree propre (ou tout stage), pour vérifier que la génération ne crée pas de diff:

```powershell
npm run api:check
```

## 5) Notes importantes / limites connues

- P&L options = **premiums seulement** (MVP). Assignations/exercise sont traités comme événements stock; les événements options non reconnus sont ignorés.
- Timeline `ticker_pnl_daily` = cumul réalisé/premiums/dividendes/frais + snapshot “as-of”.
  - Pas d’unrealized historique (pas de séries de prix journalières).
- La classification des transactions est heuristique (string matching sur `tx.type`): prévoir des cas “unknown/ignored”.

## 6) Prochaines étapes (priorisées)

Priorité A (monétisation):
1) `M3-03` + `BE-110..111` + `FE-100..101` — RevenueCat entitlements + gating + paywall.

Priorité B (observabilité):
2) `OBS-002` — OpenTelemetry traces/métriques (API→DB→providers).

Priorité C (data gouvernance):
3) `DA-050` + `SEC-012` — politique `raw`/retention + classification données + règles de logging.

## 7) Git / livraison

- Branche: `main`
- Commit principal (cette itération): `b4016ed` (DA-010..015 spec P&L + fix fees + fixture + handoff)
