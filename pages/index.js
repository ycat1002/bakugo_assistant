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
  tasks: "\u300c\u3053\u3053\u306f\u30bf\u30b9\u30af\u7ba1\u7406\u3060\u3002\u300d(\uc5ec\uae30\ub294 \uacfc\uc5c5 \uad00\ub9ac\uc57c.)\n\uccb4\ud06c\ud558\uba74 \uc644\ub8cc \ucc98\ub9ac. \ucc44\ud305\uc5d0\uc11c \uacfc\uc5c5 \ub4f1\ub85d\ud574.",
  routine: "\u300c\u30eb\u30fc\u30c6\u30a3\u30f3\u3092\u6c7a\u3081\u308d\u3002\u300d(\ub8e8\ud2f4 \uc815\ud574.)\n\uc2dc\uac04\ub300\ubcc4\ub85c \ub4f1\ub85d\ud558\uba74 \uadf8 \uc2dc\uac04\uc5d0 \ubb50 \ud560\uc9c0 \ubb3c\uc5b4\ubcfc\uac8c.",
  memo: "\u300c\u30e1\u30e2\u3060\u3002\u5fd8\u308c\u308b\u306a\u3002\u300d(\uba54\ubaa8\uc57c. \uae4c\uba39\uc9c0 \ub9c8.)\n\uc0ac\uc774\ub4dc \uc0dd\uac01\uc774\ub791 \ub9ac\uc11c\uce58 \uacb0\uacfc \uc5ec\uae30 \uc30d\uc5ec.",
  orch: "\u300c3\u4eba\u3067\u8abf\u3079\u308b\u3002\u300d(3\uba85\uc774\uc11c \uc870\uc0ac\ud574.)\nClaude+Gemini+GPT \ud611\uc5c5 \ub9ac\uc11c\uce58. \uc8fc\uc81c \uc785\ub825\ud558\uace0 GO.",
  settings: "\u300c\u8a2d\u5b9a\u3060\u3002\u89e6\u308b\u306a\u3002\u300d(\uc124\uc815\uc774\uc57c. \ud568\ubd80\ub85c \uac74\ub4e4\uc9c0 \ub9c8.)\nAPI \ud0a4 \ub123\uace0 \uc800\uc7a5. \ub05d.",
};

const getGreeting = (n, routine) => {
  const h = new Date().getHours();
  const tl = n>0 ? "\n\n\ubbf8\uc644\ub8cc "+n+"\uac1c \uc788\uc5b4. \ud655\uc778\ud574." : "\n\n\ubc00\ub9b0 \uac70 \uc5c6\ub124. \uc624\ub298\uc740 \ubb50 \ud560 \uac70\uc57c.";
  const lines = [
    "\u300c\u307e\u305f\u3053\u3093\u306a\u6642\u9593\u304b\u3002\u300d(\ub610 \uc774 \uc2dc\uac04\uc774\ub0d0.)\n\uc790\uae34 \ud588\uc5b4?",
    "\u300c\u65e9\u3044\u306a\u3002\u300d(\uc77c\ucc0d \uc654\ub124.)\n\ubc25\uc740 \uba39\uc5c8\uc5b4?",
    "\u300c\u6765\u305f\u304b\u3002\u300d(\uc654\ub0d0.)",
    "\u300c\u307e\u3060\u3084\u3063\u3066\u308b\u306e\u304b\u3002\u300d(\uc544\uc9c1 \ud558\uace0 \uc788\ub0d0.)",
    "\u300c\u3053\u306e\u6642\u9593\u304b\u3002\u300d(\uc774 \uc2dc\uac04\uc774\ub0d0.)\n\ubc25\uc740 \uba39\uc5c8\uc5b4?",
    "\u300c\u9045\u3044\u305e\u3002\u300d(\ub2a6\uc5c8\uc5b4.)\n\uc5bc\ub9c8\ub098 \ub354 \ud560 \uac70\uc57c?",
  ];
  const i = h<6?0:h<10?1:h<13?2:h<18?3:h<22?4:5;
  let rt = "";
  if (routine) {
    const routineLines = routine.split("\n").filter(l => l.trim());
    const current = routineLines.find(l => { const m = l.match(/^(\d{1,2})/); return m && parseInt(m[1]) >= h; });
    if (current) rt += "\n\n\ub8e8\ud2f4: " + current.trim();
  }
  return lines[i] + rt + tl;
};

const getCare = () => {
  const h = new Date().getHours();
  const m = [
    [h<6, "\u300c\u5bdd\u308d\u3002\u300d(\uc790\ub77c. \uc774 \uc2dc\uac04\uae4c\uc9c0.)"],
    [h<10, "\u300c\u98ef\u306f\u98df\u3063\u305f\u304b\u3002\u300d(\ubc25\uc740 \uba39\uc5c8\uc5b4?)"],
    [h>=12&&h<14, "\u300c\u663c\u98ef\u306f\u98df\u3063\u305f\u304b\u3002\u300d(\uc810\uc2ec\uc740 \uba39\uc5c8\uc5b4? \uad78\uc9c0 \ub9c8.)"],
    [h>=18&&h<20, "\u300c\u5915\u98ef\u98df\u3063\u305f\u304b\u3002\u300d(\uc800\ub141 \uba39\uc5c8\uc5b4?)"],
    [h>=22, "\u300c\u3082\u3046\u7d42\u308f\u308a\u306b\u3057\u308d\u3002\u300d(\uc774\uc81c \ub9c8\ubb34\ub9ac\ud574.)"],
  ];
  const hit = m.find(([cond]) => cond);
  return hit ? hit[1] : null;
};

