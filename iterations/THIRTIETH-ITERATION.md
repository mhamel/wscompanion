# THIRTIETH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Objectif projet (rappel): Companion Wealthsimple (via SnapTrade) — aider l’utilisateur à comprendre P&L 360°, wheel, news, alertes, exports, avec confiance/traçabilité et sans “conseil financier”.

Objectif de cette itération: rendre le disclaimer “pas de conseil financier” réellement *exécutoire* sur une feature sensible (Ask), avec un UX mobile explicite.

## 1) Ce qui a été fait

### Backend

- Ajout d’un **gate** “disclaimer accepté”:
  - Nouveau: `apps/backend/src/disclaimerGate.ts`
  - Expose `requireRiskDisclaimerAccepted(req)` qui vérifie:
    - `UserPreferences.riskDisclaimerAcceptedAt` présent
    - `UserPreferences.riskDisclaimerVersionAccepted === RISK_DISCLAIMER_VERSION`
  - Sinon: erreur `403` avec:
    - `code: "DISCLAIMER_REQUIRED"`
    - `details.requiredVersion` + infos acceptation
- Wiring Fastify:
  - `apps/backend/src/server.ts` décore `app.requireRiskDisclaimer`
  - `apps/backend/src/fastify.d.ts` ajoute le type `requireRiskDisclaimer`
- Gating effectif:
  - `apps/backend/src/routes/ask.ts` ajoute `app.requireRiskDisclaimer` au `preHandler`
  - Schéma OpenAPI mis à jour (ajout de `403` sur `/v1/ask`)
- Test d’intégration (DB):
  - `apps/backend/src/routes/ask.disclaimer.test.ts`
  - Vérifie:
    - `DISCLAIMER_REQUIRED` si non accepté
    - `200` si accepté
  - Skipped si `DATABASE_URL` absent (comme d’autres tests DB)

### Mobile

- Gestion UX quand le backend refuse Ask:
  - Nouveau helper: `apps/mobile/src/disclaimer/disclaimer.ts` → `isDisclaimerRequiredError`
  - `apps/mobile/src/screens/AskScreen.tsx`:
    - intercepte `DISCLAIMER_REQUIRED`
    - affiche un bloc “Action requise” + bouton vers `Settings`
    - (l’acceptation se fait dans `SettingsScreen` via “Lire”/“Accepter”)

### Contrats

- `npm run api:generate` a régénéré:
  - `packages/contract/openapi.json`
  - `apps/mobile/src/api/schema.ts`

### Docs

- `docs/DISCLAIMER.md` reflète maintenant le fait que Ask est gated + le code erreur.

## 2) Comment valider

### Contract/OpenAPI

```powershell
npm run api:generate
npm run api:check
```

### Backend

```powershell
npm --workspace apps/backend run lint
npm --workspace apps/backend run format
npm --workspace apps/backend test
npm --workspace apps/backend run build
```

Test DB (optionnel, nécessite Postgres):
```powershell
docker-compose up -d postgres
$env:DATABASE_URL='postgresql://justlove:justlove@localhost:5432/justlove?schema=public'
npm --workspace apps/backend exec prisma migrate deploy
npm --workspace apps/backend test -- -t "POST /v1/ask (disclaimer gate)"
```

### Mobile (typecheck)

```powershell
npx tsc -p apps/mobile/tsconfig.json --noEmit
```

Manuel (mobile):
1) Avoir un user Pro (ou override) et aller dans l’onglet “Ask”
2) Si disclaimer non accepté → message + bouton vers “Paramètres”
3) Dans “Paramètres” → “Lire l’avertissement” puis “Accepter”
4) Retour Ask → l’appel fonctionne

## 3) Notes / limites / next steps

- Pour l’instant, seul `POST /v1/ask` est gated. Si on veut un *onboarding* plus strict, on peut:
  - afficher un modal de disclaimer à la 1ère ouverture (root navigator)
  - ou étendre le gate à d’autres endpoints “sensibles”
- Le gate est **versionné**: si `RISK_DISCLAIMER_VERSION` change, l’utilisateur devra ré-accepter (comportement voulu).
- Backlog pertinent:
  - `docs/TODO_SECURITY_QA_OBS.md` → `SEC-005` (ToS review) + éventuellement étendre les disclaimers
  - `docs/TODO_SECURITY_QA_OBS.md` → `SEC-002` (stratégie chiffrement tokens/secrets)

## 4) Git

- Branche: `main`
- Commit: à créer dans cette itération (voir `git log -1` après commit)

