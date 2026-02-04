# THIRTY-NINTH ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Project goal (reminder): ship an end-to-end product (backend + mobile) that is easy to clone, start, and iterate on, with a deterministic "Ask" assistant (no LLM) that is gated behind Pro + risk disclaimer.

Iteration goal: make Ask follow-ups work better and make the mobile history renderer show the same structured output that the backend persists.

## 1) What changed

### Backend: infer symbol from existing thread when doing follow-ups

- `apps/backend/src/assistant/askContext.ts`
  - Adds `extractSymbolFromMessageData()` + `inferSymbolFromThreadMessages()` to infer the last known `symbol` from recent *user* messages in an Ask thread (by inspecting `AskMessage.data`).
- `apps/backend/src/assistant/askContext.test.ts`
  - Unit tests for symbol extraction/inference behavior.
- `apps/backend/src/routes/ask.ts`
  - If the request has `threadId` and **no** `symbol` (and no symbol extracted from question), the backend loads recent user messages for the thread and reuses the last known symbol.
  - If `threadId` is provided but does not belong to the authenticated user, the API returns `404 Ask thread not found` (prevents leaking existence).

Why: users often ask a follow-up ("what about last week?") and expect it to keep the same ticker.

### Mobile: render structured assistant messages from stored data

- `apps/mobile/src/screens/AskScreen.tsx`
  - Thread history now renders structured assistant responses by parsing `AskMessage.data` (stored AskResponse shape: `{ answer, sections[] }`).
  - Sections are rendered with bullets and "Source" chips (news URLs open via `Linking.openURL()`).
  - Removes the duplicate "result" renderer and relies on the thread messages as the single source of truth.

### Docs

- `docs/ASK.md`
  - Documents that the backend can reuse the last known `symbol` when `threadId` is provided.
- `docs/TODO_MOBILE.md`
  - FE-091 stays open, but notes the partial MVP: threads/messages/delete now live in AskScreen.

## 2) How to use / validate

- Start a new Ask conversation with a ticker (e.g. set `symbol=AAPL`) and submit.
- For a follow-up, keep `threadId` (mobile does this automatically) and leave the ticker field empty: the backend should infer it from the conversation.

Commands validated locally:
- `npm --workspace apps/backend run lint`
- `npm --workspace apps/backend test`
- `npm --workspace apps/backend run build`
- `npm --workspace apps/backend run format`
- `npx tsc -p apps/mobile/tsconfig.json --noEmit`

## 3) Notes / design constraints

- Persistence format:
  - user message: `role="user"`, `content` is redacted question, `data` may include `{ symbol }`
  - assistant message: `role="assistant"`, `content` is `answer`, `data` is the full structured response
- The symbol inference currently scans recent user messages (take 25). A future optimization would be to store `symbol` on `AskThread` directly.

## 4) Next steps (good follow-up iteration ideas)

- FE-091: a dedicated ConversationScreen with streaming UX, retry, and "useful/not useful" feedback.
- Improve the sources UI: show publisher/title for news sources, not just a generic "Source" chip.

## 5) Git

- Branch: `main`
- Commit: to be created in this iteration (run `git log -1` after commit)

