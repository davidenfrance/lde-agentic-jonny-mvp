import { NextRequest, NextResponse } from "next/server";
import { canonicalPresence, deviceId, oracleUrl, signPresence } from "@/lib/sign";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { state?: string; human_eta_ms?: number | null };
    const state = body.state || "present";
    if (state !== "present" && state !== "eta" && state !== "declined") {
      return NextResponse.json({ error: "invalid_state" }, { status: 400 });
    }
    const device_id = deviceId();
    const issued_at = new Date().toISOString();
    const human_eta_ms = state === "eta" ? body.human_eta_ms ?? 2500 : null;
    const canonical = canonicalPresence({ device_id, state, human_eta_ms, issued_at });
    const signature = signPresence(canonical);
    const res = await fetch(`${oracleUrl()}/api/v1/cover/presence`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ device_id, state, human_eta_ms, issued_at, signature }),
    });
    const data = await res.json();
    return NextResponse.json(
      {
        forwarded: res.status,
        not_a_real_hsm: true,
        canonical,
        oracle: data,
      },
      { status: res.status }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "presence_sign_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
