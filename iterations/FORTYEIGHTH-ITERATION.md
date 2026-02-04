# FORTY-EIGHTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): keep dev/testing friction low on real devices (iOS-first), especially around network configuration.

Iteration goal: allow changing the mobile API base URL at runtime (dev) and make the whole app consistently use the effective base URL.

## 1) What changed

### Mobile: dev settings store (persisted) for API baseUrl override

- `apps/mobile/src/dev/devSettingsStore.ts`
  - New Zustand + SecureStore store with:
    - `apiBaseUrlOverride` (persisted)
    - `hydrate()` and `setApiBaseUrlOverride()`
  - Normalizes input (adds scheme if missing; stores URL origin).

- `apps/mobile/src/providers/AppProviders.tsx`
  - Hydrates dev settings store on app start.

### Mobile: centralized API hooks (useApiClient / baseUrl)

- `apps/mobile/src/api/apiHooks.ts`
  - `useApiBaseUrl()` returns the effective base URL (override if set + hydrated in dev).
  - `useApiClient()` creates the OpenAPI client using the effective base URL.
  - `getEffectiveApiBaseUrl()` is available for non-React modules.

### Mobile: adopt the hook everywhere

Updated screens/hooks to stop hardcoding `config.apiBaseUrl` and instead use the effective base URL:

- Screens:
  - `apps/mobile/src/screens/AuthScreen.tsx`
  - `apps/mobile/src/screens/HomeScreen.tsx`
  - `apps/mobile/src/screens/PortfolioScreen.tsx`
  - `apps/mobile/src/screens/ExportsScreen.tsx`
  - `apps/mobile/src/screens/AlertsScreen.tsx`
  - `apps/mobile/src/screens/CreateAlertScreen.tsx`
  - `apps/mobile/src/screens/ConnectionsScreen.tsx`
  - `apps/mobile/src/screens/PaywallScreen.tsx`
  - `apps/mobile/src/screens/TickerScreen.tsx`
  - `apps/mobile/src/screens/TransactionsFilterScreen.tsx`
  - `apps/mobile/src/screens/WheelCycleDetailScreen.tsx`
  - `apps/mobile/src/screens/AskScreen.tsx`
  - `apps/mobile/src/screens/SettingsScreen.tsx`

- Hook:
  - `apps/mobile/src/billing/entitlements.ts`

- Non-React module:
  - `apps/mobile/src/analytics/analytics.ts` now uses `getEffectiveApiBaseUrl()`.

### Mobile: UI improvements for dev override + banners

- `apps/mobile/src/screens/SettingsScreen.tsx`
  - Dev card now shows the effective `API` baseUrl and supports:
    - editing override baseUrl
    - Apply / Reset (clears React Query cache to avoid stale data)
    - /health probe uses effective baseUrl

- `apps/mobile/src/ui/Screen.tsx`
  - Localhost warning banner now uses the effective baseUrl (override-aware).

## 2) Validation

- `npx tsc -p apps/mobile/tsconfig.json --noEmit`

## 3) Notes / gotchas

- The override is dev-only (`__DEV__`) and persists via SecureStore.
- Input normalization stores URL origin only (ex: `http://10.0.2.2:3000`).

## 4) Next steps

- Consider exposing the override for internal EAS builds (non-Expo-Go) if needed (currently dev-only).
- Add a “copy API URL” button if we decide to add `expo-clipboard`.

## 5) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

