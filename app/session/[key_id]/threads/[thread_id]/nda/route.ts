import { NextRequest, NextResponse } from "next/server";
import { findRoster } from "@/lib/roster";
import { normalizeKey } from "@/lib/sign";
import { getThread } from "@/lib/threads";
import { publicNda, registerOffer, threadNdas } from "@/lib/nda";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ key_id: string; thread_id: string }> }
) {
  const { key_id, thread_id } = await ctx.params;
  const row = findRoster(normalizeKey(key_id || ""));
  if (!row) return NextResponse.json({ error: "unknown_session_key" }, { status: 404 });
  const thread = await getThread(row.key_id, thread_id);
  if (!thread) return NextResponse.json({ error: "unknown_thread" }, { status: 404 });
  const ndas = await threadNdas(thread.thread_id);
  return NextResponse.json({ thread_id: thread.thread_id, ndas: ndas.map(publicNda) });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ key_id: string; thread_id: string }> }
) {
  try {
    const { key_id, thread_id } = await ctx.params;
    const roster = findRoster(normalizeKey(key_id || ""));
    if (!roster) return NextResponse.json({ error: "unknown_session_key" }, { status: 404 });
    const thread = await getThread(roster.key_id, thread_id);
    if (!thread) return NextResponse.json({ error: "unknown_thread" }, { status: 404 });
    const body = (await req.json()) as { wording?: string; company_signature?: string };
    if (!body.wording) return NextResponse.json({ error: "wording_required" }, { status: 400 });
    const nda = await registerOffer({
      thread,
      wording: body.wording,
      company_signature: body.company_signature || null,
    });
    return NextResponse.json({ ok: true, nda: publicNda(nda) }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "nda_offer_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
