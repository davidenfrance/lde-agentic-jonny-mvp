import { NextRequest, NextResponse } from "next/server";
import { askJonnyGrok, assertJonny, getLiveInstruction, JONNY_KEY, setInstruction } from "@/lib/controller";
import { normalizeKey } from "@/lib/sign";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ key_id: string }> }
) {
  try {
    const { key_id } = await ctx.params;
    assertJonny(normalizeKey(key_id || ""));
    const live = await getLiveInstruction(JONNY_KEY);
    return NextResponse.json({
      device_id: JONNY_KEY,
      person: "Jonny Fry",
      room: "controller",
      xai_configured: Boolean(process.env.JONNY_XAI_API_KEY),
      live_instruction: live
        ? {
            instruction_id: live.instruction_id,
            text: live.text,
            issued_at: live.issued_at,
            expires_at: live.expires_at,
          }
        : null,
      not_a_real_hsm: true,
      note: "POST wallet-instruct-mvp, wallet-instruct-clear-mvp or wallet-ask-mvp signed by Jonny's device key.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "controller_failed";
    return NextResponse.json({ error: message }, { status: message === "controller_jonny_only" ? 404 : 400 });
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ key_id: string }> }
) {
  try {
    const { key_id } = await ctx.params;
    assertJonny(normalizeKey(key_id || ""));
    const body = (await req.json()) as {
      action?: string;
      text?: string;
      issued_at?: string;
      expires_at?: string;
      signature?: string;
    };
    if (!body.action || !body.issued_at || !body.signature) {
      return NextResponse.json({ error: "action_issued_at_signature_required" }, { status: 400 });
    }
    if (body.action === "wallet-instruct-mvp" || body.action === "wallet-instruct-clear-mvp") {
      if (!body.expires_at) return NextResponse.json({ error: "expires_at_required" }, { status: 400 });
      const row = await setInstruction({
        device_id: JONNY_KEY,
        text: body.text || "",
        issued_at: body.issued_at,
        expires_at: body.expires_at,
        signature: body.signature,
        clear: body.action === "wallet-instruct-clear-mvp",
      });
      return NextResponse.json({ ok: true, instruction: row }, { status: 201 });
    }
    if (body.action === "wallet-ask-mvp") {
      const out = await askJonnyGrok({
        prompt: body.text || "",
        issued_at: body.issued_at,
        signature: body.signature,
      });
      return NextResponse.json({ ok: !out.error, ...out }, { status: out.error === "JONNY_XAI_API_KEY_not_set" ? 503 : 200 });
    }
    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "controller_failed";
    const status =
      message === "controller_jonny_only"
        ? 404
        : message.startsWith("invalid_")
          ? 401
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
