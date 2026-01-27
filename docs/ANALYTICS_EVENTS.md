# Analytics produit — Plan d’événements (AN-001)

Objectif: définir un **funnel mesurable** (time‑to‑wow + conversion Pro) sans capturer de données sensibles.

Ce document est volontairement “provider‑agnostic” (PostHog / Segment / autre). Le choix d’outil et l’implémentation de tracking seront une itération séparée.

## Principes

- **Minimisation**: pas de PII (email/nom), pas de positions/transactions brutes.
- **Stabilité**: noms d’événements figés, propriétés versionnées si besoin.
- **Cohérence**: noms en `snake_case`, propriétés en `snake_case`.
- **Dédup**: prévoir des clés idempotentes quand un événement ne doit arriver qu’une fois.

## Propriétés communes (tous événements)

- `app_env`: `development|staging|production`
- `platform`: `ios|android|web`
- `app_version`: version mobile (si dispo)
- `build_number`: build mobile (si dispo)
- `user_id`: UUID interne (si dispo)
- `plan`: `free|pro` (si dispo)

## Funnel minimal (MVP)

### 1) Signup / Login

- `auth_signup_started`
  - Quand: l’utilisateur commence le flow signup
- `auth_signup_succeeded`
  - Quand: compte créé + session active
- `auth_login_succeeded`
  - Quand: login réussi (session active)

### 2) Connexion SnapTrade (Wealthsimple)

- `connect_snaptrade_started`
  - Quand: clic “Connecter Wealthsimple”
- `connect_snaptrade_completed`
  - Quand: callback réussi + connection en état “connected”
  - Propriétés: `broker` (ex: `wealthsimple`), `connection_id` (UUID interne)
- `connect_snaptrade_failed`
  - Quand: callback échoue / user cancel
  - Propriétés: `reason` (ex: `cancelled|provider_error|timeout|unknown`)

### 3) Sync initial

- `sync_initial_started`
  - Quand: première sync démarre après connexion
  - Propriétés: `sync_run_id`
- `sync_initial_completed`
  - Quand: première sync passe en “done”
  - Propriétés: `sync_run_id`, `duration_ms`, `tx_count` (optionnel, agrégé)
- `sync_initial_failed`
  - Quand: première sync échoue définitivement (DLQ / retries épuisés)
  - Propriétés: `sync_run_id`, `reason` (code stable)

### 4) First “wow”

Définition MVP: l’utilisateur voit un écran P&L “utile” (ex: Home avec top tickers ou Ticker avec P&L 360) après une sync réussie.

- `wow_first_pnl_viewed`
  - Quand: premier affichage réussi d’un écran P&L (data non vide)
  - Propriétés: `screen` (`home|ticker`), `symbols_count` (agrégé), `time_since_connect_ms` (si dispo)

### 5) Paywall / Upgrade

- `paywall_shown`
  - Quand: l’écran paywall est affiché
  - Propriétés: `source` (ex: `settings|wheel|alerts|exports`)
- `purchase_started`
  - Quand: l’utilisateur lance l’achat
  - Propriétés: `source`, `package_id` (si dispo), `price` (si dispo), `currency` (si dispo)
- `purchase_succeeded`
  - Quand: achat confirmé côté device (SDK)
  - Propriétés: `source`, `package_id`
- `purchase_failed`
  - Quand: achat échoue / cancelled
  - Propriétés: `source`, `reason` (`cancelled|store_error|unknown`)
- `restore_started`
- `restore_succeeded`
- `restore_failed`
- `entitlement_pro_activated`
  - Quand: backend voit le plan `pro` actif (source de vérité serveur)
  - Propriétés: `source` (`webhook|override`), `expires_at` (optionnel)

## Notes d’implémentation (quand tu coderas le tracking)

- Émettre les events “produit” **côté mobile** (meilleure vérité UX), et compléter par des events “système” côté backend/worker (sync/jobs).
- Pour `entitlement_pro_activated`, l’événement doit être émis côté backend (après webhook RevenueCat ou override).
- Garder une “kill switch” via env pour désactiver le tracking en dev.

