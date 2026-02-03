# THIRTY-FIRST ITERATION (Knowledge Transfer)

Owner: Product/Delivery (this repo)  
Repo: `D:\DEVS\JUSTLOVETHESTOCKS`

Objectif projet (rappel): Companion Wealthsimple (via SnapTrade) — analytics P&L + wheel + news + alertes, avec confiance/sécurité (données sensibles, tokens providers).

Objectif de cette itération: rendre `SEC-002` réellement opérable en production: **rotation de clés** d’encryption (AES-GCM) pour les tokens SnapTrade stockés en DB.

## 1) Ce qui a été fait

### Backend — crypto helpers

- `apps/backend/src/crypto.ts`
  - Ajout:
    - `getActiveEncryptionKeyId()`
    - `parseEncryptedPayloadHeader(payload)` → `{ version, keyId }`
  - `decryptStringFromBytes(...)` accepte maintenant aussi `Uint8Array` (donc `Buffer` Prisma) en plus de `Uint8Array<ArrayBuffer>`.

### Backend — script de rotation

- Nouveau script: `apps/backend/src/scripts/rotateEncryptedTokens.ts`
  - But: re-chiffrer `BrokerConnection.accessTokenEnc` et `BrokerConnection.refreshTokenEnc` avec la **clé active**
  - Mode:
    - dry-run (défaut)
    - apply via `--apply`
  - Filtres:
    - `--provider=snaptrade`
    - `--userId=<uuid>`
    - `--batchSize=<n>`
- Nouveau script npm:
  - `apps/backend/package.json` → `crypto:rotate`

### Docs

- Nouveau: `docs/ENCRYPTION.md`
  - décrit le format des payloads, la config des keys, la procédure de rotation, et le script.
- `docs/TODO_SECURITY_QA_OBS.md`
  - marque `SEC-002` comme fait (doc + rotation opérable).
- `docs/THREAT_MODEL.md`
  - met à jour le checklist (audit logs + rotation) et remplace le “next step SEC-002” par `OBS-004` (SLOs).

## 2) Comment valider

```powershell
npm --workspace apps/backend run lint
npm --workspace apps/backend run format
npm --workspace apps/backend test
npm --workspace apps/backend run build
```

Pour tester la rotation en local (nécessite `DATABASE_URL` + des rows `broker_connection` avec tokens chiffrés):
```powershell
# dry-run
npm --workspace apps/backend run crypto:rotate -- --provider=snaptrade

# apply
npm --workspace apps/backend run crypto:rotate -- --provider=snaptrade --apply
```

## 3) Notes / limites / next steps

- Le script suppose que l’ancienne clé est toujours présente dans `APP_ENCRYPTION_KEYS` (sinon decrypt impossible).
- Le worker sync est encore en “mock ingestion” (`SYNC_MOCK_TRANSACTIONS_JSON`), donc ces tokens ne sont pas encore consommés côté provider — mais la rotation est prête pour le jour où l’intégration SnapTrade “réelle” sera branchée.
- Prochain gros lot sécurité recommandé:
  - `SEC-005` review ToS SnapTrade/news + disclaimers
  - `OBS-004` SLOs/alerting minimal

## 4) Git

- Branche: `main`
- Commit: à créer dans cette itération (voir `git log -1` après commit)

