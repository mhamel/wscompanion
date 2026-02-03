# TWENTY-FIFTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Objectif: handoff autonome.

## 1) Ce qui a été fait

Objectif atteint: **PL-011** — CI OpenAPI breaking-change check (PR).

- Ajout d’un script repo-local (sans dépendance) qui compare l’OpenAPI HEAD vs base PR:
  - `scripts/openapi-breaking-check.js`
  - Détecte breaking minimum: opérations (path+method) supprimées + schemas supprimés.
  - Skip automatique hors PR (pas de `GITHUB_BASE_REF`).
- Ajout script npm:
  - `package.json` → `api:breaking`
- CI:
  - `.github/workflows/ci.yml`: `fetch-depth: 0` + step `OpenAPI breaking check (PR)`
- Backlog:
  - `docs/TODO_PLATFORM_DEVOPS.md`: `PL-011` coché.

## 2) Comment valider

Local (simule “non PR”):
```powershell
npm run api:breaking
```

En PR GitHub: le step s’exécute automatiquement (compare à `origin/${GITHUB_BASE_REF}`).

## 3) Notes / limites

- Le check est volontairement “MVP”: il ne détecte pas encore les changements subtils (enum values, required props, etc.).
- Amélioration future: analyser les changements de schémas (required/properties) et paramètres.

## 4) Git

- Branche: `main`
- Commit: voir `git log -1` (message: `ci: add OpenAPI breaking-change check for PRs`)

