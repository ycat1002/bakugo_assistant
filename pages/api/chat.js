export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { messages, system, model, max_tokens, image } = req.body;

  // 마지막 유저 메시지에 이미지 첨부
  const processedMessages = messages.map((m, i) => {
    if (i === messages.length - 1 && m.role === "user" && image) {
      return {
        role: "user",
        content: [
          { type:"image", source:{ type:"base64", media_type:image.mediaType||"image/jpeg", data:image.data } },
          { type:"text", text: m.content || m.text || "" },
        ],
      };
    }
    return { role: m.role, content: m.content || m.text || "" };
  });

  // 시스템 프롬프트 토큰 제한 — 너무 길면 Claude가 500 냄
  const systemText = typeof system === "string"
    ? system.slice(0, 6000)
    : system;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-4-20250514",
        max_tokens: max_tokens || 800,
        system: systemText,
        // web_search 제거 — 시스템 프롬프트 길면 툴 충돌로 500 유발
        messages: processedMessages,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error("[chat] Claude error:", data.error.message, "type:", data.error.type);
      return res.status(200).json({ error: data.error.message, content: [{ type:"text", text:"「はぁ？もう一回やれ。」\n(하? 다시 해.)" }] });
    }

    // text 블록만 반환
    const filtered = {
      ...data,
      content: (data.content || []).filter(b => b.type === "text"),
    };

    return res.status(200).json(filtered);
  } catch (e) {
    console.error("[chat] exception:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
