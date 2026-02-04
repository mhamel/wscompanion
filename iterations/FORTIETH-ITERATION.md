# FORTIETH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): make the monorepo easy to clone and run (backend + mobile), with a smooth developer workflow (VS Code tasks, clear docs) and a usable mobile app early (even before “full iOS build” work).

Iteration goal: improve the mobile dev experience (Android emulator + iOS device) and clearly document/handle Expo Go limitations.

## 1) What changed

### VS Code tasks

- `.vscode/tasks.json`
  - Adds cache-busting variants:
    - `Mobile: Android (Expo, Clear Cache)`
    - `Mobile: Metro (Expo, Clear Cache)`

### Mobile: Expo Go limitations handled in-app (RevenueCat)

- `apps/mobile/src/billing/revenuecat.ts`
  - Adds `isRevenueCatAvailable()` (checks native module presence: `NativeModules.RNPurchases`).
  - Throws a clearer error when RevenueCat is unavailable (typical in Expo Go).
- `apps/mobile/src/screens/PaywallScreen.tsx`
  - Uses `isRevenueCatAvailable()` to disable Paywall actions and shows a friendly message explaining dev build / TestFlight is required.

### Docs

- `docs/MOBILE_DEV.md`
  - New: end-to-end instructions to run mobile on Android emulator and iOS device.
  - Explains why Expo Go won’t support RevenueCat purchases and what to do instead.
- `README.md`
  - Adds a “Dev quickstart” link to `docs/MOBILE_DEV.md`.

## 2) How to use

- Android emulator:
  - VS Code -> Run Task -> `Mobile: Android (Expo)` (or the clear-cache version).
- iOS device (Windows):
  - Run `Mobile: Metro (Expo)` and scan QR in Expo Go.
  - Ensure `EXPO_PUBLIC_API_BASE_URL` is your machine IP (not `localhost`) in `apps/mobile/.env`.

## 3) Validation

- `npx tsc -p apps/mobile/tsconfig.json --noEmit`
- `npm --workspace apps/backend test` (sanity)

## 4) Next steps

- Add an EAS “dev build” workflow for iOS (so RevenueCat + native modules can be tested on device).
- Consider adding a dedicated “Mobile: iOS (EAS dev build)” doc + scripts once the workflow is chosen.

## 5) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

