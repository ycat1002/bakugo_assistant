export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { action, payload } = req.body;
  const token = process.env.NOTION_TOKEN;
  const dbId  = process.env.NOTION_DB_ID;

  if (!token) return res.status(500).json({ error: "NOTION_TOKEN not set" });

  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
  };

  try {
    // 노션 DB에서 과업 전체 조회
    if (action === "get_tasks") {
      const r = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          sorts: [{ property: "날짜", direction: "ascending" }],
          page_size: 50,
        }),
      });
      const data = await r.json();
      return res.status(200).json(data);
    }

    // 과업 등록
    if (action === "add_task") {
      const r = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers,
        body: JSON.stringify({
          parent: { database_id: dbId },
          properties: {
            작업명: { title: [{ text: { content: payload.task } }] },
            분야:   { select: { name: payload.category } },
            ...(payload.date ? { 날짜: { date: { start: payload.date } } } : {}),
            완료:   { checkbox: false },
          },
        }),
      });
      const data = await r.json();
      return res.status(200).json(data);
    }

    // 검색
    if (action === "search") {
      const r = await fetch("https://api.notion.com/v1/search", {
        method: "POST",
        headers,
        body: JSON.stringify({ query: payload.query, page_size: 5 }),
      });
      const data = await r.json();
      return res.status(200).json(data);
    }

    // 완료 처리
    if (action === "complete") {
      const r = await fetch(`https://api.notion.com/v1/pages/${payload.pageId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ properties: { 완료: { checkbox: true } } }),
      });
      const data = await r.json();
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: "unknown action" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
