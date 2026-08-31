import { NextResponse } from "next/server";
import { DEFAULT_DEVICE_ID, deviceId, oracleUrl } from "@/lib/sign";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "lde-agentic-jonny-mvp",
    person: "Jonny Fry",
    device_id: deviceId(),
    default_device_id: DEFAULT_DEVICE_ID,
    ldi_oracle: oracleUrl(),
    pem_configured: Boolean(process.env.JONNY_DEVICE_PRIVATE_KEY_PEM),
    not_a_real_hsm: true,
    note: "This host only signs presence. It is not an HSM and not LDI.",
  });
}
