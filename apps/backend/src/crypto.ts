import crypto from "node:crypto";

type Keyring = {
  activeKeyId: number;
  keys: ReadonlyMap<number, Buffer>;
};

let cachedKeyring: Keyring | null = null;

function parseKeyBase64(label: string, keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) {
    throw new Error(`${label} must be 32 bytes (base64-encoded)`);
  }
  return key;
}

function getKeyring(): Keyring {
  if (cachedKeyring) return cachedKeyring;

  const nodeEnv = process.env.NODE_ENV ?? "development";
  const keysRaw = process.env.APP_ENCRYPTION_KEYS?.trim();

  if (keysRaw) {
    const keys = new Map<number, Buffer>();
    for (const entry of keysRaw
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)) {
      const [idRaw, keyBase64] = entry.split(":", 2);
      if (!idRaw || !keyBase64) {
        throw new Error("APP_ENCRYPTION_KEYS entries must be '<id>:<base64>'");
      }

      const keyId = Number(idRaw);
      if (!Number.isInteger(keyId) || keyId < 0 || keyId > 255) {
        throw new Error(`Invalid APP_ENCRYPTION_KEYS key id: ${idRaw}`);
      }

      if (keys.has(keyId)) {
        throw new Error(`Duplicate APP_ENCRYPTION_KEYS key id: ${keyId}`);
      }

      keys.set(keyId, parseKeyBase64(`APP_ENCRYPTION_KEYS[${keyId}]`, keyBase64));
    }

    const activeRaw = process.env.APP_ENCRYPTION_ACTIVE_KEY_ID?.trim();
    const activeKeyId = activeRaw ? Number(activeRaw) : Math.min(...keys.keys());

    if (!Number.isInteger(activeKeyId) || !keys.has(activeKeyId)) {
      throw new Error("APP_ENCRYPTION_ACTIVE_KEY_ID must reference an existing key id");
    }

    cachedKeyring = { activeKeyId, keys };
    return cachedKeyring;
  }

  const singleKeyBase64 = process.env.APP_ENCRYPTION_KEY?.trim();
  if (singleKeyBase64) {
    const key = parseKeyBase64("APP_ENCRYPTION_KEY", singleKeyBase64);
    cachedKeyring = { activeKeyId: 0, keys: new Map([[0, key]]) };
    return cachedKeyring;
  }

  if (nodeEnv !== "production") {
    const key = crypto.createHash("sha256").update("dev-app-encryption-key").digest();
    cachedKeyring = { activeKeyId: 0, keys: new Map([[0, key]]) };
    return cachedKeyring;
  }

  throw new Error("APP_ENCRYPTION_KEY or APP_ENCRYPTION_KEYS is required in production");
}

export function encryptStringToBytes(plaintext: string): Uint8Array<ArrayBuffer> {
  const keyring = getKeyring();
  const key = keyring.keys.get(keyring.activeKeyId);
  if (!key) {
    throw new Error("Active encryption key not found");
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Format: version(1) + keyId(1) + iv(12) + tag(16) + ciphertext
  const payload = Buffer.concat([Buffer.from([2, keyring.activeKeyId]), iv, tag, ciphertext]);
  const arrayBuffer = payload.buffer.slice(
    payload.byteOffset,
    payload.byteOffset + payload.byteLength,
  );
  return new Uint8Array(arrayBuffer);
}

export function decryptStringFromBytes(payload: Uint8Array<ArrayBuffer>): string {
  const buffer = Buffer.from(payload);

  if (buffer.length < 1 + 12 + 16) {
    throw new Error("Invalid encrypted payload");
  }

  const version = buffer.subarray(0, 1).readUInt8(0);
  const keyring = getKeyring();

  if (version === 1) {
    const key = keyring.keys.get(0);
    if (!key) {
      throw new Error("Encrypted payload uses legacy key id 0, but it is not configured");
    }

    const iv = buffer.subarray(1, 13);
    const tag = buffer.subarray(13, 29);
    const ciphertext = buffer.subarray(29);

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
  }

  if (version !== 2) {
    throw new Error(`Unsupported encrypted payload version: ${version}`);
  }

  if (buffer.length < 2 + 12 + 16) {
    throw new Error("Invalid encrypted payload");
  }

  const keyId = buffer.subarray(1, 2).readUInt8(0);
  const key = keyring.keys.get(keyId);
  if (!key) {
    throw new Error(`Encryption key not found for key id: ${keyId}`);
  }

  const iv = buffer.subarray(2, 14);
  const tag = buffer.subarray(14, 30);
  const ciphertext = buffer.subarray(30);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
