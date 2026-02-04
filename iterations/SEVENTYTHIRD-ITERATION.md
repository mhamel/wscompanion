# SEVENTYTHIRD ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): make device deployment predictable — especially iOS physical devices, where `localhost` is not reachable.

Iteration goal: add a simple, built-in helper to discover your PC LAN IP and form the correct `EXPO_PUBLIC_API_BASE_URL`.

## 1) What changed

### LAN IP helper script (PowerShell)

- `scripts/dev/show-lan-ip.ps1`
  - Prints IPv4 LAN addresses (filters out loopback + APIPA)
  - Outputs suggested base URLs like `http://<ip>:3000`
  - Reminds about same-network + Windows Firewall considerations

### VS Code Tasks

- `.vscode/tasks.json`
  - Adds `Dev: Show LAN IP (for iOS device)` to run the helper script.

### Docs

- `docs/MOBILE_DEV.md`
  - Mentions the new VS Code task in the iOS physical device section.

## 2) How to use

1) Start backend locally (`Backend: API (dev)`).
2) VS Code: `Run Task...` -> `Dev: Show LAN IP (for iOS device)`
3) Use one of the suggested URLs as `EXPO_PUBLIC_API_BASE_URL` (or in the app via override).

## 3) Next steps (suggested)

- Add “copy to clipboard” for mobile diagnostics output to share in issues/Slack quickly.

## 4) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

