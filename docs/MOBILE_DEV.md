# Mobile dev (Expo) — Android emulator + iOS device

Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Objectif: permettre a n’importe qui de lancer l’app mobile rapidement (Android emulator ou iPhone) et comprendre les limites d’Expo Go.

## 1) Pre-requis

- Node.js + npm
- Android Studio (pour l’emulateur Android)
- (Optionnel) Docker Desktop / Docker Engine (pour Postgres + Redis + deps backend)

## 2) Backend (API)

L’app mobile consomme l’API Fastify.

1) Demarrer les deps locales:
- `docker compose up -d`
- Ou VS Code task: `Infra: Up (docker compose)`

2) Configurer l’API:
- Copier `apps/backend/.env.example` -> `apps/backend/.env`
- `npm --workspace apps/backend run db:generate` (ou task `Backend: Prisma generate`)
- `npm --workspace apps/backend run db:migrate` (ou task `Backend: DB migrate (dev)`)

Raccourci (VS Code):
- task `Backend: Setup DB (generate + migrate)`

3) Lancer l’API:
- `npm --workspace apps/backend run dev`
- Ou VS Code task: `Backend: API (dev)`

Optionnel (jobs/queues):
- `npm --workspace apps/backend run dev:worker`
- Ou VS Code task: `Backend: Worker (dev)`

## 3) Mobile — Expo dev server

1) Configurer l’app:
- Copier `apps/mobile/.env.example` -> `apps/mobile/.env`

2) Lancer Metro / Expo:
- `npm --workspace apps/mobile run start`

Ou via VS Code: `Terminal` -> `Run Task...` -> `Mobile: Metro (Expo)`.
Astuce: si Metro est "stuck", utiliser `Mobile: Metro (Expo, Clear Cache)`.

Raccourci (VS Code):
- task `Dev: Full stack (Infra + Backend + Mobile)` (lance plusieurs tasks en parallèle)
- Premier setup (fresh clone): task `Dev: Fresh clone (Bootstrap + Run)` (démarre Docker, fait migrate, puis lance API/worker/Metro)

## 4) Android emulator

Avec un emulateur Android operationnel (Android Studio):

- VS Code task: `Mobile: Android (Expo)`
- (debug) `Mobile: Android (Expo, Clear Cache)`
- ou CLI: `npm --workspace apps/mobile run android`

Note importante (Android emulator):
- `localhost` pointe vers l’emulateur lui-meme, pas ton PC.
- Mets `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000` pour joindre l’API qui tourne sur ton PC.

## 5) iOS (premier device cible)

Sur Windows, tu ne peux pas lancer le simulateur iOS. Pour voir l’app sur iPhone:

1) Installer **Expo Go** sur l’iPhone.
2) Lancer Metro: `npm --workspace apps/mobile run start`
3) Scanner le QR code depuis Expo Go.

Important: sur un device physique, `EXPO_PUBLIC_API_BASE_URL` doit pointer vers l’IP de ta machine sur le meme reseau (pas `localhost`).
Ex:
- `EXPO_PUBLIC_API_BASE_URL=http://192.168.0.123:3000`

Astuce: en mode dev, tu peux aussi le changer directement dans l’app: `Paramètres` -> `Dev` -> `Override API baseUrl` (inclut des presets `10.0.2.2` et `localhost`).

Option (macOS):
- VS Code task: `Mobile: iOS (Expo)` (ouvre le simulateur iOS)

## 6) Expo Go — ce qui n’est pas supporte ici

Expo Go n’embarque pas tous les modules natifs.

- **RevenueCat (`react-native-purchases`)**: non disponible dans Expo Go (module natif `RNPurchases` absent).
  - L’app detecte ce cas et affiche un message dans le Paywall.
  - Pour tester les achats, utiliser un **dev build (EAS)** ou une build App Store/TestFlight. Voir `docs/EAS_DEV_BUILD.md`.

Notes:
- Les push notifications iOS requierent un device physique; le simulateur iOS ne recoit pas de push APNs.
- En mode dev, l’app affiche un petit banner si `EXPO_PUBLIC_API_BASE_URL` est sur `localhost` (aide a corriger emulator/device).
