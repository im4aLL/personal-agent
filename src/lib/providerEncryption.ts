const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

const PASSPHRASE_SALT_BYTES = new Uint8Array([
  0x70, 0x65, 0x72, 0x73, 0x6f, 0x6e, 0x61, 0x6c, 0x2d, 0x61, 0x67, 0x65, 0x6e, 0x74, 0x2d, 0x76,
]);

export type EncryptedKeyFormat = {
  salt?: string;
  iv: string;
  ciphertext: string;
};

export function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

export function base64Decode(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function serialize(encrypted: EncryptedKeyFormat): string {
  const salt = encrypted.salt ?? "";
  return `v1|${salt}|${encrypted.iv}|${encrypted.ciphertext}`;
}

function parse(value: string): EncryptedKeyFormat {
  const parts = value.split("|");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Invalid encrypted key format");
  }

  const salt = parts[1];
  return {
    salt: salt || undefined,
    iv: parts[2] ?? "",
    ciphertext: parts[3] ?? "",
  };
}

export async function deriveKeyFromPassphrase(passphrase: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    ENCODER.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: PASSPHRASE_SALT_BYTES,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function generateRandomKey(): Promise<{ recoveryKey: string; key: CryptoKey }> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const recoveryKey = base64Encode(raw);
  const key = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);

  return { recoveryKey, key };
}

export async function importKeyFromBase64(base64: string): Promise<CryptoKey> {
  const raw = base64Decode(base64);
  if (raw.byteLength !== 32) {
    throw new Error("Invalid recovery key length");
  }

  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptApiKey(apiKey: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    ENCODER.encode(apiKey),
  );

  return serialize({
    iv: base64Encode(iv),
    ciphertext: base64Encode(new Uint8Array(ciphertext)),
  });
}

export async function decryptApiKey(encrypted: string, key: CryptoKey): Promise<string> {
  const parsed = parse(encrypted);
  const iv = base64Decode(parsed.iv);
  const ciphertext = base64Decode(parsed.ciphertext);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);

  return DECODER.decode(decrypted);
}
