# Ask (BE-120 / FE-090) — MVP

Objectif: un écran “Ask” style Perplexity qui répond à une question avec:
- un résumé clair
- des sections structurées
- des **sources** (internes: P&L/transactions, externes: news)

## Backend

- Endpoint: `POST /v1/ask` (Pro-only)
- Impl: `apps/backend/src/routes/ask.ts`
- Builder (déterministe, sans LLM): `apps/backend/src/assistant/ask.ts`

### Payload

Request:
- `question` (string, required)
- `symbol` (string, optional) — sinon extraction simple depuis la question (MVP)

Response:
- `answer` (string)
- `sections[]` (title, bullets, sources)

## Mobile

- TODO: `FE-090` (AskScreen) — consommer `POST /v1/ask` et afficher sections + liens.

