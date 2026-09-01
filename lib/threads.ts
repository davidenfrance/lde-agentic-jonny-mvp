import { randomUUID } from "crypto";
import { findRoster, type RosterEntry } from "./roster";
import { normalizeKey, signPresence } from "./sign";
import { verifyEd25519Hex } from "./ed25519";
import { CONTROLLER_DISCLOSURE_ASK, JONNY_KEY } from "./disclosure";
import { jonnyThreadGrokReply } from "./jonny-thread-reply";
import {
  dbCloseThread,
  dbGetThread,
  dbInsertMessage,
  dbInsertThread,
  dbListThreads,
  ensureThreadSchema,
  hasDatabase,
} from "./thread-db";

export type ThreadMessage = {
  seq: number;
  from: "interrogator" | "subject";
  lang: "en";
  text: string;
  sent_at: string;
  signature: string;
};

export type Thread = {
  thread_id: string;
  subject_device_id: string;
  interrogator_key_id: string;
  language: "en";
  cover_ref: string | null;
  opened_at: string;
  closed_at: string | null;
  status: "open" | "closed";
  open_signature: string;
  messages: ThreadMessage[];
};

type G = typeof globalThis & { __lde_threads?: Map<string, Thread> };

function bag(): Map<string, Thread> {
  const g = globalThis as G;
  if (!g.__lde_threads) g.__lde_threads = new Map();
  return g.__lde_threads;
}

async function persistReady(): Promise<boolean> {
  if (!hasDatabase()) return false;
  await ensureThreadSchema();
  return true;
}

export function canonicalThreadOpen(body: {
  action: "thread-open-mvp";
  subject_device_id: string;
  interrogator_key_id: string;
  language: "en";
  cover_ref: string | null;
  opened_at: string;
}): string {
  return JSON.stringify({
    action: "thread-open-mvp",
    subject_device_id: normalizeKey(body.subject_device_id),
    interrogator_key_id: normalizeKey(body.interrogator_key_id),
    language: "en",
    cover_ref: body.cover_ref,
    opened_at: body.opened_at,
  });
}

export function canonicalThreadMessage(body: {
  action: "thread-message-mvp";
  thread_id: string;
  from: string;
  lang: "en";
  text: string;
  seq: number;
  sent_at: string;
}): string {
  return JSON.stringify({
    action: "thread-message-mvp",
    thread_id: body.thread_id,
    from: body.from,
    lang: "en",
    text: body.text,
    seq: body.seq,
    sent_at: body.sent_at,
  });
}

export async function listThreads(subject_device_id: string): Promise<Thread[]> {
  const id = normalizeKey(subject_device_id);
  if (await persistReady()) return dbListThreads(id);
  return [...bag().values()].filter((t) => t.subject_device_id === id);
}

export async function getThread(subject_device_id: string, thread_id: string): Promise<Thread | null> {
  const id = normalizeKey(subject_device_id);
  if (await persistReady()) return dbGetThread(id, thread_id);
  const t = bag().get(thread_id);
  if (!t || t.subject_device_id !== id) return null;
  return t;
}

export async function openThread(opts: {
  subject: RosterEntry;
  interrogator_key_id: string;
  cover_ref?: string | null;
  opened_at: string;
  signature: string;
}): Promise<Thread> {
  const interrogator_key_id = normalizeKey(opts.interrogator_key_id);
  if (interrogator_key_id.length !== 64) throw new Error("invalid_interrogator_key_id");
  const canonical = canonicalThreadOpen({
    action: "thread-open-mvp",
    subject_device_id: opts.subject.key_id,
    interrogator_key_id,
    language: "en",
    cover_ref: opts.cover_ref || null,
    opened_at: opts.opened_at,
  });
  if (!verifyEd25519Hex(canonical, interrogator_key_id, opts.signature)) {
    throw new Error("invalid_interrogator_signature");
  }
  const thread: Thread = {
    thread_id: `th-${randomUUID()}`,
    subject_device_id: opts.subject.key_id,
    interrogator_key_id,
    language: "en",
    cover_ref: opts.cover_ref || null,
    opened_at: opts.opened_at,
    closed_at: null,
    status: "open",
    open_signature: opts.signature,
    messages: [],
  };
  if (await persistReady()) await dbInsertThread(thread);
  else bag().set(thread.thread_id, thread);
  return thread;
}

