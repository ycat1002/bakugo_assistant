// pages/api/db.js — Cloudflare D1 cloud storage (replaces notion.js)
const ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const DB_ID = process.env.CF_D1_DATABASE_ID;
const API_TOKEN = process.env.CF_API_TOKEN;

const d1 = async (sql, params = []) => {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    }
  );
  const data = await res.json();
  if (!data.success) throw new Error(data.errors?.[0]?.message || "D1 query failed");
  return data.result?.[0]?.results || [];
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { action, payload } = req.body;

  if (!ACCOUNT_ID || !DB_ID || !API_TOKEN) {
    return res.status(500).json({ error: "Cloudflare D1 env vars not set" });
  }

  try {
    // ── 1. 과업 전체 조회 ──
    if (action === "get_tasks") {
      const rows = await d1("SELECT * FROM tasks ORDER BY created_at ASC LIMIT 100");
      return res.status(200).json({ results: rows });
    }

    // ── 2. 분야 옵션 조회 ──
    if (action === "get_categories") {
      const rows = await d1("SELECT DISTINCT category FROM tasks WHERE category IS NOT NULL");
      const options = rows.map((r) => r.category).filter(Boolean);
      return res.status(200).json({ options });
    }

    // ── 3. 과업 등록 ──
    if (action === "add_task") {
      const p = payload;
      const id = crypto.randomUUID().replace(/-/g, "");
      await d1(
        "INSERT INTO tasks (id, task, category, date, done) VALUES (?, ?, ?, ?, 0)",
        [id, p.task, p.category || "기타", p.date || ""]
      );
      return res.status(200).json({ ok: true, id });
    }

    // ── 4. 완료 처리 ──
    if (action === "complete") {
      if (!payload?.id) return res.status(400).json({ error: "id required" });
      await d1("UPDATE tasks SET done = 1 WHERE id = ?", [payload.id]);
      return res.status(200).json({ ok: true });
    }

    // ── 5. 사이드 생각 저장 ──
    if (action === "save_thought") {
      const id = crypto.randomUUID().replace(/-/g, "");
      await d1(
        "INSERT INTO side_thoughts (id, thought, context) VALUES (?, ?, ?)",
        [id, payload.thought || "", payload.context || ""]
      );
      return res.status(200).json({ ok: true, id });
    }

    // ── 6. 루틴 읽기 ──
    if (action === "get_routine") {
      const rows = await d1("SELECT content FROM routine WHERE id = 1");
      return res.status(200).json({ text: rows[0]?.content || "" });
    }

    // ── 7. 루틴 수정 ──
    if (action === "update_routine") {
      if (!payload?.content) return res.status(400).json({ error: "content required" });
      await d1(
        "UPDATE routine SET content = ?, updated_at = datetime('now') WHERE id = 1",
        [payload.content.slice(0, 5000)]
      );
      return res.status(200).json({ ok: true });
    }

    // ── 8. 채팅 기록 저장 (배치) ──
    if (action === "save_chat") {
      const messages = payload?.messages || [];
      for (const m of messages.slice(-20)) {
        const id = crypto.randomUUID().replace(/-/g, "");
        await d1(
          "INSERT INTO chat_history (id, role, text) VALUES (?, ?, ?)",
          [id, m.role, m.text || ""]
        );
      }
      return res.status(200).json({ ok: true });
    }

    // ── 9. 채팅 기록 불러오기 ──
    if (action === "get_chat") {
      const rows = await d1(
        "SELECT role, text FROM chat_history ORDER BY created_at DESC LIMIT 30"
      );
      return res.status(200).json({ messages: rows.reverse() });
    }

    // ── 10. 과업 삭제 ──
    if (action === "delete_task") {
      if (!payload?.id) return res.status(400).json({ error: "id required" });
      await d1("DELETE FROM tasks WHERE id = ?", [payload.id]);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "unknown action" });
  } catch (e) {
    console.error("[db]", e.message);
    return res.status(500).json({ error: e.message });
  }
}
