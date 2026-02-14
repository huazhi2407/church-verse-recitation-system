import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { getCumulativeContent } from "@/lib/weekUtils";
import pinyin from "pinyin";

/** 移除拼音聲調，只留音節（的/得/地 → de，字不同音同即視為一樣） */
function stripTone(py: string): string {
  return py
    .replace(/ǖ|ǘ|ǚ|ǜ|ü/g, "v")
    .replace(/ā|á|ǎ|à/g, "a")
    .replace(/ē|é|ě|è/g, "e")
    .replace(/ī|í|ǐ|ì/g, "i")
    .replace(/ō|ó|ǒ|ò/g, "o")
    .replace(/ū|ú|ǔ|ù/g, "u")
    .replace(/ń|ň|ǹ|n/g, "n")
    .replace(/ḿ|m̀|m̌|m/g, "m")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** 將中文轉成「無聲調拼音」字串，用於比對（字不同、音同即可） */
function toPlainPinyin(text: string): string {
  if (!text || !text.trim()) return "";
  try {
    const arr = pinyin(text, { style: pinyin.STYLE_TONE, heteronym: false });
    const syllables = arr.map((readings) => (readings[0] ? stripTone(readings[0]) : ""));
    return syllables.join(" ");
  } catch {
    return "";
  }
}

/** 移除經文中的節數／經節標記，背誦時不用講「十六」等節數 */
function removeVerseNumbers(text: string): string {
  return text
    .replace(/\{[一二三四五六七八九十百千零０-９0-9]+\}/g, "") // {十六}、{1} 等
    .replace(/\「[一二三四五六七八九十百千零０-９0-9]+\」/g, "") // 「十六」「一」等
    .replace(/第[一二三四五六七八九十百千零０-９0-9]+節/g, "") // 第十六節、第1節等
    .replace(/^[一二三四五六七八九十百千零０-９0-9]+\s*[\「\"]?/g, "") // 開頭 十六「 或 16 "
    .replace(/\s+/g, " ")
    .trim();
}

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
    const expected = testFirstVerseOnly
      ? (segments[0] ?? "")
      : getCumulativeContent(segments, day);

    const clean = (s: string) =>
      s
        .replace(/\s+/g, " ")
        .replace(/[,，.。、；;：:]/g, " ")
        .trim();
    const expectedNorm = clean(removeVerseNumbers(expected));
    const recitedNorm = clean(removeVerseNumbers(recitedText));
    const expectedPinyin = toPlainPinyin(expectedNorm);
    const recitedPinyin = toPlainPinyin(recitedNorm);

    if (expectedPinyin.length < 2) {
      const acc = recitedPinyin.length >= 1 ? 100 : 0;
      return NextResponse.json({ pass: acc >= 90, accuracy: acc });
    }

    const expectedSyl = expectedPinyin.split(/\s+/).filter(Boolean);
    const recitedSyl = recitedPinyin.split(/\s+/).filter(Boolean);
    let matchCount = 0;
    let recitedIdx = 0;
    for (let i = 0; i < expectedSyl.length && recitedIdx < recitedSyl.length; i++) {
      if (expectedSyl[i] === recitedSyl[recitedIdx]) {
        matchCount++;
        recitedIdx++;
      } else {
        const next = recitedSyl.indexOf(expectedSyl[i], recitedIdx);
        if (next !== -1) {
          matchCount++;
          recitedIdx = next + 1;
        }
      }
    }
    const accuracy = Math.round((matchCount / expectedSyl.length) * 100);
    const pass = accuracy >= 90;

    return NextResponse.json({ pass, accuracy });
  } catch (e) {
    console.error("Verify recitation error:", e);
    return NextResponse.json(
      { error: "驗證失敗，請稍後再試" },
      { status: 500 }
    );
  }
}
