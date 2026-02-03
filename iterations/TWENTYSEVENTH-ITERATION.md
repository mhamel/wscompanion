# TWENTY-SEVENTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Objectif: handoff autonome.

## 1) Ce qui a été fait

Objectif atteint: **FE-090** — AskScreen MVP (mobile).

- AskScreen consomme `POST /v1/ask`:
  - `apps/mobile/src/screens/AskScreen.tsx`
  - input question + ticker optionnel
  - bouton “Demander”, états busy/error
  - rendu `answer` + sections + bullets
  - sources news cliquables (ouvre URL)
- Paywall:
  - si user free: écran “Ask (Pro)” + CTA Paywall (source `ask`)
  - si API renvoie `PAYWALL`: navigation vers Paywall
  - `apps/mobile/src/navigation/MainStack.tsx` accepte maintenant `source: 'ask'`
- Client API:
  - `apps/mobile/src/api/client.ts` expose `ask(...)`
- Backlog:
  - `docs/TODO_MOBILE.md`: `FE-090` coché

## 2) Comment valider

```powershell
npm run api:generate
npx tsc -p apps/mobile/tsconfig.json --noEmit
```

Manuel:
1) être Pro (ou override) → onglet Ask → poser une question → voir réponse
2) être Free → Ask → CTA Paywall

## 3) Notes / limites

- Les “sources” non-news sont affichées comme chips génériques (type). Amélioration: afficher plus de détail (ex: `pnl_total`, date recompute).
- UI volontairement simple (MVP).

## 4) Git

- Branche: `main`
- Commit: voir `git log -1` (message: `feat: implement AskScreen (FE-090)`)

