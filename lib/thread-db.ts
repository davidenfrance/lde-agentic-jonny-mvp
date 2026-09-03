import { neon } from "@neondatabase/serverless";
import type { Thread } from "./threads";
import type { ReceiptView } from "./receipt-verify";

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function ensureThreadSchema(): Promise<void> {
  const db = sql();
  await db`
    CREATE TABLE IF NOT EXISTS conversation_threads (
      thread_id TEXT PRIMARY KEY,
      subject_device_id TEXT NOT NULL,
      interrogator_key_id TEXT NOT NULL,
      language TEXT NOT NULL,
      cover_ref TEXT,
      opened_at TIMESTAMPTZ NOT NULL,
      closed_at TIMESTAMPTZ,
      status TEXT NOT NULL,
      open_signature TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await db`ALTER TABLE conversation_threads ADD COLUMN IF NOT EXISTS receipt_id TEXT`;
  await db`ALTER TABLE conversation_threads ADD COLUMN IF NOT EXISTS receipt_query_id TEXT`;
  await db`ALTER TABLE conversation_threads ADD COLUMN IF NOT EXISTS receipt_json TEXT`;
  await db`
    CREATE TABLE IF NOT EXISTS conversation_messages (
      thread_id TEXT NOT NULL REFERENCES conversation_threads(thread_id),
      seq INTEGER NOT NULL,
      from_role TEXT NOT NULL,
      lang TEXT NOT NULL,
      text TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL,
      signature TEXT NOT NULL,
      PRIMARY KEY (thread_id, seq)
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS conversation_threads_subject ON conversation_threads (subject_device_id)`;
}

function parseReceipt(row: Record<string, unknown>): ReceiptView | null {
  if (!row.receipt_json) return null;
  try {
    return JSON.parse(String(row.receipt_json)) as ReceiptView;
  } catch {
    return row.receipt_id
      ? {
          presented: true,
          ok: true,
          live: false,
          errors: [],
          receipt_id: String(row.receipt_id),
          query_id: row.receipt_query_id ? String(row.receipt_query_id) : undefined,
        }
      : null;
  }
}

function mapThread(row: Record<string, unknown>, messages: Thread["messages"]): Thread {
  return {
    thread_id: String(row.thread_id),
    subject_device_id: String(row.subject_device_id),
    interrogator_key_id: String(row.interrogator_key_id),
    language: "en",
    cover_ref: row.cover_ref ? String(row.cover_ref) : null,
    opened_at: new Date(String(row.opened_at)).toISOString(),
    closed_at: row.closed_at ? new Date(String(row.closed_at)).toISOString() : null,
    status: row.status === "closed" ? "closed" : "open",
    open_signature: String(row.open_signature),
    messages,
    receipt_view: parseReceipt(row),
  };
}

export async function dbInsertThread(thread: Thread): Promise<void> {
  const db = sql();
  const receiptJson = thread.receipt_view ? JSON.stringify(thread.receipt_view) : null;
  const receiptId = thread.receipt_view?.receipt_id || null;
  const queryId = thread.receipt_view?.query_id || null;
  await db`
    INSERT INTO conversation_threads (
      thread_id, subject_device_id, interrogator_key_id, language, cover_ref,
      opened_at, closed_at, status, open_signature, receipt_id, receipt_query_id, receipt_json
    ) VALUES (
      ${thread.thread_id}, ${thread.subject_device_id}, ${thread.interrogator_key_id},
      ${thread.language}, ${thread.cover_ref}, ${thread.opened_at}::timestamptz,
      ${thread.closed_at}::timestamptz, ${thread.status}, ${thread.open_signature},
      ${receiptId}, ${queryId}, ${receiptJson}
    )
  `;
}

export async function dbInsertMessage(thread_id: string, m: Thread["messages"][number]): Promise<void> {
  const db = sql();
  await db`
    INSERT INTO conversation_messages (thread_id, seq, from_role, lang, text, sent_at, signature)
    VALUES (${thread_id}, ${m.seq}, ${m.from}, ${m.lang}, ${m.text}, ${m.sent_at}::timestamptz, ${m.signature})
  `;
}

export async function dbCloseThread(thread_id: string, closed_at: string): Promise<void> {
  const db = sql();
  await db`UPDATE conversation_threads SET status = 'closed', closed_at = ${closed_at}::timestamptz WHERE thread_id = ${thread_id}`;
}

async function loadMessages(thread_id: string): Promise<Thread["messages"]> {
  const db = sql();
  const rows = await db`SELECT * FROM conversation_messages WHERE thread_id = ${thread_id} ORDER BY seq ASC`;
  return rows.map((row) => ({
    seq: Number(row.seq),
    from: row.from_role === "subject" ? "subject" : "interrogator",
    lang: "en" as const,
    text: String(row.text),
    sent_at: new Date(String(row.sent_at)).toISOString(),
    signature: String(row.signature),
  }));
}

export async function dbGetThread(subject_device_id: string, thread_id: string): Promise<Thread | null> {
  const db = sql();
  const rows = await db`
    SELECT * FROM conversation_threads
    WHERE thread_id = ${thread_id} AND subject_device_id = ${subject_device_id}
    LIMIT 1
  `;
  if (!rows.length) return null;
  return mapThread(rows[0] as Record<string, unknown>, await loadMessages(thread_id));
}

export async function dbListThreads(subject_device_id: string): Promise<Thread[]> {
  const db = sql();
  const rows = await db`
    SELECT * FROM conversation_threads
    WHERE subject_device_id = ${subject_device_id}
    ORDER BY opened_at DESC
  `;
  const out: Thread[] = [];
  for (const row of rows) {
    const t = mapThread(row as Record<string, unknown>, await loadMessages(String(row.thread_id)));
    out.push(t);
  }
  return out;
}
