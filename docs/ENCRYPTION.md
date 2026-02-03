# Encryption (SEC-002) — tokens SnapTrade + rotation clés

Objectif: chiffrer **au repos** les tokens SnapTrade stockés en DB (Postgres), permettre la **rotation** de clés sans downtime, et rendre le process opérable (script + doc).

## 1) Ce qui est chiffré

- `BrokerConnection.accessTokenEnc` (Bytes)
- `BrokerConnection.refreshTokenEnc` (Bytes)

Chiffrement “app-level” (pas seulement “disk encryption” du volume DB).

## 2) Implémentation

- Code: `apps/backend/src/crypto.ts`
- Algo: AES-256-GCM
- Format payload:
  - version `1`: legacy (key id implicite `0`)
  - version `2`: `version(1) + keyId(1) + iv(12) + tag(16) + ciphertext`

## 3) Configuration des clés (env)

### Option A — clé unique (simple)

- `APP_ENCRYPTION_KEY` = base64 d’une clé 32 bytes

### Option B — keyring (rotation)

- `APP_ENCRYPTION_KEYS` = `"<id>:<base64>,<id>:<base64>"`
  - `id` entier `0..255`
  - garder `0` si vous avez encore des payloads legacy
- `APP_ENCRYPTION_ACTIVE_KEY_ID` = l’id utilisé pour chiffrer les nouveaux payloads

En dev, si aucune clé n’est fournie, une clé par défaut non-sécurisée est utilisée (pour éviter de bloquer le développement).

### Générer une clé (32 bytes base64)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 4) Rotation (procédure)

Rotation “sans downtime” recommandée:

1) Ajouter une nouvelle clé à `APP_ENCRYPTION_KEYS` (sans retirer l’ancienne).
2) Déployer avec `APP_ENCRYPTION_ACTIVE_KEY_ID` pointant vers la **nouvelle** clé.
   - l’app peut toujours déchiffrer l’ancien stock grâce à l’ancienne clé.
3) Exécuter le script de rotation (dry-run d’abord):

```powershell
# dry-run (défaut)
npm --workspace apps/backend run crypto:rotate -- --provider=snaptrade

# apply
npm --workspace apps/backend run crypto:rotate -- --provider=snaptrade --apply
```

Options:
- `--batchSize=200` (défaut 200)
- `--provider=snaptrade`
- `--userId=<uuid>`

4) Vérifier qu’il ne reste plus de tokens sur l’ancien key id (logs du script).
5) Retirer l’ancienne clé de `APP_ENCRYPTION_KEYS` (optionnel, selon politique).

## 5) Notes sécurité

- Le script ne fait que ré-encrypter: il ne loggue jamais de tokens (seulement ids internes).
- Garder les anciennes clés tant que vous avez des payloads chiffrés avec elles.
- En production, privilégier une gestion de secrets (KMS/secret manager) et une rotation contrôlée (playbook + audit).

