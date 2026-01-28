# Analytics produit (PostHog) — Implémentation & dashboards (AN-010, AN-002)

Objectif: instrumenter le funnel “time‑to‑wow” + conversion Pro **sans PII** (pas d’email/nom, pas de positions/transactions brutes).

## 1) Comment ça marche (architecture)

- Mobile émet des events “produit” via `apps/mobile/src/analytics/analytics.ts` (fonction `trackEvent()`).
  - Transport: `POST /v1/analytics/event` (API backend, auth requise).
- Backend enrichit automatiquement:
  - `user_id` (depuis le JWT),
  - `plan` (via entitlements),
  - puis forward vers PostHog (si configuré).
- Backend/worker émettent aussi des events “système” (sync initial, entitlements) directement vers PostHog.

Références:
- Endpoint API: `apps/backend/src/routes/analytics.ts`
- Client PostHog (backend/worker): `apps/backend/src/observability/productAnalytics.ts`
- Events & propriétés: `docs/ANALYTICS_EVENTS.md`

## 2) Variables d’environnement / kill switch

Mobile (`apps/mobile/.env.example`):
- `EXPO_PUBLIC_ANALYTICS_ENABLED=false`
  - `false` (défaut): aucun event envoyé à l’API.
  - `true`: l’app envoie les events au backend.

Backend (`apps/backend/.env.example`):
- `POSTHOG_API_KEY=` (vide = tracking désactivé)
- `POSTHOG_HOST=https://app.posthog.com` (ou US / self-host)
- `ANALYTICS_DISABLED=false` (si `true`, tracking désactivé même avec une clé)

## 3) Valider rapidement (dev)

1) Renseigner `POSTHOG_API_KEY` côté backend (+ `POSTHOG_HOST` si besoin), puis démarrer l’API + le worker.
2) Mettre `EXPO_PUBLIC_ANALYTICS_ENABLED=true` côté mobile et lancer l’app.
3) Utiliser “Live events” dans PostHog pour vérifier la réception:
   - login (`auth_*_succeeded`)
   - connect (`connect_snaptrade_*`)
   - paywall/purchase (`paywall_shown`, `purchase_*`, `restore_*`)
   - sync initial (worker: `sync_initial_*`)

## 4) Dashboards recommandés (PostHog)

### A) Time‑to‑wow

But: mesurer le temps entre la connexion et le premier écran P&L utile.

Events:
- `connect_snaptrade_completed`
- `wow_first_pnl_viewed`

Propriété utile:
- `time_since_connect_ms` (si dispo) sur `wow_first_pnl_viewed`

### B) Conversion Pro (paywall)

Funnels possibles:
- `paywall_shown` → `purchase_succeeded`
- ou `paywall_shown` → `entitlement_pro_activated` (vérité serveur, via webhook)

Segmentations:
- `source` (`settings|wheel|alerts|exports`)
- `platform`
- `plan`

### C) Qualité sync initial

Graphiques:
- Taux d’échec: `sync_initial_failed` (group by `reason`)
- Distribution de durée: `sync_initial_completed` (prop `duration_ms`)
- Volume agrégé: `sync_initial_completed` (prop `tx_count`)

### D) Rétention (hebdo)

Event:
- `app_opened` (startup + retour foreground, après auth)

Insights PostHog (recommandé):
- **Retention**: event = `app_opened`, interval = Weekly, “Returning users” (par cohort si besoin)
- **Stickiness**: event = `app_opened`, interval = Weekly (WAU)
