# EIGHTIETH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): provide a “one task” path to a fully usable dev environment, including Pro/disclaimer-gated features.

Iteration goal: add VS Code shortcuts that combine bootstrap/reset + seed (prompt email) + Pro/disclaimer unlock + run stack.

## 1) What changed

### VS Code Tasks

- `.vscode/tasks.json`
  - Adds:
    - `Dev: Fresh clone (Bootstrap + Seed Prompt pro+disclaimer + Run)`
    - `Dev: Reset DB (DANGEROUS) + Seed Prompt pro+disclaimer + Run)`
  - Both rely on `Backend: Seed dev data (prompt email, pro+disclaimer)` and the `seedEmail` input prompt.

### Docs

- `docs/MOBILE_DEV.md`
  - Documents the new pro+disclaimer tasks as optional shortcuts.
- `docs/BACKEND_DEV.md`
  - Documents the new pro+disclaimer shortcuts.

## 2) How to use

- First setup with unlocked dev user:
  - VS Code: `Dev: Fresh clone (Bootstrap + Seed Prompt pro+disclaimer + Run)`

- Recovery with unlocked dev user:
  - VS Code: `Dev: Reset DB (DANGEROUS) + Seed Prompt pro+disclaimer + Run`

## 3) Next steps (suggested)

- If these become the default, consider updating `README.md` quickstart tips to point to the “pro+disclaimer” task.

## 4) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

