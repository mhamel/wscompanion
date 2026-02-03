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

## Notes

- L’acceptation n’est pas encore “hard-required” pour utiliser toutes les features (MVP).
- Étape suivante possible: gating (ex: Ask) tant que disclaimer non accepté.
