export default function Home() {
  return (
    <main style={{ fontFamily: "Arial, sans-serif", maxWidth: 720, margin: "40px auto", color: "#174873" }}>
      <h1>Jonny Fry agentic MVP</h1>
      <p>Emulated session host. Signs LDI presence from Vercel env PEM. Not a real HSM.</p>
      <ul>
        <li>GET /api/v1/health</li>
        <li>GET /api/v1/session</li>
        <li>POST /api/v1/presence</li>
      </ul>
      <p>Verified. Validated. Vested.</p>
    </main>
  );
}
