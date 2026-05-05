import { createDecipheriv, createHash } from "node:crypto";

const ENCRYPTION_VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const AUTH_TAG_LENGTH = 16;

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

function getEncryptionKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;

  if (!secret || secret.length < 24) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be configured with at least 24 characters");
  }

  return deriveKey(secret);
}

export function decryptSecret(payload: string): string {
  const [version, iv, authTag, encrypted] = payload.split(":");

  if (version !== ENCRYPTION_VERSION || !iv || !authTag || !encrypted) {
    throw new Error("Unsupported encrypted secret format");
  }

  const key = getEncryptionKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64url"), {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(Buffer.from(authTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
