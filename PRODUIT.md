# Produit — Companion Wealthsimple (via SnapTrade)

## Ce qu’on veut faire

Créer une application compagnon (mobile) qui se connecte à Wealthsimple **via SnapTrade** pour offrir aux investisseurs actifs 2–3 fonctionnalités “power user” qui ne sont pas (ou pas bien) disponibles dans Wealthsimple aujourd’hui.

Objectif: que l’utilisateur se dise “wow, c’est exactement ce qui me manque”, et que Wealthsimple voie une valeur évidente (rétention, engagement, satisfaction) — au point de vouloir s’associer… ou acheter.

## Ce que ce produit n’est pas

- Pas un plugin “dans” Wealthsimple: c’est une app compagnon indépendante.
- Pas un outil de conseils financiers: on affiche des données et des analyses; on ne dit pas quoi acheter/vendre.
- Pas un scraper: la connexion passe par **SnapTrade** (portail sécurisé, contrôle utilisateur, possibilité de déconnecter).

## Connexion Wealthsimple (expérience utilisateur)

- Bouton unique: **“Connecter Wealthsimple (via SnapTrade)”**
- L’utilisateur est redirigé vers le portail SnapTrade, se connecte, autorise l’accès, puis revient dans l’app.
- Message clair: “Lecture seule par défaut” + “Tu peux déconnecter à tout moment”.
- On lance ensuite: “On analyse ton historique et on reconstruit ton P&L réel”.

## Les 3 fonctionnalités qui nous démarquent

### 1) P&L 360° par ticker (le “wow” principal)

Pour chaque symbole, répondre à une question simple:
**“Ce titre m’a rapporté combien, au total, depuis que je le trade?”**

Ce qu’on montre, par ticker:
- Gains/pertes sur actions (réalisé + non-réalisé)
- Primes d’options (covered calls / puts) et assignations
- Dividendes et frais (si disponibles)
- Une vue “en cash” et une vue “en rendement”
- Comparatif “si j’avais juste hold” (optionnel, mais très convaincant)

### 2) Wheel / Covered Calls tracker (organisation + clarté)

Une vue “cycle” par ticker pour suivre:
- Ce qui est **ouvert** (ex: options en cours, expirations à venir)
- Ce qui est **fermé** (ex: cycles complétés, résultat net du cycle)
- Les événements importants: expirations, assignations, earnings/dividendes (si on peut les afficher)

Le but: arrêter de tout gérer dans des notes/Excel et réduire les erreurs.

### 3) Exports propres (comptable-friendly), sans promettre “les taxes”

Wealthsimple fournit déjà des documents fiscaux, mais:
- Les stratégies options (wheel/covered calls) sont souvent difficiles à résumer “par ticker”
- Les utilisateurs veulent des exports clairs pour réconcilier leur année

Ce qu’on offre:
- Export CSV/PDF “réalisé par ticker”
- Export “primes d’options par année”
- Liste des transactions filtrable + réconciliation (sans remplacer les documents officiels)

Note: on valide précisément ce que Wealthsimple calcule déjà pour ses utilisateurs, et on se positionne comme **complément** (pas substitut).

## Parcours utilisateur (simple et addictif)

1. Connecter Wealthsimple via SnapTrade
2. Dashboard: aperçu portefeuille + top tickers (P&L 360°)
3. Détail ticker: breakdown + timeline + cycles wheel/CC + news/événements
4. Alertes: expirations proches, earnings/news, situations “à surveiller”
5. Exports: un bouton “préparer mon année” (sans jargon fiscal)

## Actualités & événements par action (contexte)

Sur chaque page ticker, ajouter un onglet **“News”** pour donner du contexte (sans jamais faire du conseil).

Ce qu’on affiche (MVP):
- Headlines récentes, avec source + date + lien
- Filtre “mes positions / watchlist”
- Événements: earnings, dividendes, splits (selon disponibilité des données)

Approche data (MVP → scalable):
- MVP “gratuit”: flux RSS/Atom (ex: Google News RSS par ticker) + sources publiques (ex: communiqués, filings EDGAR), avec cache serveur (stabilité/ToS à valider)
- Freemium (API key): providers type Alpha Vantage / Finnhub (quotas limités)
- Plus tard: provider payant si on veut couverture + fiabilité + conformité long terme

## Modèle payant (clair)

- Gratuit: connexion + aperçu limité (ex: 1–2 tickers, quelques graphiques)
- Pro (abonnement): P&L 360° illimité + wheel tracker + alertes + exports

Le pricing final dépendra des coûts de données/connexion liés à SnapTrade en production (on veut garder une marge saine).

## Ce qui fera dire “wow” (nos critères de succès)

- “Time to wow” < 2 minutes après connexion SnapTrade (P&L 360° visible immédiatement)
- Rétention: l’utilisateur revient chaque semaine (expirations/alertes + suivi de performance)
- Recommandations organiques: “tu trades des options? prends ça”

## Transparence et confiance

- “Non affilié à Wealthsimple” (branding clair)
- SnapTrade visible et expliqué (sécurité, contrôle, déconnexion)
- Données minimales: on ne collecte que ce qui sert aux fonctionnalités
