# SEVENTYNINTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): allow local testing of “gated” features (Pro + disclaimer gate) without needing RevenueCat/TestFlight.

Iteration goal: extend the backend dev seed script to optionally unlock Pro + accept the risk disclaimer, and expose that via VS Code tasks.

## 1) What changed

### Backend seed script: unlock options

- `apps/backend/src/scripts/seedDevData.ts`
  - New flags:
    - `--pro` seeds a local Pro entitlement for the user (if none active)
    - `--acceptDisclaimer` marks the risk disclaimer accepted (current `RISK_DISCLAIMER_VERSION`)
  - If `REDIS_URL` is set:
    - Clears `entitlement:plan:<userId>` cache when `--pro` is used
    - Still bumps PnL cache version when enabled

### VS Code Tasks

- `.vscode/tasks.json`
  - Adds:
    - `Backend: Seed dev data (demo user, pro+disclaimer)`
    - `Backend: Seed dev data (prompt email, pro+disclaimer)`

### Docs

- `docs/BACKEND_DEV.md`
  - Documents the new flags and tasks.

## 2) How to use

- Unlock dev user (demo):
  - VS Code: `Backend: Seed dev data (demo user, pro+disclaimer)`

- Unlock your own email (OTP flow):
  - VS Code: `Backend: Seed dev data (prompt email, pro+disclaimer)`

This should make Pro-only endpoints/features and Ask disclaimer-gated flows testable locally with seeded data.

## 3) Next steps (suggested)

- Add a convenience “Fresh clone + Seed Prompt (pro+disclaimer) + Run” task if this becomes the default dev flow.

## 4) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

