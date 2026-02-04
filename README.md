# wscompanion

Companion Wealthsimple (via SnapTrade) — vision produit: `PRODUIT.md`, architecture: `ARCHITECTURE.md`.

## Dev quickstart

- Mobile (Expo, Android emulator + iOS device): `docs/MOBILE_DEV.md`
- Backend (API + worker): `docs/BACKEND_DEV.md`
- Backlog: `docs/TODO_INDEX.md`

Tips (VS Code):
- Démarrer vite: `Run Task...` -> `Dev: Full stack (Infra + Backend + Mobile)` (infra + API + worker + Metro).
- Premier setup (DB + seed): `Dev: Fresh clone (Bootstrap + Seed + Run)` (évite un UI vide sur mobile).
- Premier setup “full debug” (seed + UIs + Swagger): `Dev: Full stack (Seed Prompt pro+disclaimer + Dashboards)`.
- Onboarding (checks + env + seed + unlock + dashboards): `Dev: Onboarding (Doctor + Env + Full stack pro+disclaimer + Dashboards)`.
- iOS device (Windows): `Dev: iOS device (LAN IP first + Full stack pro+disclaimer + Dashboards)` (puis scanner le QR dans Expo Go).
- Sanity check API: `Backend: Probe (health + ready + version)`.
- Repartir clean (DB cassée): `Dev: Reset DB (DANGEROUS) + Seed + Run`.

## Backlog

- Point d’entrée: `docs/TODO_INDEX.md`

## Structure (monorepo)

- `apps/backend` — API Fastify + worker BullMQ (Node.js/TS)
- `apps/mobile` — app mobile Expo (React Native/TS)
- `packages/*` — packages partagés (contrats, utilitaires)
