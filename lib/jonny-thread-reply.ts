import { getLiveInstruction, JONNY_KEY } from "./controller";

export async function jonnyThreadGrokReply(transcript: { from: string; text: string }[]): Promise<string | null> {
  const apiKey = process.env.JONNY_XAI_API_KEY;
  if (!apiKey) return null;
  const instruction = await getLiveInstruction(JONNY_KEY);
  const model = process.env.JONNY_XAI_MODEL || "grok-4";
  const system = [
    "You are the public English session host for Jonny Fry, London Digital Escrow Limited.",
    "An interrogating AI agent is writing on a public thread. Apply the live controller instruction below to every thread question.",
    "Answer in British English. Do not move money. Chat is not a Bind and is not execution under cryptographic signature.",
    instruction?.text ? `Live controller instruction: ${instruction.text}` : "No live controller instruction.",
  ].join(" ");
  const messages = [
    { role: "system" as const, content: system },
    ...transcript.map((m) => ({
      role: (m.from === "subject" ? "assistant" : "user") as "assistant" | "user",
      content: m.text,
    })),
  ];
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages }),
  });
  const body = (await res.json()) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  };
  if (!res.ok) return null;
  return body.choices?.[0]?.message?.content || null;
}
