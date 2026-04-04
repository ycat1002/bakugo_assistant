// pages/api/chat.js
// Claude Vision 지원 (이미지 base64 처리)

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { messages, system, model, max_tokens, image } = req.body;

  // 마지막 유저 메시지에 이미지 첨부
  const processedMessages = messages.map((m, i) => {
    if (i === messages.length - 1 && m.role === "user" && image) {
      return {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: image.mediaType || "image/jpeg",
              data: image.data,
            },
          },
          { type: "text", text: m.content || m.text || "" },
        ],
      };
    }
    return {
      role: m.role,
      content: m.content || m.text || "",
    };
  });

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
        max_tokens: max_tokens || 600,
        system,
        tools: [{
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 2,
        }],
        messages: processedMessages,
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    // thinking/tool_use 블록 제거, text만 반환
    const filtered = {
      ...data,
      content: (data.content || []).filter(b => b.type === "text"),
    };

    return res.status(200).json(filtered);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
