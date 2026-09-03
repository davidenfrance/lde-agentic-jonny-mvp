import { NextRequest, NextResponse } from "next/server";
import { findRoster } from "@/lib/roster";
import { normalizeKey } from "@/lib/sign";
import { listThreads, openThread, publicThread } from "@/lib/threads";
import { assessReceipt, type QueryReceipt } from "@/lib/receipt-verify";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ key_id: string }> }
) {
  const { key_id } = await ctx.params;
  const row = findRoster(normalizeKey(key_id || ""));
  if (!row) return NextResponse.json({ error: "unknown_session_key" }, { status: 404 });
  const threads = await listThreads(row.key_id);
  return NextResponse.json({
    device_id: row.key_id,
    person: row.person,
    threads: threads.map(publicThread),
  });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ key_id: string }> }
) {
  try {
    const { key_id } = await ctx.params;
    const row = findRoster(normalizeKey(key_id || ""));
    if (!row) return NextResponse.json({ error: "unknown_session_key" }, { status: 404 });
    const body = (await req.json()) as {
      interrogator_key_id?: string;
      cover_ref?: string | null;
      opened_at?: string;
      signature?: string;
      receipt?: QueryReceipt;
    };
    if (!body.interrogator_key_id || !body.opened_at || !body.signature) {
      return NextResponse.json(
        { error: "interrogator_key_id_opened_at_signature_required" },
        { status: 400 }
      );
    }
    const sessionUrl = `https://agentic.londondigitalescrow.com/session/${row.key_id}`;
    const receipt_view = assessReceipt(body.receipt, {
      subject_key_id: row.key_id,
      interrogator_key_id: body.interrogator_key_id,
      session_url: sessionUrl,
    });
    if (body.receipt && !receipt_view.ok) {
      return NextResponse.json(
        { error: "invalid_query_receipt", receipt_view },
        { status: 401 }
      );
    }
    const thread = await openThread({
      subject: row,
      interrogator_key_id: body.interrogator_key_id,
      cover_ref: body.cover_ref || null,
      opened_at: body.opened_at,
      signature: body.signature,
      receipt_view,
    });
    return NextResponse.json({ ok: true, thread: publicThread(thread), receipt_view }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "thread_open_failed";
    const status = message.startsWith("invalid_") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
