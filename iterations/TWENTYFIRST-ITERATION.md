# TWENTY-FIRST ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Objectif de ce document: donner au prochain une reprise **autonome** (objectif produit, ce qui est livré, où regarder, comment valider, et quoi faire ensuite).

## 0) Source de vérité (à lire en premier)

- Vision produit: `PRODUIT.md`
- Architecture: `ARCHITECTURE.md`
- Backlog: `docs/TODO_INDEX.md`
- Sécurité/QA/Obs backlog: `docs/TODO_SECURITY_QA_OBS.md`
- Logging: `docs/LOGGING.md`

## 1) Objectif du projet (rappel)

Companion mobile (Expo) connecté à Wealthsimple via SnapTrade (lecture seule par défaut) avec:
- P&L 360 par ticker
- Wheel tracker
- Exports
- News + alertes
- Paywall Pro + entitlements

## 2) Ce qui a été fait dans cette itération

Objectif atteint: **SEC-012** — classification des données + règles logging/monitoring, et durcissement de la redaction côté backend.

### Documentation

- Nouveau doc: `docs/DATA_CLASSIFICATION.md`
  - catégories (Secrets / PII / Finance / IDs internes)
  - règles “what to log / what not to log”
  - règles analytics + traces
  - checklist PR

### Implémentation (logging / redaction)

- Redaction Fastify/Pino élargie:
  - `req.body.email`
  - `req.body.properties` (analytics ingest)
- Doc `docs/LOGGING.md` aligné sur la redaction actuelle.

### Backlog

- `docs/TODO_SECURITY_QA_OBS.md`: `SEC-012` coché.

## 3) Où regarder

- Classification: `docs/DATA_CLASSIFICATION.md`
- Conventions logging: `docs/LOGGING.md`
- Redaction API: `apps/backend/src/server.ts`
- Redaction worker: `apps/backend/src/worker.ts`

## 4) Comment valider rapidement

```powershell
npm --workspace apps/backend run format
npm --workspace apps/backend run lint
npm --workspace apps/backend test
npm --workspace apps/backend run build
```

## 5) Notes importantes / limites connues

- La redaction “req.body.properties” protège contre des events analytics mal-formés (PII) mais peut réduire le debug via logs — c’est volontaire.

## 6) Prochaines étapes (priorisées)

1) `SEC-001` threat model (mobile + API + worker + providers).
2) `SEC-004` audit logs (actions sensibles: overrides wheel, exports, disconnect).
3) `BE-120` / `FE-090` Ask MVP.

## 7) Git / livraison

- Branche: `main`
- Commit principal (cette itération): voir `git log -1` (message: `sec: add data classification + logging redaction`)

