# EAS dev build (iOS) — tester les modules natifs (ex: RevenueCat)

Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Pourquoi: Expo Go ne supporte pas tous les modules natifs (ex: `react-native-purchases` / RevenueCat). Pour tester les achats sur iPhone, il faut un **dev build** (Expo Dev Client) ou une build App Store/TestFlight.

## TL;DR

Dans `apps/mobile`:
- `npx eas-cli login`
- `npx eas-cli init` (crée le project EAS / projectId)
- `npx eas-cli build --profile development --platform ios`
- Lancer Metro en mode dev client: `npm --workspace apps/mobile run start -- --dev-client`

## Prérequis

- Compte Expo / EAS
- Apple Developer Program (pour builds iOS distribuables)
- Un iPhone (device physique) pour tester les achats (et push APNs)

## Notes importantes

- Identifiants bundle:
  - `apps/mobile/app.json` contient des valeurs par défaut:
    - iOS: `com.justlovethestocks.mobile`
    - Android: `com.justlovethestocks.mobile`
  - Si tu as déjà une app publiée ou si tu veux un identifiant différent, change-les avant de build.
- `eas init` va généralement ajouter un `projectId` dans la config Expo (c’est normal).

## VS Code Tasks

Dans VS Code: `Terminal` -> `Run Task...`

- `Mobile: Metro (Dev Client)` (lance `expo start --dev-client`)
- `Mobile: EAS init`
- `Mobile: EAS build iOS (development)`

