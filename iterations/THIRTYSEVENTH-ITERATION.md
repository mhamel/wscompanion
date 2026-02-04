# THIRTY-SEVENTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Objectif projet (rappel): Companion Wealthsimple (via SnapTrade) — monorepo backend + mobile (Expo), avec un workflow dev simple (1 commande / 1 tâche VS Code).

Objectif de cette itération: ajouter des **Tasks VS Code** pour lancer l’app mobile sur l’émulateur Android.

## 1) Ce qui a été fait

- `D:\DEVS\JUSTLOVETHESTOCKS\.vscode\tasks.json`
  - Ajoute:
    - `Mobile: Android (Expo)` → `npm --workspace apps/mobile run android`
    - `Mobile: Metro (Expo)` → `npm --workspace apps/mobile run start`
  - Conserve la task existante `Launch Codex with Bypass`.

## 2) Comment utiliser (VS Code)

1) Ouvrir VS Code sur `D:\DEVS\JUSTLOVETHESTOCKS`
2) `Terminal` → `Run Task...`
3) Choisir:
   - `Mobile: Android (Expo)` pour démarrer Metro + ouvrir Android
   - `Mobile: Metro (Expo)` pour seulement démarrer Metro

## 3) Prérequis / dépannage

- Avoir Android Studio + un AVD configuré, et `adb` disponible dans le PATH.
- Si l’émulateur ne démarre pas automatiquement, lancer l’AVD via Android Studio, puis relancer la task.

## 4) Git

- Branche: `main`
- Commit: à créer dans cette itération (voir `git log -1` après commit)

