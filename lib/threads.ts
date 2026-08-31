import { randomUUID } from "crypto";
import { findRoster, type RosterEntry } from "./roster";
import { canonicalPresence, normalizeKey, signPresence } from "./sign";
import { verifyEd25519Hex } from "./ed25519";

type ThreadMessage = {
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

export function listThreads(subject_device_id: string): Thread[] {
  const id = normalizeKey(subject_device_id);
  return [...bag().values()].filter((t) => t.subject_device_id === id);
}

export function getThread(subject_device_id: string, thread_id: string): Thread | null {
  const t = bag().get(thread_id);
  if (!t || t.subject_device_id !== normalizeKey(subject_device_id)) return null;
  return t;
}

export function openThread(opts: {
  subject: RosterEntry;
  interrogator_key_id: string;
  cover_ref?: string | null;
  opened_at: string;
  signature: string;
}): Thread {
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
  bag().set(thread.thread_id, thread);
  return thread;
}

export function addInterrogatorMessage(opts: {
  thread: Thread;
  text: string;
  sent_at: string;
  signature: string;
}): Thread {
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
  opts.thread.messages.push({
    seq,
    from: "interrogator",
    lang: "en",
    text,
    sent_at: opts.sent_at,
    signature: opts.signature,
  });
  return opts.thread;
}

export function addSubjectReply(thread: Thread, subject: RosterEntry): Thread {
  const sent_at = new Date().toISOString();
  const seq = thread.messages.length + 1;
  const last = [...thread.messages].reverse().find((m) => m.from === "interrogator");
  const text =
    seq === 2
      ? `This is the English session host for ${subject.person}, ${subject.firm}. Identity cover lives on LDI, not in this thread. How can I help?`
      : `Understood. (${subject.person}) You wrote: "${(last?.text || "").slice(0, 240)}" This reply is English text only. It is not a Bind and not settlement.`;
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
  thread.messages.push({
    seq,
    from: "subject",
    lang: "en",
    text,
    sent_at,
    signature,
  });
  return thread;
}

export function closeThread(thread: Thread): Thread {
  thread.status = "closed";
  thread.closed_at = new Date().toISOString();
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
    note: "English text thread. Not a Bind. Server memory is MVP only and may reset on deploy.",
  };
}

void canonicalPresence;
export { findRoster };
