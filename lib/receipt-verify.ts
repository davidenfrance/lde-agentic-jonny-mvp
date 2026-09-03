import { verifyEd25519Hex } from "./ed25519";
import { normalizeKey } from "./sign";

export const RECEIPT_ACTION = "ldedi-query-receipt-1.0";
export const BURNED_INDEX_PUBLIC_KEY_HEX =
  "c9d3f73a61b58e0defb9b43286ee5afbfa1c49ba0fb9db0def34b77e4363fb83";

export type QueryReceipt = {
  action?: string;
  receipt_id?: string;
  query_id?: string;
  index_id?: string;
  record_id?: string;
  key_id?: string;
  session_url?: string | null;
  record_canonical_hash?: string;
  served_row_hash?: string;
  listing_signature?: string;
  query?: {
    task?: string | null;
    jurisdiction?: string | null;
    firm?: string | null;
    verification?: string | null;
    language?: string | null;
  };
  interrogator_key_id?: string;
  queried_at?: string;
  receipt_expires_at?: string;
  signature?: string;
  index_public_key_hex?: string;
};

export type ReceiptView = {
  presented: boolean;
  ok: boolean;
  live: boolean;
  errors: string[];
  receipt_id?: string;
  query_id?: string;
  key_id?: string;
  interrogator_key_id?: string;
  session_url?: string | null;
  queried_at?: string;
  receipt_expires_at?: string;
  query?: QueryReceipt["query"];
  declared_intent?: string;
};

function burnedIndexKey(): string {
  return normalizeKey(process.env.INDEX_PUBLIC_KEY_HEX || BURNED_INDEX_PUBLIC_KEY_HEX);
}

export function canonicalQueryReceipt(r: QueryReceipt): string {
  return JSON.stringify({
    action: r.action,
    receipt_id: r.receipt_id,
    query_id: r.query_id,
    index_id: r.index_id,
    record_id: r.record_id,
    key_id: normalizeKey(r.key_id || ""),
    session_url: r.session_url ?? null,
    record_canonical_hash: r.record_canonical_hash,
    served_row_hash: r.served_row_hash,
    listing_signature: (r.listing_signature || "").trim().toLowerCase().replace(/^0x/, ""),
    query: {
      task: r.query?.task ?? null,
      jurisdiction: r.query?.jurisdiction ?? null,
      firm: r.query?.firm ?? null,
      verification: r.query?.verification ?? null,
      language: r.query?.language ?? null,
    },
    interrogator_key_id: normalizeKey(r.interrogator_key_id || ""),
    queried_at: r.queried_at,
    receipt_expires_at: r.receipt_expires_at,
  });
}

export function assessReceipt(
  receipt: QueryReceipt | null | undefined,
  opts?: {
    subject_key_id?: string;
    interrogator_key_id?: string;
    session_url?: string;
  }
): ReceiptView {
  if (!receipt) {
    return { presented: false, ok: true, live: false, errors: [] };
  }
  const errors: string[] = [];
  if (receipt.action !== RECEIPT_ACTION) errors.push("not_a_query_receipt");
  if (!receipt.signature || !receipt.receipt_id) errors.push("receipt_incomplete");
  const hint = receipt.index_public_key_hex ? normalizeKey(receipt.index_public_key_hex) : "";
  const burned = burnedIndexKey();
  if (hint && hint !== burned) errors.push("index_public_key_mismatch");
  const statement = canonicalQueryReceipt(receipt);
  if (receipt.signature && !verifyEd25519Hex(statement, burned, receipt.signature)) {
    errors.push("invalid_index_signature");
  }
  const expires = receipt.receipt_expires_at ? Date.parse(receipt.receipt_expires_at) : NaN;
  const live = Number.isFinite(expires) && Date.now() < expires;
  if (!live) errors.push("receipt_expired");
  if (opts?.subject_key_id && receipt.key_id && normalizeKey(receipt.key_id) !== normalizeKey(opts.subject_key_id)) {
    errors.push("receipt_subject_mismatch");
  }
  if (
    opts?.interrogator_key_id &&
    receipt.interrogator_key_id &&
    normalizeKey(receipt.interrogator_key_id) !== normalizeKey(opts.interrogator_key_id)
  ) {
    errors.push("receipt_interrogator_mismatch");
  }
  if (opts?.session_url && receipt.session_url && receipt.session_url !== opts.session_url) {
    errors.push("receipt_session_url_mismatch");
  }
  const q = receipt.query || {};
  const intentBits = [q.task, q.jurisdiction, q.firm, q.verification].filter(Boolean);
  return {
    presented: true,
    ok: errors.length === 0,
    live,
    errors,
    receipt_id: receipt.receipt_id,
    query_id: receipt.query_id,
    key_id: receipt.key_id ? normalizeKey(receipt.key_id) : undefined,
    interrogator_key_id: receipt.interrogator_key_id
      ? normalizeKey(receipt.interrogator_key_id)
      : undefined,
    session_url: receipt.session_url ?? null,
    queried_at: receipt.queried_at,
    receipt_expires_at: receipt.receipt_expires_at,
    query: receipt.query,
    declared_intent: intentBits.length ? intentBits.join(" / ") : undefined,
  };
}
