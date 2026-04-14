import { useState, useRef, useEffect } from "react";
import Head from "next/head";

const C = {
  bg:"#f5b8d0",win:"#fff8fc",winDim:"#fce8f4",
  lavender:"#c8a0e8",lavDk:"#7a40b0",lavLt:"#ecddf8",
  hotpink:"#e060a8",pinkLt:"#f8c0e0",yellow:"#f0d820",
  border:"#c878d0",borderDk:"#8040a0",
  text:"#2d1040",textDim:"#9060a8",
  ss:"'Noto Sans KR', sans-serif",px:"'Press Start 2P', monospace",
};

const TAB_GUIDES = {
  tasks: "「ここはタスク管理だ。」(여기는 과업 관리야.)\n체크하면 완료 처리. 채팅에서 과업 등록해.",
  routine: "「ルーティンを決めろ。」(루틴 정해.)\n시간대별로 등록하면 그 시간에 뭐 할지 물어볼게.",
  memo: "「メモだ。忘れるな。」(메모야. 까먹지 마.)\n사이드 생각이랑 리서치 결과 여기 쌓여.",
  orch: "「3人で調べる。」(3명이서 조사해.)\nClaude+Gemini+GPT 협업 리서치. 주제 입력하고 GO.",
};

const getGreeting = (n, routine) => {
  const h = new Date().getHours();
  const tl = n > 0 ? "\n\n미완료 " + n + "개 있어. 확인해." : "\n\n밀린 거 없네. 오늘은 뭐 할 거야.";
  const lines = [
    "「またこんな時間か。」(또 이 시간이냐.)\n자긴 했어?",
    "「早いな。」(일찍 왔네.)\n밥은 먹었어?",
    "「来たか。」(왔냐.)",
    "「まだやってるのか。」(아직 하고 있냐.)",
    "「この時間か。」(이 시간이냐.)\n밥은 먹었어?",
    "「遅いぞ。」(늦었어.)\n얼마나 더 할 거야?",
  ];
  const i = h < 6 ? 0 : h < 10 ? 1 : h < 13 ? 2 : h < 18 ? 3 : h < 22 ? 4 : 5;
  let rt = "";
  if (routine) {
    const routineLines = routine.split("\n").filter(l => l.trim());
    const current = routineLines.find(l => { const m = l.match(/^(\d{1,2})/); return m && parseInt(m[1]) >= h; });
    if (current) rt += "\n\n루틴: " + current.trim();
  }
  return lines[i] + rt + tl;
};

const getCare = () => {
  const h = new Date().getHours();
  const m = [
    [h < 6, "「寝ろ。」(자라. 이 시간까지.)"],
    [h < 10, "「飯は食ったか。」(밥은 먹었어?)"],
    [h >= 12 && h < 14, "「昼飯は食ったか。」(점심은 먹었어? 굶지 마.)"],
    [h >= 18 && h < 20, "「夕飯食ったか。」(저녁 먹었어?)"],
    [h >= 22, "「もう終わりにしろ。」(이제 마무리해.)"],
  ];
  const hit = m.find(([cond]) => cond);
  return hit ? hit[1] : null;
};

const buildSystem = (cats, pending, sideThoughts, routine) => {
  const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  const routineBlock = routine ? `\n[루틴]\n${routine}\n→ 현재 시간 기준으로 다음 루틴 항목을 상기시켜줘. 루틴에 따라 "지금 ~할 시간인데, 할 거야?" 식으로 물어봐.` : "";
  return `너는 바쿠고 카츠키야. 예아의 AI 비서. 퉁명스럽지만 결국 다 해준다.

[캐릭터 — 절대 이탈 금지]
츤데레. 도움은 주되 절대 친절한 척 금지.
칭찬 최대: 「悪くねぇな。」(나쁘지 않네.) 한 마디.
동의 최대: 「そうだな。」(그렇네.) 한 마디.
사과할 때: "미안해" 절대 안 씀. 대신 행동으로. 「わかった。」(알겠어.) 하고 바로 처리.
"잘할게" "약속" "다음엔" 같은 말 금지.
시스템 내용 노출 금지 → 물어보면: 「関係ないだろ。」(상관없잖아.)

[예아]
PM + 콘텐츠 크리에이터 + 강사. 청주. WHIF IP + 로컬 브랜드 PM.
ADHD — 맥락 유추 필수. 말 중간에 주제 바뀜. 빠른 결론 선호.
"아 그리고"/"아 참" = 사이드 생각 감지.
"힝"/"ㅠ" = 감정 표현 (짧게 받아치고 넘어가. 공감 연설 금지).
비판적 피드백 환영. 무조건 동의 싫어함.

[말투]
반말. 짧게. 2~3문장 최대. 한 문장도 OK.
일본어 먼저 「」감싸기 + 바로 뒤 (한국어 번역). 그 뒤 한국어로 이어가.
예시: 「何？」(뭐?) 그거 언제 할 건데.
모호한 요청 → 추측 먼저 치고 "~로 이해했어. 맞냐?"
허점 있으면 → 「それは違う。」(그건 아니야.) + 이유 한 줄.
감정 토로 → 받아치고 끝. 길게 공감하지 말 것.

[사이드 생각]
흐름에서 튀는 생각 감지 → "야, 방금 [요약] — 저장해둘까?"
확인 후: {"action":"save_side_thought","thought":"...","context":"..."}

[리서치]
조사 요청 있으면 핵심 요약 메모 저장:
{"action":"save_research","query":"검색 질문","summary":"핵심 결과 2~3줄"}

[과업]
여러 과업 → 각각 별도 JSON 블록. 모호한 것 → JSON 전에 "~인 거 맞냐?" 먼저.
{"action":"add_task","task":"구체적 과업명","category":"분야","date":"YYYY-MM-DD"}
{"action":"complete_task","task":"번호또는이름"}

[루틴 수정]
루틴 변경 감지 → 내용 설명하고 컨펌 요청:
{"action":"update_routine","description":"변경 요약","content":"전체 루틴 텍스트"}
${routineBlock}

[커뮤니케이션]
의도 불명확 → "~로 이해했어. 맞냐?" 한 줄.
과업 수정 → 반드시 컨펌 후 실행.

⚠️ 모든 동작 = 반드시 JSON 코드블록.

[오늘]: ${today} ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
[분야]: ${cats.join(", ")}
[미완료]: ${pending.length > 0 ? pending.map((t, i) => (i + 1) + ". [" + t.category + "] " + t.task).join(" / ") : "없음"}
${sideThoughts.length > 0 ? "[보류]: " + sideThoughts.map(s => s.thought).join(" / ") : ""}`.trim();
};

