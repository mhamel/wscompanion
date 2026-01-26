# SIXTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Objectif de ce document: donner au prochain une reprise **autonome** (objectif produit, ce qui est livré, où regarder, comment lancer, état git, quoi faire ensuite).

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

Règle d’or: **un TODO à la fois**. Implémenter → valider → cocher le TODO → commit → suivant.

Note (Windows/encoding): si le Markdown semble “garbled” dans PowerShell, lire avec `Get-Content -Encoding utf8 ...`.

## 1) Objectif du projet (le “pourquoi”)

App compagnon (mobile) qui se connecte à Wealthsimple via **SnapTrade** (lecture seule par défaut) et donne 2–3 features “power user”:

- P&L 360 par ticker (le “wow”)
- Wheel / covered calls tracker
- Exports CSV “comptable-friendly”
- News + alertes (push) pour rétention + confiance

Critères de succès:
- “Time to wow” < 2 minutes après connexion SnapTrade (sync initial → P&L visible).
- Confiance: posture privacy claire (disconnect/purge), pas de fuite de secrets.

## 2) Ce qui a été fait dans cette itération

Objectif atteint: `SEC-010` (Disconnect SnapTrade) est maintenant implémenté **end-to-end** (backend + mobile).

### Backend (API + worker)

- Ajout API connexions:
  - `GET /v1/connections` — liste des connexions (sans secrets).
  - `DELETE /v1/connections/:id` — “disconnect”: `status=disconnected`, purge `accessTokenEnc/refreshTokenEnc`, stop sync.
- “Stop sync” robuste:
  - `POST /v1/connections/:id/sync` refuse si la connexion n’est pas `connected` (409 `CONNECTION_NOT_CONNECTED`).
  - Le worker refuse d’exécuter un job de sync si la connexion n’est pas `connected` (évite qu’un job en file continue après un disconnect).

### Mobile (Expo)

- Nouveau `ConnectionsScreen` (FE-110): statut SnapTrade, “sync now”, disconnect (avec confirmation).
- UX “safe” après disconnect:
  - `HomeScreen` n’essaie plus de sync une connexion `disconnected` (bouton → “Connexions”).
  - `PortfolioScreen` ne fait plus la connexion directement; bouton “Gérer la connexion” ouvre `ConnectionsScreen`.

### Docs/contrat

- Backlog mis à jour:
  - `docs/TODO_SECURITY_QA_OBS.md` → `SEC-010` coché.
  - `docs/TODO_MOBILE.md` → `FE-110` coché.
- Contrat OpenAPI + types régénérés via `npm run api:generate`:
  - `packages/contract/openapi.json`
  - `apps/mobile/src/api/schema.ts`

## 3) Où regarder (entry points “haute valeur”)

Backend:
- Connexions: `apps/backend/src/routes/connections.ts`
- Sync manuel + guard: `apps/backend/src/routes/sync.ts`
- Worker (guard stop-sync): `apps/backend/src/worker.ts`

Mobile:
- Screen: `apps/mobile/src/screens/ConnectionsScreen.tsx`
- Navigation: `apps/mobile/src/navigation/MainStack.tsx`
- Home “sync → connexions”: `apps/mobile/src/screens/HomeScreen.tsx`
- Portfolio “gérer connexion”: `apps/mobile/src/screens/PortfolioScreen.tsx`
- Client API: `apps/mobile/src/api/client.ts`

## 4) Comment valider rapidement

### Génération contrat

```powershell
npm run api:generate
```

### Backend

```powershell
npm --workspace apps/backend test
npm --workspace apps/backend run build
```

### Mobile

```powershell
cd apps/mobile; npx tsc --noEmit
```

## 5) Notes importantes / limites connues

- Le “disconnect” purge les **tokens** et stoppe la sync, mais ne supprime pas (encore) les données déjà importées.
  - C’est intentionnel pour `SEC-010` (trust + contrôle). La purge complète des données est plutôt du scope `SEC-011`.
- `GET /v1/sync/status` retourne aussi les connexions `disconnected` (utile UX). Les écrans utilisent `status === 'connected'` pour décider si on peut “sync”.

## 6) Prochaines étapes (priorisées)

Priorité A (trust):
1) `SEC-011` Suppression compte / purge données (politique + implémentation).

Priorité B (Settings):
2) `FE-111` SettingsScreen (confidentialité, support, suppression compte) + wiring navigation.

Priorité C (monétisation):
3) `BE-110..111` RevenueCat entitlements + gates API, puis `FE-100..101`.

