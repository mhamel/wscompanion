# EIGHTYFIFTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): reduce context switching when debugging local dev (stack + dashboards + API docs).

Iteration goal: add composite VS Code tasks that start a seeded stack and open all relevant UIs automatically.

## 1) What changed

### VS Code Tasks

- `.vscode/tasks.json`
  - Adds `Dev: Open Dashboards (Mailhog + Jaeger + MinIO + Swagger)`
  - Adds:
    - `Dev: Full stack (Seed Prompt + Dashboards)`
    - `Dev: Full stack (Seed Prompt pro+disclaimer + Dashboards)`

### Docs

- `docs/BACKEND_DEV.md`
  - Lists the new dashboards + full-stack shortcuts.
- `docs/MOBILE_DEV.md`
  - Mentions the new “full stack + dashboards + seed + unlock” option.

## 2) How to use

- Fast “everything opened” dev loop:
  - VS Code: `Dev: Full stack (Seed Prompt pro+disclaimer + Dashboards)`
  - Enter your email when prompted (seed + unlock is server-side).

## 3) Notes

- The dashboards tasks are safe to run even if services aren’t up yet (browser will just show a connection error until ready).

## 4) Next steps (suggested)

- Refresh `README.md` quickstart to point newcomers to the best “one task” flow (seed + dashboards).

## 5) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

