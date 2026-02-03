# TWENTY-NINTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Objectif: handoff autonome.

## 1) Ce qui a été fait

Objectif: disclaimer “not financial advice” versionné + acceptation utilisateur enregistrée (MVP).

### Backend

- Disclaimer source + version:
  - `apps/backend/src/disclaimer.ts`
  - `RISK_DISCLAIMER_VERSION` + `getRiskDisclaimerText()`
- Stockage acceptation:
  - `UserPreferences.riskDisclaimerAcceptedAt`
  - `UserPreferences.riskDisclaimerVersionAccepted`
  - migrations + schema:
    - `apps/backend/prisma/migrations/20260203000009_disclaimer_acceptance/migration.sql`
    - `apps/backend/prisma/schema.prisma`
- Endpoints (auth-required):
  - `GET /v1/disclaimer` (texte + version + acceptedAt)
  - `POST /v1/disclaimer/accept` (set acceptedAt + version)
  - impl: `apps/backend/src/routes/disclaimer.ts`
  - route enregistrée: `apps/backend/src/server.ts`

### Mobile

- API client:
  - `apps/mobile/src/api/client.ts` ajoute `disclaimerGet()` et `disclaimerAccept()`
- Settings:
  - `apps/mobile/src/screens/SettingsScreen.tsx` affiche statut + boutons “Lire” / “Accepter”

### Docs

- `docs/DISCLAIMER.md` décrit le wiring + prochaines étapes possibles.

## 2) Comment valider

```powershell
npm run api:generate
npm --workspace apps/backend run db:generate
npm --workspace apps/backend run lint
npm --workspace apps/backend run format
npm --workspace apps/backend test
npm --workspace apps/backend run build
npx tsc -p apps/mobile/tsconfig.json --noEmit
```

Manuel:
1) Ouvrir Settings → section “Confidentialité” → “Lire l’avertissement”
2) Cliquer “Accepter” → statut devient “accepté”

## 3) Notes / limites

- Disclaimer non “bloquant” (MVP): aucune feature n’est encore gated dessus.
- `SEC-005` (ToS review) reste à faire (différent du disclaimer technique).

## 4) Git

- Branche: `main`
- Commit: voir `git log -1` (message: `sec: add disclaimer acceptance endpoints + settings UI`)

