import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { verifyRecitation } from "@/lib/verifyRecitationLogic";

/**
 * 驗證背誦：以「拼音」比對，字不同但讀音相同即算對
 * body: { weekId, day, recitedText, testFirstVerseOnly? }
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

    const { weekId, day, recitedText, testFirstVerseOnly } = (await request.json()) as {
      weekId?: string;
      day?: number;
      recitedText?: string;
      testFirstVerseOnly?: boolean;
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
    const { pass, accuracy } = verifyRecitation(
      segments,
      day,
      recitedText,
      !!testFirstVerseOnly
    );

    return NextResponse.json({ pass, accuracy });
  } catch (e) {
    console.error("Verify recitation error:", e);
    return NextResponse.json(
      { error: "驗證失敗，請稍後再試" },
      { status: 500 }
    );
  }
}
