# NINETYFIRST ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): make setup issues obvious without needing to “know the gotchas”.

Iteration goal: improve Dev Doctor so it shows the current mobile API base URL and warns about common misconfigurations.

## 1) What changed

- `scripts/dev/doctor.ps1`
  - Reads `apps/mobile/.env` and prints `EXPO_PUBLIC_API_BASE_URL` when present.
  - Warns when the value is:
    - `localhost` (bad for Android emulator, bad for physical devices)
    - `10.0.2.2` / `10.0.3.2` (emulator alias; bad for physical devices)
  - Points to the relevant VS Code tasks to fix it quickly.

## 2) How to use

- VS Code: `Dev: Doctor (preflight checks)`

If it warns about baseUrl, use:
- `Dev: Set Mobile API baseUrl (Android emulator 10.0.2.2)`
- or `Dev: Set Mobile API baseUrl (LAN IP first)`
- or `Dev: Set Mobile API baseUrl (prompt)`

## 3) Next steps (suggested)

- Add a “super onboarding” task that chains: doctor → env bootstrap → onboarding full stack (already possible manually; could be made one-click).

## 4) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

