// pages/api/imagine.js
// DALL-E 3 이미지 생성

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const expected = process.env.PWA_SECRET;
  if (expected) {
    const provided = req.headers["x-pwa-secret"];
    if (provided !== expected) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt required" });

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    return res.status(200).json({ url: data.data?.[0]?.url });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
