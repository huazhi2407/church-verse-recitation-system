"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import Link from "next/link";
import {
  getWeekId,
  getDayOfWeek,
  getCumulativeContent,
  DAY_LABELS,
} from "@/lib/weekUtils";

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [verse, setVerse] = useState<{
    reference: string;
    segments: string[];
  } | null>(null);
  const [recording, setRecording] = useState(false);
  const [recitedText, setRecitedText] = useState("");
  const [verifyStatus, setVerifyStatus] = useState<
    "idle" | "checking" | "pass" | "fail"
  >("idle");
  const [verifyAccuracy, setVerifyAccuracy] = useState<number | null>(null);
  const [checkInStatus, setCheckInStatus] = useState<
    "idle" | "saving" | "done" | "err"
  >("idle");
  const [todayCheckIn, setTodayCheckIn] = useState<boolean | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const justStoppedRef = useRef(false);

  const now = new Date();
  const weekId = getWeekId(now);
  const dayOfWeek = getDayOfWeek(now);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "weeklyVerses", weekId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setVerse(snap.data() as typeof verse);
      else setVerse(null);
    });
    return () => unsub();
  }, [user, weekId]);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "checkins", user.uid, "weeks", weekId);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data();
      const dayKey = `day${dayOfWeek}` as keyof typeof data;
      setTodayCheckIn(!!data?.[dayKey]);
    });
    return () => unsub();
  }, [user, weekId, dayOfWeek]);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  const startRecording = async () => {
    try {
      setRecitedText("");
      setVerifyStatus("idle");
      recognitionRef.current = null;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();

      // 錄音同時啟動語音辨識（辨識「正在說」的內容，結束錄音時就有文字）
      const Win = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
      const Recognition = Win.SpeechRecognition || Win.webkitSpeechRecognition;
      if (typeof Recognition !== "undefined") {
        const RecClass = Recognition as new () => {
          continuous: boolean;
          interimResults: boolean;
          lang: string;
          onresult: (e: { results: unknown }) => void;
          onend: () => void;
          start: () => void;
          stop: () => void;
        };
        const rec = new RecClass();
        rec.continuous = true;
        rec.interimResults = false;
        rec.lang = "zh-TW";
        rec.onresult = (e: { results: unknown }) => {
          const results = e.results as Iterable<{ 0: { transcript: string }; length: number }>;
          const t = Array.from(results)
            .map((r) => r[0].transcript)
            .join("");
          if (t) setRecitedText((prev) => (prev ? prev + t : t));
        };
        rec.onend = () => {};
        rec.start();
        recognitionRef.current = rec;
      }

      setRecording(true);
    } catch (err) {
      console.error(err);
      setVerifyStatus("fail");
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state !== "recording") return;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }

    mr.stop();
    setRecording(false);
    justStoppedRef.current = true;
  };

  const runVerify = async (text: string) => {
    if (!text.trim()) return;
    setVerifyStatus("checking");
    setVerifyAccuracy(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/verify-recitation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({
          weekId,
          day: dayOfWeek,
          recitedText: text.trim(),
        }),
      });
      const data = await res.json();
      const accuracy = typeof data.accuracy === "number" ? data.accuracy : 0;
      setVerifyAccuracy(accuracy);
      setVerifyStatus(data.pass ? "pass" : "fail");
    } catch {
      setVerifyAccuracy(0);
      setVerifyStatus("fail");
    }
  };

  const handleVerify = () => runVerify(recitedText);

  const resetForRerecord = () => {
    setRecitedText("");
    setVerifyStatus("idle");
    setVerifyAccuracy(null);
  };

  const handleCheckIn = async () => {
    if (verifyStatus !== "pass" || !user) return;
    setCheckInStatus("saving");
    try {
      const checkinRef = doc(db, "checkins", user.uid, "weeks", weekId);
      const snap = await getDoc(checkinRef);
      const prev = snap.data() ?? {};
      await setDoc(checkinRef, {
        ...prev,
        [`day${dayOfWeek}`]: serverTimestamp(),
      });
      setCheckInStatus("done");
    } catch {
      setCheckInStatus("err");
    }
  };

  const todayContent = verse
    ? getCumulativeContent(verse.segments, dayOfWeek)
    : "";
  // 結束錄音後，若有辨識結果則自動驗證（不需手動貼文）
  useEffect(() => {
    if (!recording && justStoppedRef.current && recitedText.trim() && verifyStatus === "idle") {
      justStoppedRef.current = false;
      runVerify(recitedText);
    }
  }, [recording, recitedText, verifyStatus]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--muted)]">載入中…</p>
      </main>
    );
  }
  if (!user) return null;

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[var(--muted)] text-sm">
            {user.name} · 帳號 {user.uid}
          </p>
          <h1 className="text-xl font-bold">本週經文 · 第 {DAY_LABELS[dayOfWeek - 1]} 天</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/progress"
            className="px-3 py-1.5 rounded-lg border border-white/20 text-sm hover:bg-white/5"
          >
            過曆表格
          </Link>
          {user.role === "admin" && (
            <Link
              href="/admin"
              className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium"
            >
              管理經文
            </Link>
          )}
          <button
            type="button"
            onClick={() => signOut().then(() => router.replace("/"))}
            className="px-3 py-1.5 rounded-lg border border-white/20 text-sm hover:bg-white/5"
          >
            登出
          </button>
        </div>
      </header>

      <section className="rounded-2xl bg-[var(--card)] border border-white/10 p-6 mb-6">
        <p className="text-[var(--muted)] text-sm mb-2">本週 {weekId}</p>
        {verse ? (
          recording ? (
            <div className="py-8 text-center">
              <p className="text-[var(--muted)] font-medium">
                錄音中 · 經文已隱藏
              </p>
              <p className="text-[var(--muted)] text-sm mt-1">
                請憑記憶背誦，完成後按「結束錄音」
              </p>
            </div>
          ) : (
            <>
              <p className="text-[var(--accent)] font-medium mb-3">
                {verse.reference}
              </p>
              <p className="text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                {todayContent || "（本日尚無段落）"}
              </p>
            </>
          )
        ) : (
          <p className="text-[var(--muted)]">
            本週尚未填寫經文
            {user.role === "admin" && "，請至「管理經文」填寫。"}
          </p>
        )}
      </section>

      {verse && todayContent && (
        <section className="rounded-2xl bg-[var(--card)] border border-white/10 p-6 space-y-4">
          <h2 className="font-semibold">錄音 + AI 感測簽到</h2>
          <p className="text-sm text-[var(--muted)]">
            錄音背誦經文，AI 會給出準確度；達 90% 以上即可簽到，低於 90% 需重錄。
          </p>

          {todayCheckIn ? (
            <p className="text-emerald-400 font-medium">✓ 今日已簽到</p>
          ) : (
            <>
              <div className="flex gap-2 flex-wrap">
                {!recording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="px-4 py-2 rounded-lg bg-red-500/20 text-red-300 font-medium hover:bg-red-500/30"
                  >
                    開始錄音
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-300 font-medium"
                  >
                    結束錄音
                  </button>
                )}
                {verifyStatus === "fail" && (
                  <button
                    type="button"
                    onClick={resetForRerecord}
                    className="px-4 py-2 rounded-lg border border-white/20 text-sm hover:bg-white/5"
                  >
                    重新錄音
                  </button>
                )}
              </div>

              {verifyStatus === "checking" && (
                <p className="text-[var(--muted)] text-sm">AI 檢測中…</p>
              )}

              {verifyStatus === "pass" && verifyAccuracy !== null && (
                <div className="space-y-2">
                  <p className="text-emerald-400 font-medium">
                    準確度 {verifyAccuracy}%，通過
                  </p>
                  <button
                    type="button"
                    onClick={handleCheckIn}
                    disabled={checkInStatus === "saving" || checkInStatus === "done"}
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50"
                  >
                    {checkInStatus === "saving"
                      ? "簽到中…"
                      : checkInStatus === "done"
                        ? "已簽到"
                        : "確認簽到"}
                  </button>
                </div>
              )}

              {verifyStatus === "fail" && verifyAccuracy !== null && (
                <p className="text-red-400 text-sm">
                  準確度 {verifyAccuracy}%，需達 90% 請重錄。
                </p>
              )}

              {!recitedText.trim() && !recording && (
                <div className="space-y-2">
                  <p className="text-[var(--muted)] text-sm">
                    結束錄音後將自動辨識並檢測，無需貼文。
                  </p>
                  <p className="text-amber-200/90 text-xs">
                    若裝置無法自動辨識，可輸入經文後按「驗證」：
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={recitedText}
                      onChange={(e) => setRecitedText(e.target.value)}
                      placeholder="輸入背誦內容"
                      className="flex-1 rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                    <button
                      type="button"
                      onClick={handleVerify}
                      disabled={verifyStatus === "checking" || !recitedText.trim()}
                      className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50 shrink-0"
                    >
                      驗證
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}