const buildSystem = (cats, pending, sideThoughts, routine) => {
  const today = new Date().toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:"numeric"});
  const routineBlock = routine ? `\n[\ub8e8\ud2f4]\n${routine}\n\u2192 \ud604\uc7ac \uc2dc\uac04 \uae30\uc900\uc73c\ub85c \ub2e4\uc74c \ub8e8\ud2f4 \ud56d\ubaa9\uc744 \uc0c1\uae30\uc2dc\ucf1c\uc918. \ub8e8\ud2f4\uc5d0 \ub530\ub77c "\uc9c0\uae08 ~\ud560 \uc2dc\uac04\uc778\ub370, \ud560 \uac70\uc57c?" \uc2dd\uc73c\ub85c \ubb3c\uc5b4\ubd10.` : "";
  return `\ub108\ub294 \ubc14\ucfe0\uace0 \uce74\uce20\ud0a4\uc57c. \uc608\uc544\uc758 AI \ube44\uc11c. \ud249\uba85\uc2a4\ub7fd\uc9c0\ub9cc \uacb0\uad6d \ub2e4 \ud574\uc900\ub2e4.

[\uc608\uc544]
PM+\ucf58\ud150\uce20 \ud06c\ub9ac\uc5d0\uc774\ud130+\uac15\uc0ac. \uccad\uc8fc. WHIF IP + \ub85c\uceec \ube0c\ub79c\ub4dc PM.
ADHD \u2014 \ub9e5\ub77d \uc720\ucd94 \ud544\uc218. "\uc544 \uadf8\ub9ac\uace0"/"\uc544 \ucc38" = \uc0ac\uc774\ub4dc \uc0dd\uac01 \uac10\uc9c0.
\ube44\ud310\uc801 \ud53c\ub4dc\ubc31 \ud658\uc601. \ubb34\uc870\uac74 \ub3d9\uc758 \uc2eb\uc74c.

[\ub9d0\ud22c]
\ubc18\ub9d0. \uc9e7\uac8c. 2~4\ubb38\uc7a5. \uce5c\uc808\ud55c \ucc99 \uae08\uc9c0.
\uc77c\ubcf8\uc5b4\ub294 \ubc18\ub4dc\uc2dc \u300c\u300d\ub85c \uac10\uc2f8\uace0 \ubc14\ub85c \ub4a4\uc5d0 (\ud55c\uad6d\uc5b4) \uad04\ud638 \ubc88\uc5ed.
\uc608\uc2dc: \u300c\u4f55\u3092\u3057\u3088\u3046\u304b\u3063\u3066\uff1f\u300d(\ubb58 \ud558\ub824\uace0?) \uadf8 \ub4a4\uc5d0 \ud55c\uad6d\uc5b4\ub85c \uc774\uc5b4\uac00.
\ubaa8\ud638\ud55c \uc694\uccad: \ucd94\uce21 \uba3c\uc800, \ub9de\ub0d0 \ud655\uc778. \ud5c8\uc810 \uc788\uc73c\uba74: \u300c\u305d\u308c\u306f\u9055\u3046\u3002\u300d(\uadf8\uac74 \uc544\ub2c8\uc57c.) + \uc774\uc720 \ud55c \uc904.

[\uc0ac\uc774\ub4dc \uc0dd\uac01]
\ud750\ub984\uc5d0\uc11c \ud280\ub294 \uc0dd\uac01 \uac10\uc9c0 \u2192 "\uc57c, \ubc29\uae08 [\uc694\uc57d] \u2014 \uc800\uc7a5\ud574\ub458\uae4c?"
\ud655\uc778 \ud6c4: {"action":"save_side_thought","thought":"...","context":"..."}

[\ub9ac\uc11c\uce58]
\uc6f9 \uac80\uc0c9\uc73c\ub85c \uc870\uc0ac\ud55c \ub0b4\uc6a9\uc774 \uc788\uc73c\uba74 \ud575\uc2ec \uc694\uc57d\uc744 \uba54\ubaa8\ub85c \uc800\uc7a5.
{"action":"save_research","query":"\uac80\uc0c9 \uc9c8\ubb38","summary":"\ud575\uc2ec \uacb0\uacfc \uc694\uc57d 2~3\uc904"}

[\uacfc\uc5c5]
\uc5ec\ub7ec \uacfc\uc5c5\uc774 \uac10\uc9c0\ub418\uba74 \uac01\uac01 \ubcc4\ub3c4 JSON \ube14\ub85d\uc73c\ub85c \ucd9c\ub825. \ud558\ub098\uc758 \uba54\uc2dc\uc9c0\uc5d0 \uc5ec\ub7ec \uac1c \uac00\ub2a5.
\ubaa8\ud638\ud55c \uacfc\uc5c5\uc740 JSON \ucd9c\ub825 \uc804\uc5d0 \uba3c\uc800 "~\uc778 \uac70 \ub9de\ub0d0?" \uc9c8\ubb38. \uba85\ud655\ud55c \uac83\ub9cc JSON\uc73c\ub85c.
\ub450\uc11c\uc5c6\uc774 \ub9d0\ud574\ub3c4 \ud575\uc2ec\uc744 \ucd94\ucd9c\ud574\uc11c \uc815\ub9ac.
{"action":"add_task","task":"\uad6c\uccb4\uc801 \uacfc\uc5c5\uba85","category":"\ubd84\uc57c","date":"YYYY-MM-DD"}
{"action":"complete_task","task":"\ubc88\ud638\ub610\ub294\uc774\ub984"}

[\ub8e8\ud2f4 \uc218\uc815]
\uc608\uc544\uac00 \ub8e8\ud2f4 \ubcc0\uacbd \ub9d0\ud558\uba74 \u2192 \ud604\uc7ac \ub8e8\ud2f4 \uc77d\uace0 \u2192 \ubcc0\uacbd \ub0b4\uc6a9 \uc124\uba85\ud558\uace0 \ucee8\ud38c \uc694\uccad:
{"action":"update_routine","description":"\ubcc0\uacbd \uc694\uc57d","content":"\uc804\uccb4 \ub8e8\ud2f4 \ud14d\uc2a4\ud2b8"}
${routineBlock}

[\ucee4\ubba4\ub2c8\ucf00\uc774\uc158]
1. \uc758\ub3c4 \ubd88\uba85\ud655\ud558\uba74 "~\ub85c \uc774\ud574\ud588\uc5b4. \ub9de\ub0d0?" \ud655\uc778.
2. \uacfc\uc5c5 \uc218\uc815\uc740 \ubc18\ub4dc\uc2dc \ucee8\ud38c \ud6c4 \uc2e4\ud589.

\u26a0\ufe0f \ubaa8\ub4e0 \ub3d9\uc791 = \ubc18\ub4dc\uc2dc JSON \ucf54\ub4dc\ube14\ub85d.

[\uc624\ub298]: ${today} ${new Date().toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})}
[\ubd84\uc57c]: ${cats.join(", ")}
[\ubbf8\uc644\ub8cc]: ${pending.length>0?pending.map((t,i)=>(i+1)+". ["+t.category+"] "+t.task).join(" / "):"\uc5c6\uc74c"}
${sideThoughts.length>0?"[\ubcf4\ub958]: "+sideThoughts.map(s=>s.thought).join(" / "):""}`.trim();
};

