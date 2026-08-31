import { NextRequest, NextResponse } from "next/server";
import { findRoster } from "@/lib/roster";
import { deviceId, normalizeKey } from "@/lib/sign";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("device_id") || deviceId();
  const row = findRoster(normalizeKey(q));
  if (!row) return NextResponse.json({ error: "unknown_device" }, { status: 404 });
  return NextResponse.json({
    session: `https://agentic.londondigitalescrow.com/session/${row.key_id}`,
    device_id: row.key_id,
    person: row.person,
    firm: row.firm,
    not_a_real_hsm: true,
  });
}
