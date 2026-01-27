<a id="arch-top"></a>
# Architecture — Companion Wealthsimple (via SnapTrade)

Ce document décrit l’architecture cible (mobile + backend + données) pour livrer une app “power user” (P&L 360°, wheel tracker, exports, news) avec une UX très conviviale, inspirée des meilleurs produits “search-first” (style Perplexity): une barre de recherche centrale, des réponses claires, des “sources” cliquables, et des actions rapides.

<a id="arch-backlog"></a>
## Backlog & exécution

- Vision produit: [PRODUIT.md](PRODUIT.md#prd-top)
- Backlog global: [docs/TODO_INDEX.md](docs/TODO_INDEX.md)
- TODOs par domaine: [backend](docs/TODO_BACKEND.md#todo-backend-top), [mobile](docs/TODO_MOBILE.md#todo-mobile-top), [données](docs/TODO_DATA_ANALYTICS.md#todo-data-top), [platform](docs/TODO_PLATFORM_DEVOPS.md#todo-platform-top), [sec/qa/obs](docs/TODO_SECURITY_QA_OBS.md#todo-secqaobs-top)

<a id="arch-objectifs-produit"></a>
## Objectifs produit (architecture-driven)

- **Time-to-wow < 2 min**: connexion SnapTrade → sync initial → top tickers P&L visibles.
- **Fiabilité des chiffres**: P&L, primes, assignations, dividendes, frais, multi-comptes, multi-devises.
- **Performance**: pages ticker instantanées (pré-calcul + cache), sync incrémental, pagination.
- **Sécurité & confiance**: lecture seule par défaut, chiffrement, audit, désinscription/déconnexion facile.
- **Monétisation**: gating clair (free vs pro), instrumentation (funnel), paywall non intrusif.

<a id="arch-perimetre-principes"></a>
## Périmètre & principes

- App compagnon (pas un plugin Wealthsimple).
- Pas de conseil financier: **on explique des faits**, on donne du contexte, on affiche des sources.
- Pas de scraping fragile: **connexion via SnapTrade** + providers “news”/“market data” compatibles.

<a id="arch-stack-technique"></a>
## Stack technique

<a id="arch-stack-mobile"></a>
### Mobile

- **React Native + TypeScript** (recommandé: **Expo** pour vitesse de delivery + OTA).
- Navigation: **React Navigation** (stack + tabs).
- Data fetching/cache: **TanStack Query**.
- State UI: **Zustand** (léger).
- Charts: **victory-native** ou **react-native-svg** + lib chart.
- Auth: magic link/OTP + token JWT (stockage sécurisé: Keychain/Keystore).
- Push: Expo Push ou APNS/FCM direct (selon besoin).

<a id="arch-stack-backend"></a>
### Backend

- **Node.js + Fastify + TypeScript**.
- API contract: **OpenAPI** (via `@fastify/swagger`), versionné `/v1`.
- DB: **PostgreSQL** (15+).
- ORM: **Prisma** (ou Drizzle; Prisma recommandé pour productivité/typing).
- Cache + jobs: **Redis** + **BullMQ** (sync SnapTrade, news fetch, exports, alerting).
- Stockage fichiers: **S3-compatible** (AWS S3, R2, etc) + URLs signées.
- Observabilité: logs structurés (pino), traces (OpenTelemetry), erreurs (Sentry).

<a id="arch-stack-integrations"></a>
### Intégrations

- **SnapTrade**: authentification broker + lecture comptes/transactions/positions.
- News (MVP): **RSS/Atom** + sources publiques; puis API (Alpha Vantage/Finnhub) si besoin.
- Email/SMS: SendGrid/Postmark/Twilio (pour OTP et notifications).
- Abonnements: **RevenueCat** (recommandé mobile) ou IAP natif; Stripe si web plus tard.

<a id="arch-architecture-logique"></a>
## Architecture logique (monolithe modulaire)

On démarre en **monolithe modulaire** (un repo backend, un repo mobile) pour itérer vite, avec des frontières nettes par domaine:

- `auth` — identité, sessions, devices, entitlements (free/pro).
- `snaptrade` — connexion, tokens, sync, normalisation des données.
- `portfolio` — comptes, positions, instruments, transactions.
- `analytics` — P&L 360, timelines, agrégats, comparatifs.
- `wheel` — cycles, legs, détection auto + overrides manuels.
- `news` — ingestion, dédup, recherche, lien ticker↔article.
- `alerts` — règles, évaluations, notifications push/email.
- `exports` — jobs CSV/PDF, stockage, téléchargement.
- `assistant` (option premium) — Q&A “style Perplexity” avec citations internes + externes.

Les jobs lourds (sync, calculs, exports, ingestion news) tournent dans un **worker** séparé, mais déployé depuis le même codebase.

<a id="arch-flux-principaux"></a>
## Flux principaux

<a id="arch-flux-onboarding"></a>
### 1) Onboarding → connexion SnapTrade

1. L’utilisateur crée un compte (OTP).
2. “Connecter Wealthsimple (via SnapTrade)”.
3. Redirection SnapTrade (web auth) → callback backend.
4. Backend crée/associe la `broker_connection` et planifie un **sync initial**.
5. Dès la fin du sync initial: dashboard prêt (top tickers + P&L 360).

<a id="arch-flux-sync"></a>
### 2) Sync incrémental

- Déclencheurs:
  - manuel (pull-to-refresh),
  - planifié (toutes les X minutes/heures selon quota),
  - webhook si SnapTrade le propose.
- Stratégie:
  - ingestion “append-only” des transactions,
  - recalcul ciblé des agrégats affectés (par compte/ticker),
  - mise à jour des `position_snapshot` / `ticker_pnl_daily`.

<a id="arch-flux-news"></a>
### 3) News par action

- Ingestion périodique (worker):
  - fetch RSS/Atom par requêtes “ticker + société” (et/ou providers),
  - dédup (URL hash),
  - extraction metadata (publisher, published_at, tickers détectés),
  - éventuellement résumé (LLM) côté premium.
- Lecture:
  - `/tickers/:symbol/news` paginé,
  - tri “pertinence” (récence + source + matching).

<a id="arch-flux-exports"></a>
### 4) Exports

- L’utilisateur demande un export (CSV/PDF) → création `export_job` → worker génère → upload S3 → URL signée.

<a id="arch-flux-ask"></a>
### 5) “Ask” (UX à la Perplexity)

Un écran central “Ask”:
- l’utilisateur tape une question (“Pourquoi mon P&L sur TSLA a chuté?”),
- le backend récupère du contexte (transactions, P&L, news, événements),
- produit une réponse structurée + **sources**:
  - sources internes (transactions, lots, calculs),
  - sources externes (articles news).

<a id="arch-data-model"></a>
## Modèle de données (PostgreSQL)

Principes:
- Source de vérité (implémentation): `apps/backend/prisma/schema.prisma` (noms exacts, contraintes, indexes). Les schémas ci-dessous sont une vue conceptuelle.
- IDs: `uuid` partout.
- Multi-tenant strict: toutes les tables user-scopées ont `user_id`.
- Argent: `amount_minor bigint` + `currency char(3)` (évite floats).
- Volume/prix: `numeric(20,10)` (quantités fractionnaires possibles).
- Raw ingest: colonnes `raw jsonb` pour audit/debug.
- Dédup: `external_id` + `provider` + unique indexes.

<a id="arch-data-core"></a>
### Tables (noyau)

#### `users`

- `id uuid pk`
- `email citext unique`
- `created_at timestamptz`
- `status text` (active, deleted)

#### `sessions`

- `id uuid pk`
- `user_id uuid fk users(id)`
- `refresh_token_hash text`
- `expires_at timestamptz`
- `created_at timestamptz`

#### `devices`

- `id uuid pk`
- `user_id uuid fk`
- `platform text` (ios, android)
- `push_token text` (unique par user: `unique(user_id, push_token)`)
- `last_seen_at timestamptz null`
- `created_at timestamptz`
- `updated_at timestamptz`

#### `entitlements`

- `id uuid pk`
- `user_id uuid fk users(id)`
- `type text` (ex: pro)
- `status text` (ex: active)
- `started_at timestamptz`
- `expires_at timestamptz null`
- `created_at timestamptz`
- `updated_at timestamptz`

Note: l’implémentation conserve un historique (plusieurs lignes possibles). Le plan courant est dérivé du dernier entitlement `type=pro` `status=active` non expiré.

#### `user_preferences`

- `user_id uuid pk fk`
- `base_currency char(3)` (ex: CAD)
- `created_at timestamptz`
- `updated_at timestamptz`

TODO (plus tard): `timezone`, `locale`, `risk_disclaimer_accepted_at`.

<a id="arch-data-snaptrade"></a>
### SnapTrade / connexions

#### `broker_connections`

- `id uuid pk`
- `user_id uuid fk`
- `provider text` (snaptrade)
- `status text` (connected, disconnected, error)
- `external_user_id text` (SnapTrade userId)
- `external_connection_id text` (SnapTrade connectionId)
- `access_token_enc bytea` (si requis; sinon identifiants SnapTrade)
- `refresh_token_enc bytea`
- `scopes text[]`
- `connected_at timestamptz`
- `disconnected_at timestamptz null`
- `last_sync_at timestamptz null`
- `raw jsonb`

Indexes:
- `idx_broker_connections_user (user_id)`
- Unique: `(provider, external_connection_id)`

#### `sync_runs`

Traçabilité/observabilité des syncs (utile pour UI “statut sync” + debugging).

- `id uuid pk`
- `user_id uuid fk`
- `broker_connection_id uuid fk`
- `status text` (queued, running, done, failed)
- `started_at timestamptz null`
- `finished_at timestamptz null`
- `error text null`
- `stats jsonb` (ex: `{transactionsUpserted: 123, positionsUpdated: 45}`)
- `cursor text null` (si provider supporte un curseur incrémental)
- `created_at timestamptz`

Indexes:
- `idx_sync_runs_user_created (user_id, created_at desc)`

#### `accounts`

- `id uuid pk`
- `user_id uuid fk`
- `broker_connection_id uuid fk`
- `external_account_id text`
- `name text`
- `type text` (cash, margin, tfsa, rrsp, nonreg, …)
- `base_currency char(3)`
- `status text`
- `raw jsonb`
- `created_at timestamptz`
- `updated_at timestamptz`

Unique:
- `(broker_connection_id, external_account_id)`

<a id="arch-data-portfolio"></a>
<a id="arch-data-instruments"></a>
### Instruments & marché

#### `instruments`

- `id uuid pk`
- `type text` (equity, option, etf, crypto, cash)
- `symbol text` (ex: AAPL) — null pour option si stocké ailleurs
- `exchange text null`
- `currency char(3)`
- `name text null`
- `isin text null`
- `raw jsonb`

Indexes:
- `idx_instruments_symbol (symbol)`

#### `option_contracts`

- `id uuid pk`
- `underlying_instrument_id uuid fk instruments(id)`
- `occ_symbol text` (ou provider symbol)
- `expiry date`
- `strike numeric(20,10)`
- `right text` (call, put)
- `multiplier int` (souvent 100)
- `currency char(3)`
- `raw jsonb`

Unique (provider-friendly):
- `(occ_symbol)` ou `(underlying_instrument_id, expiry, strike, right)`

#### `fx_rates_daily` (si multi-devises)

- `date date pk`
- `base_currency char(3)` (ex: CAD)
- `quote_currency char(3)` (ex: USD)
- `rate numeric(20,10)`

<a id="arch-data-positions"></a>
### Positions & snapshots

#### `position_snapshots`

Snapshot “dernier état” par compte/instrument (pour lecture rapide).

- `account_id uuid fk`
- `instrument_id uuid fk`
- `as_of timestamptz`
- `quantity numeric(20,10)`
- `avg_cost_amount_minor bigint`
- `avg_cost_currency char(3)`
- `market_price_amount_minor bigint null`
- `market_price_currency char(3) null`
- `market_value_amount_minor bigint null`
- `unrealized_pnl_amount_minor bigint null`
- `raw jsonb`

PK:
- `(account_id, instrument_id)`

<a id="arch-data-transactions"></a>
### Transactions (source de vérité)

#### `transactions`

Une ligne = un événement d’exécution ou cashflow.

- `id uuid pk`
- `user_id uuid fk`
- `account_id uuid fk`
- `provider text` (snaptrade)
- `external_id text`
- `executed_at timestamptz`
- `type text`
  - equity_buy, equity_sell
  - option_buy_to_open, option_sell_to_open, option_buy_to_close, option_sell_to_close
  - assignment, exercise
  - dividend, interest, fee, deposit, withdrawal
- `instrument_id uuid fk instruments(id) null` (equity)
- `option_contract_id uuid fk option_contracts(id) null` (options)
- `quantity numeric(20,10) null`
- `price_amount_minor bigint null`
- `price_currency char(3) null`
- `gross_amount_minor bigint null` (cashflow signe)
- `fees_amount_minor bigint null`
- `fees_currency char(3) null`
- `notes text null`
- `raw jsonb`
- `created_at timestamptz`

Unique:
- `(provider, account_id, external_id)`

Indexes:
- `idx_transactions_user_time (user_id, executed_at desc)`
- `idx_transactions_account_time (account_id, executed_at desc)`

<a id="arch-data-pnl360"></a>
### P&L 360 (agrégats)

On stocke des agrégats pour rendre l’UI “instantanée”.
Conventions de calcul (MVP): `docs/PNL360_SPEC.md`.

#### `ticker_pnl_totals`

- `user_id uuid`
- `symbol text`
- `base_currency char(3)` (préférence utilisateur)
- `realized_pnl_minor bigint`
- `unrealized_pnl_minor bigint`
- `option_premiums_minor bigint`
- `dividends_minor bigint`
- `fees_minor bigint`
- `net_pnl_minor bigint`
- `last_recomputed_at timestamptz`

PK:
- `(user_id, symbol, base_currency)`

#### `ticker_pnl_daily`

- `user_id uuid`
- `symbol text`
- `base_currency char(3)`
- `date date`
- `net_pnl_minor bigint`
- `market_value_minor bigint`
- `realized_pnl_minor bigint`
- `unrealized_pnl_minor bigint`

PK:
- `(user_id, symbol, base_currency, date)`

<a id="arch-pnl-hold"></a>
#### Comparatif “Just Hold” (heuristique MVP)

Objectif: donner une intuition (“est-ce que mes trades ont fait mieux/moins bien que buy&hold?”), **sans** prétendre à une vérité fiscale.

Hypothèses (MVP):
- Prix d’entrée = prix du **premier achat** (première transaction stock `buy`).
- Quantité “hold” = **max** de shares détenues au fil du temps (cumul buy/sell).
- Prix de référence = `position_snapshot.market_price` le plus récent si dispo, sinon dernier prix de trade.
- N’inclut pas (pour l’instant): options, frais, dividendes, timing des cashflows, splits.

Limites:
- Peut diverger fortement d’un calcul “juste” (DCA, cashflows réels, FX historique, etc.).
- À exposer comme optionnel (et documenté côté API).

<a id="arch-data-wheel"></a>
### Wheel / Covered Calls

#### `wheel_cycles`

- `id uuid pk`
- `user_id uuid fk`
- `symbol text`
- `status text` (open, closed)
- `opened_at timestamptz`
- `closed_at timestamptz null`
- `net_pnl_minor bigint null`
- `base_currency char(3)`
- `auto_detected boolean default true`
- `notes text null`

Indexes:
- `idx_wheel_cycles_user_symbol (user_id, symbol)`

#### `wheel_legs`

Une jambe = référence vers une ou plusieurs transactions (option/stock) + type.

- `id uuid pk`
- `wheel_cycle_id uuid fk`
- `kind text` (sold_put, bought_put, assigned_put, sold_call, called_away, stock_buy, stock_sell, dividend, fee)
- `transaction_id uuid fk transactions(id) null`
- `linked_transaction_ids uuid[] null` (si split)
- `occurred_at timestamptz`
- `pnl_minor bigint null`
- `raw jsonb`

<a id="arch-data-news"></a>
### News

#### `news_sources`

- `id uuid pk`
- `name text`
- `type text` (rss, api)
- `base_url text null`
- `enabled boolean default true`
- `weight int default 100`

#### `news_items`

- `id uuid pk`
- `provider text` (rss, finnhub, …)
- `external_id text null`
- `url text`
- `url_hash bytea` (sha256)
- `title text`
- `publisher text null`
- `published_at timestamptz`
- `summary text null` (option premium)
- `raw jsonb`

Unique:
- `(url_hash)`

Index:
- `idx_news_published (published_at desc)`

#### `news_item_symbols`

- `news_item_id uuid fk news_items(id)`
- `symbol text`

PK:
- `(news_item_id, symbol)`

Indexes:
- `idx_news_symbols_symbol (symbol)`

<a id="arch-data-alerts"></a>
### Alertes

#### `alert_rules`

- `id uuid pk`
- `user_id uuid fk`
- `type text` (earnings, option_expiry, price_move, news_spike)
- `symbol text null`
- `config jsonb` (thresholds, window, etc)
- `enabled boolean default true`
- `created_at timestamptz`

#### `alert_events`

- `id uuid pk`
- `alert_rule_id uuid fk`
- `triggered_at timestamptz`
- `payload jsonb`
- `delivered_at timestamptz null`

<a id="arch-data-exports"></a>
### Exports

#### `export_jobs`

- `id uuid pk`
- `user_id uuid fk`
- `type text` (ticker_realized, option_premiums_year, transactions_filtered, year_package)
- `format text` (csv, pdf)
- `params jsonb`
- `status text` (queued, running, done, failed)
- `error text null`
- `created_at timestamptz`
- `completed_at timestamptz null`

#### `export_files`

- `export_job_id uuid pk fk`
- `storage_key text` (S3 key)
- `content_type text`
- `size_bytes bigint`
- `sha256 bytea`

<a id="arch-api-backend"></a>
## Backend (Fastify) — services API

Convention:
- Base URL: `/v1`
- Auth: `Authorization: Bearer <accessToken>`
- Pagination: `?cursor=` (opaque) + `?limit=`
- Error format stable:
  - `code` (string), `message`, `details` (optional)
- Idempotency (POST côté client): header `Idempotency-Key: <uuid>`

#### Schémas (extraits)

`Money`:
- `amountMinor: string` (int64 sérialisé)
- `currency: string` (ISO 4217)

`TickerSummary`:
- `symbol: string`
- `position: { quantity: string, avgCost?: Money, marketValue?: Money }`
- `pnl: { net: Money, realized?: Money, unrealized?: Money, optionPremiums?: Money, dividends?: Money, fees?: Money }`
- `lastUpdatedAt: string` (ISO date)

`NewsItem`:
- `id: string`
- `title: string`
- `url: string`
- `publisher?: string`
- `publishedAt: string`
- `symbols: string[]`
- `summary?: string`

`CursorPage<T>`:
- `items: T[]`
- `nextCursor?: string`

<a id="arch-api-auth"></a>
### Auth

- `POST /v1/auth/start` — envoie OTP/magic link
- `POST /v1/auth/verify` — échange code → access/refresh
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `GET /v1/me`
- `DELETE /v1/me` — suppression compte (soft-delete + purge)

### Preferences

- `GET /v1/preferences` — récupérer `baseCurrency`
- `PUT /v1/preferences` — mettre à jour `baseCurrency`

<a id="arch-api-devices"></a>
### Devices / Push

- `POST /v1/devices/register` — `{pushToken, platform}`
- `DELETE /v1/devices/:id`

<a id="arch-api-snaptrade"></a>
### SnapTrade / Connexions

- `POST /v1/connections/snaptrade/start` — retourne `{redirectUrl, state}` (portail SnapTrade)
- `POST /v1/connections/snaptrade/callback` — finalise connexion (valide `state`, crée `broker_connection`)
- `GET /v1/connections` — liste
- `DELETE /v1/connections/:id` — déconnecte (et purge tokens)
- `POST /v1/connections/:id/sync` — déclenche sync (async)
- `GET /v1/sync/status` — statut dernier sync (par connexion) + derniers `sync_runs`

<a id="arch-api-portfolio"></a>
### Portfolio

- `GET /v1/accounts`
- `GET /v1/positions?accountId=...`
- `GET /v1/transactions` — filtres: `accountId`, `symbol`, `type`, `from`, `to`
- `GET /v1/tickers` — tickers de l’utilisateur + agrégats
- `GET /v1/tickers/:symbol/summary` — carte “P&L 360”
- `GET /v1/tickers/:symbol/pnl` — breakdown (réalisé, non-réalisé, primes, dividendes, frais)
- `GET /v1/tickers/:symbol/timeline` — séries daily

<a id="arch-api-wheel"></a>
### Wheel

- `GET /v1/wheel/cycles?symbol=...`
- `GET /v1/wheel/cycles/:id`
- `POST /v1/wheel/cycles` — création manuelle (si besoin)
- `PATCH /v1/wheel/cycles/:id` — notes/override
- `POST /v1/wheel/cycles/:id/close`
- `POST /v1/wheel/detect` — lance détection auto (async)

<a id="arch-api-news"></a>
### News

- `GET /v1/tickers/:symbol/news?cursor=&limit=`
- `GET /v1/news/search?q=...`
- `GET /v1/news/sources`

<a id="arch-api-alerts"></a>
### Alerts

- `GET /v1/alerts`
- `POST /v1/alerts`
- `PATCH /v1/alerts/:id`
- `DELETE /v1/alerts/:id`
- `GET /v1/alerts/events?cursor=&limit=`

<a id="arch-api-exports"></a>
### Exports

- `POST /v1/exports`
- `GET /v1/exports?cursor=&limit=`
- `GET /v1/exports/:id`
- `GET /v1/exports/:id/download` — URL signée (si `done`)

<a id="arch-api-billing"></a>
### Billing / Entitlements

- `GET /v1/billing/entitlement`
- `POST /v1/billing/webhook/revenuecat` — update entitlements (server-to-server)

<a id="arch-api-assistant"></a>
### Assistant (option premium)

- `POST /v1/assistant/query` — réponse + sources (option streaming SSE)
- `GET /v1/assistant/conversations`
- `GET /v1/assistant/conversations/:id`

<a id="arch-mobile-ecrans"></a>
## Mobile (React Native) — écrans, navigation, menus

Objectif UI: **tout doit commencer par une recherche** (ticker, question, ou action), puis afficher une réponse riche et actionnable avec des sources et des chemins rapides vers les vues (transactions, cycles, news).

### Navigation (proposée)

Bottom Tabs (4 items):

1. **Home**
2. **Ask** (central, “Perplexity-like”)
3. **Portfolio**
4. **Alerts**

Un menu “More” (icône profil en haut à droite) donne accès à:
- Exports
- Connexions (SnapTrade)
- Abonnement (Pro)
- Paramètres (devise de base, confidentialité, support)

### Écrans (détaillés)

<a id="arch-mobile-onboarding"></a>
#### Onboarding

- `WelcomeScreen` — valeur + disclaimer
- `AuthScreen` — email → OTP
- `ConnectBrokerScreen` — “Connecter Wealthsimple (via SnapTrade)”
- `SyncProgressScreen` — barre de progression + “time-to-wow”

<a id="arch-mobile-home"></a>
#### Home

- `HomeScreen`
  - barre de recherche (ticker/question)
  - cards: P&L global, top movers, prochains événements (earnings/expirations)
  - CTA “Voir mes tickers”

<a id="arch-mobile-ask"></a>
#### Ask (style Perplexity)

- `AskScreen`
  - champ input + suggestions (“Explique mon P&L sur…”, “Résumé news sur…”)
  - réponses en blocs:
    - **Answer** (texte clair)
    - **Why** (résumé en points)
    - **Sources** (transactions, calculs, articles)
  - actions rapides: “Ouvrir ticker”, “Créer alerte”, “Exporter”

<a id="arch-mobile-portfolio"></a>
#### Portfolio

- `PortfolioScreen`
  - liste tickers (search + filtres)
  - each row: net P&L, position, exposure, tag (pro/free)
- <a id="arch-mobile-ticker"></a> `TickerScreen` (le cœur)
  - Header: symbol, net P&L, position
  - Tabs:
    - **Overview** (résumé + graphiques)
    - **P&L** (breakdown + comparatif “hold” si activé)
    - **Wheel** (cycles ouverts/fermés)
    - **Trades** (transactions filtrées)
    - <a id="arch-mobile-news"></a> **News** (headlines + événements)
    - **Insights** (premium: synthèse + Q&A contextuelle)

<a id="arch-mobile-wheel"></a>
#### Wheel

- `WheelScreen`
  - liste de cycles par ticker
  - état (open/closed), prochaine expiration, net cycle
- `WheelCycleDetailScreen`
  - timeline des legs (sold put → assignment → sold call → called away)
  - net premiums, net stock P&L, fees
  - bouton “Corriger” (override manuel)

<a id="arch-mobile-alerts"></a>
#### Alerts

- `AlertsScreen`
  - règles + events récents
  - CTA “Créer une alerte”
- `CreateAlertScreen`
  - templates: earnings, expiry, price move, news spike

<a id="arch-mobile-exports"></a>
#### Exports & Settings

- `ExportsScreen` — jobs, statut, téléchargement
- `ConnectionsScreen` — connexion SnapTrade, “sync now”, disconnect
- `PaywallScreen` — bénéfices Pro + preuve de valeur (preview)
- `SettingsScreen` — devise, confidentialité, support, suppression compte

<a id="arch-mobile-patterns"></a>
### Menus & patterns UX

- **Search-first**: une seule recherche unifiée (ticker + questions).
- **Sources partout**: chaque chiffre est cliquable → “voir transactions”.
- **Empty states utiles**: si pas de data, proposer “connecter” ou “sync”.
- **Paywall intelligent**: pas de blocage brutal; teaser + “unlock”.

<a id="arch-mobile-designsystem"></a>
### Design system (objectif “premium”)

- Typo lisible, contrastes forts, **dark mode** par défaut.
- Layout: cartes simples, espaces généreux, hiérarchie “1 insight = 1 card”.
- Composants clés:
  - `SearchBar` (ticker + question + suggestions)
  - `PnlBadge` (couleur + signe + période)
  - `MetricCard` (titre court + valeur + action “voir sources”)
  - `SourceChip` (icône provider + type: transaction/news)
  - `EmptyState` (message + CTA unique)
  - `PaywallGate` (preview + bénéfice + upgrade)
- Feedback: skeleton loaders, haptics légers, transitions rapides (≤ 200ms).

### Navigation (routes & deep links)

- Deep links:
  - `app://ticker/:symbol`
  - `app://wheel/cycle/:id`
  - `app://news/:id`
  - `app://assistant/:conversationId`
- Routage (exemple):
  - `RootTabs(HomeTab, AskTab, PortfolioTab, AlertsTab)`
  - `HomeStack(Home, Ticker, NewsDetail, ExportDetail)`
  - `AskStack(Ask, Conversation, Ticker, NewsDetail)`
  - `PortfolioStack(Portfolio, Ticker, TransactionsFilter)`
  - `AlertsStack(Alerts, CreateAlert)`
  - `ModalStack(Paywall, Connections, Settings, Exports)`

<a id="arch-securite"></a>
## Sécurité, conformité, et fiabilité

- Chiffrement au repos: Postgres + chiffrement applicatif des tokens (`*_enc`).
- Secrets: gestion via vault/KMS (ou variables d’environnement chiffrées).
- Auth:
  - OTP/magic link stocké **haché** (jamais en clair) + rate limit + verrouillage progressif
  - JWT access court + refresh long (rotation + révocation)
  - stockage mobile: Keychain/Keystore uniquement
- RBAC simple: user-only; admin séparé (backoffice plus tard).
- Audit: conserver `raw` + logs d’accès aux données sensibles.
- Rate limiting: par IP + par user; protection brute-force OTP.
- Conformité: disclaimers “not financial advice”; suivi ToS SnapTrade/news providers.
- Privacy:
  - “Disconnect” SnapTrade = purge tokens + stop sync
  - suppression compte = soft-delete user + purge données selon politique
- Fiabilité:
  - jobs idempotents (sync/news/exports), retries contrôlés, DLQ (dead-letter)
  - migrations DB versionnées + rollback plan

<a id="arch-performance"></a>
## Performance & scalabilité

- Caching:
  - Redis pour agrégats chauds (top tickers, ticker summary),
  - HTTP cache headers sur endpoints read-only.
- Pré-calcul:
  - `ticker_pnl_totals` + `ticker_pnl_daily` recalculés en worker après ingest.
- Pagination:
  - transactions/news/alerts via cursor.
- DB:
  - indexes alignés sur queries (`user_id`, `symbol`, `executed_at`, `published_at`)
  - vues matérialisées possibles pour “top tickers” à grand volume

<a id="arch-observabilite"></a>
## Observabilité & analytics (croissance)

- Logs structurés (pino) + corrélation `request_id`.
- Traces OpenTelemetry (API → DB → providers).
- Erreurs: Sentry (mobile + backend).
- Produit: tracking events (PostHog/Segment) pour funnel:
  - signup, connect start/complete, first sync, first “wow”, paywall shown, upgrade

<a id="arch-deploiement"></a>
## Déploiement (cible MVP)

- Environnements: `dev` / `staging` / `prod` (providers séparés).
- Backend API: container (Docker) + autoscaling (1 service).
- Worker jobs: container séparé (BullMQ).
- Postgres managé + backups + PITR.
- Redis managé.
- S3-compatible pour exports + lifecycle policy (rétention).
- CI: lint + typecheck + tests unitaires (calcul P&L, wheel detection) + migrations check.
- CD: migrations en “expand/contract” quand nécessaire (zéro downtime).

<a id="arch-monetisation"></a>
## Monétisation (architecture)

Free:
- connexion + dashboard + 1–2 tickers + news basique

Pro:
- P&L 360 illimité, wheel complet, exports illimités, alertes avancées, assistant + résumés news

La logique d’accès passe par `entitlements` (cache + middleware), alimentée par RevenueCat (mobile) + overrides admin.

Implémentation (MVP):
- Mobile: SDK RevenueCat (`react-native-purchases`) + paywall in-app.
- Backend: `POST /v1/billing/webhook/revenuecat` met à jour la table `entitlements` et invalide le cache Redis.
  - Sécurité webhook: `REVENUECAT_WEBHOOK_AUTH_TOKEN`
  - Mapping Pro: `REVENUECAT_PRO_ENTITLEMENT_ID` (défaut: `pro`)
- Source de vérité côté app: `GET /v1/billing/entitlement`.
