# Logging (observabilité) — Conventions

Objectif: avoir des logs **JSON** exploitables (API + worker) avec corrélation via `request_id`, niveaux cohérents, et **redaction** des champs sensibles.

## Source de vérité (implémentation)

- API: `apps/backend/src/server.ts`
  - Logger Fastify/Pino (stdout, JSON)
  - `x-request-id` toujours renvoyé en header de réponse
  - Si le client envoie `x-request-id` (ou `x-correlation-id`), il est réutilisé, sinon un UUID est généré
- Worker: `apps/backend/src/worker.ts`
  - Logger Pino (stdout, JSON)

## Niveaux

- Variable: `LOG_LEVEL` (ex: `debug`, `info`, `warn`, `error`)
- Par défaut: `info`

## Corrélation `request_id`

Règle: **toute requête HTTP** doit pouvoir être corrélée côté client/support.

- Header renvoyé par l’API: `x-request-id`
- Header entrant recommandé côté client: `x-request-id` (propagé par reverse-proxy / gateway si présent)
- Pour des erreurs 5xx, le `requestId` est aussi envoyé à Sentry en `extras` (voir `apps/backend/src/server.ts`).

## Redaction (données sensibles)

Redaction côté API/worker (suppression des champs dans les logs):
- `req.headers.authorization`
- `req.headers.cookie`
- `req.body.password`
- `req.body.code`
- `req.body.accessToken`
- `req.body.refreshToken`

Important: ne jamais logger de payloads SnapTrade “bruts” contenant tokens/secrets.

## Conventions de structure (recommandations)

Quand tu ajoutes des logs:

- Message humain court + champs structurés
  - ✅ `logger.warn({ userId, symbol }, "alerts: delivery errors")`
  - ❌ `logger.warn("alerts delivery errors for user", userId, symbol)`
- Inclure le contexte minimal pour agir
  - API: `method`, `route`, `status_code`, `userId` si dispo, `request_id` (via header)
  - Worker: `queue`, `job`, `jobId`, `userId` si pertinent
- Ne pas inclure de PII (email/nom), ni de contenu “finance” brut inutile

## Debug rapide

1) Reproduire l’appel (mobile ou curl) et récupérer `x-request-id` dans la réponse.
2) Chercher ce `request_id` dans les logs (API) et dans Sentry (erreurs API).
3) Si c’est un job, chercher par `queue`/`jobId`/`exportJobId` côté worker.

