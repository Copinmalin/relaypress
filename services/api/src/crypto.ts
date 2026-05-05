import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ENCRYPTION_VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
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

export function encryptSecret(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("Cannot encrypt an empty secret");
  }

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(trimmed, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
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

export function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;

  if (value.length <= 8) {
    return "****";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
