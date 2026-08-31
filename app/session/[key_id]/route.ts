import { NextRequest, NextResponse } from "next/server";
import { deviceId } from "@/lib/sign";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ key_id: string }> }
) {
  const { key_id } = await ctx.params;
  const expected = deviceId();
  const got = (key_id || "").trim().toLowerCase().replace(/^0x/, "");
  if (got !== expected) {
    return NextResponse.json(
      { error: "unknown_session_key", expected_device_id: expected },
      { status: 404 }
    );
  }
  return NextResponse.json({
    session: `https://agentic.londondigitalescrow.com/session/${expected}`,
    device_id: expected,
    person: "Jonny Fry",
    firm: "London Digital Escrow Limited",
    presence: "POST /api/v1/presence",
    not_a_real_hsm: true,
  });
}
