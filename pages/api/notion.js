export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { action, payload } = req.body;
  const token        = process.env.NOTION_TOKEN;
  const dbId         = process.env.NOTION_DB_ID;
  const thoughtDbId  = process.env.NOTION_THOUGHT_DB_ID;
  const researchDbId = process.env.NOTION_RESEARCH_DB_ID;

  if (!token) return res.status(500).json({ error: "NOTION_TOKEN not set" });

  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
  };

  const today = new Date().toISOString().split("T")[0];

  try {

    // ── 과업 전체 조회 ──
    if (action === "get_tasks") {
      const r = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: "POST", headers,
        body: JSON.stringify({ sorts:[{ property:"날짜", direction:"ascending" }], page_size:50 }),
      });
      return res.status(200).json(await r.json());
    }

    // ── 과업 등록 ──
    if (action === "add_task") {
      const r = await fetch("https://api.notion.com/v1/pages", {
        method: "POST", headers,
        body: JSON.stringify({
          parent: { database_id: dbId },
          properties: {
            작업명: { title: [{ text: { content: payload.task } }] },
            분야:   { select: { name: payload.category || "기타" } },
            완료:   { checkbox: false },
            ...(payload.date ? { 날짜: { date: { start: payload.date } } } : {}),
          },
        }),
      });
      return res.status(200).json(await r.json());
    }

    // ── 완료 처리 ──
    if (action === "complete") {
      if (!payload?.pageId) return res.status(400).json({ error: "pageId required" });
      const r = await fetch(`https://api.notion.com/v1/pages/${payload.pageId}`, {
        method: "PATCH", headers,
        body: JSON.stringify({ properties: { 완료: { checkbox: true } } }),
      });
      return res.status(200).json(await r.json());
    }

    // ── 사이드 생각 저장 ──
    if (action === "save_thought") {
      if (!thoughtDbId) return res.status(200).json({ ok: true, skipped: true });
      const r = await fetch("https://api.notion.com/v1/pages", {
        method: "POST", headers,
        body: JSON.stringify({
          parent: { database_id: thoughtDbId },
          icon: { emoji: "💭" },
          properties: {
            생각: { title: [{ text: { content: payload.thought || "" } }] },
            날짜: { date: { start: today } },  // ✅ 올바른 REST API 형식
            맥락: { rich_text: [{ text: { content: payload.context || "" } }] },
            상태: { select: { name: "보류" } },
          },
        }),
      });
      return res.status(200).json(await r.json());
    }

    // ── 리서치 결과 저장 ──
    if (action === "save_research") {
      if (!researchDbId) return res.status(200).json({ ok: true, skipped: true });
      const p = payload;
      const r = await fetch("https://api.notion.com/v1/pages", {
        method: "POST", headers,
        body: JSON.stringify({
          parent: { database_id: researchDbId },
          icon: { emoji: "🤖" },
          properties: {
            주제:       { title: [{ text: { content: p.taskTitle || (p.task||"").slice(0,40) || "리서치" } }] },
            날짜:       { date: { start: today } },  // ✅ 올바른 REST API 형식
            분야:       { select: { name: p.domain || "기타" } },
            태스크유형: { select: { name: p.type || "general" } },
            AI리더:     { select: { name: p.leader || "Claude" } },
            요약:       { rich_text: [{ text: { content: (p.final||"").slice(0, 300) } }] },
          },
          children: [
            { object:"block", type:"callout", callout:{ icon:{emoji:"🎯"}, color:"purple_background", rich_text:[{type:"text",text:{content:"최종 결론"},annotations:{bold:true}}] } },
            { object:"block", type:"paragraph", paragraph:{ rich_text:[{type:"text",text:{content:p.final||""}}] } },
            { object:"block", type:"divider", divider:{} },
            { object:"block", type:"toggle", toggle:{ rich_text:[{type:"text",text:{content:"📝 AI 초안 3종"},annotations:{bold:true}}], children:[
              { object:"block", type:"heading_3", heading_3:{rich_text:[{type:"text",text:{content:"Claude"}}]} },
              { object:"block", type:"paragraph", paragraph:{rich_text:[{type:"text",text:{content:(p.drafts||{}).claude||""}}]} },
              { object:"block", type:"heading_3", heading_3:{rich_text:[{type:"text",text:{content:"Gemini"}}]} },
              { object:"block", type:"paragraph", paragraph:{rich_text:[{type:"text",text:{content:(p.drafts||{}).gemini||""}}]} },
              { object:"block", type:"heading_3", heading_3:{rich_text:[{type:"text",text:{content:"GPT"}}]} },
              { object:"block", type:"paragraph", paragraph:{rich_text:[{type:"text",text:{content:(p.drafts||{}).gpt||""}}]} },
            ]}},
            { object:"block", type:"toggle", toggle:{ rich_text:[{type:"text",text:{content:"⚔️ 크리틱 로그"},annotations:{bold:true}}], children:[
              { object:"block", type:"heading_3", heading_3:{rich_text:[{type:"text",text:{content:"Claude (논리)"}}]} },
              { object:"block", type:"paragraph", paragraph:{rich_text:[{type:"text",text:{content:(p.critics||{}).claude||""}}]} },
              { object:"block", type:"heading_3", heading_3:{rich_text:[{type:"text",text:{content:"Gemini (팩트)"}}]} },
              { object:"block", type:"paragraph", paragraph:{rich_text:[{type:"text",text:{content:(p.critics||{}).gemini||""}}]} },
              { object:"block", type:"heading_3", heading_3:{rich_text:[{type:"text",text:{content:"GPT (독자)"}}]} },
              { object:"block", type:"paragraph", paragraph:{rich_text:[{type:"text",text:{content:(p.critics||{}).gpt||""}}]} },
            ]}},
          ],
        }),
      });
      const data = await r.json();
      return res.status(200).json({ url: data.url || null });
    }

    return res.status(400).json({ error: "unknown action" });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
