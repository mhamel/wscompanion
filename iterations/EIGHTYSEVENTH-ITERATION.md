# EIGHTYSEVENTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): reduce onboarding time by making “what’s wrong with my setup?” self-serve.

Iteration goal: add a VS Code runnable “Dev Doctor” that performs quick preflight checks (tools, env files, ports).

## 1) What changed

### Dev Doctor script

- `scripts/dev/doctor.ps1`
  - Checks:
    - node + npm presence/versions
    - docker presence + server reachability
    - expected `.env` / `.env.example` files for backend + mobile
    - common localhost ports (Postgres/Redis/MinIO/Mailhog/Jaeger/API)
    - optional Android tooling hints (adb + ANDROID_SDK_ROOT)
  - Prints suggested next steps tasks.

### VS Code Tasks

- `.vscode/tasks.json`
  - Adds `Dev: Doctor (preflight checks)` to run the script.

### Docs

- `docs/MOBILE_DEV.md` and `docs/BACKEND_DEV.md`
  - Mention the new preflight task.

## 2) How to use

- VS Code: `Run Task...` -> `Dev: Doctor (preflight checks)`

Fix the reported WARN/ERRORs, then rerun.

## 3) Next steps (suggested)

- Add an env bootstrap task to copy `.env.example` → `.env` automatically (safe defaults for local dev).

## 4) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

