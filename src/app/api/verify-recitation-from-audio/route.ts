import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { verifyRecitation } from "@/lib/verifyRecitationLogic";
import Speech from "@google-cloud/speech";

/**
 * 存入的音檔直接給 AI 偵測：下載音檔 → 語音轉文字 → 用現有邏輯驗證
 * body: { weekId, day, audioUrl, testFirstVerseOnly? }
 * audioUrl: Firebase Storage 的 getDownloadURL() 網址（需可公開讀取或帶 token）
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

    const { weekId, day, audioUrl, testFirstVerseOnly } = (await request.json()) as {
      weekId?: string;
      day?: number;
      audioUrl?: string;
      testFirstVerseOnly?: boolean;
    };

    if (!weekId || !day || day < 1 || day > 7 || typeof audioUrl !== "string" || !audioUrl.trim()) {
      return NextResponse.json(
        { error: "請提供 weekId、day (1-7) 與 audioUrl" },
        { status: 400 }
      );
    }

    // 1. 下載音檔
    const audioRes = await fetch(audioUrl, { method: "GET" });
    if (!audioRes.ok) {
      return NextResponse.json(
        { error: "無法下載音檔，請確認網址有效且可讀取" },
        { status: 400 }
      );
    }
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

    // 2. 語音轉文字（Google Cloud Speech-to-Text）
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (!projectId || !clientEmail || !privateKey) {
      return NextResponse.json(
        { error: "伺服器未設定 Speech-to-Text 憑證" },
        { status: 500 }
      );
    }

    const speech = new Speech.SpeechClient({
      projectId,
      credentials: { client_email: clientEmail, private_key: privateKey },
    });

    const [response] = await speech.recognize({
      audio: { content: audioBuffer.toString("base64") },
      config: {
        encoding: "WEBM_OPUS" as const,
        sampleRateHertz: 48000,
        languageCode: "zh-TW",
      },
    });

    const transcript =
      response.results
        ?.map((r) => r.alternatives?.[0]?.transcript)
        .filter(Boolean)
        .join(" ") ?? "";

    if (!transcript.trim()) {
      return NextResponse.json(
        { error: "無法辨識音檔內容，請確認為中文語音且格式正確（建議 WebM/Opus）" },
        { status: 400 }
      );
    }

    // 3. 用現有邏輯驗證
    const verseSnap = await adminDb.collection("weeklyVerses").doc(weekId).get();
    if (!verseSnap.exists) {
      return NextResponse.json({ error: "該週經文不存在" }, { status: 404 });
    }

    const data = verseSnap.data()!;
    const segments = (data.segments as string[]) ?? [];
    const { pass, accuracy } = verifyRecitation(
      segments,
      day,
      transcript,
      !!testFirstVerseOnly
    );

    return NextResponse.json({
      pass,
      accuracy,
      transcript: transcript.trim(),
    });
  } catch (e) {
    console.error("Verify from audio error:", e);
    return NextResponse.json(
      { error: "音檔偵測失敗，請稍後再試" },
      { status: 500 }
    );
  }
}
