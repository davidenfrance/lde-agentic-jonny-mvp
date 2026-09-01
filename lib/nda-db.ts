import { neon } from "@neondatabase/serverless";

export type NdaRow = {
  nda_id: string;
  thread_id: string;
  subject_device_id: string;
  wording: string;
  wording_hash: string;
  company_signature: string | null;
  interrogator_key_id: string;
  countersignature: string | null;
  countersigner_key_id: string | null;
  status: "offer" | "mutual";
  issued_at: string;
  mutual_at: string | null;
};

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function ensureNdaSchema(): Promise<void> {
  const db = sql();
  await db`
    CREATE TABLE IF NOT EXISTS nda_instruments (
      nda_id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      subject_device_id TEXT NOT NULL,
      wording TEXT NOT NULL,
      wording_hash TEXT NOT NULL,
      company_signature TEXT,
      interrogator_key_id TEXT NOT NULL,
      countersignature TEXT,
      countersigner_key_id TEXT,
      status TEXT NOT NULL,
      issued_at TIMESTAMPTZ NOT NULL,
      mutual_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS nda_instruments_thread ON nda_instruments (thread_id)`;
}

function mapRow(r: Record<string, unknown>): NdaRow {
  return {
    nda_id: String(r.nda_id),
    thread_id: String(r.thread_id),
    subject_device_id: String(r.subject_device_id),
    wording: String(r.wording),
    wording_hash: String(r.wording_hash),
    company_signature: r.company_signature ? String(r.company_signature) : null,
    interrogator_key_id: String(r.interrogator_key_id),
    countersignature: r.countersignature ? String(r.countersignature) : null,
    countersigner_key_id: r.countersigner_key_id ? String(r.countersigner_key_id) : null,
    status: r.status === "mutual" ? "mutual" : "offer",
    issued_at: new Date(String(r.issued_at)).toISOString(),
    mutual_at: r.mutual_at ? new Date(String(r.mutual_at)).toISOString() : null,
  };
}

export async function insertNda(row: NdaRow): Promise<void> {
  const db = sql();
  await db`
    INSERT INTO nda_instruments (
      nda_id, thread_id, subject_device_id, wording, wording_hash, company_signature,
      interrogator_key_id, countersignature, countersigner_key_id, status, issued_at, mutual_at
    ) VALUES (
      ${row.nda_id}, ${row.thread_id}, ${row.subject_device_id}, ${row.wording}, ${row.wording_hash},
      ${row.company_signature}, ${row.interrogator_key_id}, ${row.countersignature},
      ${row.countersigner_key_id}, ${row.status}, ${row.issued_at}::timestamptz, ${row.mutual_at}::timestamptz
    )
  `;
}

export async function listNdas(thread_id: string): Promise<NdaRow[]> {
  const db = sql();
  const rows = await db`SELECT * FROM nda_instruments WHERE thread_id = ${thread_id} ORDER BY created_at DESC`;
  return rows.map((r) => mapRow(r as Record<string, unknown>));
}

export async function getNda(nda_id: string): Promise<NdaRow | null> {
  const db = sql();
  const rows = await db`SELECT * FROM nda_instruments WHERE nda_id = ${nda_id} LIMIT 1`;
  if (!rows.length) return null;
  return mapRow(rows[0] as Record<string, unknown>);
}

export async function getNdaByHash(thread_id: string, wording_hash: string): Promise<NdaRow | null> {
  const db = sql();
  const rows = await db`
    SELECT * FROM nda_instruments
    WHERE thread_id = ${thread_id} AND wording_hash = ${wording_hash}
    ORDER BY created_at DESC LIMIT 1
  `;
  if (!rows.length) return null;
  return mapRow(rows[0] as Record<string, unknown>);
}

export async function storeCountersign(opts: {
  nda_id: string;
  countersignature: string;
  countersigner_key_id: string;
  mutual_at: string;
}): Promise<void> {
  const db = sql();
  await db`
    UPDATE nda_instruments
    SET countersignature = ${opts.countersignature},
        countersigner_key_id = ${opts.countersigner_key_id},
        status = 'mutual',
        mutual_at = ${opts.mutual_at}::timestamptz
    WHERE nda_id = ${opts.nda_id}
  `;
}
