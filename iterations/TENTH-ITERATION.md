# TENTH ITERATION (Knowledge Transfer)

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

Objectif atteint: `QA-002` — **fixtures “golden files”** pour P&L 360 + wheel detection (non-régression).

### Backend (unit tests “purs”)

- Ajout d’un set de fixtures JSON (inputs + expected sérialisé) pour:
  - P&L 360: plusieurs scénarios (fees/dividendes/options/FIFO/assignment/FX missing).
  - Wheel detection: plusieurs scénarios (cycle start, called-away close, split heuristique, legs fee/dividend).
- Refactor wheel detection pour être une fonction “pure” réutilisable:
  - Extraction de la logique depuis `worker.ts` → `apps/backend/src/analytics/wheel.ts`.
  - `worker.ts` utilise maintenant `detectWheelCycles()` + `normalizeSymbol()` importés.

### Docs / backlog

- `QA-002` coché dans `docs/TODO_SECURITY_QA_OBS.md`.
- `docs/TESTING.md` mis à jour (où sont les fixtures + quels tests les consomment).

## 3) Où regarder (entry points “haute valeur”)

Backend:
- Wheel detection (pure): `apps/backend/src/analytics/wheel.ts`
- Tests P&L fixtures: `apps/backend/src/analytics/pnl.test.ts`
- Tests wheel fixtures: `apps/backend/src/analytics/wheel.test.ts`
- Fixtures:
  - P&L: `apps/backend/src/analytics/__fixtures__/pnl/*.json`
  - Wheel: `apps/backend/src/analytics/__fixtures__/wheel/*.json`
- Worker (wire wheel detect job): `apps/backend/src/worker.ts`

Docs:
- Guide tests: `docs/TESTING.md`
- Backlog QA: `docs/TODO_SECURITY_QA_OBS.md`

## 4) Comment valider rapidement

### Backend (tests + build + lint)

```powershell
npm --workspace apps/backend test
npm --workspace apps/backend run build
npm --workspace apps/backend run lint
```

### Test d’intégration (optionnel) — purge compte

Le test `DELETE /v1/me` est **skippé** si `DATABASE_URL` n’est pas défini.

```powershell
docker-compose up -d
$env:DATABASE_URL = "postgresql://justlove:justlove@localhost:5432/justlove?schema=public"
npm --workspace apps/backend run db:migrate
npm --workspace apps/backend test
```

## 5) Notes importantes / limites connues

- Les golden files sont volontairement “bêtes”: un fichier JSON = 1 cas. Ajouter des cas est simple (copier/coller un existant).
- Wheel detection reste une heuristique MVP (ex: split sur 2e `sold_put`). Si tu changes l’algo, il faudra mettre à jour les fixtures correspondantes.

## 6) Prochaines étapes (priorisées)

Priorité A (qualité):
1) Étendre les fixtures wheel vers 10–20 scénarios “réels” (`DA-023`) + options edge cases (`DA-016`).

Priorité B (monétisation):
2) `M3-03` + `BE-110..111` + `FE-100..101` — RevenueCat entitlements + gating + paywall.

Priorité C (observabilité):
3) `OBS-002` — OpenTelemetry traces/métriques (API→DB→providers).

## 7) Git / livraison

- Branche: `main`
- Commit principal (cette itération): `abffce5` (QA-002 fixtures P&L + wheel + refactor + docs)
