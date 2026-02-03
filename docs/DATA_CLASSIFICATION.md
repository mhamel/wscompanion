# Classification des données (SEC-012)

But: classifier les données manipulées par l’app (mobile + API + worker) afin de:

- **éviter la fuite** de secrets/PII/finance dans les logs, analytics, traces, ou erreurs,
- simplifier les revues sécurité,
- rendre les choix “logging / monitoring” explicites.

Ce document est un guide opérationnel (quoi logger, quoi redacter, quoi éviter).

## 1) Catégories

### A) Secrets (S0) — jamais loggés

Exemples:

- Tokens SnapTrade (access/refresh)
- Clés d’encryption (`APP_ENCRYPTION_KEY(S)`, `*_ACTIVE_KEY_ID`)
- JWT secrets (`AUTH_JWT_SECRET`)
- OTP (code), refresh tokens
- Webhook secrets (RevenueCat)
- Sentry DSN, Expo push access token, SMTP password

Règle: **NEVER LOG** (même en dev si possible). Redaction + lint/review.

### B) PII / Identifiants personnels (P1) — minimiser, redacter si possible

Exemples:

- Email
- Adresse IP
- Push token (Expo)
- External ids provider (selon le cas)

Règle:

- logs: éviter; si nécessaire → **hash / redacter**
- analytics: éviter totalement (posthog distinctId = user id interne OK)
- Sentry: éviter (pas d’email)

### C) Données financières (F1) — minimiser et agréger

Exemples:

- Transactions brutes, positions, lots, P&L détaillé
- Payloads `raw` providers (SnapTrade/news)

Règle:

- logs: **pas de payload brut**; préférer compteurs/ids internes/agrégats
- traces: idem (pas de body/payload)
- exports: OK car output attendu, mais stockage + URLs signées + rétention

### D) Identifiants internes (I0) — acceptables (pseudonymes)

Exemples:

- `userId` (UUID interne)
- `brokerConnectionId`, `syncRunId`, `exportJobId`, `wheelCycleId`, etc.

Règle: OK dans logs/traces (utile pour debug), tant qu’on ne joint pas à de la PII.

## 2) Règles de logging (API + worker)

### Ce qu’on veut voir (OK)

- `request_id`, `method`, `route`, `status_code`
- ids internes (`userId`, `syncRunId`, `exportJobId`)
- compteurs (nb transactions ingérées, nb news, durée)
- raisons d’échec “safe” (codes d’erreur, classe d’erreur)

### Ce qu’on veut éviter (NO)

- email, ip, push token
- corps de requête complet (surtout `auth/*`, `analytics/event`)
- tokens/keys/secrets
- payloads providers bruts

## 3) Règles analytics produit (PostHog)

- `distinctId`: `user_id` interne (UUID) OK.
- `properties`: uniquement des champs “produit” (plan, symbol, durations, counts).
- **Interdit**: email, ip, tokens, payloads bruts.

## 4) Règles traces (OpenTelemetry)

- Attributs OK: route, status, ids internes, queue/job.
- **Interdit**: body, headers sensibles, payloads providers, PII.

## 5) Checklist PR (rapide)

- Est-ce que je loggue du `req.body` ou un `raw` provider? → supprimer/redacter.
- Est-ce que j’ajoute un nouvel env secret? → s’assurer qu’il n’apparaît pas dans logs/analytics.
- Est-ce que j’ajoute un nouvel event analytics? → vérifier qu’il ne contient pas de PII/finance brute.

## 6) Threat model

Pour le modèle de menaces (surfaces + mitigations), voir `docs/THREAT_MODEL.md`.
