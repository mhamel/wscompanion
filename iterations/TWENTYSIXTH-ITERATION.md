# TWENTY-SIXTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Objectif: handoff autonome.

## 1) Ce qui a été fait

Objectif atteint: **BE-120** — endpoint “Ask” MVP (sans LLM) avec réponse structurée + sources.

- Backend:
  - Route: `POST /v1/ask` (Pro-only) — `apps/backend/src/routes/ask.ts`
  - Builder déterministe: `apps/backend/src/assistant/ask.ts`
    - récupère P&L total (si dispo), count transactions 30 jours, news récentes (si symbol)
    - construit `answer` + `sections[]` + `sources[]` (internes/externes)
  - Test unitaire: `apps/backend/src/assistant/ask.test.ts`
  - Route enregistrée: `apps/backend/src/server.ts`
- Docs:
  - `docs/ASK.md`
- Backlog:
  - `docs/TODO_BACKEND.md`: `BE-120` coché
- Contrat:
  - OpenAPI export + types mobile régénérés (`/v1/ask`):
    - `packages/contract/openapi.json`
    - `apps/mobile/src/api/schema.ts`

## 2) Comment valider

```powershell
npm --workspace apps/backend run lint
npm --workspace apps/backend run format
npm --workspace apps/backend test
npm --workspace apps/backend run build
npm run api:check
```

## 3) Notes / limites

- MVP sans LLM: la réponse est “factuelle” et basée sur les données existantes (P&L, transactions, news).
- `symbol` est optionnel; extraction très simple depuis la question (à améliorer).
- Endpoint Pro-only (aligné avec vision premium).

## 4) Next step logique

Implémenter `FE-090`:
- écran Ask mobile (consommer `POST /v1/ask`, afficher sections + sources cliquables).

## 5) Git

- Branche: `main`
- Commit: voir `git log -1` (message: `feat: add Ask endpoint MVP (BE-120)`)

