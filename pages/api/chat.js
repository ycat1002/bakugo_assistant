// ── D1 대화 저장 ──
async function d1save(role, text) {
  const { CF_ACCOUNT_ID, CF_D1_DATABASE_ID, CF_API_TOKEN } = process.env;
  if (!CF_ACCOUNT_ID || !CF_D1_DATABASE_ID || !CF_API_TOKEN) return;
  try {
    const id = crypto.randomUUID().replace(/-/g, "");
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_D1_DATABASE_ID}/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${CF_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sql: "INSERT INTO chat_history (id, role, text) VALUES (?, ?, ?)", params: [id, role, (text || "").slice(0, 5000)] }),
      }
    );
  } catch {}
}

// ── Claude API 호출 (과부하 시 재시도) ──
async function callClaude(payload) {
  for (let i = 0; i < 4; i++) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...payload, model: "claude-sonnet-4-20250514" }),
    });
    const data = await response.json();
    if (!data.error) return data;
    if (data.error.type === "overloaded_error" || response.status === 529 || response.status === 429) {
      if (i < 3) await new Promise(r => setTimeout(r, 800));
      continue;
    }
    return data;
  }
  return { error: { message: "overloaded" } };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const expected = process.env.PWA_SECRET;
  if (expected) {
    const provided = req.headers["x-pwa-secret"];
    if (provided !== expected) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  const { messages, system } = req.body;

  // 유저 메시지 D1 저장
  const lastUserMsg = messages?.[messages.length - 1];
  if (lastUserMsg?.role === "user") {
    d1save("user", lastUserMsg.text || lastUserMsg.content || "");
  }

  try {
    const data = await callClaude({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      system: (system || "").slice(0, 5000),
      messages: messages.map(m => ({ role: m.role, content: m.content || m.text || "" })),
    });

    if (data.error) {
      console.error("[chat]", data.error.message);
      return res.status(200).json({ content: [{ type:"text", text:"\u300c\u306f\u3041\uff1f\u3082\u3046\u4e00\u56de\u3084\u308c\u3002\u300d\n(\ud558? \ub2e4\uc2dc \ud574.)" }] });
    }

    // AI 응답 D1 저장
    const aiText = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
    if (aiText) d1save("assistant", aiText);

    return res.status(200).json({ ...data, content: (data.content||[]).filter(b=>b.type==="text") });
  } catch (e) {
    console.error("[chat exception]", e.message);
    return res.status(500).json({ error: e.message });
  }
}
