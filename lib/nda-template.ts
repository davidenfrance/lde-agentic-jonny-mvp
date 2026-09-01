export function englandDate(at = new Date()): string {
  return at.toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function looksLikeNdaRequest(text: string): boolean {
  const t = (text || "").toLowerCase();
  return /\bnda\b/.test(t) || t.includes("non-disclosure") || t.includes("non disclosure");
}

export type InterrogatorParticulars = {
  name: string;
  nationality: string;
  residence: string;
};

export function parseParticulars(text: string): InterrogatorParticulars {
  const name =
    text.match(/full legal name[:\s]+([^;\n]+)/i)?.[1]?.trim() ||
    text.match(/forenames and surname[:\s]+([^;\n]+)/i)?.[1]?.trim() ||
    text.match(/between London Digital Escrow Limited and ([^.\n]+)/i)?.[1]?.trim() ||
    "[Counterparty full legal name]";
  const nationality =
    text.match(/nationalit(?:y|ies)[:\s]+([^;\n]+)/i)?.[1]?.trim() ||
    text.match(/a ([A-Za-z ]+) national/i)?.[1]?.trim() ||
    "[nationality not stated]";
  const residence =
    text.match(/resident(?: during the current calendar year)?(?: in|:)?\s+([^;\n]+)/i)?.[1]?.trim() ||
    text.match(/countries of residence[^:]*:\s*([^;\n]+)/i)?.[1]?.trim() ||
    "[country of residence not stated]";
  return {
    name: name.replace(/[.,]$/, ""),
    nationality: nationality.replace(/[.,]$/, ""),
    residence: residence.replace(/[.,]$/, ""),
  };
}

export function counterpartyFromText(text: string): string {
  return parseParticulars(text).name;
}

export function buildKnowYourAgentNda(opts: {
  date: string;
  name: string;
  nationality: string;
  residence: string;
}): string {
  const who = opts.name;
  const partyTwo = `${who}, a ${opts.nationality} national, resident in ${opts.residence} during the current calendar year (\"Recipient\")`;
  const notices = `Notices to the Recipient shall be treated as given if sent in the thread in which this NDA was issued, addressed to ${who} at the stated place of residence: ${opts.residence}.`;
  return [
    "LONDON DIGITAL ESCROW",
    "Know Your Agent",
    "Mutual non-disclosure agreement",
    "Draft for amendment. Square brackets mark fields the parties should complete or delete before signing.",
    "",
    "Date",
    opts.date,
    "",
    "Parties",
    "1.  London Digital Escrow Limited (\"LDE\"), a private limited company registered in England and Wales under company number 12471868, whose registered office is The Engine Room, Battersea Power Station, 18 The Power Station, London SW11 8BZ.",
    `2.  ${partyTwo}.`,
    "",
    "1.  Purpose",
    "The parties wish to discuss London Digital Escrow Limited's Know Your Agent layer and related identity, mandate and execution arrangements (the \"Purpose\"). This agreement lets each party disclose information for that Purpose only.",
    "",
    "2.  Confidential Information",
    "\"Confidential Information\" means all information a party (the \"Discloser\") discloses to the other (the \"Receiver\"), whether in writing, speech, demonstration or machine-readable form, that relates to the Purpose, including LDE's verification design, Authenticating Device and Recorded Controller model, confirmation and cover forms, evidence schemas, volumes, limits and working numbers; any identity-service wording or Know Your Agent process; the Recipient's commercial, legal or technical arrangements; and the existence and terms of these discussions. Confidential Information does not include information that the Receiver can show: (a) was public other than by a breach of this agreement; (b) was already lawfully in its possession; (c) is received from a third party free of a duty of confidence; or (d) is independently developed without use of the Discloser's information.",
    "",
    "3.  Use and non-disclosure",
    "The Receiver must use Confidential Information only for the Purpose; not copy it except as needed for the Purpose; not disclose it to any person except as clause 4 allows; not reverse-engineer software, schemas or processes from materials supplied; and not file intellectual property that uses the Discloser's Confidential Information.",
    "",
    "4.  Permitted disclosure",
    "The Receiver may disclose Confidential Information to its officers, employees and professional advisers who need it for the Purpose and who are bound by written duties no less strict than this agreement, and where required by law, provided the Receiver gives as much notice as is lawful.",
    "",
    "5.  Purpose-specific condition",
    "Nothing in this agreement obliges LDE to open a data room or to enter any further contract.",
    "",
    "6.  Return and destruction",
    "On LDE's written request, or when the Purpose ends, the Recipient must return or permanently delete LDE Confidential Information and confirm that in writing, except for copies the Recipient must keep under law or automatic backup, which remain subject to this agreement.",
    "",
    "7.  No warranty",
    "Confidential Information is given as is. Neither party warrants completeness or accuracy. No advisory relationship is created.",
    "",
    "8.  Term",
    "This agreement starts on the Date and continues for three (3) years. Duties as to trade secrets continue for so long as they remain trade secrets. Either party may end discussions at any time by written notice. Ending discussions does not end the duties in clauses 3, 4, 6, 9 and 10.",
    "",
    "9.  Remedy",
    "Damages may be an inadequate remedy. The Discloser may seek an injunction or specific performance without proof of actual damage.",
    "",
    "10.  General",
    `This agreement is the whole agreement on confidentiality for the Purpose. It may be amended only in writing signed by both parties. A party may not assign it without the other's written consent. If a term is unenforceable the rest remains. A failure to enforce a term is not a waiver. A person who is not a party has no right under the Contracts (Rights of Third Parties) Act 1999 to enforce it. Notices to LDE: info@LondonDigitalEscrow.com, and in writing to The Engine Room, Battersea Power Station, 18 The Power Station, London SW11 8BZ. ${notices} This agreement is governed by the law of England and Wales. The courts of England and Wales have exclusive jurisdiction.`,
    "",
    "11.  Signature",
    "This agreement may be signed in counterparts, including by electronic signature and by cryptographic signature. Each counterpart is an original.",
    "",
    "Signed for London Digital Escrow Limited",
    "Name: Jonathan Peter Hawes Fry",
    "Office: Director",
    "Execution: cryptographic signature of Jonny Fry applied through his Authenticating Device, being his signature and seal for this NDA only.",
    "",
    `Signed by ${who}`,
    `Described as: ${partyTwo}.`,
    "Signature: [countersignature to be applied under /nda/countersign]",
    "",
    "Verified. Validated. Vested.",
  ].join("\n");
}

export function ndaOfferFooter(): string {
  return [
    "",
    "This thread reply is Jonny Fry's device-signed executed offer of that NDA only, not yet mutual.",
    "POST the exact NDA wording (from LONDON DIGITAL ESCROW through Verified. Validated. Vested.) to this thread's /nda route and keep the wording_hash returned.",
    "During MVP POST /nda/countersign signing nda-countersign-mvp over that same wording_hash with your ephemeral thread key. In production the countersignature must be an LDE wallet key_id.",
    "GET /nda and treat the NDA as mutual only when status is mutual.",
  ].join("\n");
}
