import { NextRequest, NextResponse } from "next/server";
import { findRoster } from "@/lib/roster";
import { normalizeKey } from "@/lib/sign";
import { getThread } from "@/lib/threads";
import { countersignNda, publicNda } from "@/lib/nda";

export const dynamic = "force-dynamic";

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
    const body = (await req.json()) as {
      wording_hash?: string;
      signer_key_id?: string;
      signed_at?: string;
      signature?: string;
    };
    if (!body.wording_hash || !body.signer_key_id || !body.signed_at || !body.signature) {
      return NextResponse.json({ error: "wording_hash_signer_signed_at_signature_required" }, { status: 400 });
    }
    const nda = await countersignNda({
      thread,
      wording_hash: body.wording_hash,
      signer_key_id: body.signer_key_id,
      signed_at: body.signed_at,
      signature: body.signature,
    });
    return NextResponse.json({ ok: true, nda: publicNda(nda) }, { status: nda.status === "mutual" ? 200 : 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "countersign_failed";
    const status = message.startsWith("invalid_") || message === "signer_not_thread_key" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
