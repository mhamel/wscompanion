# FORTY-SIXTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): ship an iOS-first mobile experience, while keeping dev/test loops simple and realistic (including native modules like RevenueCat).

Iteration goal: scaffold an EAS dev build workflow so we can test native modules on iPhone (beyond Expo Go).

## 1) What changed

### EAS config (mobile)

- `apps/mobile/eas.json`
  - Adds basic EAS build profiles:
    - `development` (dev client, internal distribution)
    - `preview` (internal distribution)
    - `production` (placeholder)

- `apps/mobile/app.json`
  - Adds default identifiers required for native builds:
    - iOS `bundleIdentifier`: `com.justlovethestocks.mobile`
    - Android `package`: `com.justlovethestocks.mobile`
  - These are safe defaults for local/dev; adjust if you need unique identifiers for your Apple/Google accounts.

### Docs

- `docs/EAS_DEV_BUILD.md`
  - Step-by-step notes for creating a dev build (iOS) and running Metro in `--dev-client` mode.
- `docs/MOBILE_DEV.md`
  - Links to `docs/EAS_DEV_BUILD.md` from the Expo Go limitations section.

### VS Code Tasks

- `.vscode/tasks.json`
  - Adds:
    - `Mobile: Metro (Dev Client)` (runs `expo start --dev-client`)
    - `Mobile: EAS init` (runs `npx eas-cli init` in `apps/mobile`)
    - `Mobile: EAS build iOS (development)` (runs `npx eas-cli build --profile development --platform ios`)

## 2) How to use

1) If you are still on Expo Go: keep using `Mobile: Metro (Expo)` and ignore EAS tasks for now.
2) When you need RevenueCat/native modules on iPhone:
   - Run `Mobile: EAS init` (requires Expo login)
   - Run `Mobile: EAS build iOS (development)`
   - Launch Metro with `Mobile: Metro (Dev Client)`

## 3) Validation

- `npx tsc -p apps/mobile/tsconfig.json --noEmit`
- `.vscode/tasks.json` parses as valid JSON.

## 4) Next steps / risks

- EAS will likely add a `projectId` to Expo config during `eas init` (expected).
- For a real iOS deployment pipeline, we should add a TestFlight/production profile once bundle ids and signing are finalized.

## 5) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

