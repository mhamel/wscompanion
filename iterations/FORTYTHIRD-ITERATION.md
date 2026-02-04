# FORTY-THIRD ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): make the monorepo easy to run locally, especially the mobile app (Android emulator + iOS device), with minimal “gotchas”.

Iteration goal: reduce the #1 dev pitfall: mobile pointing to `localhost` when running on emulator/device.

## 1) What changed

### Mobile: in-app warning when API base URL is localhost (dev)

- `apps/mobile/src/ui/Screen.tsx`
  - Adds a small banner (dev-only) if `config.apiBaseUrl` points to `localhost/127.0.0.1/::1`.
  - Message explains what to use instead:
    - Android emulator: `http://10.0.2.2:3000`
    - Physical device: PC LAN IP (same Wi‑Fi)

Why: this avoids “everything loads forever” confusion on iPhone/Android emulator when API is running on the dev machine.

### Dev onboarding updates (env + docs + tasks)

- `apps/mobile/.env.example`
  - Documents recommended `EXPO_PUBLIC_API_BASE_URL` values for emulator/device.
- `docs/MOBILE_DEV.md`
  - Adds the Android emulator note (`10.0.2.2`) and mentions the in-app banner.
  - Adds an optional macOS note for iOS simulator usage.
- `.vscode/tasks.json`
  - Adds:
    - `Mobile: iOS (Expo)`
    - `Mobile: iOS (Expo, Clear Cache)`

## 2) Validation

- `npx tsc -p apps/mobile/tsconfig.json --noEmit`
- `.vscode/tasks.json` parses as valid JSON.

## 3) Next steps (good follow-ups)

- Add an EAS dev build workflow (so native modules like RevenueCat can be tested on iOS device).
- Add a “Dev: Full stack” compound flow (scripts or tasks) if desired.

## 4) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

