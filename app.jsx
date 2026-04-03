import { useState, useEffect } from "react";

// 이미지 경로 - 실제 배포 시 교체
const EXPRESSIONS = {
  idle:     "/img/idle.png",      // ① 팔짱 (대기)
  angry:    "/img/angry.png",     // ② 짜증
  smirk:    "/img/smirk.png",     // ③ 마지못해 인정
  dere:     "/img/dere.png",      // ④ 데레
  laugh:    "/img/laugh.png",     // ⑤ 진짜 웃음
};

const LINES = {
  idle:   { jp: "早く言え。", kr: "(빨리 말해.)" },
  input:  { jp: "なんだ。", kr: "(뭔데.)" },
  added:  { jp: "わかった。忘れんなよ。", kr: "(알았어. 잊지 마.)" },
  done:   { jp: "...悪くねぇな。", kr: "(나쁘진 않네.)" },
  streak: { jp: "ちっ、やるじゃねぇか。", kr: "(쳇, 하긴 하는구나.)" },
  late:   { jp: "まだやってねぇのか。", kr: "(아직도 안 했냐.)" },
  error:  { jp: "はぁ？もう一回やれ。", kr: "(하? 다시 해.)" },
};

const NOTION_DB = "3376218c4184803797c0f1e7dfec030a";
const NOTION_TOKEN = import.meta?.env?.VITE_NOTION_TOKEN || "";

const CATEGORIES = ["WHIF", "클라이언트", "앱개발", "퍼브랜", "시스템"];

