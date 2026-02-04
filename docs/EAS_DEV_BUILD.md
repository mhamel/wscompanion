# EAS dev build (iOS) — tester les modules natifs (ex: RevenueCat)

Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Pourquoi: Expo Go ne supporte pas tous les modules natifs (ex: `react-native-purchases` / RevenueCat). Pour tester les achats sur iPhone, il faut un **dev build** (Expo Dev Client) ou une build App Store/TestFlight.

Note: `expo-dev-client` est déjà ajouté dans `apps/mobile/package.json` (SDK 54 compatible).

## TL;DR

Dans `apps/mobile`:
- `npx eas-cli login` (ou VS Code task `Mobile: EAS login`)
- `npx eas-cli init` (crée le project EAS / projectId)
- `npx eas-cli build --profile development --platform ios`
- Lancer Metro en mode dev client: `npm --workspace apps/mobile run start -- --dev-client` (ou task `Mobile: Metro (Dev Client)`)

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

## Configurer l’API base URL sur iPhone

Même en dev build, `localhost` ne marche pas sur un device.

- Le plus simple: dans l’app, `Paramètres` -> `Dev` -> renseigne `Override API baseUrl` (ex: `http://192.168.0.123:3000`).
- Android emulator: utilise `http://10.0.2.2:3000`.

## VS Code Tasks

Dans VS Code: `Terminal` -> `Run Task...`

- `Mobile: Metro (Dev Client)` (lance `expo start --dev-client`)
- `Mobile: EAS login`
- `Mobile: EAS init`
- `Mobile: EAS build iOS (development)`
- `Mobile: EAS build Android (development)`
