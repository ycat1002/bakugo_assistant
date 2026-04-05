export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { messages, system } = req.body;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 800,
        system: (system || "").slice(0, 5000),
        messages: messages.map(m => ({ role: m.role, content: m.content || m.text || "" })),
      }),
    });

    const data = await response.json();
    if (data.error) {
      console.error("[chat]", data.error.message);
      return res.status(200).json({ content: [{ type:"text", text:"\u300c\u306f\u3041\uff1f\u3082\u3046\u4e00\u56de\u3084\u308c\u3002\u300d\n(\ud558? \ub2e4\uc2dc \ud574.)" }] });
    }
    return res.status(200).json({ ...data, content: (data.content||[]).filter(b=>b.type==="text") });
  } catch (e) {
    console.error("[chat exception]", e.message);
    return res.status(500).json({ error: e.message });
  }
}
