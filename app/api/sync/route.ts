import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "../../../packages/db";
import { getChatGPTUser } from "../../chatgpt-auth";

const MAX_STATE_BYTES = 2_000_000;

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "需要登录后才能云端同步。" }, { status: 401 });

  const row = await getD1().prepare("SELECT payload, updated_at FROM user_states WHERE user_id = ?")
    .bind(user.userId)
    .first<{ payload: string; updated_at: string }>();

  if (!row) return NextResponse.json({ state: null, updatedAt: null, user: { displayName: user.displayName } });
  try {
    return NextResponse.json({ state: JSON.parse(row.payload), updatedAt: row.updated_at, user: { displayName: user.displayName } });
  } catch {
    return NextResponse.json({ error: "云端记录格式异常。" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "需要登录后才能云端同步。" }, { status: 401 });

  const body = await request.json() as { state?: unknown };
  if (!body.state || typeof body.state !== "object") return NextResponse.json({ error: "同步内容无效。" }, { status: 400 });
  const payload = JSON.stringify(body.state);
  if (new TextEncoder().encode(payload).length > MAX_STATE_BYTES) {
    return NextResponse.json({ error: "历史记录过大，暂时无法同步。" }, { status: 413 });
  }

  const updatedAt = new Date().toISOString();
  await getD1().prepare(`INSERT INTO user_states (user_id, payload, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`)
    .bind(user.userId, payload, updatedAt)
    .run();

  return NextResponse.json({ ok: true, updatedAt });
}