export default function App() {
  const [task, setTask] = useState("");
  const [category, setCategory] = useState("WHIF");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [expression, setExpression] = useState("idle");
  const [line, setLine] = useState(LINES.idle);
  const [loading, setLoading] = useState(false);
  const [streak, setStreak] = useState(0);
  const [imgError, setImgError] = useState({});

  // 타이핑 중 표정 변화
  useEffect(() => {
    if (task.length > 0) {
      setExpression("angry");
      setLine(LINES.input);
    } else {
      setExpression("idle");
      setLine(LINES.idle);
    }
  }, [task]);

  const addToNotion = async () => {
    if (!task.trim()) {
      setExpression("angry");
      setLine(LINES.error);
      setTimeout(() => { setExpression("idle"); setLine(LINES.idle); }, 2000);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${NOTION_TOKEN}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({
          parent: { database_id: NOTION_DB },
          properties: {
            작업명: { title: [{ text: { content: task } }] },
            분야: { select: { name: category } },
            날짜: { date: { start: date } },
            완료: { checkbox: false },
          },
        }),
      });
      if (res.ok) {
        const newStreak = streak + 1;
        setStreak(newStreak);
        setExpression(newStreak >= 3 ? "laugh" : "smirk");
        setLine(newStreak >= 3 ? LINES.streak : LINES.done);
        setTask("");
        setTimeout(() => { setExpression("idle"); setLine(LINES.idle); }, 2500);
      } else {
        throw new Error();
      }
    } catch {
      setExpression("angry");
      setLine(LINES.error);
      setTimeout(() => { setExpression("idle"); setLine(LINES.idle); }, 2000);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addToNotion(); }
  };

  // 이미지 fallback (개발 시 이모지 대체)
  const getFallback = (expr) => {
    const map = { idle:"😤", angry:"💢", smirk:"😏", dere:"😳", laugh:"😁" };
    return map[expr] || "😤";
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0d0d0d 0%, #1a1008 50%, #0d0d0d 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Noto Sans KR', sans-serif",
      padding: "24px 16px",
    }}>
      {/* 캐릭터 영역 */}
      <div style={{ position: "relative", marginBottom: "8px" }}>
        {/* 발광 효과 */}
        <div style={{
          position: "absolute", inset: "-20px",
          background: "radial-gradient(ellipse, rgba(255,80,0,0.15) 0%, transparent 70%)",
          borderRadius: "50%", pointerEvents: "none",
          transition: "all 0.4s ease",
          opacity: expression === "angry" ? 1 : 0.5,
        }} />

        {/* 캐릭터 이미지 */}
        <div style={{
          width: "200px", height: "220px",
          borderRadius: "16px",
          overflow: "hidden",
          position: "relative",
          transition: "transform 0.3s ease",
          transform: expression === "angry" ? "scale(1.03)" : "scale(1)",
        }}>
          {!imgError[expression] ? (
            <img
              src={EXPRESSIONS[expression]}
              alt={expression}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={() => setImgError(p => ({ ...p, [expression]: true }))}
            />
          ) : (
            <div style={{
              width: "100%", height: "100%",
              background: "linear-gradient(135deg, #2a1500, #1a0d00)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "80px",
            }}>
              {getFallback(expression)}
            </div>
          )}
        </div>
      </div>

      {/* 말풍선 */}
      <div style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,120,0,0.3)",
        borderRadius: "12px",
        padding: "12px 20px",
        marginBottom: "28px",
        maxWidth: "280px",
        textAlign: "center",
        backdropFilter: "blur(8px)",
        transition: "all 0.3s ease",
      }}>
        <p style={{ color: "#fff", fontSize: "16px", fontWeight: "700", margin: 0, letterSpacing: "0.05em" }}>
          {line.jp}
        </p>
        <p style={{ color: "rgba(255,180,80,0.8)", fontSize: "12px", margin: "4px 0 0", letterSpacing: "0.03em" }}>
          {line.kr}
        </p>
      </div>

      {/* 입력 카드 */}
      <div style={{
        width: "100%", maxWidth: "340px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,120,0,0.2)",
        borderRadius: "20px",
        padding: "20px",
        backdropFilter: "blur(12px)",
      }}>
        {/* 분야 선택 */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                padding: "4px 10px",
                borderRadius: "20px",
                border: category === cat ? "1px solid #ff6600" : "1px solid rgba(255,255,255,0.15)",
                background: category === cat ? "rgba(255,100,0,0.2)" : "transparent",
                color: category === cat ? "#ff8833" : "rgba(255,255,255,0.5)",
                fontSize: "12px",
                cursor: "pointer",
                transition: "all 0.2s",
                fontFamily: "'Noto Sans KR', sans-serif",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 작업명 입력 */}
        <input
          value={task}
          onChange={e => setTask(e.target.value)}
          onKeyDown={handleKey}
          placeholder="할 일 입력..."
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,120,0,0.25)",
            borderRadius: "12px",
            padding: "12px 14px",
            color: "#fff",
            fontSize: "15px",
            outline: "none",
            boxSizing: "border-box",
            fontFamily: "'Noto Sans KR', sans-serif",
            marginBottom: "10px",
          }}
        />

        {/* 날짜 */}
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,120,0,0.2)",
            borderRadius: "12px",
            padding: "10px 14px",
            color: "rgba(255,255,255,0.7)",
            fontSize: "14px",
            outline: "none",
            boxSizing: "border-box",
            marginBottom: "14px",
            colorScheme: "dark",
          }}
        />

        {/* 등록 버튼 */}
        <button
          onClick={addToNotion}
          disabled={loading}
          style={{
            width: "100%",
            padding: "13px",
            borderRadius: "12px",
            border: "none",
            background: loading
              ? "rgba(255,100,0,0.3)"
              : "linear-gradient(135deg, #ff6600, #cc4400)",
            color: "#fff",
            fontSize: "15px",
            fontWeight: "700",
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "'Noto Sans KR', sans-serif",
            letterSpacing: "0.05em",
            transition: "all 0.2s",
            boxShadow: loading ? "none" : "0 4px 20px rgba(255,100,0,0.3)",
          }}
        >
          {loading ? "등록 중..." : "등록"}
        </button>
      </div>

      {/* 스트릭 */}
      {streak > 0 && (
        <p style={{ color: "rgba(255,150,50,0.6)", fontSize: "12px", marginTop: "16px" }}>
          연속 {streak}개 완료 등록
        </p>
      )}
    </div>
  );
}
