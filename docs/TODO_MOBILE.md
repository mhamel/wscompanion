<a id="todo-mobile-top"></a>
# TODO Frontend Mobile — React Native (Expo) + TypeScript

## Références

- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-stack-mobile)
- [ARCHITECTURE.md](../ARCHITECTURE.md#arch-mobile-ecrans)
- [PRODUIT.md](../PRODUIT.md#prd-top)

## Conventions

- IDs: `FE-###`
- UX cible: **search-first**, “sources partout”, empty states utiles. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-mobile-patterns).

<a id="fe-foundations"></a>
## Foundations (app, navigation, data layer)

- [x] FE-001 — Bootstrap app Expo + TS + React Navigation (tabs + stacks) + structure feature-first. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-stack-mobile).
- [x] FE-002 — Data fetching/cache: TanStack Query + client OpenAPI typé + retry/backoff. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-stack-mobile), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-api-backend).
- [ ] FE-003 — Gestion d’état UI: Zustand (auth/session/entitlements) + persistance sécurisée (Keychain/Keystore). Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-securite).
- [ ] FE-004 — Design system MVP (tokens couleurs/typo) + dark mode par défaut. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-mobile-designsystem).

<a id="fe-auth"></a>
## Auth + onboarding SnapTrade

- [ ] FE-010 — Écrans login/signup OTP + erreurs + rate-limit friendly messaging. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-api-auth), [PRODUIT.md](../PRODUIT.md#prd-confiance).
- [ ] FE-011 — Stockage tokens + refresh flow + “logout everywhere”. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-securite).
- [ ] FE-012 — Flow “Connecter Wealthsimple (via SnapTrade)” via in-app browser + deep link callback + état “sync en cours”. Réf: [PRODUIT.md](../PRODUIT.md#prd-connexion), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-onboarding).

<a id="fe-home"></a>
## Home / Dashboard (time-to-wow)

- [ ] FE-020 — HomeScreen: top tickers P&L + cartes insights + skeleton loaders. Réf: [PRODUIT.md](../PRODUIT.md#prd-pnl360), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-mobile-home).
- [ ] FE-021 — Pull-to-refresh + feedback de sync + gestion “zéro data” (CTA connecter/sync). Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-mobile-patterns).

<a id="fe-search"></a>
## Search-first (unifiée)

- [ ] FE-030 — SearchBar centrale + suggestions (tickers) + historique local + “Ask” shortcut. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-mobile-patterns).
- [ ] FE-031 — Résultats: tickers + questions (si assistant activé) + navigation rapide. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-ask).

<a id="fe-ticker"></a>
## Ticker (P&L 360° + sources)

- [ ] FE-040 — TickerScreen: summary (P&L total, primes, dividendes, fees) + tabs (Trades/News/Wheel/Insights). Réf: [PRODUIT.md](../PRODUIT.md#prd-pnl360), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-mobile-ticker).
- [ ] FE-041 — Timeline P&L (daily) + interactions “voir sources” → TransactionsFilter. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-mobile-patterns).
- [ ] FE-042 — TransactionsFilterScreen: filtres (symbol/type/date) + pagination cursor + export/share. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-api-portfolio).

<a id="fe-wheel"></a>
## Wheel / Covered Calls

- [ ] FE-050 — WheelScreen: liste cycles par ticker (open/closed) + prochaine expiration + net cycle. Réf: [PRODUIT.md](../PRODUIT.md#prd-wheel), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-mobile-wheel).
- [ ] FE-051 — WheelCycleDetailScreen: timeline legs + bouton “Corriger” (override) + confirmation. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-mobile-wheel).

<a id="fe-news"></a>
## News

- [ ] FE-060 — Onglet News sur Ticker: liste paginée, sources cliquables (web) + états empty/loading. Réf: [PRODUIT.md](../PRODUIT.md#prd-news), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-mobile-news).
- [ ] FE-061 — NewsDetail (si nécessaire): contenu, meta, “related tickers”. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-news).

<a id="fe-alerts"></a>
## Alerts

- [ ] FE-070 — AlertsScreen: règles + events récents + CTA “Créer une alerte”. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-mobile-alerts).
- [ ] FE-071 — CreateAlertScreen: templates (earnings/expiry/price/news) + validation. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-api-alerts).
- [ ] FE-072 — Push opt-in flow + settings notifications. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-api-devices).

<a id="fe-exports"></a>
## Exports

- [ ] FE-080 — ExportsScreen: liste jobs, statut, download/share. Réf: [PRODUIT.md](../PRODUIT.md#prd-exports), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-mobile-exports).
- [ ] FE-081 — “Préparer mon année” CTA + sélection période + feedback (job en cours). Réf: [PRODUIT.md](../PRODUIT.md#prd-exports).

<a id="fe-ask"></a>
## Ask (option premium)

- [ ] FE-090 — AskScreen: champ question + réponses structurées + citations cliquables. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-ask).
- [ ] FE-091 — ConversationScreen: historique, états streaming, retry, feedback “utile/pas utile”. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-api-assistant).

<a id="fe-paywall"></a>
## Paywall / Entitlements

- [ ] FE-100 — Intégration RevenueCat SDK + état entitlements + gates UI (teaser). Réf: [PRODUIT.md](../PRODUIT.md#prd-monetisation), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-monetisation).
- [ ] FE-101 — PaywallScreen: bénéfices Pro + previews + parcours upgrade non intrusif. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-mobile-patterns).

<a id="fe-settings"></a>
## Settings, confiance, privacy

- [ ] FE-110 — ConnectionsScreen: statut SnapTrade, “sync now”, disconnect. Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-flux-onboarding).
- [ ] FE-111 — SettingsScreen: devise, confidentialité, support, suppression compte. Réf: [PRODUIT.md](../PRODUIT.md#prd-confiance), [ARCHITECTURE.md](../ARCHITECTURE.md#arch-securite).
- [ ] FE-112 — États d’erreur robustes (offline, timeouts) + observabilité mobile (Sentry). Réf: [ARCHITECTURE.md](../ARCHITECTURE.md#arch-observabilite).
