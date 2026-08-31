import { NextRequest, NextResponse } from "next/server";
import { findRoster } from "@/lib/roster";
import { normalizeKey } from "@/lib/sign";
import { closeThread, getThread, publicThread } from "@/lib/threads";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ key_id: string; thread_id: string }> }
) {
  const { key_id, thread_id } = await ctx.params;
  const row = findRoster(normalizeKey(key_id || ""));
  if (!row) return NextResponse.json({ error: "unknown_session_key" }, { status: 404 });
  const thread = getThread(row.key_id, thread_id);
  if (!thread) return NextResponse.json({ error: "unknown_thread" }, { status: 404 });
  return NextResponse.json(publicThread(thread));
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ key_id: string; thread_id: string }> }
) {
  const { key_id, thread_id } = await ctx.params;
  const row = findRoster(normalizeKey(key_id || ""));
  if (!row) return NextResponse.json({ error: "unknown_session_key" }, { status: 404 });
  const thread = getThread(row.key_id, thread_id);
  if (!thread) return NextResponse.json({ error: "unknown_thread" }, { status: 404 });
  const body = (await req.json()) as { action?: string };
  if (body.action === "thread-close-mvp") {
    return NextResponse.json(publicThread(closeThread(thread)));
  }
  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
