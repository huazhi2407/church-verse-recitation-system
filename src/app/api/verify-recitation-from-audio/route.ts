import { NextResponse } from "next/server";
import { adminAuth, adminDb, adminStorage } from "@/lib/firebase-admin";
import { verifyRecitation } from "@/lib/verifyRecitationLogic";
import { convertWebmToLinear16 } from "@/lib/convertWebmToLinear16";
import { SpeechClient } from "@google-cloud/speech";

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

const SPEECH_SAMPLE_RATE = 16000;
const MAX_SIZE_MB = 10;
/** Vercel 等環境無 ffmpeg 時，改以 WEBM_OPUS 直接辨識 */
const WEBM_OPUS_SAMPLE_RATE = 48000;

function isWebm(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
}

/**
 * 錄音驗證：接受「上傳 webm 檔」或「audioUrl」。
 * - multipart: file (webm) + weekId + day + testFirstVerseOnly? + testFirstSixSegments?
 * - JSON: audioUrl + weekId + day + ...
 * 後端：存原始 webm 一份到 Storage → 轉 16kHz mono 僅供辨識 → Speech-to-Text → 驗證。
 * 回傳：{ audioUrl, transcript, pass, accuracy }
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

    let audioBuffer: Buffer;
    let audioUrl: string;
    let weekId: string;
    let day: number;
    let testFirstVerseOnly: boolean;
    let testFirstSixSegments: boolean;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file || !(file instanceof Blob)) {
        return NextResponse.json({ error: "請上傳音檔 (file)" }, { status: 400 });
      }
      weekId = String(formData.get("weekId") ?? "").trim();
      day = Number(formData.get("day"));
      testFirstVerseOnly = formData.get("testFirstVerseOnly") === "true";
      testFirstSixSegments = formData.get("testFirstSixSegments") === "true";

      if (!weekId || !day || day < 1 || day > 7) {
        return NextResponse.json({ error: "請提供 weekId、day (1-7)" }, { status: 400 });
      }

      const ab = await file.arrayBuffer();
      audioBuffer = Buffer.from(ab);
      const sizeMB = audioBuffer.length / (1024 * 1024);
      if (sizeMB > MAX_SIZE_MB) {
        return NextResponse.json(
          { error: `音檔過大（超過 ${MAX_SIZE_MB}MB），請縮短錄音` },
          { status: 400 }
        );
      }

      // 存原始 webm 到 Storage（只存一份）
      const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET;
      const bucket = bucketName ? adminStorage.bucket(bucketName) : adminStorage.bucket();
      const path = `recordings/${userId}/${weekId}/rec-${Date.now()}.webm`;
      const fileRef = bucket.file(path);
      await fileRef.save(audioBuffer, {
        contentType: "audio/webm",
        metadata: { cacheControl: "public, max-age=31536000" },
      });
      const [signedUrl] = await fileRef.getSignedUrl({
        action: "read",
        expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
      audioUrl = signedUrl;
    } else {
      const body = (await request.json()) as {
        weekId?: string;
        day?: number;
        audioUrl?: string;
        testFirstVerseOnly?: boolean;
        testFirstSixSegments?: boolean;
      };
      weekId = String(body.weekId ?? "").trim();
      day = Number(body.day);
      testFirstVerseOnly = !!body.testFirstVerseOnly;
      testFirstSixSegments = !!body.testFirstSixSegments;

      if (!weekId || !day || day < 1 || day > 7 || typeof body.audioUrl !== "string" || !body.audioUrl.trim()) {
        return NextResponse.json(
          { error: "請提供 weekId、day (1-7) 與 audioUrl" },
          { status: 400 }
        );
      }
      audioUrl = body.audioUrl.trim();

      const res = await fetch(audioUrl, { method: "GET" });
      if (!res.ok) {
        return NextResponse.json(
          { error: "無法下載音檔，請確認網址有效" },
          { status: 400 }
        );
      }
      audioBuffer = Buffer.from(await res.arrayBuffer());
      const sizeMB = audioBuffer.length / (1024 * 1024);
      if (sizeMB > MAX_SIZE_MB) {
        return NextResponse.json(
          { error: `音檔過大（超過 ${MAX_SIZE_MB}MB）` },
          { status: 400 }
        );
      }
    }

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

    let base64: string;
    let config: { languageCode: "zh-TW"; encoding: string; sampleRateHertz?: number };

    if (isWebm(audioBuffer)) {
      // 只存 webm；辨識：優先 ffmpeg → 16kHz mono buffer → STT；失敗則改 WEBM_OPUS（Vercel 無 ffmpeg）
      try {
        const wavBuffer = await convertWebmToLinear16(audioBuffer);
        base64 = wavBuffer.toString("base64");
        config = { languageCode: "zh-TW", encoding: "LINEAR16", sampleRateHertz: SPEECH_SAMPLE_RATE };
      } catch (err) {
        console.warn("WebM ffmpeg conversion failed, using WEBM_OPUS:", err);
        base64 = audioBuffer.toString("base64");
        config = { languageCode: "zh-TW", encoding: "WEBM_OPUS", sampleRateHertz: WEBM_OPUS_SAMPLE_RATE };
      }
    } else {
      const audioConfig = detectAudioConfig(audioBuffer);
      if (!audioConfig) {
        return NextResponse.json(
          { error: "不支援的音檔格式，請用「開始錄音」錄製或上傳 WebM/MP3/FLAC/OGG" },
          { status: 400 }
        );
      }
      base64 = audioBuffer.toString("base64");
      config = {
        languageCode: "zh-TW",
        encoding: audioConfig.encoding,
        ...("sampleRateHertz" in audioConfig && { sampleRateHertz: audioConfig.sampleRateHertz }),
      };
    }

    const [res] = await speech.recognize({
      audio: { content: base64 },
      config: config as Parameters<SpeechClient["recognize"]>[0]["config"],
    });
    const response = res as RecognizeResult;
    const transcript =
      response?.results
        ?.map((r) => r.alternatives?.[0]?.transcript)
        .filter(Boolean)
        .join(" ") ?? "";

    if (!transcript.trim()) {
      return NextResponse.json(
        { error: "無法辨識音檔內容，請確認為中文語音" },
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
      transcript,
      testFirstVerseOnly,
      testFirstSixSegments
    );

    return NextResponse.json({
      audioUrl,
      transcript: transcript.trim(),
      pass,
      accuracy,
    });
  } catch (e) {
    console.error("Verify from audio error:", e);
    const err = e as { message?: string; details?: string | { message?: string }[] };
    const raw =
      err?.message ??
      (Array.isArray(err?.details) ? err?.details[0]?.message : undefined) ??
      (e instanceof Error ? e.message : String(e));
    const msg = (raw ?? "").toLowerCase();
    let message = "音檔偵測失敗，請稍後再試";
    if (msg.includes("invalid") || msg.includes("encoding") || msg.includes("sample") || msg.includes("unsupported")) {
      message = "音檔格式不支援，請用「開始錄音」錄製 WebM";
    } else if (msg.includes("resource exhausted") || msg.includes("quota") || msg.includes("deadline")) {
      message = "語音辨識服務忙碌或逾時，請稍後再試（音檔建議 1 分鐘內）";
    } else if (msg.includes("permission") || msg.includes("unauthenticated")) {
      message = "伺服器語音辨識未設定完成，請聯絡管理員";
    } else if (raw && raw.length < 120) {
      message = `音檔偵測失敗：${raw}`;
    } else if (raw) {
      message = `音檔偵測失敗：${raw.slice(0, 80)}…`;
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
