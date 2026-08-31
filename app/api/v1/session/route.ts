import { NextResponse } from "next/server";
import { deviceId } from "@/lib/sign";

export async function GET() {
  const id = deviceId();
  return NextResponse.json({
    session: `https://agentic.londondigitalescrow.com/session/${id}`,
    device_id: id,
    person: "Jonny Fry",
    firm: "London Digital Escrow Limited",
    not_a_real_hsm: true,
  });
}
