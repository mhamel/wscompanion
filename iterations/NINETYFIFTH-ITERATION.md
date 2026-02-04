# NINETYFIFTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): make backend connectivity/debugging a single step (instead of running multiple endpoint checks manually).

Iteration goal: add a small probe script + VS Code task to check `/v1/health`, `/v1/ready`, `/v1/version` with one command.

## 1) What changed

### Probe script

- `scripts/dev/probe-backend.js`
  - Probes:
    - `/v1/health`
    - `/v1/ready`
    - `/v1/version`
  - Prints status + latency for each.
  - Prints a short body snippet when an endpoint fails.
  - Exits non-zero if any probe fails (useful for automation).

### VS Code Tasks

- `.vscode/tasks.json`
  - Adds `Backend: Probe (health + ready + version)`

### Docs

- `docs/BACKEND_DEV.md`
  - Mentions the new probe task.

## 2) How to use

- VS Code: `Backend: Probe (health + ready + version)`
- CLI: `node scripts/dev/probe-backend.js http://localhost:3000`

## 3) Notes / gotchas

- If backend isn’t running, the script prints “ERROR (network)” and exits with code 1.

## 4) Next steps (suggested)

- Refresh README tips to reference the probe task as a quick sanity check (optional).

## 5) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

