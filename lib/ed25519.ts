import { createPublicKey, verify } from "crypto";
import { normalizeKey } from "./sign";

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export function verifyEd25519Hex(message: string, publicKeyHex: string, signatureHex: string): boolean {
  const key = normalizeKey(publicKeyHex);
  const sig = (signatureHex || "").trim().toLowerCase().replace(/^0x/, "");
  if (key.length !== 64 || sig.length !== 128) return false;
  try {
    const pub = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(key, "hex")]),
      format: "der",
      type: "spki",
    });
    return verify(null, Buffer.from(message, "utf8"), pub, Buffer.from(sig, "hex"));
  } catch {
    return false;
  }
}
