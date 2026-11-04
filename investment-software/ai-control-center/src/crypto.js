import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function encryptionKey() {
  const raw = process.env.KEY_ENCRYPTION_KEY || "";
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("KEY_ENCRYPTION_KEY must be base64 for exactly 32 random bytes");
  return key;
}

export function encryptSecret(secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    fingerprint: createHash("sha256").update(secret).digest("hex").slice(0, 12)
  };
}

export function decryptSecret(record) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(record.key_iv, "base64"));
  decipher.setAuthTag(Buffer.from(record.key_auth_tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(record.key_ciphertext, "base64")),
    decipher.final()
  ]).toString("utf8");
}
