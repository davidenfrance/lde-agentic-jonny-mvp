import { NextResponse } from "next/server";
import { oracleUrl, rosterPublic } from "@/lib/sign";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "lde-agentic-jonny-mvp",
    ldi_oracle: oracleUrl(),
    wallets: rosterPublic(),
    not_a_real_hsm: true,
    note: "This host signs presence per device_id. It is not an HSM and not LDI.",
  });
}
