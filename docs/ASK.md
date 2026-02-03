# Ask (BE-120 / BE-121 / FE-090) — MVP

Objectif: un écran “Ask” style Perplexity qui répond à une question avec:
- un résumé clair
- des sections structurées
- des **sources** (internes: P&L/transactions, externes: news)

## Backend

- Endpoint: `POST /v1/ask` (Pro-only, disclaimer requis)
- Impl: `apps/backend/src/routes/ask.ts`
- Builder (déterministe, sans LLM): `apps/backend/src/assistant/ask.ts`

### Payload

Request:
- `question` (string, required)
- `symbol` (string, optional) — sinon extraction simple depuis la question (MVP)
- `threadId` (string, optional) — continuer une conversation existante

Response:
- `answer` (string)
- `sections[]` (title, bullets, sources)
- `threadId` (string) — conversation id (toujours retourné)

### Conversations (BE-121)

- `GET /v1/ask/threads` (list, paginé)
- `GET /v1/ask/threads/:id` (messages, paginé)
- `DELETE /v1/ask/threads/:id` (suppression)

Stockage:
- `AskThread` + `AskMessage` (DB)
- redaction PII “best-effort” côté backend: `apps/backend/src/assistant/redaction.ts`

Quota/rate limit:
- env `ASK_RATE_WINDOW_SECONDS` + `ASK_RATE_MAX`
- erreur `429` avec `code: "ASK_RATE_LIMITED"`

## Mobile

- Ask consomme `POST /v1/ask` (et ré-utilise `threadId` pour poursuivre la conversation).
- Ask affiche des conversations récentes (threads) et permet d’ouvrir / supprimer une conversation.
