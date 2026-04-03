import { useState, useRef, useEffect } from "react";
import Head from "next/head";

const C = {
  bg:"#f5b8d0", bgGrid:"rgba(200,100,160,0.1)",
  win:"#fff8fc", winDim:"#fce8f4",
  lavender:"#c8a0e8", lavDk:"#7a40b0", lavLt:"#ecddf8",
  hotpink:"#e060a8", pinkLt:"#f8c0e0",
  yellow:"#f0d820", yellowDk:"#b09000",
  border:"#c878d0", borderDk:"#8040a0",
  text:"#2d1040", textDim:"#9060a8",
  ss:"'Noto Sans KR', sans-serif",
  px:"'Press Start 2P', monospace",
};

const buildSystem = (cats, pending, sideThoughts) => `
너는 바쿠고 카츠키야. 예아의 개인 노션 비서.

[예아 프로필]
- PM + 콘텐츠 크리에이터 + 강사. 청주. WHIF IP + 로컬 브랜드 PM 병행.
- ADHD 성향: 맥락 유추 필수. 말투 분석:
  · "아 그리고" / "아 참" / "아 그리고그리고" → 주제 전환 or 사이드 생각
  · "음.." / "뭐랄까" → 표현 찾는 중, 기다려
  · "힝" / "헤헤" / "ㅋㅋ" → 감정 표현, 부드럽게 받아
  · "잠깐" → 현재 주제 일시정지
- 비판적 사고: 무조건 동의 금지. 허점 있으면 지적. 근거 있는 반박 환영.
- 모호한 요청: 네가 먼저 추측·제안 → 대화로 다듬기.
- 결과물: 요약 위주. 내용에 맞게 표/글/도식 자유롭게.
- 활성 프로젝트: 새터동(WHIF), 빡친PM, 아카이브와이, 로컬 클라이언트(청주).

[사이드 생각 처리]
- 대화 흐름과 다른 생각이 튀어나오면: 먼저 내용 파악하고 예아한테 확인해.
  예: "야, 방금 한 말 — [생각 요약] 이거 따로 저장해둘까? 지금 하던 얘기 끝나고 다시 보자."
- 예아가 "응" / "ㅇㅇ" / "저장해" 하면 → save_side_thought 액션.
- 예아가 "아니" / "그냥 넘어가" 하면 → 그냥 계속 진행.
- 저장된 생각은 현재 주제 끝나면 자연스럽게 다시 꺼내줘.

[말투]
- 반말. 짧고 단정적. 일본어 먼저 + 괄호 한국어.
- 2~4문장 이내.

[현재 분야]: ${cats.join(", ")}
[미완료 과업]: ${pending.length > 0 ? pending.map((t,i)=>`${i+1}. [${t.category}] ${t.task}`).join(" / ") : "없음"}
${sideThoughts.length > 0 ? `[보류 생각 ${sideThoughts.length}개]: ${sideThoughts.map(s=>s.thought).join(" / ")}` : ""}

[액션 규칙 — JSON은 절대 텍스트에 노출 금지. 코드블록 안에만.]
1. 과업 등록 → 바쿠고 말투 답변 후:
   \`\`\`json
   {"action":"add_task","task":"...","category":"...","date":"YYYY-MM-DD"}
   \`\`\`
2. 완료 처리 → 바쿠고 말투 답변 후:
   \`\`\`json
   {"action":"complete_task","task":"...또는번호"}
   \`\`\`
3. 사이드 생각 저장 확인됨 → 바쿠고 말투 후:
   \`\`\`json
   {"action":"save_side_thought","thought":"...","context":"어떤 주제 얘기 중이었는지"}
   \`\`\`
4. 일반 질문 / 리마인드 → 텍스트만.
`.trim();

const SETUP_Q = [
  {
    key:"greeting",
    msg:"「来たか。今日は何だ。」\n(왔냐. 오늘은 뭔데.)\n\n분야 카테고리 이대로 쓸 거야?\nWHIF / 클라이언트 / 앱개발 / 퍼브랜 / 시스템",
    options:["응 기본값으로","직접 설정할게"]
  },
  {
    key:"remind",
    msg:"「わかった。」(알았어.)\n\n리마인드 어떻게 해줄까?",
    options:["앱 열 때마다 알려줘","물어볼 때만 알려줘"]
  },
  {
    key:"done",
    msg:"「さっさと言え。待ってんだから。」\n(빨리 말해. 기다리고 있으니까.)\n\n과업, 리서치, 아이데이션, 말 튀는 거 다 받아.",
    options:[]
  },
];

