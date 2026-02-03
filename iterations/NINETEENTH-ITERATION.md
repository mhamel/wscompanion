# NINETEENTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Objectif de ce document: donner au prochain une reprise **autonome** (objectif produit, ce qui est livré, où regarder, comment valider, et quoi faire ensuite).

## 0) Source de vérité (à lire en premier)

- Vision produit: `PRODUIT.md`
- Architecture + contrats + flows: `ARCHITECTURE.md`
- Backlog global (entrypoint): `docs/TODO_INDEX.md`
- TODOs détaillés:
  - Backend: `docs/TODO_BACKEND.md`
  - Mobile: `docs/TODO_MOBILE.md`
  - Security/QA/Obs: `docs/TODO_SECURITY_QA_OBS.md`
- Historique des itérations (handoffs): `iterations/*.md`
- Guide tests: `docs/TESTING.md`

## 1) Objectif du projet (rappel)

Companion mobile (Expo) connecté à Wealthsimple via SnapTrade (lecture seule par défaut) avec:
- P&L 360 par ticker (time-to-wow < 2 min après connexion)
- Wheel / covered calls tracker
- Exports “comptable-friendly”
- News + alertes (push)
- Paywall Pro (RevenueCat) + entitlements côté backend

## 2) Ce qui a été fait dans cette itération

Objectif atteint: **SEC-003 / BE-130** — rate limiting (IP + user) + protections anti-abus sur endpoints sensibles.

### Rate limiter (Redis si dispo, fallback mémoire)

- Nouveau util: `apps/backend/src/rateLimit.ts`
  - Store Redis (si `req.server.redis` est configuré) via `INCR` + `EXPIRE` + `TTL`.
  - Fallback mémoire (Map) pour dev/tests si Redis indisponible.
  - Clés de rate limit: on hash les parties “sensibles” (ex: IP) via `hashRateLimitKeyPart` pour éviter de stocker de la PII en clair dans Redis.

### Endpoints protégés

- `POST /v1/auth/start`: rate limit par IP (en plus du rate limit existant par email via DB).
- `POST /v1/auth/verify`: rate limit par IP (en plus de `attemptCount` + backoff progressif).
- `POST /v1/auth/refresh`: rate limit par IP.
- `POST /v1/analytics/event`: rate limit par user (anti-spam events).

### UX / API

- Ajout d’un header `Retry-After` (secondes) quand une `AppError` 429 contient `details.retryAfterSeconds`.
- OpenAPI + types mobile mis à jour (ajout réponse `429` pour `/v1/analytics/event`).

### Tests

- Ajout tests unitaires pour le store mémoire: `apps/backend/src/rateLimit.test.ts`

### Documentation / backlog

- `apps/backend/.env.example`: nouveaux paramètres de rate limiting.
- `docs/TODO_SECURITY_QA_OBS.md`: `SEC-003` coché.
- `docs/TODO_BACKEND.md`: `BE-130` coché.

## 3) Où regarder (entry points “haute valeur”)

- Rate limiting core: `apps/backend/src/rateLimit.ts`
- Injection rate limiting:
  - `apps/backend/src/routes/auth.ts`
  - `apps/backend/src/routes/analytics.ts`
- `Retry-After` header: `apps/backend/src/server.ts`
- Paramètres env: `apps/backend/.env.example`
- Contrat:
  - `packages/contract/openapi.json`
  - `apps/mobile/src/api/schema.ts`

## 4) Comment valider rapidement

### Build + tests backend

```powershell
npm --workspace apps/backend run build
npm --workspace apps/backend test
npm --workspace apps/backend run lint
```

### Contract / types

```powershell
npm run api:check
```

### Smoke manuel (rate limit)

1) Lancer l’API (`npm --workspace apps/backend run dev`)
2) Appeler `POST /v1/auth/start` en boucle (même IP) → attendre un `429` + vérifier `Retry-After`.
3) Appeler `POST /v1/analytics/event` en boucle (token requis) → `429` après `ANALYTICS_EVENT_RATE_MAX`.

## 5) Notes importantes / limites connues

- Le rate limit est best-effort en mode mémoire (process-local) si Redis n’est pas configuré.
- Le rate limit IP dépend de `req.ip` (attention si reverse-proxy: config `trustProxy` non traitée ici).
- Les limites sont volontairement “sûres” par défaut; ajuster via `.env` si l’app mobile est trop “bridée”.

## 6) Prochaines étapes (priorisées)

Priorité A (sécurité):
1) `SEC-001` threat model + `SEC-012` classification données (PII/secrets/finance) + règles de logging.

Priorité B (assistant):
2) `BE-120` / `FE-090` — MVP “Ask” (réponse structurée + citations).

Priorité C (infra):
3) Améliorer rate limiting “global” (au-delà des endpoints sensibles) + configuration `trustProxy`.

## 7) Git / livraison

- Branche: `main`
- Commit principal (cette itération): voir `git log -1` (message: `sec: add rate limiting for auth + analytics`)

