# THIRTY-EIGHTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Objectif projet (rappel): rendre le monorepo facile à cloner et à démarrer (backend + mobile), y compris via des Tasks VS Code versionnées.

Objectif de cette itération: s’assurer que les Tasks VS Code (mobile Android) sont **commitées** (pas juste locales).

## 1) Ce qui a été fait

- `.gitignore`
  - garde l’IDE noise ignoré, mais **autorise** `D:\DEVS\JUSTLOVETHESTOCKS\.vscode\tasks.json` à être versionné.
- `D:\DEVS\JUSTLOVETHESTOCKS\.vscode\tasks.json`
  - est maintenant tracké dans git (contient `Mobile: Android (Expo)` + `Mobile: Metro (Expo)`).

## 2) Comment utiliser

VS Code → `Terminal` → `Run Task...` → `Mobile: Android (Expo)`.

## 3) Notes

- On garde le reste de `.vscode/` ignoré (settings locales), seul `tasks.json` est partagé.

## 4) Git

- Branche: `main`
- Commit: à créer dans cette itération (voir `git log -1` après commit)

