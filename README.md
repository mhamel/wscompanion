# wscompanion

Companion Wealthsimple (via SnapTrade) — vision produit: `PRODUIT.md`, architecture: `ARCHITECTURE.md`.

## Dev quickstart

- Mobile (Expo, Android emulator + iOS device): `docs/MOBILE_DEV.md`
- Backlog: `docs/TODO_INDEX.md`

Tip: dans VS Code, `Run Task...` -> `Dev: Full stack (Infra + Backend + Mobile)` pour démarrer rapidement (infra + API + worker + Metro).

## Backlog

- Point d’entrée: `docs/TODO_INDEX.md`

## Structure (monorepo)

- `apps/backend` — API Fastify + worker BullMQ (Node.js/TS)
- `apps/mobile` — app mobile Expo (React Native/TS)
- `packages/*` — packages partagés (contrats, utilitaires)
