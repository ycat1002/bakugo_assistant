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

  // 텍스트 → Notion 블록 변환 (줄바꿈 처리)
  const textToBlocks = (text) => {
    if (!text) return [];
    return text.split("\n").filter(l => l.trim()).map(line => ({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: [{ type: "text", text: { content: line } }] },
    }));
  };

  try {

    // ── 1. 과업 전체 조회 ──
    if (action === "get_tasks") {
      const r = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: "POST", headers,
        body: JSON.stringify({
          sorts: [{ property: "날짜", direction: "ascending" }],
          page_size: 50,
        }),
      });
      return res.status(200).json(await r.json());
    }

    // ── 2. 분야 옵션 조회 ──
    if (action === "get_categories") {
      const r = await fetch(`https://api.notion.com/v1/databases/${dbId}`, { headers });
      const data = await r.json();
      const options = data?.properties?.분야?.select?.options?.map(o => o.name) || [];
      return res.status(200).json({ options });
    }

    // ── 3. 과업 등록 ──
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

    // ── 4. 완료 처리 ──
    if (action === "complete") {
      if (!payload?.pageId) return res.status(400).json({ error: "pageId required" });
      const r = await fetch(`https://api.notion.com/v1/pages/${payload.pageId}`, {
        method: "PATCH", headers,
        body: JSON.stringify({ properties: { "\uc644\ub8cc": { checkbox: true } } }),
      });
      const data = await r.json();
      // 노션 응답 로깅 (Vercel 로그에서 확인 가능)
      console.log("[complete] pageId:", payload.pageId, "| httpStatus:", r.status, "| notionError:", data.message || "none");
      if (r.status !== 200) {
        return res.status(200).json({ ok: false, httpStatus: r.status, error: data.message, code: data.code });
      }
      return res.status(200).json({ ok: true, id: data.id });
    }

    // ── 5. 노션 검색 ──
    if (action === "search_notion") {
      const r = await fetch("https://api.notion.com/v1/search", {
        method: "POST", headers,
        body: JSON.stringify({
          query: payload.query,
          page_size: 5,
          filter: payload.type ? { property: "object", value: payload.type } : undefined,
        }),
      });
      const data = await r.json();
      // 결과 요약 (ID + 제목만)
      const results = (data.results || []).map(p => ({
        id: p.id,
        title: p.properties?.title?.title?.[0]?.plain_text
          || p.properties?.작업명?.title?.[0]?.plain_text
          || p.properties?.생각?.title?.[0]?.plain_text
          || p.title?.[0]?.plain_text
          || "제목없음",
        type: p.object,
        url: p.url,
      }));
      return res.status(200).json({ results });
    }

    // ── 6. 페이지 내용 읽기 ──
    if (action === "read_page") {
      if (!payload?.pageId) return res.status(400).json({ error: "pageId required" });
      // 블록 가져오기
      const r = await fetch(`https://api.notion.com/v1/blocks/${payload.pageId}/children?page_size=50`, { headers });
      const data = await r.json();
      // 텍스트만 추출
      const text = (data.results || []).map(block => {
        const type = block.type;
        const content = block[type]?.rich_text?.map(t => t.plain_text)?.join("") || "";
        if (!content) return null;
        const prefix = {
          heading_1: "# ", heading_2: "## ", heading_3: "### ",
          bulleted_list_item: "• ", numbered_list_item: "1. ",
          to_do: block[type]?.checked ? "✅ " : "⬜ ",
        }[type] || "";
        return prefix + content;
      }).filter(Boolean).join("\n");
      return res.status(200).json({ text: text || "(내용 없음)", blockCount: data.results?.length || 0 });
    }

    // ── 7. 페이지에 내용 추가 ──
    if (action === "append_to_page") {
      if (!payload?.pageId || !payload?.content) return res.status(400).json({ error: "pageId and content required" });
      const blocks = textToBlocks(payload.content);
      if (blocks.length === 0) return res.status(400).json({ error: "content is empty" });
      const r = await fetch(`https://api.notion.com/v1/blocks/${payload.pageId}/children`, {
        method: "PATCH", headers,
        body: JSON.stringify({ children: blocks }),
      });
      return res.status(200).json(await r.json());
    }

    // ── 8. 새 페이지 만들기 ──
    if (action === "create_page") {
      const parentPageId = payload?.parentPageId || process.env.NOTION_PARENT_PAGE_ID || "3366218c4184810fb925e2659629e9f0";
      const r = await fetch("https://api.notion.com/v1/pages", {
        method: "POST", headers,
        body: JSON.stringify({
          parent: { page_id: parentPageId },
          icon: payload.icon ? { emoji: payload.icon } : undefined,
          properties: {
            title: [{ text: { content: payload.title || "새 페이지" } }],
          },
          children: textToBlocks(payload.content || ""),
        }),
      });
      const data = await r.json();
      return res.status(200).json({ url: data.url, id: data.id });
    }

    // ── 9. 페이지 속성 수정 ──
    if (action === "update_page") {
      if (!payload?.pageId) return res.status(400).json({ error: "pageId required" });
      const r = await fetch(`https://api.notion.com/v1/pages/${payload.pageId}`, {
        method: "PATCH", headers,
        body: JSON.stringify({
          properties: payload.properties || {},
          ...(payload.archived !== undefined ? { archived: payload.archived } : {}),
        }),
      });
      return res.status(200).json(await r.json());
    }

    // ── 10. 사이드 생각 저장 ──
    if (action === "save_thought") {
      if (!thoughtDbId) return res.status(200).json({ ok: true, skipped: true });
      const r = await fetch("https://api.notion.com/v1/pages", {
        method: "POST", headers,
        body: JSON.stringify({
          parent: { database_id: thoughtDbId },
          icon: { emoji: "💭" },
          properties: {
            생각: { title: [{ text: { content: payload.thought || "" } }] },
            날짜: { date: { start: today } },
            맥락: { rich_text: [{ text: { content: payload.context || "" } }] },
            상태: { select: { name: "보류" } },
          },
        }),
      });
      return res.status(200).json(await r.json());
    }

    // ── 11. 리서치 결과 저장 ──
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
            날짜:       { date: { start: today } },
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

    // ── 페이지 아카이브 (삭제 = 휴지통으로 이동) ──
    if (action === "archive_page") {
      if (!payload?.pageId) return res.status(400).json({ error: "pageId required" });
      const r = await fetch(`https://api.notion.com/v1/pages/${payload.pageId}`, {
        method: "PATCH", headers,
        body: JSON.stringify({ archived: true }),
      });
      const data = await r.json();
      console.log("[archive] pageId:", payload.pageId, "| status:", r.status, "| error:", data.message||"none");
      return res.status(200).json({ ok: r.status === 200, error: data.message });
    }

    // ── 루틴 페이지 수정 ──
    if (action === "update_routine") {
      const routinePageId = process.env.NOTION_ROUTINE_PAGE_ID;
      if (!routinePageId) return res.status(400).json({ error: "NOTION_ROUTINE_PAGE_ID not set" });
      if (!payload?.content) return res.status(400).json({ error: "content required" });

      // 기존 내용 읽기
      const getR = await fetch(`https://api.notion.com/v1/blocks/${routinePageId}/children?page_size=100`, { headers });
      const getData = await getR.json();

      // 기존 블록 전부 삭제 후 새 내용 추가
      for (const block of (getData.results || [])) {
        await fetch(`https://api.notion.com/v1/blocks/${block.id}`, { method: "DELETE", headers });
      }

      // 새 내용 추가
      const lines = payload.content.split("\n").filter(l => l.trim());
      const children = lines.map(line => ({
        object: "block",
        type: line.startsWith("# ") ? "heading_1" : line.startsWith("## ") ? "heading_2" : line.startsWith("- ") ? "bulleted_list_item" : "paragraph",
        ...(line.startsWith("# ") ? { heading_1: { rich_text: [{ type: "text", text: { content: line.slice(2) } }] } }
          : line.startsWith("## ") ? { heading_2: { rich_text: [{ type: "text", text: { content: line.slice(3) } }] } }
          : line.startsWith("- ") ? { bulleted_list_item: { rich_text: [{ type: "text", text: { content: line.slice(2) } }] } }
          : { paragraph: { rich_text: [{ type: "text", text: { content: line } }] } }),
      }));

      const r = await fetch(`https://api.notion.com/v1/blocks/${routinePageId}/children`, {
        method: "PATCH", headers,
        body: JSON.stringify({ children }),
      });
      return res.status(200).json({ ok: r.status === 200 });
    }

    // ── 루틴 페이지 읽기 ──
    if (action === "get_routine") {
      const routinePageId = process.env.NOTION_ROUTINE_PAGE_ID;
      if (!routinePageId) return res.status(200).json({ text: "" });
      const r = await fetch(`https://api.notion.com/v1/blocks/${routinePageId}/children?page_size=50`, { headers });
      const data = await r.json();
      const text = (data.results || []).map(block => {
        const type = block.type;
        const content = block[type]?.rich_text?.map(t => t.plain_text)?.join("") || "";
        if (!content) return null;
        const prefix = {heading_1:"# ",heading_2:"## ",heading_3:"### ",bulleted_list_item:"- ",numbered_list_item:"1. "}[type] || "";
        return prefix + content;
      }).filter(Boolean).join("\n");
      return res.status(200).json({ text });
    }

    return res.status(400).json({ error: "unknown action" });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