export async function addInterrogatorMessage(opts: {
  thread: Thread;
  text: string;
  sent_at: string;
  signature: string;
}): Promise<Thread> {
  if (opts.thread.status !== "open") throw new Error("thread_closed");
  const text = (opts.text || "").trim();
  if (!text) throw new Error("text_required");
  if (text.length > 4000) throw new Error("text_too_long");
  const seq = opts.thread.messages.length + 1;
  const canonical = canonicalThreadMessage({
    action: "thread-message-mvp",
    thread_id: opts.thread.thread_id,
    from: "interrogator",
    lang: "en",
    text,
    seq,
    sent_at: opts.sent_at,
  });
  if (!verifyEd25519Hex(canonical, opts.thread.interrogator_key_id, opts.signature)) {
    throw new Error("invalid_interrogator_signature");
  }
  const msg: ThreadMessage = {
    seq,
    from: "interrogator",
    lang: "en",
    text,
    sent_at: opts.sent_at,
    signature: opts.signature,
  };
  opts.thread.messages.push(msg);
  if (await persistReady()) await dbInsertMessage(opts.thread.thread_id, msg);
  return opts.thread;
}

function looksLikeDisclosure(text: string): boolean {
  const t = text.toLowerCase();
  const name = t.includes("name") || t.split(/\s+/).length >= 2;
  const nat = t.includes("nationalit") || t.includes("citizen") || t.includes("british");
  const res =
    t.includes("resident") || t.includes("residence") || t.includes("united kingdom") || t.includes("uk");
  return name && nat && res;
}

export async function addSubjectReply(thread: Thread, subject: RosterEntry): Promise<Thread> {
  const sent_at = new Date().toISOString();
  const seq = thread.messages.length + 1;
  const last = [...thread.messages].reverse().find((m) => m.from === "interrogator");
  const isJonny = subject.key_id === JONNY_KEY;
  const disclosed = thread.messages.some((m) => m.from === "interrogator" && looksLikeDisclosure(m.text));
  let text: string;
  if (isJonny && !disclosed) {
    text = CONTROLLER_DISCLOSURE_ASK;
  } else if (isJonny && disclosed) {
    text =
      (await jonnyThreadGrokReply(thread.messages.map((m) => ({ from: m.from, text: m.text })))) ||
      `This chat is not a Bind. Identity cover is with London Digital Insurance Limited.`;
  } else if (seq === 2) {
    text = `This is the English session host for ${subject.person}, ${subject.firm}. Identity cover lives on LDI, not in this thread. How can I help?`;
  } else {
    text = `Understood. (${subject.person}) You wrote: "${(last?.text || "").slice(0, 240)}" This reply is English text only. It is not a Bind and not settlement.`;
  }
  const canonical = canonicalThreadMessage({
    action: "thread-message-mvp",
    thread_id: thread.thread_id,
    from: "subject",
    lang: "en",
    text,
    seq,
    sent_at,
  });
  const signature = signPresence(canonical, subject.key_id);
  const msg: ThreadMessage = {
    seq,
    from: "subject",
    lang: "en",
    text,
    sent_at,
    signature,
  };
  thread.messages.push(msg);
  if (await persistReady()) await dbInsertMessage(thread.thread_id, msg);
  return thread;
}

export async function closeThread(thread: Thread): Promise<Thread> {
  thread.status = "closed";
  thread.closed_at = new Date().toISOString();
  if (await persistReady()) await dbCloseThread(thread.thread_id, thread.closed_at);
  return thread;
}

export function publicThread(thread: Thread) {
  return {
    thread_id: thread.thread_id,
    subject_device_id: thread.subject_device_id,
    interrogator_key_id: thread.interrogator_key_id,
    language: thread.language,
    cover_ref: thread.cover_ref,
    opened_at: thread.opened_at,
    closed_at: thread.closed_at,
    status: thread.status,
    messages: thread.messages,
    persistent: hasDatabase(),
    note: hasDatabase()
      ? "English text thread stored in Postgres. Not a Bind."
      : "English text thread. DATABASE_URL is not set; memory only.",
  };
}

export { findRoster };
