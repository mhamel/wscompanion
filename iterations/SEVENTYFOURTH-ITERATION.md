# SEVENTYFOURTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): enable fast, actionable debugging when the mobile app can’t reach the backend.

Iteration goal: allow developers to easily share API diagnostics output (Slack/GitHub issues) by adding “copy to clipboard”.

## 1) What changed

### Mobile: copy diagnostics output

- `apps/mobile/src/screens/SettingsScreen.tsx`
  - Adds a `Copier` button to the `API diagnostics` alert.
  - Uses `expo-clipboard` to copy the diagnostic string.

### Mobile dependency

- `apps/mobile/package.json`
  - Adds `expo-clipboard` (SDK 54 compatible).

### Docs

- `docs/MOBILE_DEV.md`
  - Mentions that `Diagnostics API` can be copied to clipboard.

## 2) How to use

- Mobile: `Paramètres` -> `Dev` -> `Diagnostics API (health + ready + version)`
- Tap `Copier`, then paste into your issue/Slack message.

## 3) Notes / gotchas

- `npm audit` still reports vulnerabilities in the repo dependency tree; intentionally not auto-fixed here (avoid breaking changes).

## 4) Next steps (suggested)

- Add prompt-based “fresh clone + seed + run” tasks so seeding is for *your* email by default (not only demo user).

## 5) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