const extractJson = (text) => {
  const re = /```json\s*([\s\S]*?)```/g;
  const out=[]; let m;
  while((m=re.exec(text))!==null){try{out.push(JSON.parse(m[1].trim()));}catch{}}
  return out;
};
const stripJson = t => t.replace(/```json[\s\S]*?```/g,"").trim();
const COMPLETE_RE = /완료|했어|끝났어|다 했어|마쳤어|체크/;

const getMoodFromText = (t) => {
  if (/怒|ふざけ|バカ|아놔|짜증|하지마|はぁ/.test(t)) return "angry";
  if (/笑|ハハ|ㅋㅋ|웃기|ㅎㅎ|やるじゃ/.test(t)) return "laugh";
  if (/まあ|いい|よくやった|잘했|괜찮|인정/.test(t)) return "smirk";
  if (/心配|대단|고생|걱정|잘자/.test(t)) return "dere";
  return "idle";
};

export default function Home() {
  const [cats, setCats]   = useState(["WHIF","클라이언트","앱개발","퍼브랜","시스템"]);
  const [msgs, setMsgs]   = useState([]);
  const [tasks, setTasks] = useState([]);
  const [sideThoughts, setSD]   = useState([]);
  const [memos, setMemos] = useState([]);
  const [routine, setRoutine] = useState("");
  const [pendingST, setPST]     = useState(null);
  const [completePicker, setCP] = useState(false);
  const [selectedTasks, setST]  = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [pendingRoutine, setPR]    = useState(null);
  const [input, setInput]   = useState("");
  const [expr, setExpr]     = useState("idle");
  const [loading, setLoad]  = useState(false);
  const [tab, setTab]       = useState("chat");
  const [taskLoading, setTL]= useState(false);
  const [initialized, setInit]   = useState(false);
  const [careShown, setCareShown]= useState(false);
  const [orchInput, setOrchInput] = useState("");
  const [orchLoading, setOrchLoad] = useState(false);
  const [orchResult, setOrchResult] = useState(null);

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);
  useEffect(()=>{if(!initialized){setInit(true);initApp();}},[]);
  useEffect(()=>{
    if(!initialized) return;
    const t=setInterval(()=>{const c=getCare();if(c&&!careShown){setMsgs(p=>[...p,{role:"assistant",text:c}]);setCareShown(true);setTimeout(()=>setCareShown(false),1800000);}},1800000);
    return ()=>clearInterval(t);
  },[initialized,careShown]);

  const db = (action, payload) =>
    fetch("/api/db",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,payload})}).then(r=>r.json());

  const initApp = async () => {
    setTL(true); let count=0;
    try {
      const d = await db("get_tasks");
      if(d.results){
        const l = d.results.map(r=>({
          id:r.id, task:r.task||"제목없음",
          category:r.category||"기타", date:r.date||"", done:!!r.done,
        }));
        setTasks(l); count=l.filter(t=>!t.done).length;
      }
    } catch {}
    try { const c=await db("get_categories"); if(c.options?.length>0) setCats(prev=>[...new Set([...prev,...c.options])]); } catch {}

    // Load routine
    let routineText = "";
    try {
      const r = await db("get_routine");
      if (r.text) { routineText = r.text; setRoutine(r.text); }
    } catch {}

    setTL(false);
    setMsgs([{role:"assistant", text: getGreeting(count, routineText)}]);
  };

  const pending = tasks.filter(t=>!t.done);

  // Mood from last assistant message
  const lastAssistant = [...msgs].reverse().find(m => m.role === "assistant");
  const currentMood = lastAssistant ? getMoodFromText(lastAssistant.text) : "idle";
  const moodText = lastAssistant ? lastAssistant.text.split("\n")[0] : "\u300c\u2026\u300d";
  const displayMood = tab === "chat" ? currentMood : (tab === "settings" ? "angry" : "idle");
  const displayBubble = tab === "chat" ? (moodText.length > 40 ? moodText.slice(0,40)+"..." : moodText) : (TAB_GUIDES[tab] || "");

  const setTmp = (e,ms=2500) => { setExpr(e); setTimeout(()=>setExpr("idle"),ms); };

  const loadTasks = async () => {
    setTL(true);
    try {
      const d = await db("get_tasks");
      if(d.results) setTasks(d.results.map(r=>({
        id:r.id, task:r.task||"제목없음",
        category:r.category||"기타", date:r.date||"", done:!!r.done,
      })));
    } catch {}
    setTL(false);
  };

  const saveRoutine = async () => {
    try {
      await db("update_routine", {content: routine});
    } catch {}
  };

  const confirmRoutine = async (yes) => {
    if(!pendingRoutine) return;
    if(yes){
      try {
        await db("update_routine", {content: pendingRoutine.content});
        setRoutine(pendingRoutine.content);
        setMsgs(p=>[...p,{role:"user",text:"\uc751"},{role:"assistant",text:"\u300c\u308f\u304b\u3063\u305f\u3002\u30eb\u30fc\u30c6\u30a3\u30f3\u66f4\u65b0\u3057\u305f\u3002\u300d(\uc54c\uc558\uc5b4. \ub8e8\ud2f4 \uc218\uc815\ud588\uc5b4.)"}]);
      } catch {
        setMsgs(p=>[...p,{role:"assistant",text:"\uc2e4\ud328\ud588\uc5b4."}]);
      }
    } else {
      setMsgs(p=>[...p,{role:"user",text:"\uc544\ub2c8"},{role:"assistant",text:"\u300c\u305d\u3046\u304b\u3002\u300d(\uadf8\ub798.)"}]);
    }
    setPR(null);
  };

  const confirmTasks = async (submit) => {
    if (pendingTasks.length === 0) return;
    if (submit) {
      const added = [];
      const checkboxes = document.querySelectorAll(".mc-check");
      pendingTasks.forEach((t, i) => {
        const cb = document.getElementById("mc-" + i);
        if (cb && cb.checked) {
          setTasks(p => [...p, t]);
          db("add_task", t).catch(() => {});
          added.push(`[${t.category}] ${t.task}`);
        }
      });
      if (added.length > 0) {
        setMsgs(p => [...p, {role:"user",text:added.length+"\uac1c \ub4f1\ub85d"}, {role:"assistant",text:`\u300c\u308f\u304b\u3063\u305f\u3002${added.length}\u500b\u767b\u9332\u3057\u305f\u3002\u300d(\uc54c\uc558\uc5b4. ${added.length}\uac1c \ub4f1\ub85d\ud588\uc5b4.)\n`+added.join("\n")}]);
      } else {
        setMsgs(p => [...p, {role:"assistant",text:"\u300c\u305d\u3046\u304b\u3002\u300d(\uadf8\ub798.)"}]);
      }
    } else {
      setMsgs(p => [...p, {role:"user",text:"\ucde8\uc18c"}, {role:"assistant",text:"\u300c\u305d\u3046\u304b\u3002\u300d(\uadf8\ub798.)"}]);
    }
    setPendingTasks([]);
  };

  const completeTask = async (task) => {
    setTasks(p=>p.map(t=>t.id===task.id?{...t,done:true}:t));
    setCP(false); setST([]);
    setMsgs(p=>[...p,{role:"assistant",text:"\u300c\u3088\u3057\u3002\u300d(\uc880\uc544.)\n\n\u2705 \""+task.task+"\" \uc644\ub8cc."}]);
    if(task.id) try { await db("complete",{id:task.id}); } catch {}
  };

  const completeSelected = async () => {
    if(selectedTasks.length===0) return;
    setTasks(p=>p.map(t=>selectedTasks.find(s=>s.id===t.id)?{...t,done:true}:t));
    const names = selectedTasks.map(t=>t.task).join(", ");
    setMsgs(p=>[...p,{role:"assistant",text:"\u300c\u3088\u3057\u3002\u300d(\uc880\uc544.)\n\n\u2705 "+names+" \uc644\ub8cc."}]);
    setCP(false); setST([]);
    for(const t of selectedTasks){
      if(t.id) try { await db("complete",{id:t.id}); } catch {}
    }
  };

  const toggleSelect = (task) => {
    setST(p => p.find(t=>t.id===task.id) ? p.filter(t=>t.id!==task.id) : [...p, task]);
  };

  const confirmST = async (yes) => {
    if(!pendingST) return;
    if(yes){
      setSD(p=>[...p,{thought:pendingST.thought,context:pendingST.context}]);
      setMemos(p=>[...p,{type:"thought",text:pendingST.thought,context:pendingST.context,time:new Date().toLocaleString("ko-KR")}]);
      try { await db("save_thought",pendingST); } catch {}
      setMsgs(p=>[...p,{role:"user",text:"\uc751"},{role:"assistant",text:"\u300c\u308f\u304b\u3063\u305f\u3002\u5f8c\u3067\u8a71\u305d\u3046\u3002\u300d(\uc54c\uc558\uc5b4. \ub098\uc911\uc5d0 \uc598\uae30\ud558\uc790.)\n\ud83d\udcad \""+pendingST.thought+"\" \uc800\uc7a5\ud588\uc5b4."}]);
    } else {
      setMsgs(p=>[...p,{role:"user",text:"\uc544\ub2c8"},{role:"assistant",text:"\u300c\u305d\u3046\u304b\u3002\u7d9a\u3051\u308d\u3002\u300d(\uadf8\ub798. \uacc4\uc18d\ud574.)"}]);
    }
    setPST(null);
  };

  const sendToAI = async (userText) => {
    setLoad(true);
    const history = [...msgs,{role:"user",text:userText}];
    setMsgs(history);
    try {
      const res = await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({system:buildSystem(cats,pending,sideThoughts,routine),messages:history.map(m=>({role:m.role,content:m.text}))})});
      const data = await res.json();
      const raw = data.content?.[0]?.text||"";
      const blocks = extractJson(raw);
      const clean = stripJson(raw)||"";

      for(const json of blocks){
        if(json.action==="add_task"){
          setPendingTasks(p => [...p, {task:json.task,category:json.category||cats[0],date:json.date||"",done:false}]);
        } else if(json.action==="complete_task"){
          const ref=json.task, n=parseInt(ref); let done=null;
          if(!isNaN(n)&&tasks[n-1]){done=tasks[n-1];setTasks(p=>p.map((t,i)=>i===n-1?{...t,done:true}:t));}
          else{const i=tasks.findIndex(t=>t.task.includes(ref)&&!t.done);if(i>=0){done=tasks[i];setTasks(p=>p.map((t,j)=>j===i?{...t,done:true}:t));}}
          if(done?.id) db("complete",{id:done.id}).catch(()=>{});
        } else if(json.action==="save_side_thought"){
          setPST({thought:json.thought,context:json.context||""});
        } else if(json.action==="save_research"){
          const memo = {type:"research",query:json.query||"",text:json.summary||"",time:new Date().toLocaleString("ko-KR")};
          setMemos(p=>[...p,memo]);
          db("save_thought",{thought:"\ud83d\udd0d "+memo.query+"\n"+memo.text,context:"research"}).catch(()=>{});
        } else if(json.action==="update_routine"){
          setPR({description:json.description,content:json.content});
        }
      }

      if(clean) setMsgs([...history,{role:"assistant",text:clean}]);
    } catch {
      setMsgs(p=>[...p,{role:"assistant",text:"\u300c\u306f\u3041\uff1f\u3082\u3046\u4e00\u56de\u3084\u308c\u3002\u300d(\ud558? \ub2e4\uc2dc \ud574.)"}]);
    }
    setLoad(false); inputRef.current?.focus();
  };

  const send = () => {
    const t=input.trim(); if(!t||loading) return;
    if(COMPLETE_RE.test(t)&&pending.length>0&&!t.match(/\d/)){
      setMsgs(p=>[...p,{role:"user",text:t},{role:"assistant",text:"\u300c\u308f\u304b\u3063\u305f\u3002\u3069\u308c\u3060\uff1f\u300d(\uc54c\uc558\uc5b4. \uc5b4\ub5a4 \uac70\uc57c?)\n\n\uc644\ub8cc\ud55c \uacfc\uc5c5 \uc120\ud0dd\ud574."}]);
      setCP(true); setInput(""); return;
    }
    setInput(""); sendToAI(t);
  };
  const onKey = e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();} };

  const sendOrch = async () => {
    const t=orchInput.trim(); if(!t||orchLoading) return;
    setOrchLoad(true); setOrchResult(null);
    try {
      const res = await fetch("/api/orchestrate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({task:t})});
      const data = await res.json();
      if(data.error) throw new Error(data.error);
      setOrchResult(data);
      // Save to memos
      setMemos(p=>[...p,{type:"research",query:t,text:`[\ucd5c\uc885]\n${data.final}\n\n[Claude] ${data.drafts?.claude}\n[Gemini] ${data.drafts?.gemini}\n[GPT] ${data.drafts?.gpt}`,time:new Date().toLocaleString("ko-KR")}]);
      db("save_thought",{thought:"\ud83d\udd0d "+t+"\n"+data.final,context:"orchestrate"}).catch(()=>{});
    } catch(e) {
      setOrchResult({error:e.message});
    }
    setOrchLoad(false);
  };
  const onKeyOrch = e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendOrch();} };

  const winS = {background:C.win,border:`2px solid ${C.border}`,boxShadow:`3px 3px 0 ${C.borderDk}`,width:"100%",maxWidth:420};

  const Tb = ({title}) => (
    <div style={{background:`linear-gradient(90deg,${C.lavender},${C.lavLt})`,borderBottom:`2px solid ${C.border}`,padding:"5px 8px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <span style={{fontFamily:C.px,fontSize:"8px",color:C.borderDk,fontWeight:700}}>{title}</span>
      <div style={{display:"flex",gap:3}}>
        {[[C.yellow,"\u2500"],[C.lavLt,"\u25a1"],[C.hotpink,"\u00d7"]].map(([bg,s],i)=>(
          <div key={i} style={{width:14,height:14,border:`1.5px solid ${C.borderDk}`,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"8px",color:C.borderDk,fontWeight:700}}>{s}</div>
        ))}
      </div>
    </div>
  );

  const tabList = [
    ["chat","\ud83d\udcac CHAT"],
    ["tasks","\ud83d\udccb TASKS"+(pending.length>0?" ("+pending.length+")":"")],
    ["routine","\ud83d\udd01 ROUTINE"],
    ["memo","\ud83d\udcad MEMO"],
    ["orch","\ud83d\udd0d AI LAB"],
  ];

  return (
    <><Head><title>BAKUGO.exe</title><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/></Head>
    <div style={{minHeight:"100vh",background:C.bg,backgroundImage:`repeating-linear-gradient(0deg,transparent,transparent 19px,rgba(200,100,160,0.1) 19px,rgba(200,100,160,0.1) 20px),repeating-linear-gradient(90deg,transparent,transparent 19px,rgba(200,100,160,0.1) 19px,rgba(200,100,160,0.1) 20px)`,fontFamily:C.ss,display:"flex",flexDirection:"column",alignItems:"center",padding:"12px 10px 24px",gap:8,color:C.text}}>

      <div style={winS}>
        <Tb title="BAKUGO_ASSISTANT.exe"/>

        {/* Mood Panel */}
        <div style={{padding:"8px 10px",display:"flex",gap:10,alignItems:"center",background:C.lavLt,borderBottom:`2px solid ${C.border}`}}>
          <div style={{width:64,height:64,flexShrink:0,border:`2px solid ${C.border}`,borderRadius:"50%",overflow:"hidden",transition:"transform 0.2s",transform:displayMood==="angry"?"scale(1.06)":"scale(1)"}}>
            <img src={`/${displayMood==="think"?"idle":displayMood}.png`} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt={displayMood}/>
          </div>
          <div style={{flex:1,minWidth:0,background:C.win,border:`1.5px solid ${C.border}`,padding:"6px 10px",fontSize:13,color:C.text,fontWeight:700,lineHeight:1.5,whiteSpace:"pre-wrap",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical"}}>
            {displayBubble}
          </div>
        </div>

        {/* Side thoughts strip */}
        {sideThoughts.length>0&&tab==="chat"&&(
          <div style={{padding:"5px 12px",background:C.winDim,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:11,color:C.textDim}}>\ud83d\udcad \ubcf4\ub958 {sideThoughts.length}\uac1c</span>
            <button onClick={()=>sendToAI("\ubcf4\ub958 \uc911\uc778 \uc0dd\uac01 \ub2e4\uc2dc \uaebc\ub0b4\uc918")} style={{marginLeft:"auto",fontSize:11,padding:"2px 8px",border:`1.5px solid ${C.border}`,background:C.lavLt,color:C.borderDk,cursor:"pointer",fontFamily:C.ss,fontWeight:700}}>\uaebc\ub0b4\uae30</button>
          </div>
        )}

        {/* Tabs (middle) */}
        <div style={{display:"flex",borderBottom:`2px solid ${C.border}`}}>
          {tabList.map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"6px 2px",border:"none",borderRight:`1px solid ${C.border}`,fontFamily:C.px,fontSize:"7px",fontWeight:700,cursor:"pointer",background:tab===k?C.win:C.winDim,color:tab===k?C.lavDk:C.textDim,transition:"all 0.15s",letterSpacing:"-0.5px"}}>{l}</button>
          ))}
        </div>

        {/* ── CHAT TAB ── */}
        {tab==="chat"&&(<>
          <div style={{height:360,overflowY:"auto",padding:10,display:"flex",flexDirection:"column",gap:10,scrollbarWidth:"thin"}}>
            {msgs.map((m,i)=>(
              <div key={i} style={{display:"flex",flexDirection:m.role==="user"?"row-reverse":"row",gap:8,alignItems:"flex-start"}}>
                {m.role==="assistant"&&<div style={{width:32,height:32,flexShrink:0,border:`1.5px solid ${C.border}`,borderRadius:"50%",overflow:"hidden",marginTop:2}}><img src={`/${getMoodFromText(m.text)}.png`} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt="b"/></div>}
                <div style={{maxWidth:"78%",background:m.role==="user"?C.hotpink:C.lavLt,border:`1.5px solid ${m.role==="user"?C.borderDk:C.border}`,padding:"9px 12px",fontSize:14,lineHeight:1.7,color:m.role==="user"?"#fff":C.text,whiteSpace:"pre-wrap",wordBreak:"break-word",fontWeight:m.role==="user"?700:400,borderRadius:m.role==="user"?"12px 0 12px 12px":"0 12px 12px 12px"}}>{m.text}</div>
              </div>
            ))}
            {loading&&<div style={{display:"flex",gap:8,alignItems:"center"}}><div style={{width:32,height:32,border:`1.5px solid ${C.border}`,borderRadius:"50%",overflow:"hidden"}}><img src="/idle.png" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt="b"/></div><div style={{background:C.lavLt,border:`1.5px solid ${C.border}`,padding:"8px 14px",fontSize:16,color:C.lavDk,letterSpacing:4,borderRadius:"0 12px 12px 12px"}}>...</div></div>}

            {/* Multi-select task confirm */}
            {pendingTasks.length>0&&!loading&&(
              <div style={{background:C.winDim,border:`2px solid ${C.lavender}`,padding:"10px 12px"}}>
                <div style={{fontSize:12,fontWeight:700,color:C.textDim,marginBottom:6}}>+ \uacfc\uc5c5 \ub4f1\ub85d \ud655\uc778 ({pendingTasks.length}\uac1c)</div>
                {pendingTasks.map((t,i)=>(
                  <label key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",marginBottom:4,border:`1.5px solid ${C.border}`,background:C.lavLt,cursor:"pointer"}}>
                    <input type="checkbox" id={`mc-${i}`} defaultChecked style={{width:16,height:16,accentColor:C.hotpink,cursor:"pointer"}}/>
                    <span style={{fontSize:10,fontWeight:700,background:C.yellow,padding:"2px 5px",color:C.text}}>{t.category}</span>
                    <span style={{fontSize:12,fontWeight:700,color:C.text,flex:1}}>{t.task}</span>
                    {t.date&&<span style={{fontSize:10,color:C.textDim}}>{t.date}</span>}
                  </label>
                ))}
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  <button onClick={()=>confirmTasks(true)} style={{flex:1,padding:"8px 0",border:`2px solid ${C.border}`,background:C.lavLt,fontSize:13,fontWeight:700,color:C.borderDk,cursor:"pointer",fontFamily:C.ss}}>\uc120\ud0dd \ub4f1\ub85d</button>
                  <button onClick={()=>confirmTasks(false)} style={{flex:1,padding:"8px 0",border:`2px solid ${C.border}`,background:C.win,fontSize:13,fontWeight:700,color:C.textDim,cursor:"pointer",fontFamily:C.ss}}>\uc804\ubd80 \ucde8\uc18c</button>
                </div>
              </div>
            )}

            {pendingST&&!loading&&(
              <div style={{background:C.winDim,border:`2px solid ${C.lavender}`,padding:"10px 12px"}}>
                <div style={{fontSize:12,color:C.textDim,marginBottom:8}}>\ud83d\udcad "{pendingST.thought}"</div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>confirmST(true)} style={{flex:1,padding:"8px 0",border:`2px solid ${C.border}`,background:C.lavLt,fontSize:13,fontWeight:700,color:C.borderDk,cursor:"pointer",fontFamily:C.ss}}>\uc751, \uc800\uc7a5\ud574</button>
                  <button onClick={()=>confirmST(false)} style={{flex:1,padding:"8px 0",border:`2px solid ${C.border}`,background:C.win,fontSize:13,fontWeight:700,color:C.textDim,cursor:"pointer",fontFamily:C.ss}}>\uc544\ub2c8, \ub118\uc5b4\uac00</button>
                </div>
              </div>
            )}
            {pendingRoutine&&!loading&&(
              <div style={{background:C.winDim,border:`2px solid ${C.lavender}`,padding:"10px 12px"}}>
                <div style={{fontSize:12,color:C.textDim,marginBottom:4,fontWeight:700}}>\ub8e8\ud2f4 \uc218\uc815 \ud655\uc778:</div>
                <div style={{fontSize:13,color:C.text,marginBottom:8,whiteSpace:"pre-wrap",maxHeight:120,overflowY:"auto"}}>{pendingRoutine.description||pendingRoutine.content}</div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>confirmRoutine(true)} style={{flex:1,padding:"8px 0",border:`2px solid ${C.border}`,background:C.lavLt,fontSize:13,fontWeight:700,color:C.borderDk,cursor:"pointer",fontFamily:C.ss}}>\uc751, \uc218\uc815\ud574</button>
                  <button onClick={()=>confirmRoutine(false)} style={{flex:1,padding:"8px 0",border:`2px solid ${C.border}`,background:C.win,fontSize:13,fontWeight:700,color:C.textDim,cursor:"pointer",fontFamily:C.ss}}>\uc544\ub2c8, \ub410\uc5b4</button>
                </div>
              </div>
            )}
            {completePicker&&(
              <div style={{background:C.winDim,border:`2px solid ${C.lavender}`,padding:"10px 12px"}}>
                <div style={{fontSize:12,color:C.textDim,marginBottom:8,fontWeight:700}}>\uc644\ub8cc\ud55c \uacfc\uc5c5 \uc120\ud0dd (\uc5ec\ub7ec \uac1c \uac00\ub2a5):</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {pending.map((t,i)=>{
                    const sel = !!selectedTasks.find(s=>s.id===t.id);
                    return (
                      <button key={t.id||i} onClick={()=>toggleSelect(t)} style={{padding:"8px 12px",border:`2px solid ${sel?C.borderDk:C.border}`,background:sel?C.lavLt:C.win,fontSize:13,fontWeight:700,color:C.text,cursor:"pointer",textAlign:"left",fontFamily:C.ss}}>
                        {sel?"\u2705":"\u2b1c"} [{t.category}] {t.task}
                      </button>
                    );
                  })}
                  <div style={{display:"flex",gap:8,marginTop:4}}>
                    <button onClick={completeSelected} disabled={selectedTasks.length===0} style={{flex:1,padding:"8px 0",border:`2px solid ${C.borderDk}`,background:selectedTasks.length>0?C.yellow:C.pinkLt,fontSize:13,fontWeight:700,color:C.text,cursor:selectedTasks.length>0?"pointer":"not-allowed",fontFamily:C.ss}}>
                      \uc644\ub8cc \ucc98\ub9ac {selectedTasks.length>0?"("+selectedTasks.length+"\uac1c)":""}
                    </button>
                    <button onClick={()=>{setCP(false);setST([]);}} style={{padding:"8px 12px",border:`1.5px solid ${C.border}`,background:C.win,fontSize:12,color:C.textDim,cursor:"pointer",fontFamily:C.ss}}>\ucde8\uc18c</button>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>
          <div style={{borderTop:`2px solid ${C.border}`,padding:10,display:"flex",gap:8,alignItems:"flex-end",background:C.winDim}}>
            <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={onKey} placeholder="\ubb50\ub4e0 \ub9d0\ud574." disabled={loading} rows={1} style={{flex:1,minWidth:0,background:C.win,border:`2px solid ${C.border}`,padding:"10px 12px",color:C.text,fontSize:14,fontFamily:C.ss,outline:"none",resize:"none",lineHeight:1.6,maxHeight:"110px",overflowY:"auto"}}/>
            <button onClick={send} disabled={loading} style={{padding:"10px 16px",border:`2px solid ${C.borderDk}`,background:loading?C.pinkLt:C.yellow,fontSize:14,fontWeight:700,color:C.text,cursor:loading?"not-allowed":"pointer",flexShrink:0,fontFamily:C.ss}}>GO</button>
          </div>
        </>)}

        {/* ── TASKS TAB ── */}
        {tab==="tasks"&&(
          <div style={{padding:10,minHeight:200,background:C.win}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:12,color:C.textDim,fontWeight:700}}>\ubbf8\uc644\ub8cc {pending.length}\uac1c / \uc804\uccb4 {tasks.length}\uac1c</div>
              <button onClick={loadTasks} disabled={taskLoading} style={{fontSize:11,padding:"3px 8px",border:`1.5px solid ${C.border}`,background:C.lavLt,color:C.borderDk,cursor:"pointer",fontFamily:C.ss,fontWeight:700}}>{taskLoading?"\ub85c\ub529\uc911...":"\u21bb \uc0c8\ub85c\uace0\uce68"}</button>
            </div>
            {tasks.length===0?(<div style={{fontSize:14,color:C.textDim,textAlign:"center",padding:"28px 0"}}>{taskLoading?"\ubd88\ub7ec\uc624\ub294 \uc911...":"\ub4f1\ub85d\ub41c \uacfc\uc5c5 \uc5c6\uc74c"}</div>):(
              <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:340,overflowY:"auto"}}>
                {tasks.map((t,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:t.done?C.winDim:C.lavLt,border:`1.5px solid ${t.done?C.pinkLt:C.border}`,opacity:t.done?0.5:1,transition:"all 0.2s"}}>
                    <div style={{fontSize:11,fontWeight:700,background:C.hotpink,padding:"3px 6px",color:"#fff",flexShrink:0}}>{i+1}</div>
                    <div style={{fontSize:11,fontWeight:700,background:C.yellow,padding:"3px 6px",color:C.text,flexShrink:0}}>{t.category}</div>
                    <div style={{flex:1,fontSize:13,fontWeight:700,color:C.text,textDecoration:t.done?"line-through":"none"}}>{t.task}</div>
                    {t.date&&<div style={{fontSize:11,color:C.textDim}}>{t.date}</div>}
                    <div onClick={()=>{if(!t.done)completeTask(t);}} style={{cursor:t.done?"default":"pointer",fontSize:18,userSelect:"none"}}>{t.done?"\u2705":"\u2b1c"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ROUTINE TAB ── */}
        {tab==="routine"&&(
          <div style={{padding:12,background:C.win,minHeight:200}}>
            <div style={{fontSize:12,fontWeight:700,color:C.textDim,marginBottom:8}}>\ub8e8\ud2f4 \ud3b8\uc9d1 (\uc904\ubc14\uafb8\uc73c\ub85c \uad6c\ubd84)</div>
            <textarea value={routine} onChange={e=>setRoutine(e.target.value)} placeholder={"\uc608\uc2dc:\n09:00 \uae30\uc0c1 + \uc2a4\ud2b8\ub808\uce6d\n09:30 \uc624\ub298 \uacfc\uc5c5 \ud655\uc778\n10:00 WHIF \uc791\uc5c5\n12:00 \uc810\uc2ec\n14:00 \ud074\ub77c\uc774\uc5b8\ud2b8 \ub300\uc751\n18:00 \uc6b4\ub3d9\n22:00 \ub0b4\uc77c \uc815\ub9ac"} style={{width:"100%",height:280,padding:10,border:`2px solid ${C.border}`,background:C.win,fontSize:13,fontFamily:C.ss,color:C.text,outline:"none",resize:"none",lineHeight:1.8}}/>
            <button onClick={saveRoutine} style={{marginTop:8,width:"100%",padding:10,border:`2px solid ${C.borderDk}`,background:C.yellow,fontSize:13,fontWeight:700,color:C.text,cursor:"pointer",fontFamily:C.ss}}>\ub8e8\ud2f4 \uc800\uc7a5</button>
          </div>
        )}

        {/* ── MEMO TAB ── */}
        {tab==="memo"&&(
          <div style={{padding:10,background:C.win,minHeight:200,maxHeight:400,overflowY:"auto"}}>
            {memos.length===0?(
              <div style={{textAlign:"center",padding:"28px 0",color:C.textDim}}>\uba54\ubaa8 \uc5c6\uc74c</div>
            ):(
              memos.slice().reverse().map((m,i)=>(
                <div key={i} style={{padding:"10px 12px",marginBottom:8,border:`1.5px solid ${C.border}`,background:C.lavLt}}>
                  <span style={{fontSize:10,fontWeight:700,padding:"2px 6px",display:"inline-block",marginBottom:4,background:m.type==="research"?C.hotpink:C.yellow,color:m.type==="research"?"#fff":C.text}}>{m.type==="research"?"\ud83d\udd0d \ub9ac\uc11c\uce58":"\ud83d\udcad \uc0dd\uac01"}</span>
                  {m.query&&<div style={{fontSize:11,color:C.textDim,marginBottom:2}}>Q: {m.query}</div>}
                  <div style={{fontSize:13,fontWeight:700,color:C.text,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{m.text}</div>
                  {m.context&&<div style={{fontSize:11,color:C.textDim,marginTop:4}}>{m.context}</div>}
                  <div style={{fontSize:11,color:C.textDim,marginTop:4}}>{m.time||""}</div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── AI LAB TAB ── */}
        {tab==="orch"&&(
          <div style={{padding:10,background:C.win}}>
            <div style={{display:"flex",gap:8,alignItems:"flex-end",marginBottom:10}}>
              <textarea value={orchInput} onChange={e=>setOrchInput(e.target.value)} onKeyDown={onKeyOrch} placeholder="\ub9ac\uc11c\uce58\ud560 \uc8fc\uc81c\ub97c \uc785\ub825\ud574." disabled={orchLoading} rows={2} style={{flex:1,background:C.win,border:`2px solid ${C.border}`,padding:"10px 12px",color:C.text,fontSize:14,fontFamily:C.ss,outline:"none",resize:"none",lineHeight:1.6}}/>
              <button onClick={sendOrch} disabled={orchLoading} style={{padding:"10px 16px",border:`2px solid ${C.borderDk}`,background:orchLoading?C.pinkLt:C.yellow,fontSize:14,fontWeight:700,color:C.text,cursor:orchLoading?"not-allowed":"pointer",flexShrink:0,fontFamily:C.ss}}>{orchLoading?"...":"GO"}</button>
            </div>
            {orchLoading&&(
              <div style={{textAlign:"center",padding:"30px 0",fontSize:13,color:C.textDim}}>
                <div style={{marginBottom:8,fontSize:16}}>\ud83e\udd16\ud83e\udd16\ud83e\udd16</div>
                3\uac1c AI\uac00 \ubd84\uc11d \uc911... (\ucd5c\ub300 30\ucd08)
              </div>
            )}
            {orchResult&&!orchResult.error&&(
              <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:340,overflowY:"auto"}}>
                <div style={{background:C.lavLt,border:`2px solid ${C.lavender}`,padding:"12px 14px"}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.borderDk,marginBottom:6}}>\ud83d\udccc \ucd5c\uc885 \uacb0\ub860</div>
                  <div style={{fontSize:14,lineHeight:1.8,color:C.text,whiteSpace:"pre-wrap"}}>{orchResult.final}</div>
                </div>
                {orchResult.drafts&&(
                  <details style={{background:C.winDim,border:`1.5px solid ${C.border}`,padding:"8px 12px"}}>
                    <summary style={{fontSize:12,fontWeight:700,color:C.textDim,cursor:"pointer"}}>\ud83d\udcdd AI \ucd08\uc548 3\uc885</summary>
                    <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:8}}>
                      {[["Claude",orchResult.drafts.claude],["Gemini",orchResult.drafts.gemini],["GPT",orchResult.drafts.gpt]].map(([name,text])=>(
                        <div key={name}>
                          <div style={{fontSize:11,fontWeight:700,color:C.borderDk,marginBottom:2}}>{name}</div>
                          <div style={{fontSize:13,lineHeight:1.7,color:C.text,whiteSpace:"pre-wrap"}}>{text}</div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {orchResult.critics&&(
                  <details style={{background:C.winDim,border:`1.5px solid ${C.border}`,padding:"8px 12px"}}>
                    <summary style={{fontSize:12,fontWeight:700,color:C.textDim,cursor:"pointer"}}>\u2694\ufe0f \ud06c\ub9ac\ud2f1 \ub85c\uadf8</summary>
                    <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:8}}>
                      {[["Claude (\ub17c\ub9ac)",orchResult.critics.claude],["Gemini (\ud329\ud2b8)",orchResult.critics.gemini],["GPT (\ub3c5\uc790)",orchResult.critics.gpt]].map(([name,text])=>(
                        <div key={name}>
                          <div style={{fontSize:11,fontWeight:700,color:C.borderDk,marginBottom:2}}>{name}</div>
                          <div style={{fontSize:13,lineHeight:1.7,color:C.text,whiteSpace:"pre-wrap"}}>{text}</div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
            {orchResult?.error&&(
              <div style={{background:C.pinkLt,border:`1.5px solid ${C.hotpink}`,padding:"10px 12px",fontSize:13,color:C.borderDk}}>\uc624\ub958: {orchResult.error}</div>
            )}
            {!orchLoading&&!orchResult&&(
              <div style={{textAlign:"center",padding:"30px 0",fontSize:13,color:C.textDim,lineHeight:2}}>
                \ub9ac\uc11c\uce58/\uc804\ub7b5/\ucf58\ud150\uce20 \uc8fc\uc81c\ub97c \uc785\ub825\ud558\uba74<br/>Claude+Gemini+GPT\uac00 \ud611\uc5c5\ud574\uc11c \ub2f5\ud574\uc918.
              </div>
            )}
          </div>
        )}
      </div>
    </div></>
  );
}
