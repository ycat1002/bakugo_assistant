// pages/api/orchestrate.js
// Claude (Extended Thinking + Web Search)
// Gemini (Google Search Grounding)
// GPT (Web Search + Code Interpreter)

const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY;
const GEMINI_KEY   = process.env.GEMINI_API_KEY;
const OPENAI_KEY   = process.env.OPENAI_API_KEY;
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const RESEARCH_DB  = process.env.NOTION_RESEARCH_DB_ID;

const MODELS = {
  claude: "claude-sonnet-4-20250514",
  gemini: "gemini-2.0-flash",
  gpt:    "gpt-4o",
};
const FALLBACK = { gemini: "gemini-1.5-flash", gpt: "gpt-4o-mini" };

const YEA_PROFILE = `[사용자: 예아]
- PM + 콘텐츠 크리에이터 + 강사. 청주. WHIF IP + 로컬 브랜드 PM.
- ADHD 성향. 구조 > 아이디어. 비판적 사고 환영. 무조건 동의 싫음.
- 활성 프로젝트: 새터동(WHIF), 빡친PM, 아카이브와이, 클라이언트(청주).
- 결과물: 요약 위주. 내용에 맞게 표/글/도식.`;

const detectType = (t) => {
  if (/리서치|조사|트렌드|최신|사례|레퍼런스|분석/.test(t)) return "research";
  if (/전략|기획|계획|방향|구조|설계|프레임/.test(t)) return "strategy";
  if (/카피|콘텐츠|문장|글|스크립트|캡션|제목|아이디어|아이데이션/.test(t)) return "content";
  return "general";
};

const detectDomain = (t) => {
  if (/WHIF|새터동|이환|이윤|침잠|인큐버스/.test(t)) return "WHIF";
  if (/클라이언트|가화|숨포크|아트캐럿|마음무늬|학원/.test(t)) return "클라이언트";
  if (/앱|코드|개발|쿠션키|next|vercel/.test(t)) return "앱개발";
  if (/빡친|아카이브|인스타|릴스|퍼스널/.test(t)) return "퍼브랜";
  if (/아이디어|아이데이션|브레인/.test(t)) return "아이데이션";
  return "기타";
};

const getLeader = (type) => {
  if (type === "research") return "Gemini";
  if (type === "content")  return "GPT";
  return "Claude";
};

const withRetry = async (fn, maxAttempts = 3, delay = 1000) => {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const r = await fn(i);
      if (r && r !== "오류") return r;
    } catch (e) { console.error(`Attempt ${i+1}:`, e.message); }
    if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, delay * (i + 1)));
  }
  return "[응답 생성 실패]";
};

// ── Claude: Web Search (Extended Thinking은 callClaudeThinking 사용) ──
const callClaude = async (system, prompt) => {
  const body = {
    model: MODELS.claude,
    max_tokens: 1000,
    system,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
    messages: [{ role: "user", content: prompt }],
  };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": CLAUDE_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  // thinking 블록 제외, text 블록만 반환
  return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim() || "오류";
};

// ── Claude: Extended Thinking 전용 (web_search 없음 — 호환 안됨) ──
const callClaudeThinking = async (system, prompt) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": CLAUDE_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODELS.claude,
      max_tokens: 16000,
      system,
      thinking: { type: "enabled", budget_tokens: 8000 },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim() || "오류";
};

// ── Gemini: Google Search Grounding ──
const callGemini = async (prompt) => {
  return withRetry(async (attempt) => {
    const model = attempt >= 1 ? FALLBACK.gemini : MODELS.gemini;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { maxOutputTokens: 1500 },
        }),
      }
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const text = data.candidates?.[0]?.content?.parts?.filter(p => p.text)?.map(p => p.text)?.join("\n")?.trim();
    if (!text) throw new Error("empty");
    return text;
  });
};

// ── GPT: Web Search + Code Interpreter ──
const callGPT = async (system, prompt, useCode = false) => {
  return withRetry(async (attempt) => {
    const model = attempt >= 1 ? FALLBACK.gpt : MODELS.gpt;
    const tools = model === "gpt-4o"
      ? [{ type: "web_search_preview" }, ...(useCode ? [{ type: "code_interpreter" }] : [])]
      : undefined;
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model, max_tokens: 1500,
        messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
        ...(tools ? { tools } : {}),
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("empty");
    return text;
  });
};

