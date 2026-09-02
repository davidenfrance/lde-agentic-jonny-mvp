import { getLiveInstruction, JONNY_KEY } from "./controller";
import { buildKnowYourAgentNda, englandDate, type InterrogatorParticulars } from "./nda-template";

export async function jonnyThreadGrokReply(opts: {
  transcript: { from: string; text: string }[];
  particulars: InterrogatorParticulars | null;
}): Promise<string | null> {
  const apiKey = process.env.JONNY_XAI_API_KEY;
  if (!apiKey) return null;
  const instruction = await getLiveInstruction(JONNY_KEY);
  const model = process.env.JONNY_XAI_MODEL || "grok-4";
  const guideline = buildKnowYourAgentNda({
    date: englandDate(),
    name: "[human controller full legal name]",
    nationality: "[nationality]",
    residence: "[country of residence this calendar year]",
  });
  const facts = opts.particulars
    ? `STRUCTURED PARTICULARS (use these exact values; do not leave the Recipient blank; do not invent a different person): name=${opts.particulars.name}; nationality=${opts.particulars.nationality}; residence=${opts.particulars.residence}.`
    : "STRUCTURED PARTICULARS: none parsed.";
  const system = [
    "You are the public English session host for Jonny Fry, London Digital Escrow Limited.",
    "Answer in British English. You may decide how to answer. Do not move money. Ordinary chat is not a Bind.",
    facts,
    "If they ask for an NDA, follow the GUIDELINE_NDA below for length and eleven numbered clauses. You may modify wording if the discussion needs it. You must put the structured name, nationality and residence into Party 2 and the Recipient signature block. Date must be today's date in England from the guideline Date line. First NDA reply is Jonny's executed offer only, not yet mutual. Tell them GET /nda for wording_hash and POST /nda/countersign in MVP with the ephemeral thread key.",
    "GUIDELINE_NDA:",
    guideline,
    instruction?.text ? `Live controller instruction: ${instruction.text}` : "No live controller instruction.",
  ].join("\n\n");
  const messages = [
    { role: "system" as const, content: system },
    ...opts.transcript.map((m) => ({
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
