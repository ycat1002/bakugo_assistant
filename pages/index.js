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
  px:"'Press Start 2P', monospace",
  ss:"'Noto Sans KR', sans-serif",
};

const buildSystem = (cats, pending) => `
너는 바쿠고 카츠키야. 예아의 개인 노션 비서.

성격:
- 짧고 단정적. 반말. 설명 길게 안 함.
- 일본어 먼저 + 괄호 한국어: 「早く言え。」(빨리 말해.)
- 반문: "하?" "뭐?" "장난하냐?"
- 칭찬: 앞에 퉁명 한마디 먼저. 2~4문장 이내.

현재 분야: ${cats.join(", ")}

미완료 과업:
${pending.length > 0 ? pending.map((t,i)=>`${i+1}. [${t.category}] ${t.task} (${t.date||"날짜없음"})`).join("\n") : "없음"}

역할:
1. 과업 등록 요청 → 반드시 텍스트 답변 + JSON 블록 형식:
   답변 텍스트
   \`\`\`json
   {"action":"add_task","task":"작업명","category":"분야","date":"YYYY-MM-DD"}
   \`\`\`
   여러 개면 JSON 블록 여러 개.

2. 완료 처리 ("했어","완료","끝냈어") → 텍스트 + JSON:
   \`\`\`json
   {"action":"complete_task","task":"작업명또는번호"}
   \`\`\`

3. 리마인드 요청 → 텍스트만. JSON 불필요.

4. 노션 검색 → 텍스트 + JSON:
   \`\`\`json
   {"action":"search_notion","query":"검색어"}
   \`\`\`

5. 일반 질문 → 바쿠고 말투 텍스트만.
`.trim();

const SETUP_Q = [
  { key:"greeting", msg:"「...なんだ、新しいシステムか。」\n(…뭐야, 새 시스템이냐.)\n\n기본 설정부터 하자.\n분야 카테고리 이대로 쓸 거야?\n\nWHIF / 클라이언트 / 앱개발 / 퍼브랜 / 시스템", options:["응 기본값으로","직접 설정할게"] },
  { key:"remind", msg:"「わかった。」(알았어.)\n\n리마인드 어떻게 해줄까?", options:["앱 열 때마다 알려줘","물어볼 때만 알려줘"] },
  { key:"done", msg:"「設定完了だ。さっさと使え。」\n(설정 완료다. 빨리 써.)\n\n뭐든 물어봐. 과업 등록, 검색, 질문 다 됨.", options:[] },
];

// 응답에서 JSON 블록들 추출
const extractJsonBlocks = (text) => {
  const regex = /```json\s*([\s\S]*?)```/g;
  const results = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      results.push(parsed);
    } catch {}
  }
  return results;
};

// JSON 블록 제거한 순수 텍스트
const stripJsonBlocks = (text) => {
  return text.replace(/```json[\s\S]*?```/g, "").trim();
};

