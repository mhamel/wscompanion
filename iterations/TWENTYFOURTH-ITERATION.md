# TWENTY-FOURTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Objectif: handoff autonome (objectif produit, livré, où regarder, comment valider, next steps).

## 0) Ce qu’il faut savoir

Beaucoup de features utilisent `req.ip` (rate limiting, audit hash). Derrière un reverse-proxy, `req.ip` peut être faux si `trustProxy` n’est pas configuré.

## 1) Ce qui a été fait

Objectif atteint: **IP handling derrière proxy** (qualité/sécurité).

- Fastify `trustProxy` configuré via env `TRUST_PROXY`:
  - `apps/backend/src/server.ts`
  - valeurs supportées: `true/false` ou nombre de hops (ex: `2`)
- `.env.example` documente `TRUST_PROXY`:
  - `apps/backend/.env.example`
- Test ajouté pour valider `x-forwarded-for` quand `TRUST_PROXY=true`:
  - `apps/backend/src/server.test.ts`

## 2) Comment valider

```powershell
npm --workspace apps/backend test
npm --workspace apps/backend run build
```

## 3) Notes importantes

- Si déployé derrière un LB/proxy, activer `TRUST_PROXY=true` pour que:
  - rate limiting IP (auth) soit correct
  - audit `ipHashHex` soit cohérent

## 4) Next steps

1) `PL-011` — breaking-change check OpenAPI en CI PR.
2) Ask MVP (`BE-120` / `FE-090`).

## 5) Git

- Branche: `main`
- Commit: voir `git log -1` (message: `chore: add trustProxy support for correct req.ip`)

