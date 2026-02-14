"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { ref, getDownloadURL } from "firebase/storage";
import { auth, storage } from "@/lib/firebase";
import Link from "next/link";
import {
  getWeekId,
  getDayOfWeek,
  getPrevWeekId,
  getNextWeekId,
  parseWeekId,
  DAY_LABELS,
} from "@/lib/weekUtils";

type MemberRow = {
  uid: string;
  name: string;
  day1: boolean;
  day2: boolean;
  day3: boolean;
  day4: boolean;
  day5: boolean;
  day6: boolean;
  day7: boolean;
};

function formatWeekLabel(weekId: string): string {
  const d = parseWeekId(weekId);
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  return `${weekId} ～ ${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
}

export default function ProgressPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [weekId, setWeekId] = useState(() => getWeekId(new Date()));
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [recordings, setRecordings] = useState<{ path: string; userId: string; userName: string; name: string }[]>([]);
  const [loadingRecordings, setLoadingRecordings] = useState(false);
  const [playingPath, setPlayingPath] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoadingList(true);
    auth.currentUser?.getIdToken().then((token) => {
      if (cancelled) return;
      fetch(`/api/progress?weekId=${encodeURIComponent(weekId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled && data.members) setMembers(data.members);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoadingList(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [user, weekId]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    let cancelled = false;
    setLoadingRecordings(true);
    setRecordings([]);
    auth.currentUser?.getIdToken().then((token) => {
      if (cancelled) return;
      fetch(`/api/admin/recordings?weekId=${encodeURIComponent(weekId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled && data.recordings) setRecordings(data.recordings);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoadingRecordings(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [user, weekId]);

  const playRecording = async (path: string) => {
    try {
      setPlayingPath(path);
      const url = await getDownloadURL(ref(storage, path));
      const audio = new Audio(url);
      audio.onended = () => setPlayingPath(null);
      audio.onerror = () => setPlayingPath(null);
      await audio.play();
    } catch {
      setPlayingPath(null);
    }
  };

  const now = new Date();
  const currentWeekId = getWeekId(now);
  const todayDay = getDayOfWeek(now);

  const getCellStatus = (
    dayNum: number,
    checked: boolean
  ): "done" | "missed" | "future" => {
    const isCurrentWeek = weekId === currentWeekId;
    if (isCurrentWeek) {
      if (dayNum < todayDay) return checked ? "done" : "missed";
      if (dayNum === todayDay) return checked ? "done" : "missed";
      return "future";
    }
    if (weekId < currentWeekId) return checked ? "done" : "missed";
    return "future";
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--muted)]">載入中…</p>
      </main>
    );
  }
  if (!user) return null;

  return (
    <main className="min-h-screen p-4 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">過曆表格</h1>
        <Link
          href="/dashboard"
          className="px-3 py-1.5 rounded-lg border border-white/20 text-sm hover:bg-white/5"
        >
          返回首頁
        </Link>
      </header>

      <div className="flex items-center justify-center gap-4 mb-6">
        <button
          type="button"
          onClick={() => setWeekId(getPrevWeekId(weekId))}
          className="p-2 rounded-lg border border-white/20 hover:bg-white/5"
          aria-label="上一週"
        >
          ←
        </button>
        <p className="text-[var(--muted)] min-w-[240px] text-center">
          {formatWeekLabel(weekId)}
        </p>
        <button
          type="button"
          onClick={() => setWeekId(getNextWeekId(weekId))}
          className="p-2 rounded-lg border border-white/20 hover:bg-white/5"
          aria-label="下一週"
        >
          →
        </button>
      </div>

      <p className="text-sm text-[var(--muted)] mb-2">
        綠：已簽到 · 紅：未完成 · 灰：未到／未來
      </p>

      {loadingList ? (
        <p className="text-[var(--muted)]">載入進度…</p>
      ) : (
        <div className="rounded-2xl bg-[var(--card)] border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left p-3 font-medium">帳號 / 名字</th>
                {DAY_LABELS.map((label, i) => (
                  <th
                    key={i}
                    className="p-2 text-center font-medium text-[var(--muted)]"
                  >
                    第{label}天
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr
                  key={m.uid}
                  className="border-b border-white/5 hover:bg-white/5"
                >
                  <td className="p-3">
                    <span className="text-[var(--muted)]">{m.uid}</span>
                    <span className="ml-2">{m.name}</span>
                  </td>
                  {([1, 2, 3, 4, 5, 6, 7] as const).map((d) => {
                    const status = getCellStatus(
                      d,
                      m[`day${d}` as keyof MemberRow] as boolean
                    );
                    return (
                      <td key={d} className="p-2 text-center">
                        <span
                          className={`inline-block w-8 h-8 rounded ${
                            status === "done"
                              ? "bg-emerald-500/30 text-emerald-300"
                              : status === "missed"
                                ? "bg-red-500/20 text-red-300"
                                : "bg-white/10 text-[var(--muted)]"
                          }`}
                          title={
                            status === "done"
                              ? "已簽到"
                              : status === "missed"
                                ? "未完成"
                                : "未到／未來"
                          }
                        >
                          {status === "done" ? "✓" : status === "missed" ? "✗" : "－"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {members.length === 0 && (
            <p className="p-4 text-[var(--muted)] text-center">
              尚無資料
            </p>
          )}
        </div>
      )}

      {user?.role === "admin" && (
        <section className="mt-8 rounded-2xl bg-[var(--card)] border border-white/10 p-6">
          <h2 className="font-semibold mb-3">錄音紀錄（管理員）</h2>
          <p className="text-sm text-[var(--muted)] mb-3">本週 {formatWeekLabel(weekId)} 所有人上傳的錄音，可點播放聆聽。</p>
          {loadingRecordings ? (
            <p className="text-[var(--muted)]">載入中…</p>
          ) : recordings.length === 0 ? (
            <p className="text-[var(--muted)]">本週尚無錄音</p>
          ) : (
            <ul className="space-y-2">
              {recordings.map((r) => (
                <li
                  key={r.path}
                  className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0"
                >
                  <span className="text-[var(--muted)] shrink-0">{r.userId}</span>
                  <span className="shrink-0">{r.userName}</span>
                  <span className="text-[var(--muted)] text-sm truncate flex-1" title={r.name}>
                    {r.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => playRecording(r.path)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
                    disabled={playingPath !== null}
                  >
                    {playingPath === r.path ? "播放中…" : "播放"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
