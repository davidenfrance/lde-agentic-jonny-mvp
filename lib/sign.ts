import { createPrivateKey, createPublicKey, sign } from "crypto";
import { findRoster, ROSTER } from "./roster";

export const DEFAULT_DEVICE_ID =
  "e78c8cdf81b599cfc1a7488154536074ffd8aafcfebc8b519a9aa84839bd392e";

export function normalizePem(raw: string): string {
  let s = raw.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  s = s.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
  if (!s.endsWith("\n")) s += "\n";
  return s;
}

export function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/^0x/, "");
}

export function deviceId(): string {
  return normalizeKey(process.env.JONNY_DEVICE_ID || DEFAULT_DEVICE_ID);
}

export function oracleUrl(): string {
  return (process.env.LDI_ORACLE_URL || "https://www.londonagentic.ai").replace(/\/$/, "");
}

function pemsFromJson(): Record<string, string> {
  const raw = process.env.WALLET_PEMS_JSON;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) out[normalizeKey(k)] = v;
    return out;
  } catch {
    return {};
  }
}

export function pemForDevice(device_id: string): string {
  const id = normalizeKey(device_id);
  const fromJson = pemsFromJson()[id];
  if (fromJson) return fromJson;
  const row = findRoster(id);
  if (row && process.env[row.pem_env]) return String(process.env[row.pem_env]);
  if (id === deviceId() && process.env.JONNY_DEVICE_PRIVATE_KEY_PEM) {
    return process.env.JONNY_DEVICE_PRIVATE_KEY_PEM;
  }
  throw new Error(`pem_not_configured_for_${id}`);
}

export function inspectPem(device_id: string): {
  pem_configured: boolean;
  pem_parse_ok: boolean;
  begin_private_key: boolean;
  type: string | null;
  pub_matches_id: boolean | null;
  error: string | null;
} {
  let raw: string | null = null;
  try {
    raw = pemForDevice(device_id);
  } catch {
    return {
      pem_configured: false,
      pem_parse_ok: false,
      begin_private_key: false,
      type: null,
      pub_matches_id: null,
      error: "missing",
    };
  }
  const norm = normalizePem(raw);
  const begin_private_key = norm.includes("-----BEGIN PRIVATE KEY-----");
  try {
    const key = createPrivateKey(norm);
    const pub = createPublicKey(key)
      .export({ type: "spki", format: "der" })
      .subarray(-32)
      .toString("hex");
    return {
      pem_configured: true,
      pem_parse_ok: true,
      begin_private_key,
      type: key.asymmetricKeyType || null,
      pub_matches_id: pub === normalizeKey(device_id),
      error: null,
    };
  } catch (err) {
    return {
      pem_configured: true,
      pem_parse_ok: false,
      begin_private_key,
      type: null,
      pub_matches_id: null,
      error: err instanceof Error ? err.message : "parse_failed",
    };
  }
}

export function canonicalPresence(body: {
  device_id: string;
  state: string;
  human_eta_ms: number | null;
  issued_at: string;
}): string {
  return JSON.stringify({
    action: "hsm-presence-mvp",
    device_id: normalizeKey(body.device_id),
    state: body.state,
    human_eta_ms: body.human_eta_ms,
    issued_at: body.issued_at,
  });
}

export function signPresence(canonical: string, device_id: string): string {
  const key = createPrivateKey(normalizePem(pemForDevice(device_id)));
  return sign(null, Buffer.from(canonical, "utf8"), key).toString("hex");
}

export function rosterPublic() {
  return ROSTER.map((r) => ({
    key_id: r.key_id,
    person: r.person,
    firm: r.firm,
    ...inspectPem(r.key_id),
  }));
}
