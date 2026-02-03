# THIRTY-SIXTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Objectif projet (rappel): Companion Wealthsimple (via SnapTrade) — conserver des données utiles (Ask, exports, analytics) mais avec une hygiène “production” (rétention, coûts, privacy).

Objectif de cette itération: ajouter une **rétention automatique** pour l’historique Ask via un job worker (maintenance).

## 1) Ce qui a été fait

### Backend — retention config

- `apps/backend/src/assistant/askRetention.ts`
  - `ASK_RETENTION_DAYS` (défaut 180)
  - `computeAskRetentionCutoff(...)` (retourne `null` si désactivé)

### Worker — maintenance queue + prune

- `apps/backend/src/worker.ts`
  - Ajout queue + DLQ:
    - `maintenance` + `maintenance-dlq`
  - Schedule:
    - job `ask-prune` (défaut daily via `ASK_PRUNE_SCHEDULE_EVERY_SECONDS`)
  - Handler:
    - supprime `AskThread` dont `lastMessageAt < cutoff` (cascade DB supprime `AskMessage`)
  - Shutdown:
    - ferme `maintenanceWorker`, `maintenanceQueue`, `maintenanceDlq`

### Config & docs

- `apps/backend/.env.example` ajoute:
  - `ASK_RETENTION_DAYS`
  - `ASK_PRUNE_SCHEDULE_EVERY_SECONDS`
- `docs/ASK.md` documente la rétention + la queue `maintenance`

## 2) Comment valider

```powershell
npm --workspace apps/backend run lint
npm --workspace apps/backend run format
npm --workspace apps/backend test
npm --workspace apps/backend run build
```

Validation fonctionnelle (avec worker en cours):
1) Configurer `ASK_RETENTION_DAYS=1` (par ex) et `ASK_PRUNE_SCHEDULE_EVERY_SECONDS=60`
2) Créer des threads Ask (et manipuler `lastMessageAt` en DB si besoin)
3) Attendre 60s → vérifier que les threads plus vieux que le cutoff sont supprimés

## 3) Notes / limites / next steps

- Rétention est **opt-out**: `ASK_RETENTION_DAYS=0` désactive la suppression.
- Next: étendre la queue `maintenance` à d’autres tâches (exports retention, nettoyage de DLQ, etc.) si nécessaire.

## 4) Git

- Branche: `main`
- Commit: à créer dans cette itération (voir `git log -1` après commit)

