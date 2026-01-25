# ADR-0001 — Structure de dépôt (monorepo)

## Statut

Accepté

## Contexte

On veut paralléliser le travail (multi-agents IA) tout en gardant un contrat clair entre mobile, backend, worker et packages partagés.

## Décision

Adopter un **monorepo** avec workspaces:

- `apps/backend` — API + worker (même codebase, entrypoints séparés)
- `apps/mobile` — Expo (React Native)
- `packages/*` — partagés (ex: contrat OpenAPI, libs utilitaires)

## Conséquences

- Partage facile de contrats/types entre apps.
- CI plus simple au début; séparation en repos possible plus tard si nécessaire.
- Nécessite une discipline de frontières (domaines) pour éviter un “monolithe spaghetti”.

## Références

- `ARCHITECTURE.md#arch-architecture-logique`
- `docs/TODO_PLATFORM_DEVOPS.md#pl-top`

