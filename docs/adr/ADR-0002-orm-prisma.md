# ADR-0002 — ORM: Prisma

## Statut

Accepté

## Contexte

Le backend utilise PostgreSQL, et on veut:

- une productivité élevée (schéma typé, migrations, DX),
- des queries sûres (typing),
- une base solide pour jobs/agrégats (P&L, wheel, exports),
- une intégration simple avec un monorepo TypeScript.

## Décision

Choisir **Prisma** comme ORM + migration tool.

## Alternatives considérées

- **Drizzle**: très bon contrôle SQL, léger; DX/migrations correctes mais moins “batteries included”.
- **Kysely** + migrations maison: flexible, mais plus de code et moins d’outillage intégré.

## Conséquences

- Schéma central dans `apps/backend/prisma/schema.prisma`.
- Migrations versionnées dans `apps/backend/prisma/migrations/*`.
- Seed dev script (idempotent) pour faciliter les démos.

## Références

- `ARCHITECTURE.md#arch-stack-backend`
- `docs/TODO_BACKEND.md#be-db`

