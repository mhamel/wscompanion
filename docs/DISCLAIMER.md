# Disclaimer “Not financial advice” (MVP)

Objectif: afficher un avertissement clair et enregistrer l’acceptation utilisateur (date + version) afin de:

- renforcer la transparence / confiance
- réduire le risque de malentendu (l’app n’est pas un conseiller)

## Backend

- Source: `apps/backend/src/disclaimer.ts`
- Version: `RISK_DISCLAIMER_VERSION`
- Stockage acceptation: `UserPreferences.riskDisclaimerAcceptedAt` + `riskDisclaimerVersionAccepted`
- Endpoints:
  - `GET /v1/disclaimer`
  - `POST /v1/disclaimer/accept`

## Mobile

- Settings:
  - affiche statut accepté / non accepté
  - bouton “Lire” + “Accepter”
- Ask (Pro):
  - si disclaimer requis → bloc UX + acceptation inline + lien vers Paramètres

## Notes

- L’acceptation est maintenant **requise** pour `POST /v1/ask` (Ask Pro).
- En cas de non-acceptation: `403` avec `code: "DISCLAIMER_REQUIRED"` et `details.requiredVersion`.
- Le disclaimer est **versionné**: si `RISK_DISCLAIMER_VERSION` change, l’utilisateur doit ré-accepter (le mobile compare `acceptedVersion` vs `version`).
- Étape suivante possible: étendre le gating à d’autres features (si nécessaire).
