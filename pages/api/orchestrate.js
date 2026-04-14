// pages/api/orchestrate.js
export const config = { maxDuration: 60 }; // Vercel Pro: 60초, Hobby: 10초

const CLAUDE_KEY  = process.env.ANTHROPIC_API_KEY;
const GEMINI_KEY  = process.env.GEMINI_API_KEY;
const OPENAI_KEY  = process.env.OPENAI_API_KEY;

const YEA_PROFILE = `[사용자: 예아]
- 직업: PM + 콘텐츠 크리에이터 + 강사. 청주 기반.
- 활성 프로젝트: 새터동(WHIF 현대 인터랙티브픽션), 빡친PM(인스타 퍼스널브랜딩), 아카이브와이(WHIF 릴스), 로컬 클라이언트(가화 바지락칼국수, 숨포크, 박미숙 수학학원 등).
- 관심사: AI 콘텐츠 파이프라인, 인스타 마케팅, IP 세계관 구축, 청주 로컬 브랜딩.
- 결과물 선호: 요약 위주. 실행 가능한 구조. 추상론 거부. 표/도식/글 내용에 맞게.
- 비판적 사고 환영. 무조건 동의 싫음. 구조 > 아이디어.`.trim();

const detectType = (t) => {
  if (/리서치|조사|트렌드|최신|사례|분석/.test(t)) return "research";
  if (/전략|기획|방향|구조|설계/.test(t)) return "strategy";
  if (/카피|콘텐츠|글|스크립트|아이디어/.test(t)) return "content";
  return "general";
};

const detectDomain = (t) => {
  if (/WHIF|새터동/.test(t)) return "WHIF";
  if (/클라이언트|가화|숨포크|학원/.test(t)) return "클라이언트";
  if (/앱|코드|개발|쿠션키/.test(t)) return "앱개발";
  if (/빡친|아카이브|인스타|퍼스널/.test(t)) return "퍼브랜";
  return "기타";
};

const getLeader = (t) => t === "research" ? "Gemini" : t === "content" ? "GPT" : "Claude";

// 타임아웃 래퍼 (8초)
const withTimeout = (promise, ms = 8000, fallback = "[응답 없음]") =>
  Promise.race([promise, new Promise(r => setTimeout(() => r(fallback), ms))]);

const withRetry = async (fn, attempts = 2) => {
  for (let i = 0; i < attempts; i++) {
    try { const r = await fn(i); if (r && r !== "오류") return r; } catch (e) { console.error(e.message); }
  }
  return "[응답 생성 실패]";
};

// ── Claude: Web Search ──
const callClaude = async (system, prompt) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": CLAUDE_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      system,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 2 }],
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n").trim() || "오류";
};

// ── Claude: Extended Thinking (웹검색 없음 — 호환 안됨) ──
const callClaudeThinking = async (system, prompt) => {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": CLAUDE_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      system,
      thinking: { type: "enabled", budget_tokens: 4000 },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n").trim() || "오류";
};

// ── Gemini: Google Search ──
const callGemini = async (prompt) => {
  return withRetry(async (attempt) => {
    const model = attempt > 0 ? "gemini-1.5-flash" : "gemini-2.0-flash";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { maxOutputTokens: 800 },
        }),
      }
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const text = data.candidates?.[0]?.content?.parts?.filter(p=>p.text)?.map(p=>p.text)?.join("\n")?.trim();
    if (!text) throw new Error("empty");
    return text;
  });
};

// ── GPT: Web Search ──
const callGPT = async (system, prompt) => {
  return withRetry(async (attempt) => {
    const model = attempt > 0 ? "gpt-4o-mini" : "gpt-4o";
    const body = {
      model, max_tokens: 800,
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
      ...(model === "gpt-4o" ? { tools: [{ type: "web_search_preview" }] } : {}),
    };
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("empty");
    return text;
  });
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const expected = process.env.PWA_SECRET;
  if (expected) {
    const provided = req.headers["x-pwa-secret"];
    if (provided !== expected) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  const { task, taskTitle } = req.body;
  if (!task) return res.status(400).json({ error: "task required" });

  const type   = detectType(task);
  const domain = detectDomain(task);
  const leader = getLeader(type);
  const base   = `${YEA_PROFILE}\n\n[태스크]\n${task}`;

  try {
    // Phase 1: 병렬 초안 (각 8초 타임아웃)
    const [draftClaude, draftGemini, draftGPT] = await Promise.all([
      withTimeout(withRetry(()=>callClaude(`${YEA_PROFILE}\n전략적 분석가. 웹검색 후 최신 정보 기반 초안. 400자 이내. 한국어.`, base)), 9000),
      withTimeout(callGemini(`${YEA_PROFILE}\n\n리서처. Google Search로 최신 팩트 기반 초안. 400자 이내. 한국어.\n\n${base}`), 9000),
      withTimeout(callGPT(`${YEA_PROFILE}\n창의적 분석가. 웹검색 후 트렌드 반영 초안. 400자 이내. 한국어.`, base), 9000),
    ]);

    const drafts = { claude:draftClaude, gemini:draftGemini, gpt:draftGPT };
    const ctx = `[Claude]\n${draftClaude}\n\n[Gemini]\n${draftGemini}\n\n[GPT]\n${draftGPT}`;

    // Phase 2: 병렬 크리틱 (각 8초 타임아웃)
    const [criticClaude, criticGemini, criticGPT] = await Promise.all([
      withTimeout(withRetry(()=>callClaude(`논리 파괴자. 구조적 모순·빠진 전제 지적. 200자 이내. 한국어.`, `[태스크]\n${task}\n\n${ctx}`)), 9000),
      withTimeout(callGemini(`팩트 파괴자. 틀린 정보·근거 부족 지적. 200자 이내. 한국어.\n\n[태스크]\n${task}\n\n${ctx}`), 9000),
      withTimeout(callGPT(`독자 파괴자. 불명확한 표현·설득력 없는 부분 지적. 200자 이내. 한국어.`, `[태스크]\n${task}\n\n${ctx}`), 9000),
    ]);

    const critics = { claude:criticClaude, gemini:criticGemini, gpt:criticGPT };

    // Phase 3: Extended Thinking 최종 종합
    const final = await withTimeout(
      withRetry(()=>callClaudeThinking(
        `${YEA_PROFILE}\n편집장. 세 초안 + 세 크리틱 종합 → 최종 결론. 핵심 3~5줄. 표/도식/글 자유. 한국어.`,
        `[태스크]\n${task}\n\n[초안]\nClaude:${draftClaude}\nGemini:${draftGemini}\nGPT:${draftGPT}\n\n[크리틱]\nClaude:${criticClaude}\nGemini:${criticGemini}\nGPT:${criticGPT}`
      )),
      15000, // Extended Thinking은 더 길게
      `세 AI 초안을 종합한 결과:\n\nClaude: ${draftClaude}\n\nGemini: ${draftGemini}\n\nGPT: ${draftGPT}`
    );

    return res.status(200).json({ type, domain, leader, drafts, critics, final });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
