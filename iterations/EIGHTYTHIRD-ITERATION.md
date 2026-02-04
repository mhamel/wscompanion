# EIGHTYTHIRD ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): shorten “debug the stack” time by making the common web UIs and endpoints one-click from VS Code.

Iteration goal: add convenience VS Code tasks to open infra UIs and backend diagnostic endpoints in a browser.

## 1) What changed

### VS Code Tasks

- `.vscode/tasks.json`
  - Adds `Infra: Open All UIs (Mailhog + Jaeger + MinIO)` (opens all three in parallel).
  - Adds browser open tasks:
    - `Backend: Open Health (/v1/health)`
    - `Backend: Open Ready (/v1/ready)`
    - `Backend: Open Version (/v1/version)`

### Docs

- `docs/BACKEND_DEV.md`
  - Documents the new tasks.

## 2) How to use

- Start infra: `Infra: Up (docker compose)`
- Open dashboards: `Infra: Open All UIs (Mailhog + Jaeger + MinIO)`
- Start backend: `Backend: API (dev)`
- Open API diagnostics endpoints via the new `Backend: Open ...` tasks.

## 3) Next steps (suggested)

- Improve the mobile Dev panel to surface entitlement + disclaimer status inline (like backend version), so “why is Ask blocked?” is obvious.

## 4) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