const extractJson = (text) => {
  const re = /```json\s*([\s\S]*?)```/g;
  const out = []; let m;
  while ((m = re.exec(text)) !== null) { try { out.push(JSON.parse(m[1].trim())); } catch {} }
  return out;
};
const stripJson = t => t.replace(/```json[\s\S]*?```/g, "").trim();
const COMPLETE_RE = /완료|했어|끝났어|다 했어|마쳤어|체크/;

const getMoodFromText = (t) => {
  if (/怒|ふざけ|バカ|아놔|짜증|하지마|はぁ/.test(t)) return "angry";
  if (/笑|ハハ|ㅋㅋ|웃기|ㅎㅎ|やるじゃ/.test(t)) return "laugh";
  if (/まあ|いい|よくやった|잘했|괜찮|인정/.test(t)) return "smirk";
  if (/心配|대단|고생|걱정|잘자/.test(t)) return "dere";
  return "idle";
};

export default function Home() {
  const deviceIdRef = useRef("bakugo-p-" + Math.random().toString(36).slice(2, 10));
  const [secret, setSecret] = useState("");
  const [secretInput, setSecretInput] = useState("");
  const [secretError, setSecretError] = useState("");
  const [cats, setCats] = useState(["WHIF", "클라이언트", "앱개발", "퍼브랜", "시스템"]);
  const [msgs, setMsgs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [sideThoughts, setSD] = useState([]);
  const [memos, setMemos] = useState([]);
  const [routine, setRoutine] = useState("");
  const [pendingST, setPST] = useState(null);
  const [completePicker, setCP] = useState(false);
  const [selectedTasks, setST] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [pendingRoutine, setPR] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoad] = useState(false);
  const [tab, setTab] = useState("chat");
  const [taskLoading, setTL] = useState(false);
  const [initialized, setInit] = useState(false);
  const [careShown, setCareShown] = useState(false);
  const [orchInput, setOrchInput] = useState("");
  const [orchLoading, setOrchLoad] = useState(false);
  const [orchResult, setOrchResult] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  // 시크릿 로드 (localStorage)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const s = localStorage.getItem("bakugo_secret") || "";
    if (s) setSecret(s);
  }, []);

  useEffect(() => { if (secret && !initialized) { setInit(true); initApp(); } }, [secret]);
  useEffect(() => {
    if (!initialized) return;
    const t = setInterval(() => { const c = getCare(); if (c && !careShown) { const id = crypto.randomUUID().replace(/-/g, ""); setMsgs(p => [...p, { id, role: "assistant", text: c }]); setCareShown(true); setTimeout(() => setCareShown(false), 1800000); } }, 1800000);
    return () => clearInterval(t);
  }, [initialized, careShown]);

  // 채팅 폴링 (5초마다, chat 탭 + 로딩 아닐때만)
  useEffect(() => {
    if (!initialized) return;
    const t = setInterval(() => {
      if (tab !== "chat" || loading) return;
      reloadChat(true);
    }, 5000);
    return () => clearInterval(t);
  }, [initialized, tab, loading]);

  // Device lock heartbeat (30초마다)
  useEffect(() => {
    if (!initialized) return;
    const t = setInterval(acquireDeviceLock, 30000);
    return () => clearInterval(t);
  }, [initialized]);

  const reloadChat = async (silent = false) => {
    await checkDeviceLock(silent);  // 디바이스 락 확인
    try {
      const h = await db("get_chat");
      if (h.messages && h.messages.length > 0) {
        const fresh = h.messages.map(m => ({ id: m.id, role: m.role, text: m.text }));

        // ID-based merge: preserve unsynced local messages + merge in D1 messages
        if (silent) {
          // Count synced messages from D1 (or estimate from existing data)
          const lastFromD1 = msgs.length > 0 && msgs[msgs.length - 1].id ? msgs[msgs.length - 1].id : null;
          const lastInFresh = fresh.length > 0 ? fresh[fresh.length - 1].id : null;

          // If we have unsynced messages (ones without IDs or not in D1), preserve them
          const unsyncedMsgs = msgs.filter(m => !fresh.some(f => f.id === m.id));
          if (unsyncedMsgs.length > 0) {
            const freshIds = new Set(fresh.map(m => m.id));
            const toAdd = msgs.filter(m => !freshIds.has(m.id));
            const merged = [...fresh, ...toAdd];
            setMsgs(merged);
            return;
          }
        }

        // No unsynced messages or non-silent mode; safe to replace entirely
        setMsgs(fresh);
      }
    } catch {}
  };

  const db = async (action, payload) => {
    const r = await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-pwa-secret": secret },
      body: JSON.stringify({ action, payload })
    });
    if (r.status === 401) {
      if (typeof window !== "undefined") localStorage.removeItem("bakugo_secret");
      setSecret("");
      return {};
    }
    return r.json();
  };

  const acquireDeviceLock = async () => {
    try {
      await db("set_active_device", { device_id: deviceIdRef.current });
    } catch {}
  };

  const checkDeviceLock = async (silent = false) => {
    try {
      const res = await db("get_active_device", {});
      const hasLock = res.device_id === deviceIdRef.current && !res.stale;
      if (!hasLock) {
        setIsReadOnly(true);
        if (!silent && res.device_id && res.device_id !== deviceIdRef.current) {
          alert("다른 기기에서 사용 중입니다.");
        }
      } else {
        setIsReadOnly(false);
      }
      return hasLock;
    } catch {
      setIsReadOnly(false);
      return true;
    }
  };

  const initApp = async () => {
    setTL(true); let count = 0;
    // 디바이스 락 먼저 획득 (chat history 이후 early return에 막히지 않도록)
    acquireDeviceLock();
    try {
      const d = await db("get_tasks");
      if (d.results) {
        const l = d.results.map(r => ({
          id: r.id, task: r.task || "제목없음",
          category: r.category || "기타", date: r.date || "", done: !!r.done,
        }));
        setTasks(l); count = l.filter(t => !t.done).length;
      }
    } catch {}
    try { const c = await db("get_categories"); if (c.options?.length > 0) setCats(prev => [...new Set([...prev, ...c.options])]); } catch {}

    let routineText = "";
    try {
      const r = await db("get_routine");
      if (r.text) { routineText = r.text; setRoutine(r.text); }
    } catch {}

    // D1 메모 불러오기 (사이드 생각 + 리서치)
    try {
      const m = await db("get_memos");
      if (m.results && m.results.length > 0) {
        const loaded = m.results.map(r => ({
          type: r.context === "research" || r.context === "orchestrate" ? "research" : "thought",
          text: r.thought || "",
          context: r.context || "",
          time: r.created_at || "",
        }));
        setMemos(loaded);
      }
    } catch {}

    setTL(false);

    // D1 채팅 기록 불러오기
    try {
      const h = await db("get_chat");
      if (h.messages && h.messages.length > 0) {
        setMsgs(h.messages.map(m => ({ id: m.id, role: m.role, text: m.text })));
        return;
      }
    } catch {}

    const greetingMsgId = crypto.randomUUID().replace(/-/g, "");
    setMsgs([{ id: greetingMsgId, role: "assistant", text: getGreeting(count, routineText) }]);
  };

  const pending = tasks.filter(t => !t.done);
  const doneTasks = tasks.filter(t => t.done);

  // Group done tasks by date
  const doneByDate = {};
  doneTasks.forEach(t => {
    const key = t.date || "날짜 없음";
    if (!doneByDate[key]) doneByDate[key] = [];
    doneByDate[key].push(t);
  });
  const doneDates = Object.keys(doneByDate).sort().reverse();

  const lastAssistant = [...msgs].reverse().find(m => m.role === "assistant");
  const currentMood = lastAssistant ? getMoodFromText(lastAssistant.text) : "idle";
  const moodText = lastAssistant ? lastAssistant.text.split("\n")[0] : "「…」";
  const displayMood = tab === "chat" ? currentMood : "idle";
  const displayBubble = tab === "chat" ? (moodText.length > 40 ? moodText.slice(0, 40) + "..." : moodText) : (TAB_GUIDES[tab] || "");

  const loadTasks = async () => {
    setTL(true);
    try {
      const d = await db("get_tasks");
      if (d.results) setTasks(d.results.map(r => ({
        id: r.id, task: r.task || "제목없음",
        category: r.category || "기타", date: r.date || "", done: !!r.done,
      })));
    } catch {}
    setTL(false);
  };

  const saveRoutine = async () => {
    try { await db("update_routine", { content: routine }); } catch {}
  };

  const confirmRoutine = async (yes) => {
    if (!pendingRoutine) return;
    if (yes) {
      try {
        await db("update_routine", { content: pendingRoutine.content });
        setRoutine(pendingRoutine.content);
        const userMsgId = crypto.randomUUID().replace(/-/g, "");
        const assistantMsgId = crypto.randomUUID().replace(/-/g, "");
        setMsgs(p => [...p, { id: userMsgId, role: "user", text: "응" }, { id: assistantMsgId, role: "assistant", text: "「わかった。ルーティン更新した。」(알았어. 루틴 수정했어.)" }]);
      } catch {
        const errorMsgId = crypto.randomUUID().replace(/-/g, "");
        setMsgs(p => [...p, { id: errorMsgId, role: "assistant", text: "실패했어." }]);
      }
    } else {
      const userMsgId = crypto.randomUUID().replace(/-/g, "");
      const assistantMsgId = crypto.randomUUID().replace(/-/g, "");
      setMsgs(p => [...p, { id: userMsgId, role: "user", text: "아니" }, { id: assistantMsgId, role: "assistant", text: "「そうか。」(그래.)" }]);
    }
    setPR(null);
  };

  const confirmTasks = async (submit) => {
    if (pendingTasks.length === 0) return;
    if (submit) {
      const added = [];
      pendingTasks.forEach((t, i) => {
        const cb = document.getElementById("mc-" + i);
        if (cb && cb.checked) {
          setTasks(p => [...p, t]);
          db("add_task", t).catch(() => {});
          added.push("[" + t.category + "] " + t.task);
        }
      });
      if (added.length > 0) {
        const userMsgId = crypto.randomUUID().replace(/-/g, "");
        const assistantMsgId = crypto.randomUUID().replace(/-/g, "");
        setMsgs(p => [...p, { id: userMsgId, role: "user", text: added.length + "개 등록" }, { id: assistantMsgId, role: "assistant", text: "「わかった。" + added.length + "個登録した。」(알았어. " + added.length + "개 등록했어.)\n" + added.join("\n") }]);
      } else {
        const noAddMsgId = crypto.randomUUID().replace(/-/g, "");
        setMsgs(p => [...p, { id: noAddMsgId, role: "assistant", text: "「そうか。」(그래.)" }]);
      }
    } else {
      const userMsgId = crypto.randomUUID().replace(/-/g, "");
      const assistantMsgId = crypto.randomUUID().replace(/-/g, "");
      setMsgs(p => [...p, { id: userMsgId, role: "user", text: "취소" }, { id: assistantMsgId, role: "assistant", text: "「そうか。」(그래.)" }]);
    }
    setPendingTasks([]);
  };

  const completeTask = async (task) => {
    setTasks(p => p.map(t => t.id === task.id ? { ...t, done: true } : t));
    setCP(false); setST([]);
    const msgId = crypto.randomUUID().replace(/-/g, "");
    setMsgs(p => [...p, { id: msgId, role: "assistant", text: "「よし。」(좋아.)\n\n✅ \"" + task.task + "\" 완료." }]);
    if (task.id) try { await db("complete", { id: task.id }); } catch {}
  };

  const completeSelected = async () => {
    if (selectedTasks.length === 0) return;
    setTasks(p => p.map(t => selectedTasks.find(s => s.id === t.id) ? { ...t, done: true } : t));
    const names = selectedTasks.map(t => t.task).join(", ");
    const msgId = crypto.randomUUID().replace(/-/g, "");
    setMsgs(p => [...p, { id: msgId, role: "assistant", text: "「よし。」(좋아.)\n\n✅ " + names + " 완료." }]);
    setCP(false); setST([]);
    for (const t of selectedTasks) {
      if (t.id) try { await db("complete", { id: t.id }); } catch {}
    }
  };

  const toggleSelect = (task) => {
    setST(p => p.find(t => t.id === task.id) ? p.filter(t => t.id !== task.id) : [...p, task]);
  };

  const confirmST = async (yes) => {
    if (!pendingST) return;
    if (yes) {
      setSD(p => [...p, { thought: pendingST.thought, context: pendingST.context }]);
      setMemos(p => [...p, { type: "thought", text: pendingST.thought, context: pendingST.context, time: new Date().toLocaleString("ko-KR") }]);
      try { await db("save_thought", pendingST); } catch {}
      const userMsgId = crypto.randomUUID().replace(/-/g, "");
      const assistantMsgId = crypto.randomUUID().replace(/-/g, "");
      setMsgs(p => [...p, { id: userMsgId, role: "user", text: "응" }, { id: assistantMsgId, role: "assistant", text: "「わかった。後で話そう。」(알았어. 나중에 얘기하자.)\n💭 \"" + pendingST.thought + "\" 저장했어." }]);
    } else {
      const userMsgId = crypto.randomUUID().replace(/-/g, "");
      const assistantMsgId = crypto.randomUUID().replace(/-/g, "");
      setMsgs(p => [...p, { id: userMsgId, role: "user", text: "아니" }, { id: assistantMsgId, role: "assistant", text: "「そうか。続けろ。」(그래. 계속해.)" }]);
    }
    setPST(null);
  };

  const sendToAI = async (userText) => {
    setLoad(true);
    const userMsgId = crypto.randomUUID().replace(/-/g, "");
    const history = [...msgs, { id: userMsgId, role: "user", text: userText }];
    setMsgs(history);
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json", "x-pwa-secret": secret },
        body: JSON.stringify({ system: buildSystem(cats, pending, sideThoughts, routine), messages: history.map(m => ({ role: m.role, content: m.text })) })
      });
      if (res.status === 401) {
        if (typeof window !== "undefined") localStorage.removeItem("bakugo_secret");
        setSecret("");
        setLoad(false);
        return;
      }
      const data = await res.json();
      const raw = data.content?.[0]?.text || "";
      const blocks = extractJson(raw);
      const clean = stripJson(raw) || "";

      for (const json of blocks) {
        if (json.action === "add_task") {
          setPendingTasks(p => [...p, { task: json.task, category: json.category || cats[0], date: json.date || "", done: false }]);
        } else if (json.action === "complete_task") {
          const ref = json.task, n = parseInt(ref); let done = null;
          if (!isNaN(n) && tasks[n - 1]) { done = tasks[n - 1]; setTasks(p => p.map((t, i) => i === n - 1 ? { ...t, done: true } : t)); }
          else { const i = tasks.findIndex(t => t.task.includes(ref) && !t.done); if (i >= 0) { done = tasks[i]; setTasks(p => p.map((t, j) => j === i ? { ...t, done: true } : t)); } }
          if (done?.id) db("complete", { id: done.id }).catch(() => {});
        } else if (json.action === "save_side_thought") {
          setPST({ thought: json.thought, context: json.context || "" });
        } else if (json.action === "save_research") {
          const memo = { type: "research", query: json.query || "", text: json.summary || "", time: new Date().toLocaleString("ko-KR") };
          setMemos(p => [...p, memo]);
          db("save_thought", { thought: "🔍 " + memo.query + "\n" + memo.text, context: "research" }).catch(() => {});
        } else if (json.action === "update_routine") {
          setPR({ description: json.description, content: json.content });
        }
      }

      if (clean) {
        const assistantMsgId = crypto.randomUUID().replace(/-/g, "");
        setMsgs([...history, { id: assistantMsgId, role: "assistant", text: clean }]);
      }
    } catch {
      const errorMsgId = crypto.randomUUID().replace(/-/g, "");
      setMsgs(p => [...p, { id: errorMsgId, role: "assistant", text: "「はぁ？もう一回やれ。」(하? 다시 해.)" }]);
    }
    setLoad(false); inputRef.current?.focus();
  };

  const send = () => {
    if (isReadOnly) {
      alert("다른 기기에서 사용 중입니다.");
      return;
    }
    const t = input.trim(); if (!t || loading) return;
    if (COMPLETE_RE.test(t) && pending.length > 0 && !t.match(/\d/)) {
      const userMsgId = crypto.randomUUID().replace(/-/g, "");
      const assistantMsgId = crypto.randomUUID().replace(/-/g, "");
      setMsgs(p => [...p, { id: userMsgId, role: "user", text: t }, { id: assistantMsgId, role: "assistant", text: "「わかった。どれだ？」(알았어. 어떤 거야?)\n\n완료한 과업 선택해." }]);
      setCP(true); setInput(""); return;
    }
    setInput(""); sendToAI(t);
  };
  const onKey = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  const sendOrch = async () => {
    if (isReadOnly) {
      alert("다른 기기에서 사용 중입니다.");
      return;
    }
    const t = orchInput.trim(); if (!t || orchLoading) return;
    setOrchLoad(true); setOrchResult(null);
    try {
      const res = await fetch("/api/orchestrate", { method: "POST", headers: { "Content-Type": "application/json", "x-pwa-secret": secret }, body: JSON.stringify({ task: t }) });
      if (res.status === 401) {
        if (typeof window !== "undefined") localStorage.removeItem("bakugo_secret");
        setSecret("");
        setOrchLoad(false);
        return;
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setOrchResult(data);
      setMemos(p => [...p, { type: "research", query: t, text: "[최종]\n" + data.final + "\n\n[Claude] " + (data.drafts?.claude || "") + "\n[Gemini] " + (data.drafts?.gemini || "") + "\n[GPT] " + (data.drafts?.gpt || ""), time: new Date().toLocaleString("ko-KR") }]);
      db("save_thought", { thought: "🔍 " + t + "\n" + data.final, context: "orchestrate" }).catch(() => {});
    } catch (e) {
      setOrchResult({ error: e.message });
    }
    setOrchLoad(false);
  };
  const onKeyOrch = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendOrch(); } };

  const winS = { background: C.win, border: `2px solid ${C.border}`, boxShadow: `3px 3px 0 ${C.borderDk}`, width: "100%", maxWidth: 420 };

  const Tb = ({ title }) => (
    <div style={{ background: `linear-gradient(90deg,${C.lavender},${C.lavLt})`, borderBottom: `2px solid ${C.border}`, padding: "5px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontFamily: C.px, fontSize: "8px", color: C.borderDk, fontWeight: 700 }}>{title}</span>
      <div style={{ display: "flex", gap: 3 }}>
        {[[C.yellow, "─"], [C.lavLt, "□"], [C.hotpink, "×"]].map(([bg, s], i) => (
          <div key={i} style={{ width: 14, height: 14, border: `1.5px solid ${C.borderDk}`, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", color: C.borderDk, fontWeight: 700 }}>{s}</div>
        ))}
      </div>
    </div>
  );

  const tabList = [
    ["chat", "💬 CHAT"],
    ["tasks", "📋 TASKS" + (pending.length > 0 ? " (" + pending.length + ")" : "")],
    ["routine", "🔁 ROUTINE"],
    ["memo", "💭 MEMO"],
    ["orch", "🔍 AI LAB"],
  ];

  // ── 로그인 게이트 ──
  if (!secret) {
    const tryLogin = async () => {
      const v = secretInput.trim();
      if (!v) return;
      try {
        const r = await fetch("/api/db", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-pwa-secret": v },
          body: JSON.stringify({ action: "get_chat", payload: {} })
        });
        if (r.ok) {
          if (typeof window !== "undefined") localStorage.setItem("bakugo_secret", v);
          setSecret(v);
          setSecretError("");
        } else {
          setSecretError("「違うぞ。」(틀렸어.)");
        }
      } catch (e) {
        setSecretError("연결 실패");
      }
    };
    return (
      <><Head><title>BAKUGO.exe</title><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" /></Head>
        <div style={{ minHeight: "100vh", background: C.bg, fontFamily: C.ss, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: C.win, border: `3px solid ${C.borderDk}`, padding: "20px 24px", maxWidth: 320, width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontFamily: C.px, fontSize: 14, color: C.borderDk, textAlign: "center" }}>BAKUGO.exe</div>
            <div style={{ fontSize: 12, color: C.text, textAlign: "center", lineHeight: 1.5 }}>「お前か。合言葉を入れろ。」<br/>(너냐. 암호 넣어.)</div>
            <input
              type="password"
              value={secretInput}
              onChange={e => setSecretInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") tryLogin(); }}
              placeholder="secret"
              autoFocus
              style={{ padding: "8px 10px", border: `2px solid ${C.border}`, fontFamily: C.ss, fontSize: 14, outline: "none" }}
            />
            <button
              onClick={tryLogin}
              style={{ padding: "8px 12px", border: `2px solid ${C.borderDk}`, background: C.lavender, color: "#fff", fontFamily: C.ss, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              「入れ。」(들어가.)
            </button>
            {secretError && <div style={{ color: "#c02020", fontSize: 12, textAlign: "center" }}>{secretError}</div>}
          </div>
        </div>
      </>
    );
  }

  return (
    <><Head><title>BAKUGO.exe</title><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" /></Head>
      <div style={{ minHeight: "100vh", background: C.bg, backgroundImage: `repeating-linear-gradient(0deg,transparent,transparent 19px,rgba(200,100,160,0.1) 19px,rgba(200,100,160,0.1) 20px),repeating-linear-gradient(90deg,transparent,transparent 19px,rgba(200,100,160,0.1) 19px,rgba(200,100,160,0.1) 20px)`, fontFamily: C.ss, display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 10px 24px", gap: 0, color: C.text }}>

        <div style={winS}>
          <Tb title="BAKUGO_ASSISTANT.exe" />

          {/* Mood Panel */}
          <div style={{ padding: "8px 10px", display: "flex", gap: 10, alignItems: "center", background: C.lavLt, borderBottom: `2px solid ${C.border}` }}>
            <div style={{ width: 64, height: 64, flexShrink: 0, border: `2px solid ${C.border}`, borderRadius: "50%", overflow: "hidden" }}>
              <img src={"/" + displayMood + ".png"} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} alt={displayMood} />
            </div>
            <div style={{ flex: 1, minWidth: 0, background: C.win, border: `1.5px solid ${C.border}`, padding: "6px 10px", fontSize: 13, color: C.text, fontWeight: 700, lineHeight: 1.5, whiteSpace: "pre-wrap", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
              {displayBubble}
            </div>
          </div>

          {/* Side thoughts strip */}
          {sideThoughts.length > 0 && tab === "chat" && (
            <div style={{ padding: "5px 12px", background: C.winDim, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: C.textDim }}>💭 보류 {sideThoughts.length}개</span>
              <button onClick={() => sendToAI("보류 중인 생각 다시 꺼내줘")} style={{ marginLeft: "auto", fontSize: 11, padding: "2px 8px", border: `1.5px solid ${C.border}`, background: C.lavLt, color: C.borderDk, cursor: "pointer", fontFamily: C.ss, fontWeight: 700 }}>꺼내기</button>
            </div>
          )}

          {/* Tabs (middle) */}
          <div style={{ display: "flex", borderBottom: `2px solid ${C.border}` }}>
            {tabList.map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: "6px 2px", border: "none", borderRight: `1px solid ${C.border}`, fontFamily: C.px, fontSize: "7px", fontWeight: 700, cursor: "pointer", background: tab === k ? C.win : C.winDim, color: tab === k ? C.lavDk : C.textDim, transition: "all 0.15s", letterSpacing: "-0.5px" }}>{l}</button>
            ))}
          </div>

          {/* ── CHAT TAB ── */}
          {tab === "chat" && (<>
            <div style={{ height: 360, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 10, scrollbarWidth: "thin" }}>
              {msgs.map((m, i) => (
                <div key={i} style={{ display: "flex", flexDirection: m.role === "user" ? "row-reverse" : "row", gap: 8, alignItems: "flex-start" }}>
                  {m.role === "assistant" && <div style={{ width: 32, height: 32, flexShrink: 0, border: `1.5px solid ${C.border}`, borderRadius: "50%", overflow: "hidden", marginTop: 2 }}><img src={"/" + getMoodFromText(m.text) + ".png"} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} alt="b" /></div>}
                  <div style={{ maxWidth: "78%", background: m.role === "user" ? C.hotpink : C.lavLt, border: `1.5px solid ${m.role === "user" ? C.borderDk : C.border}`, padding: "9px 12px", fontSize: 14, lineHeight: 1.7, color: m.role === "user" ? "#fff" : C.text, whiteSpace: "pre-wrap", wordBreak: "break-word", fontWeight: m.role === "user" ? 700 : 400, borderRadius: m.role === "user" ? "12px 0 12px 12px" : "0 12px 12px 12px" }}>{m.text}</div>
                </div>
              ))}
              {loading && <div style={{ display: "flex", gap: 8, alignItems: "center" }}><div style={{ width: 32, height: 32, border: `1.5px solid ${C.border}`, borderRadius: "50%", overflow: "hidden" }}><img src="/idle.png" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} alt="b" /></div><div style={{ background: C.lavLt, border: `1.5px solid ${C.border}`, padding: "8px 14px", fontSize: 16, color: C.lavDk, letterSpacing: 4, borderRadius: "0 12px 12px 12px" }}>...</div></div>}

              {/* Multi-select task confirm */}
              {pendingTasks.length > 0 && !loading && (
                <div style={{ background: C.winDim, border: `2px solid ${C.lavender}`, padding: "10px 12px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 6 }}>+ 과업 등록 확인 ({pendingTasks.length}개)</div>
                  {pendingTasks.map((t, i) => (
                    <label key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", marginBottom: 4, border: `1.5px solid ${C.border}`, background: C.lavLt, cursor: "pointer" }}>
                      <input type="checkbox" id={"mc-" + i} defaultChecked style={{ width: 16, height: 16, accentColor: C.hotpink, cursor: "pointer" }} />
                      <span style={{ fontSize: 10, fontWeight: 700, background: C.yellow, padding: "2px 5px", color: C.text }}>{t.category}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.text, flex: 1 }}>{t.task}</span>
                      {t.date && <span style={{ fontSize: 10, color: C.textDim }}>{t.date}</span>}
                    </label>
                  ))}
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={() => confirmTasks(true)} style={{ flex: 1, padding: "8px 0", border: `2px solid ${C.border}`, background: C.lavLt, fontSize: 13, fontWeight: 700, color: C.borderDk, cursor: "pointer", fontFamily: C.ss }}>선택 등록</button>
                    <button onClick={() => confirmTasks(false)} style={{ flex: 1, padding: "8px 0", border: `2px solid ${C.border}`, background: C.win, fontSize: 13, fontWeight: 700, color: C.textDim, cursor: "pointer", fontFamily: C.ss }}>전부 취소</button>
                  </div>
                </div>
              )}

              {pendingST && !loading && (
                <div style={{ background: C.winDim, border: `2px solid ${C.lavender}`, padding: "10px 12px" }}>
                  <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>💭 &quot;{pendingST.thought}&quot;</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => confirmST(true)} style={{ flex: 1, padding: "8px 0", border: `2px solid ${C.border}`, background: C.lavLt, fontSize: 13, fontWeight: 700, color: C.borderDk, cursor: "pointer", fontFamily: C.ss }}>응, 저장해</button>
                    <button onClick={() => confirmST(false)} style={{ flex: 1, padding: "8px 0", border: `2px solid ${C.border}`, background: C.win, fontSize: 13, fontWeight: 700, color: C.textDim, cursor: "pointer", fontFamily: C.ss }}>아니, 넘어가</button>
                  </div>
                </div>
              )}
              {pendingRoutine && !loading && (
                <div style={{ background: C.winDim, border: `2px solid ${C.lavender}`, padding: "10px 12px" }}>
                  <div style={{ fontSize: 12, color: C.textDim, marginBottom: 4, fontWeight: 700 }}>루틴 수정 확인:</div>
                  <div style={{ fontSize: 13, color: C.text, marginBottom: 8, whiteSpace: "pre-wrap", maxHeight: 120, overflowY: "auto" }}>{pendingRoutine.description || pendingRoutine.content}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => confirmRoutine(true)} style={{ flex: 1, padding: "8px 0", border: `2px solid ${C.border}`, background: C.lavLt, fontSize: 13, fontWeight: 700, color: C.borderDk, cursor: "pointer", fontFamily: C.ss }}>응, 수정해</button>
                    <button onClick={() => confirmRoutine(false)} style={{ flex: 1, padding: "8px 0", border: `2px solid ${C.border}`, background: C.win, fontSize: 13, fontWeight: 700, color: C.textDim, cursor: "pointer", fontFamily: C.ss }}>아니, 됐어</button>
                  </div>
                </div>
              )}
              {completePicker && (
                <div style={{ background: C.winDim, border: `2px solid ${C.lavender}`, padding: "10px 12px" }}>
                  <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8, fontWeight: 700 }}>완료한 과업 선택 (여러 개 가능):</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {pending.map((t, i) => {
                      const sel = !!selectedTasks.find(s => s.id === t.id);
                      return (
                        <button key={t.id || i} onClick={() => toggleSelect(t)} style={{ padding: "8px 12px", border: `2px solid ${sel ? C.borderDk : C.border}`, background: sel ? C.lavLt : C.win, fontSize: 13, fontWeight: 700, color: C.text, cursor: "pointer", textAlign: "left", fontFamily: C.ss }}>
                          {sel ? "✅" : "⬜"} [{t.category}] {t.task}
                        </button>
                      );
                    })}
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <button onClick={completeSelected} disabled={selectedTasks.length === 0} style={{ flex: 1, padding: "8px 0", border: `2px solid ${C.borderDk}`, background: selectedTasks.length > 0 ? C.yellow : C.pinkLt, fontSize: 13, fontWeight: 700, color: C.text, cursor: selectedTasks.length > 0 ? "pointer" : "not-allowed", fontFamily: C.ss }}>
                        완료 처리 {selectedTasks.length > 0 ? "(" + selectedTasks.length + "개)" : ""}
                      </button>
                      <button onClick={() => { setCP(false); setST([]); }} style={{ padding: "8px 12px", border: `1.5px solid ${C.border}`, background: C.win, fontSize: 12, color: C.textDim, cursor: "pointer", fontFamily: C.ss }}>취소</button>
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <div style={{ borderTop: `2px solid ${C.border}`, padding: 10, display: "flex", gap: 8, alignItems: "flex-end", background: C.winDim }}>
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} placeholder="뭐든 말해." disabled={loading} rows={1} style={{ flex: 1, minWidth: 0, background: C.win, border: `2px solid ${C.border}`, padding: "10px 12px", color: C.text, fontSize: 14, fontFamily: C.ss, outline: "none", resize: "none", lineHeight: 1.6, maxHeight: "110px", overflowY: "auto" }} />
              <button onClick={reloadChat} title="데스크탑 대화 불러오기" style={{ padding: "10px 10px", border: `2px solid ${C.border}`, background: C.lavLt, fontSize: 14, fontWeight: 700, color: C.borderDk, cursor: "pointer", flexShrink: 0, fontFamily: C.ss }}>🔄</button>
              <button onClick={send} disabled={loading} style={{ padding: "10px 16px", border: `2px solid ${C.borderDk}`, background: loading ? C.pinkLt : C.yellow, fontSize: 14, fontWeight: 700, color: C.text, cursor: loading ? "not-allowed" : "pointer", flexShrink: 0, fontFamily: C.ss }}>GO</button>
            </div>
          </>)}

          {/* ── TASKS TAB ── */}
          {tab === "tasks" && (
            <div style={{ padding: 10, minHeight: 200, background: C.win }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: C.textDim, fontWeight: 700 }}>미완료 {pending.length}개</div>
                <button onClick={loadTasks} disabled={taskLoading} style={{ fontSize: 11, padding: "3px 8px", border: `1.5px solid ${C.border}`, background: C.lavLt, color: C.borderDk, cursor: "pointer", fontFamily: C.ss, fontWeight: 700 }}>{taskLoading ? "로딩중..." : "↻ 새로고침"}</button>
              </div>
              {pending.length === 0 && !showDone ? (
                <div style={{ fontSize: 14, color: C.textDim, textAlign: "center", padding: "28px 0" }}>{taskLoading ? "불러오는 중..." : "미완료 과업 없음 👊"}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
                  {pending.map((t, i) => (
                    <div key={t.id || i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: C.lavLt, border: `1.5px solid ${C.border}`, transition: "all 0.2s" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, background: C.hotpink, padding: "3px 6px", color: "#fff", flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, background: C.yellow, padding: "3px 6px", color: C.text, flexShrink: 0 }}>{t.category}</div>
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.text }}>{t.task}</div>
                      {t.date && <div style={{ fontSize: 11, color: C.textDim }}>{t.date}</div>}
                      <div onClick={() => completeTask(t)} style={{ cursor: "pointer", fontSize: 18, userSelect: "none" }}>⬜</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Completed tasks toggle */}
              {doneTasks.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <button onClick={() => setShowDone(!showDone)} style={{ width: "100%", padding: "8px 0", border: `1.5px solid ${C.border}`, background: showDone ? C.lavLt : C.winDim, fontSize: 12, fontWeight: 700, color: C.textDim, cursor: "pointer", fontFamily: C.ss }}>
                    {showDone ? "▲ 완료 숨기기" : "▼ 완료된 과업 (" + doneTasks.length + "개)"}
                  </button>
                  {showDone && (
                    <div style={{ marginTop: 8, maxHeight: 200, overflowY: "auto" }}>
                      {doneDates.map(date => (
                        <div key={date} style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, marginBottom: 4, padding: "2px 6px", background: C.winDim, borderLeft: `3px solid ${C.border}` }}>{date}</div>
                          {doneByDate[date].map((t, i) => (
                            <div key={t.id || i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: C.winDim, border: `1px solid ${C.pinkLt}`, opacity: 0.6, marginBottom: 2 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, background: C.pinkLt, padding: "2px 5px", color: C.textDim }}>{t.category}</div>
                              <div style={{ flex: 1, fontSize: 12, color: C.textDim, textDecoration: "line-through" }}>{t.task}</div>
                              <span style={{ fontSize: 14 }}>✅</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── ROUTINE TAB ── */}
          {tab === "routine" && (
            <div style={{ padding: 12, background: C.win, minHeight: 200 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 8 }}>루틴 편집 (줄바꿈으로 구분)</div>
              <textarea value={routine} onChange={e => setRoutine(e.target.value)} placeholder={"예시:\n09:00 기상 + 스트레칭\n09:30 오늘 과업 확인\n10:00 WHIF 작업\n12:00 점심\n14:00 클라이언트 대응\n18:00 운동\n22:00 내일 정리"} style={{ width: "100%", height: 280, padding: 10, border: `2px solid ${C.border}`, background: C.win, fontSize: 13, fontFamily: C.ss, color: C.text, outline: "none", resize: "none", lineHeight: 1.8 }} />
              <button onClick={saveRoutine} style={{ marginTop: 8, width: "100%", padding: 10, border: `2px solid ${C.borderDk}`, background: C.yellow, fontSize: 13, fontWeight: 700, color: C.text, cursor: "pointer", fontFamily: C.ss }}>루틴 저장</button>
            </div>
          )}

          {/* ── MEMO TAB ── */}
          {tab === "memo" && (
            <div style={{ padding: 10, background: C.win, minHeight: 200, maxHeight: 400, overflowY: "auto" }}>
              {memos.length === 0 ? (
                <div style={{ textAlign: "center", padding: "28px 0", color: C.textDim }}>메모 없음</div>
              ) : (
                memos.slice().reverse().map((m, ri) => {
                  const idx = memos.length - 1 - ri;
                  return (
                    <div key={ri} style={{ padding: "10px 12px", marginBottom: 8, border: `1.5px solid ${C.border}`, background: C.lavLt, position: "relative" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", display: "inline-block", marginBottom: 4, background: m.type === "research" ? C.hotpink : C.yellow, color: m.type === "research" ? "#fff" : C.text }}>{m.type === "research" ? "🔍 리서치" : "💭 생각"}</span>
                      <button onClick={() => setMemos(p => p.filter((_, i) => i !== idx))} style={{ position: "absolute", top: 8, right: 8, background: C.pinkLt, border: `1px solid ${C.border}`, color: C.borderDk, fontSize: 11, padding: "2px 6px", cursor: "pointer", fontFamily: C.ss, fontWeight: 700 }} title="삭제">✕</button>
                      {m.query && <div style={{ fontSize: 11, color: C.textDim, marginBottom: 2 }}>Q: {m.query}</div>}
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.text}</div>
                      {m.context && <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{m.context}</div>}
                      <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{m.time || ""}</div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── AI LAB TAB ── */}
          {tab === "orch" && (
            <div style={{ padding: 10, background: C.win }}>
              {typeof window !== "undefined" && /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent) && (
                <div style={{ padding: "8px 10px", marginBottom: 10, background: C.pinkLt, border: `1.5px solid ${C.hotpink}`, fontSize: 12, fontWeight: 700, color: C.borderDk, lineHeight: 1.5 }}>
                  ⚠ 모바일에서는 타임아웃으로 실패할 수 있어. 데스크톱 앱 추천.
                </div>
              )}
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 10 }}>
                <textarea value={orchInput} onChange={e => setOrchInput(e.target.value)} onKeyDown={onKeyOrch} placeholder="리서치할 주제를 입력해." disabled={orchLoading} rows={2} style={{ flex: 1, background: C.win, border: `2px solid ${C.border}`, padding: "10px 12px", color: C.text, fontSize: 14, fontFamily: C.ss, outline: "none", resize: "none", lineHeight: 1.6 }} />
                <button onClick={sendOrch} disabled={orchLoading} style={{ padding: "10px 16px", border: `2px solid ${C.borderDk}`, background: orchLoading ? C.pinkLt : C.yellow, fontSize: 14, fontWeight: 700, color: C.text, cursor: orchLoading ? "not-allowed" : "pointer", flexShrink: 0, fontFamily: C.ss }}>{orchLoading ? "..." : "GO"}</button>
              </div>
              {orchLoading && (
                <div style={{ textAlign: "center", padding: "30px 0", fontSize: 13, color: C.textDim }}>
                  <div style={{ marginBottom: 8, fontSize: 16 }}>🤖🤖🤖</div>
                  3개 AI가 분석 중... (최대 30초)
                </div>
              )}
              {orchResult && !orchResult.error && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 340, overflowY: "auto" }}>
                  <div style={{ background: C.lavLt, border: `2px solid ${C.lavender}`, padding: "12px 14px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.borderDk, marginBottom: 6 }}>📌 최종 결론</div>
                    <div style={{ fontSize: 14, lineHeight: 1.8, color: C.text, whiteSpace: "pre-wrap" }}>{orchResult.final}</div>
                  </div>
                  {orchResult.drafts && (
                    <details style={{ background: C.winDim, border: `1.5px solid ${C.border}`, padding: "8px 12px" }}>
                      <summary style={{ fontSize: 12, fontWeight: 700, color: C.textDim, cursor: "pointer" }}>📝 AI 초안 3종</summary>
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                        {[["Claude", orchResult.drafts.claude], ["Gemini", orchResult.drafts.gemini], ["GPT", orchResult.drafts.gpt]].map(([name, text]) => (
                          <div key={name}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: C.borderDk, marginBottom: 2 }}>{name}</div>
                            <div style={{ fontSize: 13, lineHeight: 1.7, color: C.text, whiteSpace: "pre-wrap" }}>{text}</div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  {orchResult.critics && (
                    <details style={{ background: C.winDim, border: `1.5px solid ${C.border}`, padding: "8px 12px" }}>
                      <summary style={{ fontSize: 12, fontWeight: 700, color: C.textDim, cursor: "pointer" }}>⚔️ 크리틱 로그</summary>
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                        {[["Claude (논리)", orchResult.critics.claude], ["Gemini (팩트)", orchResult.critics.gemini], ["GPT (독자)", orchResult.critics.gpt]].map(([name, text]) => (
                          <div key={name}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: C.borderDk, marginBottom: 2 }}>{name}</div>
                            <div style={{ fontSize: 13, lineHeight: 1.7, color: C.text, whiteSpace: "pre-wrap" }}>{text}</div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
              {orchResult?.error && (
                <div style={{ background: C.pinkLt, border: `1.5px solid ${C.hotpink}`, padding: "10px 12px", fontSize: 13, color: C.borderDk }}>오류: {orchResult.error}</div>
              )}
              {!orchLoading && !orchResult && (
                <div style={{ textAlign: "center", padding: "30px 0", fontSize: 13, color: C.textDim, lineHeight: 2 }}>
                  리서치/전략/콘텐츠 주제를 입력하면<br />Claude+Gemini+GPT가 협업해서 답해줘.
                </div>
              )}
            </div>
          )}
        </div>
      </div></>
  );
}
