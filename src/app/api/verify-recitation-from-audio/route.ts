import { NextResponse } from "next/server";
import { adminAuth, adminDb, adminStorage } from "@/lib/firebase-admin";
import { verifyRecitation } from "@/lib/verifyRecitationLogic";
import { convertWebmToFlac } from "@/lib/convertWebmToFlac";
import { SpeechClient } from "@google-cloud/speech";

/** 語音辨識回傳形狀，避免依賴 @google-cloud/speech 的型別命名空間 */
type RecognizeResult = { results?: { alternatives?: { transcript?: string }[] }[] };

type EncodingConfig =
  | { encoding: "WEBM_OPUS"; sampleRateHertz: number }
  | { encoding: "MP3" }
  | { encoding: "FLAC" }
  | { encoding: "OGG_OPUS"; sampleRateHertz: number };

function detectAudioConfig(buffer: Buffer): EncodingConfig | null {
  const b = buffer;
  if (b.length < 4) return null;
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) {
    return { encoding: "WEBM_OPUS", sampleRateHertz: 48000 };
  }
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return { encoding: "MP3" };
  if (b[0] === 0xff && (b[1] === 0xfb || b[1] === 0xfa)) return { encoding: "MP3" };
  if (b[0] === 0x66 && b[1] === 0x4c && b[2] === 0x61 && b[3] === 0x43) return { encoding: "FLAC" };
  if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) {
    return { encoding: "OGG_OPUS", sampleRateHertz: 48000 };
  }
  return null;
}

/**
 * 存入的音檔直接給 AI 偵測：下載音檔 → 語音轉文字 → 用現有邏輯驗證
 * body: { weekId, day, audioUrl, testFirstVerseOnly? }
 * audioUrl: Firebase Storage 的 getDownloadURL() 網址（需可公開讀取或帶 token）
 * 支援格式：WebM/Opus、MP3、FLAC、OGG/Opus
 * @see 使用 SpeechClient named import 與 RecognizeResult 型別，避免 Speech namespace 建置錯誤
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
    const decoded = await adminAuth.verifyIdToken(token);
    const userId = decoded.uid;

    const { weekId, day, audioUrl, testFirstVerseOnly, testFirstSixSegments } = (await request.json()) as {
      weekId?: string;
      day?: number;
      audioUrl?: string;
      testFirstVerseOnly?: boolean;
      testFirstSixSegments?: boolean;
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
    const sizeMB = audioBuffer.length / (1024 * 1024);
    if (sizeMB > 10) {
      return NextResponse.json(
        { error: "音檔過大（超過 10MB），請縮短錄音或壓縮後再試" },
        { status: 400 }
      );
    }

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

    const speech = new SpeechClient({
      projectId,
      credentials: { client_email: clientEmail, private_key: privateKey },
    });

    let audioConfig = detectAudioConfig(audioBuffer) ?? { encoding: "WEBM_OPUS" as const, sampleRateHertz: 48000 };
    let bufferToUse: Buffer = audioBuffer;
    let encodingToUse: EncodingConfig = audioConfig;
    let convertedFlacPath: string | undefined;

    // WebM/Opus 部分環境（如 Gemini、部分 Speech-to-Text）不支援，先轉成 FLAC 再辨識
    if (audioConfig.encoding === "WEBM_OPUS") {
      try {
        bufferToUse = await convertWebmToFlac(audioBuffer) as Buffer;
        encodingToUse = { encoding: "FLAC" };
        // 轉完的 FLAC 上傳到 Storage，與原錄音同路徑結構、副檔名 .flac
        convertedFlacPath = `recordings/${userId}/${weekId}/rec-${Date.now()}-converted.flac`;
        const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET;
        const bucket = bucketName ? adminStorage.bucket(bucketName) : adminStorage.bucket();
        const file = bucket.file(convertedFlacPath);
        await file.save(bufferToUse, {
          contentType: "audio/flac",
          metadata: { cacheControl: "public, max-age=31536000" },
        });
      } catch (convertErr) {
        console.error("WebM to FLAC conversion failed:", convertErr);
        // 轉檔失敗時仍用原本 WebM 試一次
      }
    }

    const base64 = bufferToUse.toString("base64");
    let response: RecognizeResult | null = null;

    const runRecognize = (cfg: EncodingConfig) => {
      const config = {
        languageCode: "zh-TW" as const,
        encoding: cfg.encoding,
        ...("sampleRateHertz" in cfg && { sampleRateHertz: cfg.sampleRateHertz }),
      };
      return speech.recognize({ audio: { content: base64 }, config: config as Parameters<SpeechClient["recognize"]>[0]["config"] });
    };

    try {
      const [res] = await runRecognize(encodingToUse);
      response = res as RecognizeResult;
    } catch (firstErr) {
      const msg = String((firstErr as Error).message).toLowerCase();
      if (
        (msg.includes("invalid") || msg.includes("encoding") || msg.includes("sample")) &&
        encodingToUse.encoding === "WEBM_OPUS" &&
        "sampleRateHertz" in encodingToUse &&
        encodingToUse.sampleRateHertz === 48000
      ) {
        const [res] = await runRecognize({ encoding: "WEBM_OPUS", sampleRateHertz: 44100 });
        response = res as RecognizeResult;
      } else {
        throw firstErr;
      }
    }

    const transcript =
      response?.results
        ?.map((r) => r.alternatives?.[0]?.transcript)
        .filter(Boolean)
        .join(" ") ?? "";

    if (!transcript.trim()) {
      return NextResponse.json(
        { error: "無法辨識音檔內容，請確認為中文語音（支援 WebM/Opus、MP3、FLAC、OGG）" },
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
      !!testFirstVerseOnly,
      !!testFirstSixSegments
    );

    return NextResponse.json({
      pass,
      accuracy,
      transcript: transcript.trim(),
      ...(convertedFlacPath && { convertedFlacPath }),
    });
  } catch (e) {
    console.error("Verify from audio error:", e);
    const err = e as {
      message?: string;
      details?: string | { message?: string }[];
      code?: number;
    };
    const raw =
      err?.message ??
      (typeof err?.details === "string" ? err.details : Array.isArray(err?.details) ? err.details[0]?.message : undefined) ??
      (e instanceof Error ? e.message : String(e));
    const msg = (raw ?? "").toLowerCase();
    let message = "音檔偵測失敗，請稍後再試";
    if (msg.includes("invalid") || msg.includes("encoding") || msg.includes("sample rate") || msg.includes("unsupported") || msg.includes("3 invalid_argument")) {
      message = "音檔格式不支援，請用「開始錄音」錄製或上傳 WebM/Opus、MP3、FLAC、OGG 格式";
    } else if (msg.includes("resource exhausted") || msg.includes("quota") || msg.includes("deadline") || msg.includes("exceeded") || msg.includes("4 deadline") || msg.includes("8 resource_exhausted")) {
      message = "語音辨識服務忙碌或逾時，請稍後再試（音檔建議 1 分鐘內）";
    } else if (msg.includes("unauthenticated") || msg.includes("permission denied") || msg.includes("7 permission_denied") || msg.includes("16 unauthenticated")) {
      message = "伺服器語音辨識未設定完成，請聯絡管理員";
    } else if (msg.includes("fetch") || msg.includes("econnrefused") || msg.includes("enotfound") || msg.includes("network")) {
      message = "無法下載音檔，請確認網址有效或稍後再試";
    } else if (raw && raw.length < 120) {
      message = `音檔偵測失敗：${raw}`;
    } else if (raw) {
      message = `音檔偵測失敗：${raw.slice(0, 80)}…`;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
