# Threat model (SEC-001) — MVP

Scope: Companion Wealthsimple (via SnapTrade) — mobile (Expo), backend API (Fastify), worker (BullMQ), DB (Postgres), cache/queues (Redis), S3 exports (MinIO/S3), providers (SnapTrade, PostHog, Sentry, RSS/news, RevenueCat, SMTP).

Objectif: identifier les principales surfaces d’attaque et définir les mitigations minimales “MVP-safe” sans bloquer la delivery.

## 1) Hypothèses et non-objectifs

- L’app est **lecture seule** par défaut (pas d’ordres de trading).
- On ne “scrape” pas Wealthsimple: la connexion passe par SnapTrade.
- On assume un déploiement standard (K8s/containers) avec secrets en variables d’env (à durcir plus tard).
- Non-objectif: conformité réglementaire complète (mais on suit de bonnes pratiques).

## 2) Actifs à protéger

### Secrets (S0)

- Tokens SnapTrade (accès comptes/transactions)
- Secrets d’encryption (`APP_ENCRYPTION_KEY(S)`), JWT secret, OTP/refresh tokens
- Tokens fournisseurs (Expo push, RevenueCat webhook, Sentry DSN, PostHog key, SMTP pass)

### Données sensibles (P1/F1)

- Email, IP, push tokens
- Données financières (transactions, positions, P&L, exports)

Réf: `docs/DATA_CLASSIFICATION.md`

## 3) Surfaces d’attaque (vue système)

### Mobile

- Vol de tokens (Keychain/Keystore), device compromis
- Reverse engineering (app bundle), abuse d’API
- Deep links / in-app browser callback SnapTrade

### Backend API

- Auth brute force (OTP) / session hijacking
- IDOR (accès aux données d’un autre user)
- Injection (SQL via ORM), SSRF (news fetch si endpoints mal contrôlés)
- Abuse endpoints (analytics spam, exports spam)

### Worker / queues

- Poison pill jobs, retry storms
- Job payload tampering (si Redis exposé)
- Exfiltration via logs (payloads bruts)

### Infra & storage

- DB compromise (RCE, creds leak)
- S3 exports leak (URLs signées trop longues, bucket public)
- Redis exposed (data leak / job injection)

### Providers

- SnapTrade: tokens leak, scopes excessifs
- RevenueCat webhook spoof
- PostHog/Sentry: PII accidentelle dans events/errors

## 4) Principales menaces + mitigations (MVP)

### T1) Brute force OTP / credential stuffing

Mitigations:

- Rate limiting (IP + per-email) + backoff progressif: déjà implémenté (`BE-130`, `SEC-003`).
- Messages d’erreur non-oraculaires (ne pas révéler “email existe”).
- TTL OTP + invalidation des OTP en cours.

### T2) Session hijacking / token replay

Mitigations:

- Refresh tokens hashés en DB, rotation refresh, revoke on logout.
- Access token TTL court + session check server-side (`authenticate`).
- Redaction logs des tokens.

### T3) IDOR / multi-tenant break

Mitigations:

- Toutes les queries user-scopées via `userId` (prisma where clauses).
- Tests d’intégration ciblés (à renforcer).
- Interdire les accès par ids “devinables” (UUID).

### T4) Leakage via logs/analytics/traces

Mitigations:

- Redaction centralisée API/worker (incluant email, codes, tokens, `properties` analytics).
- Politique data classification (SEC-012): `docs/DATA_CLASSIFICATION.md`.
- OTel sans payloads (pas de bodies).

### T5) Provider webhook spoof (RevenueCat)

Mitigations:

- Vérification token webhook (`REVENUECAT_WEBHOOK_AUTH_TOKEN`) (déjà en place).
- Logs audit (à faire) + alerte sur taux d’échec.

### T6) Exports leak

Mitigations:

- URLs signées courtes (TTL), bucket non-public.
- Rétention/lifecycle policy (à faire côté infra), suppression sur account delete.

### T7) Queue/Redis exposed

Mitigations:

- Redis non exposé public, auth/network policies.
- DLQ + retries limités, backoff.
- OTel pour diagnostiquer storms.

## 5) Contrôles MVP (checklist)

- [x] Rate limiting endpoints sensibles (auth/analytics): `BE-130`, `SEC-003`
- [x] Redaction logs: `docs/LOGGING.md` + impl API/worker
- [x] Chiffrement tokens SnapTrade en DB (app-level)
- [x] S3 download via URL signée
- [x] Tracing (OTel) pour investigations: `docs/OPENTELEMETRY.md`
- [x] Audit logs (SEC-004) pour actions sensibles: `docs/AUDIT_LOGS.md`
- [ ] Trust proxy / IP handling explicite (si déployé derrière proxy)

## 6) Prochaines étapes sécurité (recommandées)

1. `SEC-004` audit logs + rétention (DB) + export minimal.
2. `SEC-005` review ToS SnapTrade/news + disclaimers “not financial advice”.
3. `OBS-004` définir des SLOs MVP (API + jobs) + alerting minimal.
