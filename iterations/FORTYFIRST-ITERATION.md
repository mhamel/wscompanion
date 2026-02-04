# FORTY-FIRST ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): ship a usable mobile app quickly, with a deterministic Ask assistant and a smooth day-to-day dev workflow.

Iteration goal: improve the Ask conversation UX (mobile) so threads feel like real chat history (more space, auto-scroll, better sources).

## 1) What changed

### Mobile Ask UI/UX improvements

- `apps/mobile/src/screens/AskScreen.tsx`
  - Conversation list now uses available vertical space:
    - `threadCard` is `flex: 1`
    - messages `ScrollView` is `flex: 1`
  - Input fields (question + optional ticker + submit) moved to the bottom of the screen (more chat-like layout).
  - Auto-scrolls to the bottom when:
    - opening a thread (`threadId` changes)
    - new messages arrive (items length changes)
  - Source chips show more informative labels:
    - News sources show publisher (fallback “News”)
    - P&L and Transactions sources use clearer labels
  - Adds a small timestamp under each message bubble (best-effort from `createdAt`).
  - Adds a loading placeholder card when a thread is selected and the messages are still loading.

## 2) Validation

- `npx tsc -p apps/mobile/tsconfig.json --noEmit`

## 3) Notes / follow-ups

- Sources UX can still be improved by showing news title/date in the chip or a dedicated “Sources” row.
- If we add streaming later (FE-091), the auto-scroll logic may need to respect “user scrolled up” state.

## 4) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

