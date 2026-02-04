# SEVENTYFIFTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): keep the dev loop smooth for real users (OTP email) — not only the hard-coded demo user.

Iteration goal: add prompt-based VS Code “fresh clone” and “reset DB” flows that seed data for *your* email automatically.

## 1) What changed

### VS Code Tasks

- `.vscode/tasks.json`
  - Adds:
    - `Dev: Fresh clone (Bootstrap + Seed Prompt + Run)`
    - `Dev: Reset DB (DANGEROUS) + Seed Prompt + Run`
  - Both rely on the existing `seedEmail` input (prompt) via `Backend: Seed dev data (prompt email)`.

### Docs

- `docs/MOBILE_DEV.md`
  - Documents the new prompt-based tasks.
- `docs/BACKEND_DEV.md`
  - Documents the new prompt-based tasks.

## 2) How to use

- First run on a new machine (seed your email):
  - VS Code: `Dev: Fresh clone (Bootstrap + Seed Prompt + Run)`
- Recovery when DB is broken (seed your email):
  - VS Code: `Dev: Reset DB (DANGEROUS) + Seed Prompt + Run`

## 3) Next steps (suggested)

- Improve mobile dev status display (show whether override baseUrl is active and show backend version inline).

## 4) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

