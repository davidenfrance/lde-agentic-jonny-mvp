import { createHash, randomUUID } from "crypto";
import { normalizeKey } from "./sign";
import { verifyEd25519Hex } from "./ed25519";
import type { Thread } from "./threads";
import {
  ensureNdaSchema,
  getNda,
  getNdaByHash,
  hasDatabase,
  insertNda,
  listNdas,
  storeCountersign,
  type NdaRow,
} from "./nda-db";

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function canonicalNdaOffer(body: {
  action: "nda-offer-mvp";
  subject_device_id: string;
  thread_id: string;
  wording_hash: string;
  issued_at: string;
}): string {
  return JSON.stringify({
    action: "nda-offer-mvp",
    subject_device_id: normalizeKey(body.subject_device_id),
    thread_id: body.thread_id,
    wording_hash: body.wording_hash,
    issued_at: body.issued_at,
  });
}

export function canonicalNdaCountersign(body: {
  action: "nda-countersign-mvp";
  subject_device_id: string;
  thread_id: string;
  wording_hash: string;
  signer_key_id: string;
  signed_at: string;
}): string {
  return JSON.stringify({
    action: "nda-countersign-mvp",
    subject_device_id: normalizeKey(body.subject_device_id),
    thread_id: body.thread_id,
    wording_hash: body.wording_hash,
    signer_key_id: normalizeKey(body.signer_key_id),
    signed_at: body.signed_at,
  });
}

export function publicNda(row: NdaRow) {
  return {
    nda_id: row.nda_id,
    thread_id: row.thread_id,
    subject_device_id: row.subject_device_id,
    wording_hash: row.wording_hash,
    wording: row.wording,
    company_signature: row.company_signature,
    interrogator_key_id: row.interrogator_key_id,
    countersignature: row.countersignature,
    countersigner_key_id: row.countersigner_key_id,
    status: row.status,
    issued_at: row.issued_at,
    mutual_at: row.mutual_at,
    mvp_ephemeral_ok: process.env.NDA_REQUIRE_LDE_WALLET !== "true",
  };
}

export async function registerOffer(opts: {
  thread: Thread;
  wording: string;
  company_signature?: string | null;
}): Promise<NdaRow> {
  if (!hasDatabase()) throw new Error("DATABASE_URL_required");
  await ensureNdaSchema();
  const wording = opts.wording.trim();
  if (wording.length < 200) throw new Error("wording_too_short");
  const wording_hash = sha256Hex(wording);
  const existing = await getNdaByHash(opts.thread.thread_id, wording_hash);
  if (existing) return existing;
  const row: NdaRow = {
    nda_id: `nda-${randomUUID()}`,
    thread_id: opts.thread.thread_id,
    subject_device_id: opts.thread.subject_device_id,
    wording,
    wording_hash,
    company_signature: opts.company_signature || null,
    interrogator_key_id: opts.thread.interrogator_key_id,
    countersignature: null,
    countersigner_key_id: null,
    status: "offer",
    issued_at: new Date().toISOString(),
    mutual_at: null,
  };
  await insertNda(row);
  return row;
}

export async function countersignNda(opts: {
  thread: Thread;
  wording_hash: string;
  signer_key_id: string;
  signed_at: string;
  signature: string;
}): Promise<NdaRow> {
  if (!hasDatabase()) throw new Error("DATABASE_URL_required");
  await ensureNdaSchema();
  const wording_hash = opts.wording_hash.trim().toLowerCase();
  const signer = normalizeKey(opts.signer_key_id);
  const row = await getNdaByHash(opts.thread.thread_id, wording_hash);
  if (!row) throw new Error("unknown_nda_hash");
  if (row.status === "mutual") return row;
  const requireLde = process.env.NDA_REQUIRE_LDE_WALLET === "true";
  if (requireLde) throw new Error("lde_wallet_required_in_production");
  if (signer !== opts.thread.interrogator_key_id) throw new Error("signer_not_thread_key");
  const issued = Date.parse(opts.signed_at);
  if (Number.isNaN(issued) || Math.abs(Date.now() - issued) > 120_000) throw new Error("signed_at_stale");
  const canonical = canonicalNdaCountersign({
    action: "nda-countersign-mvp",
    subject_device_id: opts.thread.subject_device_id,
    thread_id: opts.thread.thread_id,
    wording_hash,
    signer_key_id: signer,
    signed_at: opts.signed_at,
  });
  if (!verifyEd25519Hex(canonical, signer, opts.signature)) {
    throw new Error("invalid_countersignature");
  }
  const mutual_at = new Date().toISOString();
  await storeCountersign({
    nda_id: row.nda_id,
    countersignature: opts.signature,
    countersigner_key_id: signer,
    mutual_at,
  });
  const updated = await getNda(row.nda_id);
  if (!updated) throw new Error("nda_missing_after_update");
  return updated;
}

export async function threadNdas(thread_id: string): Promise<NdaRow[]> {
  if (!hasDatabase()) return [];
  await ensureNdaSchema();
  return listNdas(thread_id);
}
