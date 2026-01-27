# ADR-0004 — Billing: RevenueCat (mobile-first)

## Statut

Accepté

## Contexte

Le produit est **mobile-first** et veut un gating clair (free vs pro) avec une UX paywall non intrusive.

Contraintes:

- gérer IAP iOS/Android sans complexité excessive,
- disposer d’un modèle d’entitlements simple côté backend,
- réduire les risques de bugs de billing.

## Décision

Utiliser **RevenueCat** pour les abonnements mobile.

Le backend reste la source de vérité opérationnelle via une table `entitlements` (alimentée via webhook/polling), et applique les gates (API + cache).

## Alternatives considérées

- IAP natif uniquement: plus de code spécifique par plateforme + complexité serveurs.
- Stripe d’emblée: mieux pour web, mais friction mobile et contraintes store.

## Conséquences

- SDK RevenueCat côté mobile, synchronisation des entitlements.
- Endpoint backend pour recevoir/valider les updates.
- Doit documenter les règles d’accès (features pro/free) et les états edge (offline).

Notes d’implémentation (MVP):
- Backend: `POST /v1/billing/webhook/revenuecat` avec `REVENUECAT_WEBHOOK_AUTH_TOKEN` + `REVENUECAT_PRO_ENTITLEMENT_ID`.
- Mobile: `react-native-purchases` avec `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`.

## Références

- `PRODUIT.md#prd-monetisation`
- `ARCHITECTURE.md#arch-monetisation`
- `docs/TODO_BACKEND.md#be-entitlements`
- `docs/TODO_MOBILE.md#fe-paywall`