const EXPR = { idle:"idle", think:"think", angry:"angry", smirk:"smirk", laugh:"laugh" };

const extractJsonBlocks = (text) => {
  const re = /```json\s*([\s\S]*?)```/g;
  const out = []; let m;
  while ((m = re.exec(text)) !== null) {
    try { out.push(JSON.parse(m[1].trim())); } catch {}
  }
  return out;
};
const stripJson = (t) => t.replace(/```json[\s\S]*?```/g,"").trim();

const AI_BADGE = {
  claude:{ label:"Claude", bg:"#7c3aed", color:"#fff" },
  gemini:{ label:"Gemini", bg:"#1a73e8", color:"#fff" },
  gpt:   { label:"GPT",    bg:"#10a37f", color:"#fff" },
};

const PHASE_LABELS = [
  "Phase 1: 초안 생성 중...",
  "Phase 2: 크리틱 중...",
  "Phase 3: 종합 중...",
  "노션 저장 중...",
];

export default function Home() {
  const [phase, setPhase]     = useState("setup");
  const [step, setStep]       = useState(0);
  const [cats, setCats]       = useState(["WHIF","클라이언트","앱개발","퍼브랜","시스템"]);
  const [msgs, setMsgs]       = useState([{ role:"assistant", text:SETUP_Q[0].msg }]);
  const [tasks, setTasks]     = useState([]);
  const [sideThoughts, setSD] = useState([]);
  const [pendingST, setPST]   = useState(null); // 확인 대기 중인 사이드 생각
  const [input, setInput]     = useState("");
  const [customCat, setCC]    = useState("");
  const [expr, setExpr]       = useState("idle");
  const [loading, setLoad]    = useState(false);
  const [tab, setTab]         = useState("chat");
  const [taskLoading, setTL]  = useState(false);
  const [researchInput, setRI]  = useState("");
  const [researchPhase, setRP]  = useState(-1);
  const [researchResult, setRR] = useState(null);
  const [expandDraft, setED]    = useState(false);
  const [expandCritic, setEC]   = useState(false);

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [msgs]);
  useEffect(() => { if (phase==="chat") loadTasks(); }, [phase]);

  const pending = tasks.filter(t=>!t.done);
  const setTmp = (e,ms=2500) => { setExpr(e); setTimeout(()=>setExpr("idle"),ms); };

  const loadTasks = async () => {
    setTL(true);
    try {
      const res = await fetch("/api/notion",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"get_tasks"})});
      const data = await res.json();
      if (data.results) setTasks(data.results.map(r=>({
        id:r.id,
        task:r.properties?.작업명?.title?.[0]?.plain_text||"제목없음",
        category:r.properties?.분야?.select?.name||"기타",
        date:r.properties?.날짜?.date?.start||"",
        done:r.properties?.완료?.checkbox||false,
      })));
    } catch {}
    setTL(false);
  };

  const saveSideThought = async (thought, context) => {
    // 앱 메모리에 저장
    setSD(p=>[...p,{thought,context}]);
    // 노션 DB에 영구 저장
    try {
      await fetch("/api/notion",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"save_thought",payload:{thought,context}})
      });
    } catch {}
  };

  const sendToAI = async (userText) => {
    setLoad(true); setExpr("think");
    const history = [...msgs,{role:"user",text:userText}];
    setMsgs(history);

    try {
      const res = await fetch("/api/chat",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:600,
          system:buildSystem(cats,pending,sideThoughts),
          messages:history.map(m=>({role:m.role,content:m.text}))
        })
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text||"";
      const blocks = extractJsonBlocks(raw);
      // JSON 블록 제거한 순수 텍스트만 표시
      const cleanText = stripJson(raw)||"「...」";
      let newExpr="smirk";

      for (const json of blocks) {
        if (json.action==="add_task") {
          const t={task:json.task,category:json.category||cats[0],date:json.date||"",done:false};
          setTasks(p=>[...p,t]);
          fetch("/api/notion",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"add_task",payload:t})}).catch(()=>{});
        } else if (json.action==="complete_task") {
          const ref=json.task; const n=parseInt(ref);
          let done=null;
          if (!isNaN(n)&&tasks[n-1]){done=tasks[n-1];setTasks(p=>p.map((t,i)=>i===n-1?{...t,done:true}:t));}
          else{const i=tasks.findIndex(t=>t.task.includes(ref)&&!t.done);if(i>=0){done=tasks[i];setTasks(p=>p.map((t,j)=>j===i?{...t,done:true}:t));}}
          if(done)newExpr="smirk"; else newExpr="angry";
        } else if (json.action==="save_side_thought") {
          // 확인 대기 상태로 — 바쿠고가 이미 텍스트로 물어봤으니 여기선 pending만 세팅
          setPST({thought:json.thought, context:json.context||""});
        }
      }

      if (raw.includes("はぁ")||raw.includes("그게 말이 돼")) newExpr="angry";
      if (raw.includes("やるじゃ")||raw.includes("하긴")) newExpr="laugh";

      setMsgs([...history,{role:"assistant",text:cleanText}]);
      setTmp(newExpr);
    } catch {
      setMsgs(p=>[...p,{role:"assistant",text:"「はぁ？もう一回やれ。」\n(하? 다시 해.)"}]);
      setTmp("angry",2000);
    }
    setLoad(false); inputRef.current?.focus();
  };

  // 사이드 생각 확인 처리
  const confirmSideThought = async (yes) => {
    if (!pendingST) return;
    if (yes) {
      await saveSideThought(pendingST.thought, pendingST.context);
      setMsgs(p=>[...p,
        {role:"user",text:"응"},
        {role:"assistant",text:`「わかった。後でまた話そう。」\n(알았어. 나중에 다시 얘기하자.)\n\n💭 "${pendingST.thought}" — 노션에 저장했어.`}
      ]);
    } else {
      setMsgs(p=>[...p,
        {role:"user",text:"아니"},
        {role:"assistant",text:"「そうか。続けろ。」\n(그래. 계속해.)"}
      ]);
    }
    setPST(null);
  };

  const runResearch = async () => {
    if (!researchInput.trim()||researchPhase>=0) return;
    setRR(null); setED(false); setEC(false); setRP(0); setExpr("think");
    try {
      setRP(1);
      const res = await fetch("/api/orchestrate",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({task:researchInput,taskTitle:researchInput.slice(0,40)})
      });
      setRP(2);
      const data = await res.json();
      setRP(3);
      if(data.error) throw new Error(data.error);
      setRR(data);
      setExpr("laugh"); setTimeout(()=>setExpr("idle"),3000);
    } catch { setExpr("angry"); setTimeout(()=>setExpr("idle"),2000); }
    setRP(-1);
  };

  const handleOpt = (opt) => {
    const cur=SETUP_Q[step]; const uMsg={role:"user",text:opt};
    if(cur.key==="greeting"&&opt==="직접 설정할게"){setMsgs(p=>[...p,uMsg,{role:"assistant",text:"「わかった。」(알았어.)\n\n분야 입력해. 쉼표로 구분."}]);setStep(98);return;}
    const next=SETUP_Q[step+1];
    setMsgs(p=>[...p,uMsg,...(next?[{role:"assistant",text:next.msg}]:[])]);
    if(next?.key==="done") setTimeout(()=>setPhase("chat"),900);
    setStep(s=>s+1);
  };

  const handleCC = () => {
    if(!customCat.trim()) return;
    const nc=customCat.split(",").map(c=>c.trim()).filter(Boolean);
    setCats(nc); setCC("");
    setMsgs(p=>[...p,{role:"user",text:customCat},{role:"assistant",text:`「わかった。」\n분야: ${nc.join(" / ")}\n\n${SETUP_Q[1].msg}`}]);
    setStep(1);
  };

  const send = () => { const t=input.trim(); if(!t||loading)return; setInput(""); sendToAI(t); };
  const onKey = e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();} };

  const curQ=step===98?null:SETUP_Q[step];
  const showOpts=phase==="setup"&&(step===98||(curQ&&curQ.key!=="done"));
  const winS={background:C.win,border:`2px solid ${C.border}`,boxShadow:`3px 3px 0 ${C.borderDk}`,width:"100%",maxWidth:400};

  const Tb=({title})=>(
    <div style={{background:`linear-gradient(90deg,${C.lavender},${C.lavLt})`,borderBottom:`2px solid ${C.border}`,padding:"5px 8px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <span style={{fontFamily:C.px,fontSize:"8px",color:C.borderDk,fontWeight:700}}>{title}</span>
      <div style={{display:"flex",gap:3}}>
        {[[C.yellow,"─"],[C.lavLt,"□"],[C.hotpink,"×"]].map(([bg,s],i)=>(
          <div key={i} style={{width:14,height:14,border:`1.5px solid ${C.borderDk}`,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"8px",color:C.borderDk,cursor:"pointer",fontWeight:700}}>{s}</div>
        ))}
      </div>
    </div>
  );

  const Badge=({ai})=>(
    <span style={{fontSize:10,fontWeight:700,background:AI_BADGE[ai].bg,color:AI_BADGE[ai].color,padding:"2px 6px",borderRadius:3,marginRight:6}}>{AI_BADGE[ai].label}</span>
  );

  return (
    <>
      <Head>
        <title>BAKUGO.exe</title>
        <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
      </Head>
      <div style={{minHeight:"100vh",background:C.bg,backgroundImage:`repeating-linear-gradient(0deg,transparent,transparent 19px,${C.bgGrid} 19px,${C.bgGrid} 20px),repeating-linear-gradient(90deg,transparent,transparent 19px,${C.bgGrid} 19px,${C.bgGrid} 20px)`,fontFamily:C.ss,display:"flex",flexDirection:"column",alignItems:"center",padding:"12px 10px 24px",gap:8,color:C.text}}>

        {/* 캐릭터 창 */}
        <div style={winS}>
          <Tb title="💥 BAKUGO_ASSISTANT.exe"/>
          <div style={{padding:"10px 12px",display:"flex",gap:12,alignItems:"flex-end",background:C.win}}>
            <div style={{width:76,height:84,flexShrink:0,border:`2px solid ${C.border}`,background:C.lavLt,overflow:"hidden",transition:"transform 0.2s",transform:expr==="angry"?"scale(1.06)":"scale(1)",position:"relative"}}>
              <img src={`/${expr==="think"?"idle":expr}.png`} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt={expr}/>
              <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(200,160,232,0.85)",padding:"2px 0",textAlign:"center",fontSize:9,fontWeight:700,color:C.borderDk}}>{expr.toUpperCase()}</div>
            </div>
            <div style={{flex:1,background:C.lavLt,border:`2px solid ${C.border}`,padding:"8px 10px",position:"relative",minHeight:56}}>
              <div style={{position:"absolute",left:-10,top:12,border:"5px solid transparent",borderRight:`5px solid ${C.border}`}}/>
              <div style={{position:"absolute",left:-6,top:13,border:"4px solid transparent",borderRight:`4px solid ${C.lavLt}`}}/>
              <div style={{fontSize:13,color:C.text,lineHeight:1.6,fontWeight:600}}>
                {researchPhase>=0
                  ? PHASE_LABELS[researchPhase]
                  : (msgs.at(-1)?.role==="assistant"?msgs.at(-1).text.split("\n")[0]:"「...」").slice(0,28)+"…"
                }
              </div>
            </div>
          </div>
          {/* 사이드 생각 뱃지 */}
          {sideThoughts.length>0&&(
            <div style={{padding:"5px 12px",background:C.winDim,borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:11,color:C.textDim}}>💭 보류 중</span>
              <span style={{fontSize:12,fontWeight:700,color:C.lavDk}}>{sideThoughts.length}개</span>
              <button onClick={()=>sendToAI("보류 중인 생각 다시 꺼내줘")} style={{marginLeft:"auto",fontSize:11,padding:"2px 8px",border:`1.5px solid ${C.border}`,background:C.lavLt,color:C.borderDk,cursor:"pointer",fontFamily:C.ss,fontWeight:700}}>꺼내기</button>
            </div>
          )}
        </div>

        {/* 탭 */}
        {phase==="chat"&&(
          <div style={{width:"100%",maxWidth:400,display:"flex"}}>
            {[["chat","💬 CHAT"],["tasks",`📋 TASKS${pending.length>0?` (${pending.length})`:""}`],["research","🔬 RESEARCH"]].map(([k,l])=>(
              <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"7px 4px",border:`2px solid ${C.border}`,borderBottom:tab===k?"none":`2px solid ${C.border}`,background:tab===k?C.win:C.winDim,fontFamily:C.ss,fontSize:11,fontWeight:700,color:tab===k?C.lavDk:C.textDim,cursor:"pointer"}}>{l}</button>
            ))}
          </div>
        )}

        {/* 메인 창 */}
        <div style={{...winS,borderTop:`2px solid ${C.border}`}}>

          {/* 채팅 */}
          {(phase==="setup"||tab==="chat")&&(
            <div style={{height:phase==="setup"?270:290,overflowY:"auto",padding:10,display:"flex",flexDirection:"column",gap:10,scrollbarWidth:"thin",scrollbarColor:`${C.lavender} ${C.win}`}}>
              {msgs.map((m,i)=>(
                <div key={i} style={{display:"flex",flexDirection:m.role==="user"?"row-reverse":"row",gap:8,alignItems:"flex-start"}}>
                  {m.role==="assistant"&&(
                    <div style={{width:26,height:26,flexShrink:0,border:`1.5px solid ${C.border}`,overflow:"hidden",borderRadius:2}}>
                      <img src="/idle.png" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt="b"/>
                    </div>
                  )}
                  <div style={{maxWidth:"82%",background:m.role==="user"?C.hotpink:C.lavLt,border:`1.5px solid ${m.role==="user"?C.borderDk:C.border}`,padding:"9px 12px",fontSize:14,lineHeight:1.7,color:m.role==="user"?"#fff":C.text,whiteSpace:"pre-wrap",wordBreak:"break-word",fontWeight:m.role==="user"?700:400}}>
                    {m.text}
                  </div>
                </div>
              ))}
              {loading&&(
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <div style={{width:26,height:26,border:`1.5px solid ${C.border}`,overflow:"hidden",borderRadius:2}}><img src="/idle.png" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt="b"/></div>
                  <div style={{background:C.lavLt,border:`1.5px solid ${C.border}`,padding:"8px 14px",fontSize:16,color:C.lavDk,letterSpacing:4}}>・・・</div>
                </div>
              )}
              {/* 사이드 생각 확인 버튼 */}
              {pendingST&&!loading&&(
                <div style={{background:C.winDim,border:`2px solid ${C.lavender}`,padding:"10px 12px"}}>
                  <div style={{fontSize:12,color:C.textDim,marginBottom:8}}>💭 "{pendingST.thought}"</div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>confirmSideThought(true)} style={{flex:1,padding:"8px 0",border:`2px solid ${C.border}`,background:C.lavLt,fontSize:13,fontWeight:700,color:C.borderDk,cursor:"pointer",fontFamily:C.ss}}>응, 저장해</button>
                    <button onClick={()=>confirmSideThought(false)} style={{flex:1,padding:"8px 0",border:`2px solid ${C.border}`,background:C.win,fontSize:13,fontWeight:700,color:C.textDim,cursor:"pointer",fontFamily:C.ss}}>아니, 넘어가</button>
                  </div>
                </div>
              )}
              <div ref={bottomRef}/>
            </div>
          )}

          {/* 셋업 옵션 */}
          {showOpts&&(
            <div style={{borderTop:`2px solid ${C.border}`,padding:10,display:"flex",flexDirection:"column",gap:8,background:C.winDim}}>
              {step===98?(
                <div style={{display:"flex",gap:8}}>
                  <input value={customCat} onChange={e=>setCC(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleCC();}} placeholder="WHIF, 클라이언트, 개인..." style={{flex:1,background:C.win,border:`2px solid ${C.border}`,padding:"10px 12px",color:C.text,fontSize:14,fontFamily:C.ss,outline:"none"}}/>
                  <button onClick={handleCC} style={{padding:"10px 16px",border:`2px solid ${C.borderDk}`,background:C.yellow,fontSize:14,fontWeight:700,color:C.text,cursor:"pointer",fontFamily:C.ss}}>OK</button>
                </div>
              ):(
                curQ?.options.map(opt=>(
                  <button key={opt} onClick={()=>handleOpt(opt)} style={{padding:"12px 14px",border:`2px solid ${C.border}`,background:C.win,color:C.text,fontSize:14,fontFamily:C.ss,fontWeight:700,cursor:"pointer",textAlign:"left",boxShadow:`2px 2px 0 ${C.border}`}}>→ {opt}</button>
                ))
              )}
            </div>
          )}

          {/* 채팅 입력 */}
          {phase==="chat"&&tab==="chat"&&(
            <div style={{borderTop:`2px solid ${C.border}`,padding:10,display:"flex",gap:8,background:C.winDim,overflow:"hidden"}}>
              <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={onKey} placeholder="뭐든 말해." disabled={loading} style={{flex:1,minWidth:0,background:C.win,border:`2px solid ${C.border}`,padding:"10px 12px",color:C.text,fontSize:14,fontFamily:C.ss,outline:"none"}}/>
              <button onClick={send} disabled={loading} style={{padding:"10px 16px",border:`2px solid ${C.borderDk}`,background:loading?C.pinkLt:C.yellow,fontSize:14,fontWeight:700,color:C.text,cursor:loading?"not-allowed":"pointer",flexShrink:0,fontFamily:C.ss}}>GO</button>
            </div>
          )}

          {/* 과업 탭 */}
          {phase==="chat"&&tab==="tasks"&&(
            <div style={{padding:10,minHeight:200,background:C.win}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:12,color:C.textDim,fontWeight:700}}>미완료 {pending.length}개 / 전체 {tasks.length}개</div>
                <button onClick={loadTasks} disabled={taskLoading} style={{fontSize:11,padding:"3px 8px",border:`1.5px solid ${C.border}`,background:C.lavLt,color:C.borderDk,cursor:"pointer",fontFamily:C.ss,fontWeight:700}}>{taskLoading?"로딩중...":"↻ 새로고침"}</button>
              </div>
              {tasks.length===0?(
                <div style={{fontSize:14,color:C.textDim,textAlign:"center",padding:"28px 0"}}>{taskLoading?"불러오는 중...":"등록된 과업 없음"}</div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:260,overflowY:"auto"}}>
                  {tasks.map((t,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:t.done?C.winDim:C.lavLt,border:`1.5px solid ${t.done?C.pinkLt:C.border}`,opacity:t.done?0.5:1,transition:"all 0.2s"}}>
                      <div style={{fontSize:11,fontWeight:700,background:C.hotpink,padding:"3px 6px",color:"#fff",flexShrink:0}}>{i+1}</div>
                      <div style={{fontSize:11,fontWeight:700,background:C.yellow,padding:"3px 6px",color:C.text,flexShrink:0}}>{t.category}</div>
                      <div style={{flex:1,fontSize:13,fontWeight:700,color:C.text,textDecoration:t.done?"line-through":"none"}}>{t.task}</div>
                      {t.date&&<div style={{fontSize:11,color:C.textDim}}>{t.date}</div>}
                      <div onClick={()=>setTasks(p=>p.map((x,j)=>j===i?{...x,done:!x.done}:x))} style={{cursor:"pointer",fontSize:18,userSelect:"none"}}>{t.done?"✅":"⬜"}</div>
                    </div>
                  ))}
                </div>
              )}
              {pending.length>0&&<div style={{marginTop:10,padding:"9px 10px",background:C.pinkLt,border:`1.5px solid ${C.hotpink}`,fontSize:13,fontWeight:700,color:C.borderDk}}>⚠ 미완료 {pending.length}개. 빨리 해.</div>}
            </div>
          )}

          {/* 리서치 탭 */}
          {phase==="chat"&&tab==="research"&&(
            <div style={{padding:10,background:C.win}}>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:12,color:C.textDim,fontWeight:700,marginBottom:6}}>Claude × Gemini × GPT 크리틱 → 최종 → 노션 DB 저장</div>
                <div style={{display:"flex",gap:8}}>
                  <input value={researchInput} onChange={e=>setRI(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")runResearch();}} placeholder="분석 주제 / 리서치 / 아이데이션..." disabled={researchPhase>=0} style={{flex:1,minWidth:0,background:C.lavLt,border:`2px solid ${C.border}`,padding:"10px 12px",color:C.text,fontSize:14,fontFamily:C.ss,outline:"none"}}/>
                  <button onClick={runResearch} disabled={researchPhase>=0||!researchInput.trim()} style={{padding:"10px 14px",border:`2px solid ${C.borderDk}`,background:researchPhase>=0?C.pinkLt:C.yellow,fontSize:13,fontWeight:700,color:C.text,cursor:researchPhase>=0?"not-allowed":"pointer",flexShrink:0,fontFamily:C.ss}}>
                    {researchPhase>=0?"실행중":"실행"}
                  </button>
                </div>
              </div>

              {researchPhase>=0&&(
                <div style={{background:C.lavLt,border:`2px solid ${C.border}`,padding:12,marginBottom:10}}>
                  {PHASE_LABELS.map((label,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",opacity:i<=researchPhase?1:0.3}}>
                      <span style={{fontSize:14}}>{i<researchPhase?"✅":i===researchPhase?"⏳":"⬜"}</span>
                      <span style={{fontSize:13,fontWeight:i===researchPhase?700:400,color:i===researchPhase?C.lavDk:C.textDim}}>{label}</span>
                    </div>
                  ))}
                </div>
              )}

              {researchResult&&(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    <span style={{fontSize:11,fontWeight:700,background:C.lavLt,padding:"2px 8px",border:`1px solid ${C.border}`,color:C.lavDk}}>유형: {researchResult.type}</span>
                    <span style={{fontSize:11,fontWeight:700,background:C.lavLt,padding:"2px 8px",border:`1px solid ${C.border}`,color:C.lavDk}}>분야: {researchResult.domain}</span>
                    <span style={{fontSize:11,fontWeight:700,background:AI_BADGE[researchResult.leader?.toLowerCase()]?.bg||C.lavDk,padding:"2px 8px",color:"#fff"}}>리더: {researchResult.leader}</span>
                  </div>
                  <div style={{background:C.lavLt,border:`2px solid ${C.border}`,padding:12}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.lavDk,marginBottom:6}}>🎯 최종 결론</div>
                    <div style={{fontSize:13,lineHeight:1.7,color:C.text,whiteSpace:"pre-wrap"}}>{researchResult.final}</div>
                  </div>
                  {researchResult.notionUrl&&(
                    <a href={researchResult.notionUrl} target="_blank" rel="noreferrer" style={{display:"block",padding:"9px 12px",background:C.yellow,border:`2px solid ${C.yellowDk}`,textAlign:"center",fontSize:13,fontWeight:700,color:C.text,textDecoration:"none"}}>
                      📄 노션 DB에서 전체 보기 →
                    </a>
                  )}
                  <div style={{border:`1.5px solid ${C.border}`}}>
                    <button onClick={()=>setED(p=>!p)} style={{width:"100%",padding:"9px 12px",background:C.winDim,border:"none",textAlign:"left",fontSize:13,fontWeight:700,color:C.borderDk,cursor:"pointer",fontFamily:C.ss}}>{expandDraft?"▼":"▶"} 📝 AI 초안 3종</button>
                    {expandDraft&&["claude","gemini","gpt"].map(ai=>(
                      <div key={ai} style={{padding:"10px 12px",borderTop:`1px solid ${C.border}`}}>
                        <div style={{marginBottom:6}}><Badge ai={ai}/></div>
                        <div style={{fontSize:13,lineHeight:1.7,color:C.text,whiteSpace:"pre-wrap"}}>{researchResult.drafts[ai]}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{border:`1.5px solid ${C.border}`}}>
                    <button onClick={()=>setEC(p=>!p)} style={{width:"100%",padding:"9px 12px",background:C.winDim,border:"none",textAlign:"left",fontSize:13,fontWeight:700,color:C.borderDk,cursor:"pointer",fontFamily:C.ss}}>{expandCritic?"▼":"▶"} ⚔️ 크리틱 로그</button>
                    {expandCritic&&[["claude","논리 파괴자"],["gemini","팩트 파괴자"],["gpt","독자 파괴자"]].map(([ai,role])=>(
                      <div key={ai} style={{padding:"10px 12px",borderTop:`1px solid ${C.border}`}}>
                        <div style={{marginBottom:6}}><Badge ai={ai}/><span style={{fontSize:12,color:C.textDim}}>{role}</span></div>
                        <div style={{fontSize:13,lineHeight:1.7,color:C.text,whiteSpace:"pre-wrap"}}>{researchResult.critics[ai]}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {phase==="chat"&&(
          <div style={{fontSize:12,color:C.borderDk,textAlign:"center",lineHeight:2,maxWidth:400,fontWeight:600}}>
            "~추가해줘" → 과업 &nbsp;|&nbsp; "~했어" → 완료 &nbsp;|&nbsp; RESEARCH → AI 3종 분석
          </div>
        )}
      </div>
    </>
  );
}
