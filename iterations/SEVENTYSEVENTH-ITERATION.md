# SEVENTYSEVENTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): prevent “silent misconfiguration” when connecting the app to a backend (especially on physical devices).

Iteration goal: improve the in-app API baseUrl warning banner so it catches more common mistakes (not only `localhost`).

## 1) What changed

### Mobile: smarter baseUrl warnings

- `apps/mobile/src/ui/Screen.tsx`
  - Uses `expo-device` to detect **physical device vs emulator/simulator**.
  - Shows the dev warning banner when:
    - baseUrl points to `localhost` on any native platform (existing)
    - baseUrl points to `10.0.2.2` / `10.0.3.2` on a **physical device** (new)
    - baseUrl points to `10.0.2.2` / `10.0.3.2` on iOS simulator (new, defensive)
  - Updates the banner copy to explain the correct target (LAN IP vs emulator alias).

### Docs

- `docs/MOBILE_DEV.md`
  - Mentions the new 10.0.2.2-on-device warning.

## 2) How to use

Just run the app; in dev mode the banner will appear when the baseUrl is obviously wrong for the current environment.

## 3) Next steps (suggested)

- Add VS Code tasks to open local infra UIs (Mailhog/Jaeger/MinIO) to speed up debugging.

## 4) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

