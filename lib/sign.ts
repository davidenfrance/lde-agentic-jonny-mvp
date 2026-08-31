import { createPrivateKey, sign } from "crypto";

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

export function deviceId(): string {
  return (process.env.JONNY_DEVICE_ID || DEFAULT_DEVICE_ID).trim().toLowerCase();
}

export function oracleUrl(): string {
  return (process.env.LDI_ORACLE_URL || "https://www.londonagentic.ai").replace(/\/$/, "");
}

export function canonicalPresence(body: {
  device_id: string;
  state: string;
  human_eta_ms: number | null;
  issued_at: string;
}): string {
  return JSON.stringify({
    action: "hsm-presence-mvp",
    device_id: body.device_id,
    state: body.state,
    human_eta_ms: body.human_eta_ms,
    issued_at: body.issued_at,
  });
}

export function signPresence(canonical: string): string {
  const raw = process.env.JONNY_DEVICE_PRIVATE_KEY_PEM;
  if (!raw) throw new Error("JONNY_DEVICE_PRIVATE_KEY_PEM is not set");
  const key = createPrivateKey(normalizePem(raw));
  return sign(null, Buffer.from(canonical, "utf8"), key).toString("hex");
}
