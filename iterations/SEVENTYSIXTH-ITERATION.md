# SEVENTYSIXTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): make local debugging self-serve — developers should immediately know what backend they’re hitting and whether an override is active.

Iteration goal: enrich the mobile Dev panel with “override status” and an inline backend version display (no need to manually tap test buttons).

## 1) What changed

### Mobile: richer dev status

- `apps/mobile/src/screens/SettingsScreen.tsx`
  - Shows:
    - Effective API base URL
    - Current override value (or `(none)`)
    - Inline backend version (`nodeEnv / gitSha / release`) fetched from `/v1/version`
  - Adds `Rafraîchir /v1/version` button (refetches the version query)

### Docs

- `docs/MOBILE_DEV.md`
  - Mentions the inline backend version status in `Paramètres -> Dev`.

## 2) How to use

- Mobile: `Paramètres` -> `Dev`
  - Look at `Override:` to confirm you’re using the intended base URL.
  - Look at `Backend:` to confirm which instance/build you’re hitting.
  - Tap `Rafraîchir /v1/version` if you just restarted backend or switched URLs.

## 3) Next steps (suggested)

- Add a visible warning if `Override:` is set but points to `localhost` while on a physical device.
- Consider surfacing the backend version in the Home screen footer (dev-only) for faster visibility.

## 4) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

