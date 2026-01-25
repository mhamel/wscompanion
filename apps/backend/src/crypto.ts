import crypto from "node:crypto";

function getAppEncryptionKey(): Buffer {
  const keyBase64 = process.env.APP_ENCRYPTION_KEY?.trim();
  if (keyBase64) {
    const key = Buffer.from(keyBase64, "base64");
    if (key.length !== 32) {
      throw new Error("APP_ENCRYPTION_KEY must be 32 bytes (base64-encoded)");
    }
    return key;
  }

  const nodeEnv = process.env.NODE_ENV ?? "development";
  if (nodeEnv !== "production") {
    return crypto.createHash("sha256").update("dev-app-encryption-key").digest();
  }

  throw new Error("APP_ENCRYPTION_KEY is required in production");
}

export function encryptStringToBytes(plaintext: string): Uint8Array<ArrayBuffer> {
  const key = getAppEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Format: version(1) + iv(12) + tag(16) + ciphertext
  const payload = Buffer.concat([Buffer.from([1]), iv, tag, ciphertext]);
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
  if (version !== 1) {
    throw new Error(`Unsupported encrypted payload version: ${version}`);
  }

  const key = getAppEncryptionKey();
  const iv = buffer.subarray(1, 13);
  const tag = buffer.subarray(13, 29);
  const ciphertext = buffer.subarray(29);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
