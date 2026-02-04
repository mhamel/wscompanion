# SIXTYTHIRD ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): make the mobile dev loop fast — especially the “connect the app to the correct backend” step.

Iteration goal: remove friction when switching API base URLs (Android emulator vs iOS simulator/device) by adding one-tap presets in the in-app Dev panel.

## 1) What changed

### Mobile: Dev API baseUrl presets

- `apps/mobile/src/screens/SettingsScreen.tsx`
  - Adds two preset buttons:
    - `Preset Android (10.0.2.2)` → sets override to `http://10.0.2.2:3000`
    - `Preset localhost` → sets override to `http://localhost:3000`
  - Refactors apply/reset to share a single helper:
    - Saves override, clears React Query cache, and shows a confirmation alert.

### Docs

- `docs/MOBILE_DEV.md`
  - Mentions the new presets under the “Override API baseUrl” tip.

## 2) How to use

- Mobile: `Paramètres` -> `Dev`
  - Tap `Preset Android (10.0.2.2)` when running on Android emulator and backend is on your PC.
  - Tap `Preset localhost` when running on iOS simulator (macOS) or when `localhost` is valid for your setup.

Note: on a physical phone, you usually need your PC’s LAN IP (not `localhost`).

## 3) Next steps (suggested)

- Add an optional “LAN IP preset” (manual) or a small helper to display the current device IP / hint the right baseUrl.
- Consider a “one-tap full dev sanity check” that runs `/v1/health`, `/v1/ready`, `/v1/version` sequentially.

## 4) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

