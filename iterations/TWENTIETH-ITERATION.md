# TWENTIETH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Objectif de ce document: donner au prochain une reprise **autonome** (objectif produit, ce qui est livré, où regarder, comment valider, et quoi faire ensuite).

## 0) Source de vérité (à lire en premier)

- Vision produit: `PRODUIT.md`
- Architecture + contrats + flows: `ARCHITECTURE.md`
- Backlog global (entrypoint): `docs/TODO_INDEX.md`
- Historique des itérations (handoffs): `iterations/*.md`
- CI: `.github/workflows/ci.yml`

## 1) Objectif du projet (rappel)

Companion mobile (Expo) connecté à Wealthsimple via SnapTrade (lecture seule par défaut) avec:
- P&L 360 par ticker
- Wheel tracker
- Exports
- News + alertes
- Paywall Pro + entitlements

## 2) Ce qui a été fait dans cette itération

Objectif atteint: **débloquer CI** — rendre le step `Backend format` (Prettier) green.

- Application de Prettier sur tout `apps/backend` via `npm --workspace apps/backend run format:write`.
- Validation locale que ces commandes passent:
  - `npm --workspace apps/backend run format`
  - `npm --workspace apps/backend run lint`
  - `npm --workspace apps/backend test`
  - `npm --workspace apps/backend run build`

Contexte: le CI (`.github/workflows/ci.yml`) exécute `npm --workspace apps/backend run format` et échouait si des fichiers n’étaient pas au style Prettier (fixtures JSON, tests, routes, etc.).

## 3) Où regarder

- CI: `.github/workflows/ci.yml`
- Formatting backend:
  - Script: `apps/backend/package.json` → `format` / `format:write`
  - Config: `apps/backend/.prettierrc.json`
  - Ignore: `apps/backend/.prettierignore`

## 4) Comment valider rapidement

```powershell
npm --workspace apps/backend run format
npm --workspace apps/backend run lint
npm --workspace apps/backend test
npm --workspace apps/backend run build
```

## 5) Notes importantes / limites connues

- Cette itération change beaucoup de fichiers uniquement pour le style (diff “bruyant”, mais sans impact fonctionnel).
- Si de nouveaux fichiers sont ajoutés côté backend, penser à les garder Prettier-friendly pour ne pas casser CI.

## 6) Prochaines étapes

Revenir au backlog “produit”:
1) `SEC-001` threat model + `SEC-012` classification données.
2) `BE-120` / `FE-090` Ask MVP (réponse structurée + citations).

## 7) Git / livraison

- Branche: `main`
- Commit principal (cette itération): voir `git log -1` (message: `chore: format backend with Prettier`)

