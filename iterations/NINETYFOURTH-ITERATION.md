# NINETYFOURTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): shorten infra debugging time (docker-compose issues, service not starting, port collisions).

Iteration goal: add VS Code tasks to quickly inspect docker-compose status and tail logs per service.

## 1) What changed

### VS Code Tasks

- `.vscode/tasks.json`
  - Adds:
    - `Infra: Status (docker compose ps)`
    - `Infra: Logs (docker compose)` (tail all)
    - `Infra: Logs (postgres)`
    - `Infra: Logs (redis)`
    - `Infra: Logs (minio)`
    - `Infra: Logs (mailhog)`
    - `Infra: Logs (jaeger)`

### Docs

- `docs/BACKEND_DEV.md`
  - Documents the new infra status/log tasks.

## 2) How to use

If something is “not ready”:
1) `Infra: Status (docker compose ps)`
2) Tail the relevant service: `Infra: Logs (redis)` etc.

## 3) Next steps (suggested)

- Add a backend probe script (health/ready/version) that gives a single concise output for support/debug.

## 4) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

