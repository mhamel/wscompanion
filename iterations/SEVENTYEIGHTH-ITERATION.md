# SEVENTYEIGHTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): make local infra debugging fast (emails, traces, storage) without hunting for ports.

Iteration goal: add one-click VS Code tasks to open local infra UIs (Mailhog, Jaeger, MinIO console).

## 1) What changed

### VS Code Tasks

- `.vscode/tasks.json`
  - Adds:
    - `Infra: Open Mailhog (8025)`
    - `Infra: Open Jaeger (16686)`
    - `Infra: Open MinIO Console (9001)`

### Docs

- `docs/BACKEND_DEV.md`
  - Documents the URLs + points to the VS Code tasks.

## 2) How to use

1) Start infra: `Infra: Up (docker compose)`
2) Open UIs via VS Code tasks above.

## 3) Next steps (suggested)

- Extend the dev seed workflow to optionally grant a pro entitlement + accept the risk disclaimer (so gated endpoints/features can be tested locally without RevenueCat).

## 4) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

