# THIRTY-FIFTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Objectif projet (rappel): Companion Wealthsimple (via SnapTrade) — insights + assistant Ask, avec UX fluide et garde-fous (Pro + disclaimer).

Objectif de cette itération: exploiter `BE-121` côté mobile en ajoutant une UX d’historique Ask (threads + messages) directement dans l’écran Ask.

## 1) Ce qui a été fait

### Mobile — API client

- `apps/mobile/src/api/client.ts`
  - Ajoute types:
    - `AskThreadsResponse`, `AskThreadDetailResponse`, etc.
  - Ajoute méthodes:
    - `askThreadsList({ cursor?, limit? })`
    - `askThreadGet({ id, cursor?, limit? })`
    - `askThreadDelete({ id })`

### Mobile — Ask UI

- `apps/mobile/src/screens/AskScreen.tsx`
  - Affiche “Conversations récentes” (si disclaimer accepté) via `GET /v1/ask/threads`
  - Permet d’ouvrir une conversation → charge les messages via `GET /v1/ask/threads/:id`
  - Affiche un mini “chat” (user vs assistant) basé sur `AskMessage.content`
  - Permet de supprimer une conversation (confirmation) via `DELETE /v1/ask/threads/:id`
  - Invalide les queries `askThreads` + `askThread` après un nouveau Ask pour refresh l’historique

### Docs

- `docs/ASK.md` mentionne maintenant l’UX threads côté mobile.

## 2) Comment valider

```powershell
npx tsc -p apps/mobile/tsconfig.json --noEmit
npm --workspace apps/backend test
```

Manuel (mobile):
1) Pro + disclaimer accepté
2) Onglet Ask → “Conversations récentes” s’affiche
3) Ouvrir une conversation → messages affichés
4) “Supprimer” → conversation supprimée + liste refresh
5) Faire un nouveau Ask → la conversation courante se met à jour (messages + liste)

## 3) Notes / limites / next steps

- UX “chat” est volontairement simple (utilise `content`), et ne re-rend pas les sections structurées stockées dans `AskMessage.data`.
  - Next: pour enrichir, parser `data` sur les messages assistant (ex: afficher `sections` + sources).
- Les queries threads sont désactivées tant que le disclaimer n’est pas accepté (évite des 403 inutiles).

## 4) Git

- Branche: `main`
- Commit: à créer dans cette itération (voir `git log -1` après commit)

