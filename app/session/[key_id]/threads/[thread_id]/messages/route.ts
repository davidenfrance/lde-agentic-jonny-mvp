import { NextRequest, NextResponse } from "next/server";
import { findRoster } from "@/lib/roster";
import { normalizeKey } from "@/lib/sign";
import { addInterrogatorMessage, addSubjectReply, getThread, publicThread } from "@/lib/threads";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ key_id: string; thread_id: string }> }
) {
  try {
    const { key_id, thread_id } = await ctx.params;
    const row = findRoster(normalizeKey(key_id || ""));
    if (!row) return NextResponse.json({ error: "unknown_session_key" }, { status: 404 });
    const thread = getThread(row.key_id, thread_id);
    if (!thread) return NextResponse.json({ error: "unknown_thread" }, { status: 404 });
    const body = (await req.json()) as {
      text?: string;
      sent_at?: string;
      signature?: string;
    };
    if (!body.text || !body.sent_at || !body.signature) {
      return NextResponse.json({ error: "text_sent_at_signature_required" }, { status: 400 });
    }
    addInterrogatorMessage({
      thread,
      text: body.text,
      sent_at: body.sent_at,
      signature: body.signature,
    });
    addSubjectReply(thread, row);
    return NextResponse.json({ ok: true, thread: publicThread(thread) }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "message_failed";
    const status = message.startsWith("invalid_") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
