# THIRTY-FOURTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Objectif projet (rappel): Companion Wealthsimple (via SnapTrade) — analytics (P&L 360°, wheel), news, alertes, exports + assistant Ask, avec confiance/sécurité (privacy, redaction, rate limit).

Objectif de cette itération: compléter `BE-121` (conversations + limites) pour Ask:
- **stockage** en DB (threads + messages)
- **API** pour lister/consulter/supprimer
- **quota/rate limit** par utilisateur
- **redaction** PII “best-effort”
- **mobile**: réutiliser `threadId` pour poursuivre une conversation

## 1) Ce qui a été fait

### DB (Prisma + migrations)

- Nouvelles tables:
  - `AskThread` (user-scoped, tri via `lastMessageAt`)
  - `AskMessage` (messages “user”/“assistant”, payload `data` JSON optionnel)
- Fichiers:
  - `apps/backend/prisma/schema.prisma`
  - migration manuelle: `apps/backend/prisma/migrations/20260203000010_ask_threads/migration.sql`
    - note: docker n’était pas disponible localement (daemon non démarré), donc migration écrite à la main (mais alignée au style Prisma existant).

### Backend API (Ask)

- `POST /v1/ask` enrichi:
  - accepte `threadId` (optionnel)
  - retourne toujours `threadId`
  - enregistre 2 messages (user + assistant) dans la thread correspondante
  - met à jour `AskThread.lastMessageAt`
- Nouveaux endpoints (Pro + disclaimer requis):
  - `GET /v1/ask/threads` (paginé cursor)
  - `GET /v1/ask/threads/:id` (messages paginés)
  - `DELETE /v1/ask/threads/:id`
- Quota / rate limit:
  - `apps/backend/src/assistant/askQuota.ts` → `ASK_RATE_WINDOW_SECONDS` + `ASK_RATE_MAX`
  - erreur `429` avec `code: "ASK_RATE_LIMITED"`
- Redaction PII “best-effort” avant stockage:
  - `apps/backend/src/assistant/redaction.ts` (email / phone / token-ish + clamp longueur)
- Purge account delete:
  - `apps/backend/src/routes/auth.ts` supprime aussi `AskThread` (cascade sur messages)
  - `apps/backend/src/routes/meDelete.test.ts` inclut maintenant Ask dans la purge

### Mobile

- `apps/mobile/src/api/client.ts`:
  - `AskResponse` inclut `threadId`
  - `ask(...)` accepte `threadId?`
- `apps/mobile/src/screens/AskScreen.tsx`:
  - conserve `threadId` et le renvoie à chaque “Demander”
  - bouton “Nouvelle conversation” pour reset local (nouveau thread au prochain call)

### Contrats & docs

- `npm run api:generate` régénère:
  - `packages/contract/openapi.json`
  - `apps/mobile/src/api/schema.ts`
- Docs:
  - `docs/ASK.md` décrit threads + quota + redaction
  - `docs/TODO_BACKEND.md` marque `BE-121` comme fait
  - `apps/backend/.env.example` documente `ASK_RATE_*`

## 2) Comment valider

### API types (contrat)

```powershell
npm run api:check
```

### Backend (sans DB)

```powershell
npm --workspace apps/backend run db:generate
npm --workspace apps/backend run lint
npm --workspace apps/backend run format
npm --workspace apps/backend test
npm --workspace apps/backend run build
```

### Backend (avec Postgres)

Appliquer migrations:
```powershell
$env:DATABASE_URL='postgresql://justlove:justlove@localhost:5432/justlove?schema=public'
npm --workspace apps/backend exec prisma migrate deploy
```

Test DB (optionnel):
```powershell
npm --workspace apps/backend test -- -t \"DELETE /v1/me\"
```

### Mobile

```powershell
npx tsc -p apps/mobile/tsconfig.json --noEmit
```

Manuel:
1) Ask (Pro + disclaimer accepté) → poser une question → `threadId` est créé
2) Poser une 2e question → même thread (threadId réutilisé)
3) “Nouvelle conversation” → prochain ask crée une nouvelle thread

## 3) Notes / limites / next steps

- Le stockage Ask est MVP:
  - pas de UI de listing/historique côté mobile (les endpoints existent).
- Redaction PII est heuristique (regex) — OK MVP, mais à durcir si on passe à un vrai LLM (risque PII).
- Quotas: une seule couche (window+max). Next possible: quota journalier + short-burst séparés.
- Si on veut exposer l’historique dans l’app:
  - ajouter une liste “Threads” et un écran “Thread detail” qui consomme `GET /v1/ask/threads*`.

## 4) Git

- Branche: `main`
- Commit: à créer dans cette itération (voir `git log -1` après commit)