// ── 노션 저장 ──
const saveToNotion = async ({ topic, type, domain, leader, drafts, critics, final }) => {
  if (!NOTION_TOKEN || !RESEARCH_DB) return null;
  const today = new Date().toISOString().split("T")[0];
  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: { "Authorization": `Bearer ${NOTION_TOKEN}`, "Content-Type": "application/json", "Notion-Version": "2022-06-28" },
    body: JSON.stringify({
      parent: { database_id: RESEARCH_DB },
      icon: { emoji: "🤖" },
      properties: {
        주제: { title: [{ text: { content: topic } }] },
        "date:날짜:start": today, "date:날짜:is_datetime": 0,
        분야: { select: { name: domain } },
        태스크유형: { select: { name: type } },
        AI리더: { select: { name: leader } },
        요약: { rich_text: [{ text: { content: final.slice(0, 300) } }] },
      },
      children: [
        { object:"block", type:"callout", callout:{ icon:{emoji:"🎯"}, color:"purple_background", rich_text:[{type:"text",text:{content:"최종 결론 (Extended Thinking)"},annotations:{bold:true}}] } },
        { object:"block", type:"paragraph", paragraph:{ rich_text:[{type:"text",text:{content:final}}] } },
        { object:"block", type:"divider", divider:{} },
        { object:"block", type:"toggle", toggle:{ rich_text:[{type:"text",text:{content:"📝 AI 초안 3종"},annotations:{bold:true}}], children:[
          { object:"block", type:"heading_3", heading_3:{rich_text:[{type:"text",text:{content:"Claude (Web Search)"}}]} },
          { object:"block", type:"paragraph", paragraph:{rich_text:[{type:"text",text:{content:drafts.claude}}]} },
          { object:"block", type:"heading_3", heading_3:{rich_text:[{type:"text",text:{content:"Gemini (Google Search)"}}]} },
          { object:"block", type:"paragraph", paragraph:{rich_text:[{type:"text",text:{content:drafts.gemini}}]} },
          { object:"block", type:"heading_3", heading_3:{rich_text:[{type:"text",text:{content:"GPT (Web Search + Code)"}}]} },
          { object:"block", type:"paragraph", paragraph:{rich_text:[{type:"text",text:{content:drafts.gpt}}]} },
        ]}},
        { object:"block", type:"toggle", toggle:{ rich_text:[{type:"text",text:{content:"⚔️ 크리틱 로그"},annotations:{bold:true}}], children:[
          { object:"block", type:"heading_3", heading_3:{rich_text:[{type:"text",text:{content:"Claude (논리)"}}]} },
          { object:"block", type:"paragraph", paragraph:{rich_text:[{type:"text",text:{content:critics.claude}}]} },
          { object:"block", type:"heading_3", heading_3:{rich_text:[{type:"text",text:{content:"Gemini (팩트)"}}]} },
          { object:"block", type:"paragraph", paragraph:{rich_text:[{type:"text",text:{content:critics.gemini}}]} },
          { object:"block", type:"heading_3", heading_3:{rich_text:[{type:"text",text:{content:"GPT (독자)"}}]} },
          { object:"block", type:"paragraph", paragraph:{rich_text:[{type:"text",text:{content:critics.gpt}}]} },
        ]}},
        { object:"block", type:"paragraph", paragraph:{rich_text:[{type:"text",text:{content:`Claude Extended Thinking + Web Search | Gemini Google Search | GPT Web Search + Code Interpreter | ${today}`},annotations:{color:"gray"}}]} },
      ],
    }),
  });
  return (await res.json()).url || null;
};

// ── 메인 ──
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { task, taskTitle } = req.body;
  if (!task) return res.status(400).json({ error: "task required" });

  const type   = detectType(task);
  const domain = detectDomain(task);
  const leader = getLeader(type);
  const notionCtx = await searchNotionContext(task);
  const base   = `${YEA_PROFILE}${notionCtx ? "\n\n" + notionCtx : ""}\n\n[태스크]\n${task}\n[유형: ${type} | 분야: ${domain}]`;
  const needsCode = /데이터|통계|수치|계산|차트/.test(task);

  try {
    // Phase 1: 병렬 초안
    const [draftClaude, draftGemini, draftGPT] = await Promise.all([
      withRetry(() => callClaude(`${YEA_PROFILE}\n전략적 분석가. 웹검색해서 최신 정보 기반 초안. 500자 이내. 한국어.`, base)),
      callGemini(`${YEA_PROFILE}\n\n리서처. Google Search로 최신 팩트 기반 초안. 500자 이내. 한국어.\n\n${base}`),
      callGPT(`${YEA_PROFILE}\n창의적 분석가. 웹검색해서 최신 트렌드 반영 초안. 500자 이내. 한국어.`, base, needsCode),
    ]);

    const drafts = { claude:draftClaude, gemini:draftGemini, gpt:draftGPT };
    const ctx    = `[Claude]\n${draftClaude}\n\n[Gemini]\n${draftGemini}\n\n[GPT]\n${draftGPT}`;

    // Phase 2: 병렬 크리틱
    const [criticClaude, criticGemini, criticGPT] = await Promise.all([
      withRetry(() => callClaude(`논리 파괴자. 세 초안의 구조적 모순·비약 지적. 300자 이내. 한국어.`, `[태스크]\n${task}\n\n${ctx}`)),
      callGemini(`팩트 파괴자. 세 초안의 틀린 정보·오래된 데이터 지적. 300자 이내. 한국어.\n\n[태스크]\n${task}\n\n${ctx}`),
      callGPT(`독자 파괴자. 불명확한 표현·설득력 없는 부분 지적. 300자 이내. 한국어.`, `[태스크]\n${task}\n\n${ctx}`, false),
    ]);

    const critics = { claude:criticClaude, gemini:criticGemini, gpt:criticGPT };

    // Phase 3: Claude Extended Thinking으로 최종 종합 (웹검색 없이 — 호환 안됨)
    const final = await withRetry(() => callClaudeThinking(
      `${YEA_PROFILE}\n편집장. 세 초안 + 세 크리틱 종합해서 최종 결론. 핵심 3~5줄. 내용에 맞게 표/도식/글 자유롭게. 한국어.`,
      `[태스크]\n${task}\n\n[초안]\nClaude:${draftClaude}\nGemini:${draftGemini}\nGPT:${draftGPT}\n\n[크리틱]\nClaude:${criticClaude}\nGemini:${criticGemini}\nGPT:${criticGPT}`
    ));

    const notionUrl = await saveToNotion({ topic: taskTitle||task.slice(0,40), type, domain, leader, drafts, critics, final }).catch(()=>null);

    return res.status(200).json({ type, domain, leader, drafts, critics, final, notionUrl,
      features: { claude:"Extended Thinking + Web Search", gemini:"Google Search", gpt:`Web Search${needsCode?" + Code Interpreter":""}` }
    });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
// Note: Notion RAG is handled at the top of the handler
