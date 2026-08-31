export type RosterEntry = {
  key_id: string;
  person: string;
  firm: string;
  pem_env: string;
};

export const ROSTER: RosterEntry[] = [
  {
    key_id: "e78c8cdf81b599cfc1a7488154536074ffd8aafcfebc8b519a9aa84839bd392e",
    person: "Jonny Fry",
    firm: "London Digital Escrow Limited",
    pem_env: "JONNY_DEVICE_PRIVATE_KEY_PEM",
  },
  {
    key_id: "e7e0e482404b6939b82c7f2524a4af85dc60d4131484a8cfc669314965ad26c9",
    person: "David Parsons",
    firm: "London Digital Escrow Limited",
    pem_env: "DAVID_DEVICE_PRIVATE_KEY_PEM",
  },
  {
    key_id: "e7f341e20631f8b609b6b9aeac56deb81ebd3de5a51e210d82650ae14202dcbe",
    person: "Velia Longo",
    firm: "London Digital Escrow Limited",
    pem_env: "VELIA_DEVICE_PRIVATE_KEY_PEM",
  },
];

export function findRoster(key_id: string): RosterEntry | undefined {
  const id = key_id.trim().toLowerCase().replace(/^0x/, "");
  return ROSTER.find((r) => r.key_id === id);
}
