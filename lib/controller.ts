import { randomUUID } from "crypto";
import { findRoster } from "./roster";
import { normalizeKey } from "./sign";
import { verifyEd25519Hex } from "./ed25519";
import {
  ensureControllerSchema,
  hasDatabase,
  insertAsk,
  insertInstruction,
  latestInstruction,
  type ControllerInstruction,
} from "./controller-db";

export const JONNY_KEY = "e78c8cdf81b599cfc1a7488154536074ffd8aafcfebc8b519a9aa84839bd392e";

export function assertJonny(key_id: string) {
  if (normalizeKey(key_id) !== JONNY_KEY) {
    throw new Error("controller_jonny_only");
  }
}

export function canonicalInstruct(body: {
  action: "wallet-instruct-mvp" | "wallet-instruct-clear-mvp" | "wallet-ask-mvp";
  device_id: string;
  text: string;
  issued_at: string;
  expires_at: string | null;
}): string {
  return JSON.stringify({
    action: body.action,
    device_id: normalizeKey(body.device_id),
    text: body.text,
    issued_at: body.issued_at,
    expires_at: body.expires_at,
  });
}

function live(row: ControllerInstruction | null): ControllerInstruction | null {
  if (!row) return null;
  if (row.cleared) return null;
  if (Date.parse(row.expires_at) <= Date.now()) return null;
  return row;
}

export async function getLiveInstruction(device_id: string): Promise<ControllerInstruction | null> {
  if (!hasDatabase()) return null;
  await ensureControllerSchema();
  return live(await latestInstruction(normalizeKey(device_id)));
}

export async function setInstruction(opts: {
  device_id: string;
  text: string;
  issued_at: string;
  expires_at: string;
  signature: string;
  clear?: boolean;
}): Promise<ControllerInstruction> {
  assertJonny(opts.device_id);
  if (!findRoster(JONNY_KEY)) throw new Error("unknown_device");
  const issued = Date.parse(opts.issued_at);
  const exp = Date.parse(opts.expires_at);
  if (Number.isNaN(issued) || Number.isNaN(exp)) throw new Error("invalid_time");
  if (Math.abs(Date.now() - issued) > 120_000) throw new Error("issued_at_stale");
  if (exp <= issued) throw new Error("expires_before_issued");
  if (exp - issued > 24 * 60 * 60 * 1000) throw new Error("ttl_over_24h");
  const text = (opts.text || "").trim();
  if (!opts.clear && !text) throw new Error("text_required");
  if (text.length > 4000) throw new Error("text_too_long");
  const action = opts.clear ? "wallet-instruct-clear-mvp" : "wallet-instruct-mvp";
  const canonical = canonicalInstruct({
    action,
    device_id: JONNY_KEY,
    text: opts.clear ? "" : text,
    issued_at: opts.issued_at,
    expires_at: opts.expires_at,
  });
  if (!verifyEd25519Hex(canonical, JONNY_KEY, opts.signature)) {
    throw new Error("invalid_controller_signature");
  }
  if (!hasDatabase()) throw new Error("DATABASE_URL_required");
  await ensureControllerSchema();
  const row: ControllerInstruction = {
    instruction_id: `ins-${randomUUID()}`,
    device_id: JONNY_KEY,
    text: opts.clear ? "" : text,
    issued_at: opts.issued_at,
    expires_at: opts.expires_at,
    signature: opts.signature,
    cleared: Boolean(opts.clear),
  };
  await insertInstruction(row);
  return row;
}

export async function askJonnyGrok(opts: {
  prompt: string;
  issued_at: string;
  signature: string;
}): Promise<{ ask_id: string; answer: string | null; model: string | null; error: string | null; instruction: ControllerInstruction | null }> {
  assertJonny(JONNY_KEY);
  const issued = Date.parse(opts.issued_at);
  if (Number.isNaN(issued) || Math.abs(Date.now() - issued) > 120_000) throw new Error("issued_at_stale");
  const prompt = (opts.prompt || "").trim();
  if (!prompt) throw new Error("text_required");
  if (prompt.length > 8000) throw new Error("text_too_long");
  const canonical = canonicalInstruct({
    action: "wallet-ask-mvp",
    device_id: JONNY_KEY,
    text: prompt,
    issued_at: opts.issued_at,
    expires_at: null,
  });
  if (!verifyEd25519Hex(canonical, JONNY_KEY, opts.signature)) {
    throw new Error("invalid_controller_signature");
  }
  const instruction = await getLiveInstruction(JONNY_KEY);
  const apiKey = process.env.JONNY_XAI_API_KEY;
  const model = process.env.JONNY_XAI_MODEL || "grok-4";
  const ask_id = `ask-${randomUUID()}`;
  if (!apiKey) {
    if (hasDatabase()) {
      await ensureControllerSchema();
      await insertAsk({
        ask_id,
        device_id: JONNY_KEY,
        prompt,
        answer: null,
        model: null,
        error: "JONNY_XAI_API_KEY_not_set",
        issued_at: opts.issued_at,
      });
    }
    return { ask_id, answer: null, model: null, error: "JONNY_XAI_API_KEY_not_set", instruction };
  }
  const system = [
    "You are Jonny Fry's personal Wallet AI on the LDE session host.",
    "Answer in English. You are not a Bind and you must not move money.",
    "Identity cover is on LDI. This room is controller-only.",
    instruction?.text ? `Live controller instruction: ${instruction.text}` : "No live controller instruction.",
  ].join(" ");
  let answer: string | null = null;
  let error: string | null = null;
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });
    const body = (await res.json()) as {
      error?: { message?: string };
      choices?: { message?: { content?: string } }[];
    };
    if (!res.ok) error = body.error?.message || `xai_http_${res.status}`;
    else answer = body.choices?.[0]?.message?.content || "";
  } catch (err) {
    error = err instanceof Error ? err.message : "xai_failed";
  }
  if (hasDatabase()) {
    await ensureControllerSchema();
    await insertAsk({
      ask_id,
      device_id: JONNY_KEY,
      prompt,
      answer,
      model,
      error,
      issued_at: opts.issued_at,
    });
  }
  return { ask_id, answer, model, error, instruction };
}
