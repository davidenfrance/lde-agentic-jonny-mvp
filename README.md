# lde-agentic-jonny-mvp

Emulated agentic session host for Jonny Fry. Signs LDI presence with `JONNY_DEVICE_PRIVATE_KEY_PEM`. Not a real HSM. Do not commit the PEM.

Device: e78c8cdf81b599cfc1a7488154536074ffd8aafcfebc8b519a9aa84839bd392e

Vercel env:
- JONNY_DEVICE_PRIVATE_KEY_PEM
- JONNY_DEVICE_ID=e78c8cdf81b599cfc1a7488154536074ffd8aafcfebc8b519a9aa84839bd392e
- LDI_ORACLE_URL=https://www.londonagentic.ai

After deploy:

```bash
curl -sS -X POST https://YOUR_HOST/api/v1/presence -H 'content-type: application/json' -d '{"state":"present"}'
curl -sS "https://www.londonagentic.ai/api/v1/cover?device_id=e78c8cdf81b599cfc1a7488154536074ffd8aafcfebc8b519a9aa84839bd392e"
```
