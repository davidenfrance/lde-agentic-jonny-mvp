import { NextRequest, NextResponse } from "next/server";
import { findRoster } from "@/lib/roster";
import { normalizeKey } from "@/lib/sign";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ key_id: string }> }
) {
  const { key_id } = await ctx.params;
  const row = findRoster(normalizeKey(key_id || ""));
  if (!row) {
    return NextResponse.json({ error: "unknown_session_key" }, { status: 404 });
  }
  return NextResponse.json({
    session: `https://agentic.londondigitalescrow.com/session/${row.key_id}`,
    device_id: row.key_id,
    person: row.person,
    firm: row.firm,
    presence: "POST /api/v1/presence",
    not_a_real_hsm: true,
  });
}
