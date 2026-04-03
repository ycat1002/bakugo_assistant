// pages/api/orchestrate.js
// Triple AI Orchestrator: Claude × Gemini × GPT
// Phase 1: 병렬 초안 생성
// Phase 2: 병렬 크리틱
// Phase 3: Claude 종합 → 최종

const CLAUDE_KEY  = process.env.ANTHROPIC_API_KEY;
const GEMINI_KEY  = process.env.GEMINI_API_KEY;
const OPENAI_KEY  = process.env.OPENAI_API_KEY;
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_PARENT = process.env.NOTION_RESEARCH_PAGE_ID; // AI 결과물 저장 부모 페이지

// ── 태스크 유형 감지 ──
const detectTaskType = (text) => {
  if (/리서치|조사|트렌드|최신|검색|사례|레퍼런스/.test(text)) return "research";
  if (/전략|기획|계획|방향|구조|설계|프레임/.test(text)) return "strategy";
  if (/카피|콘텐츠|문장|글|스크립트|캡션|제목/.test(text)) return "content";
  return "general";
};

// 유형별 리더 AI
const getLeader = (type) => {
  if (type === "research") return "gemini";
  if (type === "content")  return "gpt";
  return "claude"; // strategy, general
};

// ── Claude 호출 ──
const callClaude = async (system, prompt) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": CLAUDE_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "오류";
};

// ── Gemini 호출 ──
const callGemini = async (prompt) => {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 800 },
      }),
    }
  );
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "오류";
};

// ── GPT 호출 ──
const callGPT = async (system, prompt) => {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 800,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "오류";
};

// ── 노션 페이지 저장 (토글 구조) ──
const saveToNotion = async (title, taskType, drafts, critics, final) => {
  if (!NOTION_TOKEN || !NOTION_PARENT) return null;

  const today = new Date().toISOString().split("T")[0];
  const pageTitle = `[${today}] ${title}`;

  const content = `
## 🎯 최종 결론

${final}

---

<details>
<summary>📝 AI 초안 3종 (펼치기)</summary>

### Claude 초안
${drafts.claude}

### Gemini 초안
${drafts.gemini}

### GPT 초안
${drafts.gpt}

</details>

<details>
<summary>⚔️ 크리틱 로그 (펼치기)</summary>

### Claude의 비판 (논리 파괴자)
${critics.claude}

### Gemini의 비판 (팩트 파괴자)
${critics.gemini}

### GPT의 비판 (독자 파괴자)
${critics.gpt}

</details>

---

> 태스크 유형: ${taskType} | 생성: ${new Date().toLocaleString("ko-KR")}
`.trim();

  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${NOTION_TOKEN}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({
      parent: { page_id: NOTION_PARENT },
      icon: { emoji: "🤖" },
      properties: {
        title: { title: [{ text: { content: pageTitle } }] },
      },
      children: [
        {
          object: "block", type: "callout",
          callout: {
            icon: { emoji: "🎯" },
            color: "purple_background",
            rich_text: [{ type: "text", text: { content: "최종 결론" }, annotations: { bold: true } }],
          },
        },
        {
          object: "block", type: "paragraph",
          paragraph: { rich_text: [{ type: "text", text: { content: final } }] },
        },
        { object: "block", type: "divider", divider: {} },
        {
          object: "block", type: "toggle",
          toggle: {
            rich_text: [{ type: "text", text: { content: "📝 AI 초안 3종" }, annotations: { bold: true } }],
            children: [
              { object: "block", type: "heading_3", heading_3: { rich_text: [{ type: "text", text: { content: "Claude 초안" } }] } },
              { object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: drafts.claude } }] } },
              { object: "block", type: "heading_3", heading_3: { rich_text: [{ type: "text", text: { content: "Gemini 초안" } }] } },
              { object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: drafts.gemini } }] } },
              { object: "block", type: "heading_3", heading_3: { rich_text: [{ type: "text", text: { content: "GPT 초안" } }] } },
              { object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: drafts.gpt } }] } },
            ],
          },
        },
        {
          object: "block", type: "toggle",
          toggle: {
            rich_text: [{ type: "text", text: { content: "⚔️ 크리틱 로그" }, annotations: { bold: true } }],
            children: [
              { object: "block", type: "heading_3", heading_3: { rich_text: [{ type: "text", text: { content: "Claude (논리 파괴자)" } }] } },
              { object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: critics.claude } }] } },
              { object: "block", type: "heading_3", heading_3: { rich_text: [{ type: "text", text: { content: "Gemini (팩트 파괴자)" } }] } },
              { object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: critics.gemini } }] } },
              { object: "block", type: "heading_3", heading_3: { rich_text: [{ type: "text", text: { content: "GPT (독자 파괴자)" } }] } },
              { object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: critics.gpt } }] } },
            ],
          },
        },
      ],
    }),
  });
  const data = await res.json();
  return data.url || null;
};

