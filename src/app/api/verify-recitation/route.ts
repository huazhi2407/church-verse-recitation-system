import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { getCumulativeContent } from "@/lib/weekUtils";

/**
 * 驗證使用者背誦內容是否與當日經文相符（文字比對）
 * body: { weekId, day, recitedText }
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }
    const token = authHeader.slice(7);
    if (!token) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }
    await adminAuth.verifyIdToken(token);

    const { weekId, day, recitedText } = (await request.json()) as {
      weekId?: string;
      day?: number;
      recitedText?: string;
    };

    if (!weekId || !day || day < 1 || day > 7 || typeof recitedText !== "string") {
      return NextResponse.json(
        { error: "請提供 weekId、day (1-7) 與 recitedText" },
        { status: 400 }
      );
    }

    const verseSnap = await adminDb.collection("weeklyVerses").doc(weekId).get();
    if (!verseSnap.exists) {
      return NextResponse.json({ error: "該週經文不存在" }, { status: 404 });
    }

    const data = verseSnap.data()!;
    const segments = (data.segments as string[]) ?? [];
    const expected = getCumulativeContent(segments, day);

    const normalize = (s: string) =>
      s
        .replace(/\s+/g, "")
        .replace(/[,，.。、；;：:]/g, "")
        .trim();
    const expectedNorm = normalize(expected);
    const recitedNorm = normalize(recitedText);

    if (expectedNorm.length < 3) {
      const acc = recitedNorm.length >= 2 ? 100 : 0;
      return NextResponse.json({ pass: acc >= 95, accuracy: acc });
    }

    // 字元比對，計算準確度（0–100）
    let matchCount = 0;
    let recitedIdx = 0;
    for (let i = 0; i < expectedNorm.length && recitedIdx < recitedNorm.length; i++) {
      if (expectedNorm[i] === recitedNorm[recitedIdx]) {
        matchCount++;
        recitedIdx++;
      } else {
        const nextInRecited = recitedNorm.indexOf(expectedNorm[i], recitedIdx);
        if (nextInRecited !== -1) {
          matchCount++;
          recitedIdx = nextInRecited + 1;
        }
      }
    }
    const accuracy = Math.round((matchCount / expectedNorm.length) * 100);
    const pass = accuracy >= 95;

    return NextResponse.json({ pass, accuracy });
  } catch (e) {
    console.error("Verify recitation error:", e);
    return NextResponse.json(
      { error: "驗證失敗，請稍後再試" },
      { status: 500 }
    );
  }
}
