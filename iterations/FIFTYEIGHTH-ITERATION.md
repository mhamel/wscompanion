# FIFTY-EIGHTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): keep mobile dev/testing efficient and debuggable on real devices.

Iteration goal: provide a single “reset local state” button in-app (dev) so QA/dev can recover from bad tokens, bad API URLs, or corrupted local cache without reinstalling the app.

## 1) What changed

### Mobile: reset local state (dev)

- `apps/mobile/src/screens/SettingsScreen.tsx`
  - Adds `Reset local state (dev)` button in the Dev section.
  - It clears:
    - auth tokens (SecureStore)
    - notifications registration (SecureStore) + best-effort server `deviceDelete`
    - dev API baseUrl override (SecureStore)
    - analytics flags (SecureStore)
    - search history (SecureStore)
    - React Query cache (`queryClient.clear()`)

### Helpers

- `apps/mobile/src/analytics/analytics.ts`
  - Adds `resetAnalyticsLocalState()` to clear local analytics flags + caches.
- `apps/mobile/src/search/history.ts`
  - Adds `clearSearchHistory()` helper.

## 2) Validation

- `npx tsc -p apps/mobile/tsconfig.json --noEmit`

## 3) Notes

- The reset button is dev-only (`__DEV__`) and shows a confirmation dialog.
- Server device cleanup is best-effort (failure doesn’t block the local reset).

## 4) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

