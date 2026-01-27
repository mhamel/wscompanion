# FOURTEENTH ITERATION (Knowledge Transfer)

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
  - Data/Analytics: `docs/TODO_DATA_ANALYTICS.md`
  - Platform/DevOps: `docs/TODO_PLATFORM_DEVOPS.md`
  - Security/QA/Obs: `docs/TODO_SECURITY_QA_OBS.md`
- Historique des itérations (handoffs): `iterations/*.md`
- Guide tests (QA-001): `docs/TESTING.md`

Règle d’or: **un TODO à la fois**. Implémenter → valider → cocher le TODO → commit → suivant.

## 1) Objectif du projet (rappel)

Companion mobile (Expo) connecté à Wealthsimple via SnapTrade (lecture seule par défaut) avec:
- P&L 360 par ticker (time-to-wow < 2 min après connexion)
- Wheel / covered calls tracker
- Exports “comptable-friendly”
- News + alertes (push)

## 2) Ce qui a été fait dans cette itération

Objectif atteint: `M3-03` + `BE-110..111` + `FE-100..101` — **RevenueCat entitlements + paywall + gating** (monétisation MVP).

### Backend

- Ajout du webhook RevenueCat: `POST /v1/billing/webhook/revenuecat`
  - Auth par token (`REVENUECAT_WEBHOOK_AUTH_TOKEN`)
  - Mapping “Pro” par entitlement id (`REVENUECAT_PRO_ENTITLEMENT_ID`, défaut `pro`)
  - Upsert `entitlements` en DB + invalidation cache Redis (`entitlement:plan:<userId>`)
- Feature gates côté API (paywall “soft” via UI + enforcement serveur):
  - `wheel/*` → **Pro requis** (403 `PAYWALL`)
  - `alerts`: create/update/delete → **Pro requis**; list/events renvoient vide si free (teaser)
  - `exports`: `user_data` reste **gratuit**; les exports CSV “comptables” sont **Pro requis** + download protégé

### Mobile

- Intégration SDK RevenueCat: `react-native-purchases`
- Nouvel écran `PaywallScreen` + accès depuis Settings (section “Abonnement”)
- État entitlements côté app: hook `useBillingEntitlementQuery()` (source de vérité = `GET /v1/billing/entitlement`)
- Gating UI (teaser) sur:
  - Alerts: CTA “Créer une alerte” → paywall si free
  - CreateAlertScreen: bloque si free
  - TickerScreen (tab Wheel): paywall si free (pas d’appels API)
  - ExportsScreen: paywall si free pour la création d’exports CSV (downloads “user_data” restent possibles)

### Docs

- Backlog mis à jour: `M3-03`, `BE-110..111`, `FE-100..101` cochés.
- `ARCHITECTURE.md` aligné sur le schéma réel (`entitlements`, `user_preferences`) + notes d’implémentation RevenueCat.
- Env examples mis à jour:
  - Backend: `apps/backend/.env.example`
  - Mobile: `apps/mobile/.env.example`

## 3) Où regarder (entry points “haute valeur”)

Backend:
- Webhook + entitlement endpoint: `apps/backend/src/routes/billing.ts`
- Calcul entitlements + cache: `apps/backend/src/entitlements.ts`
- Gates:
  - Wheel: `apps/backend/src/routes/wheel.ts`
  - Alerts: `apps/backend/src/routes/alerts.ts`
  - Exports: `apps/backend/src/routes/exports.ts`
- Variables d’env: `apps/backend/.env.example`

Mobile:
- Paywall: `apps/mobile/src/screens/PaywallScreen.tsx`
- RevenueCat wrapper: `apps/mobile/src/billing/revenuecat.ts`
- Entitlements hook + helper: `apps/mobile/src/billing/entitlements.ts`, `apps/mobile/src/billing/paywall.ts`
- Navigation: `apps/mobile/src/navigation/MainStack.tsx`
- Gating UI: `apps/mobile/src/screens/AlertsScreen.tsx`, `apps/mobile/src/screens/CreateAlertScreen.tsx`, `apps/mobile/src/screens/TickerScreen.tsx`, `apps/mobile/src/screens/ExportsScreen.tsx`
- Variables d’env: `apps/mobile/.env.example`

## 4) Comment valider rapidement

### Backend (tests + build + lint)

```powershell
npm --workspace apps/backend test
npm --workspace apps/backend run build
npm --workspace apps/backend run lint
```

### Contract check (OpenAPI)

Sur une working tree propre (ou tout stage), pour vérifier que la génération ne crée pas de diff:

```powershell
npm run api:check
```

### Mobile (typecheck)

```powershell
npx tsc -p apps/mobile/tsconfig.json --noEmit
```

### Smoke test (dev) — sans RevenueCat

Tu peux tester le gating sans setup RevenueCat en forçant un user en Pro:
- Récupère ton `userId` via `GET /v1/me` (ou logs DB)
- Mets `ENTITLEMENT_OVERRIDE_PRO_USER_IDS=<uuid>` côté backend puis redémarre
- Vérifie `GET /v1/billing/entitlement` (plan=pro) et que wheel/alerts/exports se débloquent

### Tester le webhook (manuel)

- Configure `REVENUECAT_WEBHOOK_AUTH_TOKEN` et poste un payload minimal contenant:
  - `event.app_user_id = <uuid user>`
  - `event.entitlement_ids = ["pro"]`
  - `event.expiration_at_ms = <epoch ms>`

Puis vérifie `GET /v1/billing/entitlement`.

## 5) Notes importantes / limites connues

- Le paywall achète **le premier package** de l’offering courant (MVP). Pas de choix plan/mois/année pour l’instant.
- RevenueCat n’est pas supporté sur web (le bouton est désactivé sur `Platform.OS === "web"`).
- Le backend est la source de vérité opérationnelle; après achat, l’activation peut prendre un délai (webhook).
- Gating “teaser” minimal: certaines vues affichent un message “Pro requis” plutôt qu’un blur/preview avancé.

## 6) Prochaines étapes (priorisées)

Priorité A (UX paywall / conversion):
1) Améliorer `PaywallScreen`: afficher offering + prix + essais, gérer cancel/restore proprement, lien “gérer abonnement”.
2) Ajouter instrumentation funnel (`AN-001`): paywall shown, purchase started/succeeded, restore, etc.

Priorité B (observabilité):
3) `OBS-002` — OpenTelemetry traces/métriques (API→DB→providers).

Priorité C (monétisation fine):
4) Gating P&L “free” vs “pro” (ex: limiter à 1–2 tickers, teaser sur le reste) + règles produit.

## 7) Git / livraison

- Branche: `main`
- Commit principal (cette itération): `7228e47` (M3-03 RevenueCat entitlements + paywall + gates)