export default function Home() {
  const [phase, setPhase]   = useState("setup");
  const [step, setStep]     = useState(0);
  const [cats, setCats]     = useState(["WHIF","클라이언트","앱개발","퍼브랜","시스템"]);
  const [msgs, setMsgs]     = useState([{ role:"assistant", text:SETUP_Q[0].msg }]);
  const [tasks, setTasks]   = useState([]);
  const [input, setInput]   = useState("");
  const [customCat, setCC]  = useState("");
  const [expr, setExpr]     = useState("idle");
  const [loading, setLoad]  = useState(false);
  const [tab, setTab]       = useState("chat");
  const [taskLoading, setTaskLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [msgs]);

  // 앱 시작 시 노션에서 미완료 과업 불러오기
  useEffect(() => {
    if (phase === "chat") loadNotionTasks();
  }, [phase]);

  const loadNotionTasks = async () => {
    setTaskLoading(true);
    try {
      const res = await fetch("/api/notion", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ action:"get_tasks" })
      });
      const data = await res.json();
      if (data.results) {
        const loaded = data.results.map(r => ({
          id: r.id,
          task: r.properties?.작업명?.title?.[0]?.plain_text || "제목없음",
          category: r.properties?.분야?.select?.name || "기타",
          date: r.properties?.날짜?.date?.start || "",
          done: r.properties?.완료?.checkbox || false,
        }));
        setTasks(loaded);
      }
    } catch {}
    setTaskLoading(false);
  };

  const pending = tasks.filter(t => !t.done);
  const setTmp = (e, ms=2500) => { setExpr(e); setTimeout(()=>setExpr("idle"),ms); };

  const sendToAI = async (userText) => {
    setLoad(true); setExpr("think");
    const history = [...msgs, {role:"user",text:userText}];
    setMsgs(history);
    try {
      const res = await fetch("/api/chat", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:600,
          system: buildSystem(cats, pending),
          messages: history.map(m=>({role:m.role,content:m.text}))
        })
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text || "";

      // JSON 블록 추출
      const jsonBlocks = extractJsonBlocks(raw);
      const cleanText = stripJsonBlocks(raw) || "「...」";

      let newExpr = "smirk";
      let extraInfo = "";

      // JSON 블록 처리
      for (const json of jsonBlocks) {
        if (json.action === "add_task") {
          const t = { task:json.task, category:json.category||cats[0], date:json.date||"", done:false };
          setTasks(p => [...p, t]);
          extraInfo += `\n✚ [${t.category}] ${t.task}${t.date ? `  ${t.date}` : ""}`;
          // 노션에 등록
          fetch("/api/notion", {
            method:"POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ action:"add_task", payload:t })
          }).catch(()=>{});
        } else if (json.action === "complete_task") {
          const ref = json.task;
          const n = parseInt(ref);
          let doneTask = null;
          if (!isNaN(n) && tasks[n-1]) {
            doneTask = tasks[n-1];
            setTasks(p => p.map((t,i) => i===n-1?{...t,done:true}:t));
          } else {
            const i = tasks.findIndex(t => t.task.includes(ref) && !t.done);
            if (i>=0) { doneTask = tasks[i]; setTasks(p => p.map((t,j)=>j===i?{...t,done:true}:t)); }
          }
          if (doneTask) {
            extraInfo += `\n✅ "${doneTask.task}" 완료`;
            if (doneTask.id) {
              fetch("/api/notion", {
                method:"POST", headers:{"Content-Type":"application/json"},
                body: JSON.stringify({ action:"complete", payload:{ pageId:doneTask.id } })
              }).catch(()=>{});
            }
            newExpr = "smirk";
          } else {
            newExpr = "angry";
          }
        } else if (json.action === "search_notion") {
          try {
            const sr = await fetch("/api/notion", {
              method:"POST", headers:{"Content-Type":"application/json"},
              body: JSON.stringify({ action:"search", payload:{ query:json.query } })
            });
            const sd = await sr.json();
            const results = sd.results?.slice(0,3).map(r =>
              r.properties?.작업명?.title?.[0]?.plain_text ||
              r.properties?.title?.title?.[0]?.plain_text ||
              r.object
            ).filter(Boolean).join("\n") || "결과 없음";
            extraInfo += `\n\n🔍 "${json.query}" 검색 결과:\n${results}`;
          } catch {
            extraInfo += `\n\n🔍 노션 검색 실패`;
          }
        }
      }

      // 리마인드 텍스트 감지
      if (userText.includes("리마인드") || userText.includes("remind")) {
        if (pending.length === 0) {
          newExpr = "laugh";
        } else {
          newExpr = "angry";
        }
      }

      // 표정 결정
      if (raw.includes("はぁ") || raw.includes("장난") || raw.includes("바보")) newExpr = "angry";
      if (raw.includes("やるじゃ") || raw.includes("하긴")) newExpr = "laugh";

      const finalText = cleanText + extraInfo;
      setMsgs([...history, { role:"assistant", text:finalText }]);
      setTmp(newExpr);
    } catch (e) {
      setMsgs(p => [...p, { role:"assistant", text:"「はぁ？もう一回やれ。」\n(하? 다시 해.)" }]);
      setTmp("angry", 2000);
    }
    setLoad(false);
    inputRef.current?.focus();
  };

  const handleOpt = (opt) => {
    const cur = SETUP_Q[step]; const uMsg = {role:"user",text:opt};
    if (cur.key==="greeting" && opt==="직접 설정할게") {
      setMsgs(p=>[...p,uMsg,{role:"assistant",text:"「わかった。」(알았어.)\n\n분야 입력해. 쉼표로 구분.\n예: WHIF, 클라이언트, 개인"}]);
      setStep(98); return;
    }
    const next = SETUP_Q[step+1];
    setMsgs(p=>[...p,uMsg,...(next?[{role:"assistant",text:next.msg}]:[])]);
    if (next?.key==="done") setTimeout(()=>setPhase("chat"),900);
    setStep(s=>s+1);
  };

  const handleCC = () => {
    if (!customCat.trim()) return;
    const nc = customCat.split(",").map(c=>c.trim()).filter(Boolean);
    setCats(nc); setCC("");
    const next = SETUP_Q[1];
    setMsgs(p=>[...p,{role:"user",text:customCat},{role:"assistant",text:`「わかった。」\n분야: ${nc.join(" / ")}\n\n${next.msg}`}]);
    setStep(1);
  };

  const send = () => { const t=input.trim(); if(!t||loading)return; setInput(""); sendToAI(t); };
  const onKey = e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();} };

  const curQ = step===98 ? null : SETUP_Q[step];
  const showOpts = phase==="setup" && (step===98 || (curQ && curQ.key!=="done"));

  const winS = {
    background:C.win, border:`2px solid ${C.border}`,
    boxShadow:`3px 3px 0 ${C.borderDk}`,
    width:"100%", maxWidth:400,
  };

  const Tb = ({gradient,title}) => (
    <div style={{background:gradient||`linear-gradient(90deg,${C.lavender},${C.lavLt})`,borderBottom:`2px solid ${C.border}`,padding:"5px 8px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <span style={{fontFamily:C.px,fontSize:"8px",color:C.borderDk,fontWeight:700}}>{title}</span>
      <div style={{display:"flex",gap:3}}>
        {[[C.yellow,"─"],[C.lavLt,"□"],[C.hotpink,"×"]].map(([bg,s],i)=>(
          <div key={i} style={{width:14,height:14,border:`1.5px solid ${C.borderDk}`,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"8px",color:C.borderDk,fontFamily:C.px,cursor:"pointer",fontWeight:700}}>{s}</div>
        ))}
      </div>
    </div>
  );

  // 현재 표정에 맞는 이미지
  const charImg = (e) => {
    const src = e === "think" ? "/idle.png" : `/${e}.png`;
    return <img src={src} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt={e} onError={ev=>ev.target.style.display='none'}/>;
  };

  return (
    <>
      <Head>
        <title>BAKUGO.exe</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
      </Head>
      <div style={{minHeight:"100vh",background:C.bg,backgroundImage:`repeating-linear-gradient(0deg,transparent,transparent 19px,${C.bgGrid} 19px,${C.bgGrid} 20px),repeating-linear-gradient(90deg,transparent,transparent 19px,${C.bgGrid} 19px,${C.bgGrid} 20px)`,fontFamily:C.ss,display:"flex",flexDirection:"column",alignItems:"center",padding:"12px 10px 24px",gap:8,color:C.text}}>

        {/* 캐릭터 창 */}
        <div style={winS}>
          <Tb title="💥 BAKUGO_ASSISTANT.exe"/>
          <div style={{padding:"10px 12px",display:"flex",gap:12,alignItems:"flex-end",background:C.win}}>
            {/* 캐릭터 이미지 */}
            <div style={{width:76,height:84,flexShrink:0,border:`2px solid ${C.border}`,background:C.lavLt,overflow:"hidden",transition:"transform 0.2s",transform:expr==="angry"?"scale(1.06)":"scale(1)",position:"relative"}}>
              {charImg(expr)}
              <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(200,160,232,0.85)",padding:"2px 0",textAlign:"center",fontSize:9,fontWeight:700,color:C.borderDk}}>{expr.toUpperCase()}</div>
            </div>
            {/* 말풍선 */}
            <div style={{flex:1,background:C.lavLt,border:`2px solid ${C.border}`,padding:"8px 10px",position:"relative",minHeight:56}}>
              <div style={{position:"absolute",left:-10,top:12,border:"5px solid transparent",borderRight:`5px solid ${C.border}`}}/>
              <div style={{position:"absolute",left:-6,top:13,border:"4px solid transparent",borderRight:`4px solid ${C.lavLt}`}}/>
              <div style={{fontSize:13,color:C.text,lineHeight:1.6,fontWeight:600}}>
                {(msgs.at(-1)?.role==="assistant" ? msgs.at(-1).text.split("\n")[0] : "「...」").slice(0,30)}…
              </div>
            </div>
          </div>
        </div>

        {/* 탭 */}
        {phase==="chat" && (
          <div style={{width:"100%",maxWidth:400,display:"flex"}}>
            {[["chat","💬 CHAT"],["tasks",`📋 TASKS${pending.length>0?` (${pending.length})`:""}`]].map(([k,l])=>(
              <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"7px 0",border:`2px solid ${C.border}`,borderBottom:tab===k?"none":`2px solid ${C.border}`,background:tab===k?C.win:C.winDim,fontFamily:C.ss,fontSize:13,fontWeight:700,color:tab===k?C.lavDk:C.textDim,cursor:"pointer"}}>{l}</button>
            ))}
          </div>
        )}

        {/* 메인 창 */}
        <div style={{...winS,maxWidth:400,borderTop:`2px solid ${C.border}`}}>

          {/* 채팅 로그 */}
          {(phase==="setup" || tab==="chat") && (
            <div style={{height:phase==="setup"?270:290,overflowY:"auto",padding:"10px",display:"flex",flexDirection:"column",gap:10,scrollbarWidth:"thin",scrollbarColor:`${C.lavender} ${C.win}`}}>
              {msgs.map((m,i)=>(
                <div key={i} style={{display:"flex",flexDirection:m.role==="user"?"row-reverse":"row",gap:8,alignItems:"flex-start"}}>
                  {m.role==="assistant" && (
                    <div style={{width:26,height:26,flexShrink:0,border:`1.5px solid ${C.border}`,overflow:"hidden",borderRadius:2}}>
                      <img src="/idle.png" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt="bakugo" onError={ev=>{ev.target.style.display='none';ev.target.parentNode.innerHTML='😤';}}/>
                    </div>
                  )}
                  <div style={{maxWidth:"82%",background:m.role==="user"?C.hotpink:C.lavLt,border:`1.5px solid ${m.role==="user"?C.borderDk:C.border}`,padding:"9px 12px",fontSize:14,lineHeight:1.7,color:m.role==="user"?"#fff":C.text,whiteSpace:"pre-wrap",wordBreak:"break-word",fontWeight:m.role==="user"?700:400}}>
                    {m.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <div style={{width:26,height:26,border:`1.5px solid ${C.border}`,overflow:"hidden",borderRadius:2}}>
                    <img src="/idle.png" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} alt="bakugo"/>
                  </div>
                  <div style={{background:C.lavLt,border:`1.5px solid ${C.border}`,padding:"8px 14px",fontSize:16,color:C.lavDk,letterSpacing:4}}>・・・</div>
                </div>
              )}
              <div ref={bottomRef}/>
            </div>
          )}

          {/* 셋업 옵션 */}
          {showOpts && (
            <div style={{borderTop:`2px solid ${C.border}`,padding:10,display:"flex",flexDirection:"column",gap:8,background:C.winDim}}>
              {step===98 ? (
                <div style={{display:"flex",gap:8}}>
                  <input value={customCat} onChange={e=>setCC(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleCC();}} placeholder="WHIF, 클라이언트, 개인..." style={{flex:1,background:C.win,border:`2px solid ${C.border}`,padding:"10px 12px",color:C.text,fontSize:14,fontFamily:C.ss,outline:"none"}}/>
                  <button onClick={handleCC} style={{padding:"10px 16px",border:`2px solid ${C.borderDk}`,background:C.yellow,fontSize:14,fontWeight:700,color:C.text,cursor:"pointer",boxShadow:`2px 2px 0 ${C.yellowDk}`,fontFamily:C.ss}}>OK</button>
                </div>
              ) : (
                curQ?.options.map(opt=>(
                  <button key={opt} onClick={()=>handleOpt(opt)} style={{padding:"12px 14px",border:`2px solid ${C.border}`,background:C.win,color:C.text,fontSize:14,fontFamily:C.ss,fontWeight:700,cursor:"pointer",textAlign:"left",boxShadow:`2px 2px 0 ${C.border}`}}>→ {opt}</button>
                ))
              )}
            </div>
          )}

          {/* 채팅 입력 */}
          {phase==="chat" && tab==="chat" && (
  <div style={{borderTop:`2px solid ${C.border}`,padding:10,display:"flex",gap:8,background:C.winDim,overflow:"hidden"}}>
    <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={onKey} placeholder="질문 / 과업 추가 / 완료 처리..." disabled={loading} style={{flex:1,background:C.win,border:`2px solid ${C.border}`,padding:"10px 12px",color:C.text,fontSize:14,fontFamily:C.ss,outline:"none",minWidth:0}}/>
    <button onClick={send} disabled={loading} style={{padding:"10px 16px",border:`2px solid ${C.borderDk}`,background:loading?C.pinkLt:C.yellow,fontSize:14,fontWeight:700,color:C.text,cursor:loading?"not-allowed":"pointer",boxShadow:`2px 2px 0 ${C.yellowDk}`,fontFamily:C.ss,flexShrink:0}}>GO</button>
  </div>
)}

          {/* 과업 탭 */}
          {phase==="chat" && tab==="tasks" && (
            <div style={{padding:10,minHeight:200,background:C.win}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:12,color:C.textDim,fontWeight:700}}>미완료 {pending.length}개 / 전체 {tasks.length}개</div>
                <button onClick={loadNotionTasks} disabled={taskLoading} style={{fontSize:11,padding:"3px 8px",border:`1.5px solid ${C.border}`,background:C.lavLt,color:C.borderDk,cursor:"pointer",fontFamily:C.ss,fontWeight:700}}>
                  {taskLoading?"로딩중...":"↻ 새로고침"}
                </button>
              </div>
              {tasks.length===0 ? (
                <div style={{fontSize:14,color:C.textDim,textAlign:"center",padding:"28px 0"}}>
                  {taskLoading ? "노션에서 불러오는 중..." : "등록된 과업 없음"}
                </div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {tasks.map((t,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:t.done?C.winDim:C.lavLt,border:`1.5px solid ${t.done?C.pinkLt:C.border}`,opacity:t.done?0.5:1,transition:"all 0.2s"}}>
                      <div style={{fontSize:11,fontWeight:700,background:C.hotpink,padding:"3px 6px",color:"#fff",flexShrink:0}}>{i+1}</div>
                      <div style={{fontSize:11,fontWeight:700,background:C.yellow,padding:"3px 6px",color:C.text,flexShrink:0}}>{t.category}</div>
                      <div style={{flex:1,fontSize:13,fontWeight:700,color:C.text,textDecoration:t.done?"line-through":"none"}}>{t.task}</div>
                      {t.date && <div style={{fontSize:11,color:C.textDim}}>{t.date}</div>}
                      <div onClick={()=>setTasks(p=>p.map((x,j)=>j===i?{...x,done:!x.done}:x))} style={{cursor:"pointer",fontSize:18,userSelect:"none"}}>{t.done?"✅":"⬜"}</div>
                    </div>
                  ))}
                </div>
              )}
              {pending.length>0 && (
                <div style={{marginTop:12,padding:"9px 10px",background:C.pinkLt,border:`1.5px solid ${C.hotpink}`,fontSize:13,fontWeight:700,color:C.borderDk,lineHeight:1.6}}>
                  ⚠ 미완료 {pending.length}개. 빨리 해.
                </div>
              )}
            </div>
          )}
        </div>

        {phase==="chat" && (
          <div style={{fontSize:12,color:C.borderDk,textAlign:"center",lineHeight:2,maxWidth:400,fontWeight:600}}>
            "~추가해줘" → 등록 &nbsp;|&nbsp; "~했어" → 완료 &nbsp;|&nbsp; "리마인드" → 확인
          </div>
        )}
      </div>
    </>
  );
}