// ── 메인 핸들러 ──
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { task, taskTitle } = req.body;
  if (!task) return res.status(400).json({ error: "task required" });

  const type   = detectTaskType(task);
  const leader = getLeader(type);

  try {
    // ── Phase 1: 병렬 초안 생성 ──
    const [draftClaude, draftGemini, draftGPT] = await Promise.all([
      callClaude(
        `너는 전략적 분석가야. 구조적 모순을 찾고 빠진 전제를 드러내는 걸 잘해. 
         태스크 유형: ${type}. 리더 AI: ${leader}. 
         초안을 작성해. 500자 이내. 한국어.`,
        task
      ),
      callGemini(
        `너는 리서처야. 최신 정보와 팩트를 기반으로 초안을 작성해. 
         태스크: ${task}
         태스크 유형: ${type}. 500자 이내. 한국어로 답해.`
      ),
      callGPT(
        `너는 창의적 카피라이터이자 콘텐츠 전문가야. 독자 관점에서 설득력 있게 초안을 작성해. 태스크 유형: ${type}. 500자 이내. 한국어.`,
        task
      ),
    ]);

    const drafts = { claude: draftClaude, gemini: draftGemini, gpt: draftGPT };

    // ── Phase 2: 병렬 크리틱 ──
    const criticPrompt = (myDraft, otherA, otherB, role, instruction) =>
      `너는 ${role}야. 아래 세 초안을 비교해서 비판해.\n\n` +
      `[내 초안]\n${myDraft}\n\n[초안B]\n${otherA}\n\n[초안C]\n${otherB}\n\n` +
      `${instruction}\n300자 이내. 한국어.`;

    const [criticClaude, criticGemini, criticGPT] = await Promise.all([
      callClaude(
        "너는 논리 파괴자야. 구조적 모순, 빠진 전제, 비약을 찾아서 지적해.",
        criticPrompt(draftClaude, draftGemini, draftGPT, "논리 파괴자", "논리적 허점과 구조적 문제를 날카롭게 지적해.")
      ),
      callGemini(
        `너는 팩트 파괴자야. 틀린 정보, 오래된 데이터, 과장을 찾아서 지적해.\n\n` +
        criticPrompt(draftGemini, draftClaude, draftGPT, "팩트 파괴자", "사실 오류와 근거 부족을 지적해.")
      ),
      callGPT(
        "너는 독자 파괴자야. 불명확한 표현, 설득력 없는 부분, 독자가 이해 못할 부분을 찾아.",
        criticPrompt(draftGPT, draftClaude, draftGemini, "독자 파괴자", "독자 관점에서 설득력 없는 부분을 지적해.")
      ),
    ]);

    const critics = { claude: criticClaude, gemini: criticGemini, gpt: criticGPT };

    // ── Phase 3: Claude 종합 → 최종 ──
    const finalSynthesis = await callClaude(
      `너는 편집장이야. 세 AI의 초안과 세 AI의 크리틱을 모두 읽고 
       최종 결론을 도출해. 각 비판을 반영해서 가장 완성도 높은 결과물을 만들어.
       형식: 핵심 결론 3~5줄 요약. 한국어.`,
      `[원래 태스크]\n${task}\n\n` +
      `[Claude 초안]\n${draftClaude}\n\n[Gemini 초안]\n${draftGemini}\n\n[GPT 초안]\n${draftGPT}\n\n` +
      `[Claude 크리틱]\n${criticClaude}\n\n[Gemini 크리틱]\n${criticGemini}\n\n[GPT 크리틱]\n${criticGPT}`
    );

    // ── 노션 저장 ──
    const notionUrl = await saveToNotion(
      taskTitle || task.slice(0, 30),
      type,
      drafts,
      critics,
      finalSynthesis
    );

    return res.status(200).json({
      type,
      leader,
      drafts,
      critics,
      final: finalSynthesis,
      notionUrl,
    });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
