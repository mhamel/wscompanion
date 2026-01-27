<a id="pnl360-spec-top"></a>
# P&L 360° — Spécification (MVP)

Ce document décrit la convention **effective** utilisée par le backend pour calculer le P&L par ticker.
Objectif: réduire l’ambiguïté et éviter les divergences doc/implémentation.

## Portée

- Calcul par `symbol`, agrégé sur **tous** les comptes d’un utilisateur.
- Devise de base = `user_preferences.base_currency` (défaut `USD`).
- Sorties persistées:
  - `TickerPnlTotal` (`ticker_pnl_totals`)
  - `TickerPnlDaily` (`ticker_pnl_daily`)
  - Réf schéma: `ARCHITECTURE.md` (section P&L 360).

## Source de vérité (code)

- Calcul principal: `apps/backend/src/analytics/pnl.ts` (`computeTickerPnl360()`).
- Breakdown + rendement: `apps/backend/src/routes/tickers.ts` (`GET /v1/tickers/:symbol/pnl`).
- Comparatif “Just Hold”: `apps/backend/src/routes/tickers.ts` (`GET /v1/tickers/:symbol/hold`).

## Représentation des montants

- Tous les montants sont en **minor units** (entiers): `*_amount_minor` + `*_currency` (ISO 4217).
- `gross_amount_minor` et `fees_amount_minor` sont traités en **valeur absolue**.
  - La direction (achat vs vente, premium reçu vs payé) est déduite du `type` normalisé, pas du signe.
- Quantités:
  - `quantity` est traité comme décimal (scale 10) puis converti en entier interne (scale 1e10) pour les calculs FIFO.

## FX (multi-devises)

- Toutes les composantes du P&L sont converties en `base_currency`.
- Provider FX par défaut = `createEnvFxRateProvider()` qui lit `FX_RATES_JSON` (env).
- Override transactionnel (tests + cas réels) possible via `tx.raw`:
  - `raw.fx = { fromCurrency, toCurrency, rate }`
  - ou `raw.fxFromCurrency`, `raw.fxToCurrency`, `raw.fxRate`
- Si un taux FX manque:
  - Le montant concerné est ignoré (0).
  - Une anomalie est enregistrée (ex: `gross_fx_missing:<SYMBOL>:<TX_ID>`).

## Classification des transactions (heuristique MVP)

La classification repose sur un “string matching” sur `tx.type` (lowercase):

- **Dividendes**: `type` contient `dividend` (inclut `dividend_reinvest`).
- **Frais**: `type` contient `fee` ou `commission`.
- **Assignation / exercise**: si `type` contient `assigned` / `assignment` / `exercise`, on traite comme un événement **stock**:
  - `right` commence par `p*` (put) ⇒ `stock_buy`
  - `right` commence par `c*` (call) ⇒ `stock_sell`
  - `right` est dérivé de `optionContract.right` ou `raw.right` / `raw.optionRight` / …
- **Options (premiums)**: si `optionContract` est présent ou si `type` contient `option/call/put`:
  - `type` contient `sell` ou `sto` ⇒ `option_sell`
  - `type` contient `buy` ou `bto` ⇒ `option_buy`
  - sinon: ignoré (`unknown`)
- **Stocks**:
  - `type` contient `buy` ⇒ `stock_buy`
  - `type` contient `sell` ⇒ `stock_sell`
  - sinon: ignoré (`unknown`)

Note: les événements options “exotiques” (expiration, roll non standard, corporate actions) peuvent être ignorés au MVP si non classifiables.

## Modèle de calcul — composantes exposées (DA-010)

Le P&L total par ticker est la somme:

`net = realized + unrealized + optionPremiums + dividends - fees`

### 1) Actions — lots FIFO (DA-012)

Le backend maintient par ticker une liste de lots FIFO `{ quantity, totalCost }` en `base_currency`.

- `stock_buy`:
  - ouvre/augmente des lots longs (quantité positive)
  - si un short existe, l’achat **couvre** d’abord les lots shorts FIFO (voir ci-dessous)
- `stock_sell`:
  - ferme des lots longs FIFO et produit du `realized = proceeds - cost`
  - si on vend plus que les lots longs restants, on ouvre un lot **short** (quantité négative)

Shorts:
- Un lot short stocke:
  - `quantity < 0`
  - `totalCost = proceeds` (produit de la vente à découvert)
- Un `stock_buy` couvre des lots shorts FIFO et produit:
  - `realized = short_proceeds - cover_cost`

### 2) `realized`

- Provient **uniquement** des événements `stock_buy`/`stock_sell` via lots FIFO (inclut close de shorts).

### 3) `unrealized`

- Provient des `position_snapshot.unrealized_pnl_amount_minor` (unrealized du provider), convertis en `base_currency`.
- MVP: il s’agit d’un “as-of” (snapshot courant), pas d’une série historique de marché.

### 4) `optionPremiums` (DA-011)

- Le P&L options (MVP) = **premiums** uniquement:
  - `option_sell` ⇒ `+abs(gross)`
  - `option_buy` ⇒ `-abs(gross)`
- Assignations/exercise sont traités comme événements stock (voir “Classification”).
- Pas de mark-to-market options; les expirations/événements non reconnus sont ignorés.

### 5) `dividends`

- `dividend*` ⇒ `+abs(gross)` (converti en `base_currency`).

### 6) `fees`

- Si une transaction porte `fees_amount_minor` ⇒ frais ajoutés (`+abs(fees)` en `base_currency`).
- Si une transaction est de type `fee/commission`:
  - on utilise `fees_amount_minor` si présent, sinon `gross_amount_minor`.

## Timeline quotidienne (DA-013)

`TickerPnlDaily` est construit à partir des transactions triées par `executed_at` puis `id`.

Pour chaque `symbol`:
- on cumule dans le temps `realized`, `optionPremiums`, `dividends`, `fees`
- pour chaque date:
  - `realized_pnl_minor` = **cumul** réalisé jusqu’à cette date (inclus)
  - `unrealized_pnl_minor` = snapshot unrealized **uniquement** sur la date `asOf` du recalcul (sinon `0`)
  - `market_value_minor` = snapshot market value **uniquement** sur la date `asOf` du recalcul (sinon `0`)
  - `net_pnl_minor` = `cumRealized + dayUnrealized + cumOptionPremiums + cumDividends - cumFees`

Conséquence MVP: la timeline reflète fidèlement le P&L **réalisé** et les cashflows (premiums/dividendes/frais),
mais n’a pas d’unrealized historique (faute de prix journaliers).

## “Cash vs rendement” (DA-014)

Endpoint: `GET /v1/tickers/:symbol/pnl`

- `deployedCash` (MVP) = somme en `base_currency` de:
  - `abs(gross)` pour transactions classées `stock_buy` et `option_buy`
  - `abs(fees)` pour toutes transactions (si convertible FX)
- `returnOnDeployedCashPct = net / deployedCash` (null si `deployedCash = 0`)

Limites MVP:
- ignore le timing des cashflows (pas d’IRR/XIRR)
- ignore les cashflows “sell” (on mesure un capital engagé, pas une exposition nette)

## Comparatif “Just Hold” (DA-015)

Endpoint: `GET /v1/tickers/:symbol/hold`

Heuristique MVP (cf. `ARCHITECTURE.md`, section “Comparatif Just Hold”):
- prix d’entrée = prix du **premier achat** stock
- quantité “hold” = **max** de shares détenues au fil du temps
- prix de référence = `position_snapshot.market_price` (le plus récent) sinon dernier prix de trade

Limitations (MVP):
- ignore options, frais, dividendes, timing cashflows, splits/DCA.
