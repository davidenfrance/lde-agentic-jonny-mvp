import { neon } from "@neondatabase/serverless";

export type ControllerInstruction = {
  instruction_id: string;
  device_id: string;
  text: string;
  issued_at: string;
  expires_at: string;
  signature: string;
  cleared: boolean;
};

export type ControllerAsk = {
  ask_id: string;
  device_id: string;
  prompt: string;
  answer: string | null;
  model: string | null;
  error: string | null;
  issued_at: string;
};

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function ensureControllerSchema(): Promise<void> {
  const db = sql();
  await db`
    CREATE TABLE IF NOT EXISTS controller_instructions (
      instruction_id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      text TEXT NOT NULL,
      issued_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      signature TEXT NOT NULL,
      cleared BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS controller_instructions_device ON controller_instructions (device_id, created_at DESC)`;
  await db`
    CREATE TABLE IF NOT EXISTS controller_asks (
      ask_id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      prompt TEXT NOT NULL,
      answer TEXT,
      model TEXT,
      error TEXT,
      issued_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

export async function insertInstruction(row: ControllerInstruction): Promise<void> {
  const db = sql();
  await db`
    INSERT INTO controller_instructions (
      instruction_id, device_id, text, issued_at, expires_at, signature, cleared
    ) VALUES (
      ${row.instruction_id}, ${row.device_id}, ${row.text}, ${row.issued_at}::timestamptz,
      ${row.expires_at}::timestamptz, ${row.signature}, ${row.cleared}
    )
  `;
}

export async function latestInstruction(device_id: string): Promise<ControllerInstruction | null> {
  const db = sql();
  const rows = await db`
    SELECT * FROM controller_instructions
    WHERE device_id = ${device_id} AND cleared = false
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (!rows.length) return null;
  const r = rows[0] as Record<string, unknown>;
  return {
    instruction_id: String(r.instruction_id),
    device_id: String(r.device_id),
    text: String(r.text),
    issued_at: new Date(String(r.issued_at)).toISOString(),
    expires_at: new Date(String(r.expires_at)).toISOString(),
    signature: String(r.signature),
    cleared: Boolean(r.cleared),
  };
}

export async function insertAsk(row: ControllerAsk): Promise<void> {
  const db = sql();
  await db`
    INSERT INTO controller_asks (ask_id, device_id, prompt, answer, model, error, issued_at)
    VALUES (${row.ask_id}, ${row.device_id}, ${row.prompt}, ${row.answer}, ${row.model}, ${row.error}, ${row.issued_at}::timestamptz)
  `;
}
