"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import {
  getWeekId,
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
  day1AudioUrl?: string | null;
  day2AudioUrl?: string | null;
  day3AudioUrl?: string | null;
  day4AudioUrl?: string | null;
  day5AudioUrl?: string | null;
  day6AudioUrl?: string | null;
  day7AudioUrl?: string | null;
};

function formatWeekLabel(weekId: string): string {
  const d = parseWeekId(weekId);
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  return `${weekId} ～ ${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
}

export default function AdminRecordingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [weekId, setWeekId] = useState(() => getWeekId(new Date()));
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
    else if (!loading && user?.role !== "admin") router.replace("/dashboard");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
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

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--muted)]">載入中…</p>
      </main>
    );
  }
  if (!user || user.role !== "admin") return null;

  return (
    <main className="min-h-screen p-4 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">錄音紀錄</h1>
        <div className="flex gap-2">
          <Link
            href="/admin"
            className="px-3 py-1.5 rounded-lg border border-white/20 text-sm hover:bg-white/5"
          >
            管理經文
          </Link>
          <Link
            href="/dashboard"
            className="px-3 py-1.5 rounded-lg border border-white/20 text-sm hover:bg-white/5"
          >
            返回首頁
          </Link>
        </div>
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

      <p className="text-sm text-[var(--muted)] mb-4">
        點擊「播放」聆聽該日簽到錄音，或「下載」保存。
      </p>

      {loadingList ? (
        <p className="text-[var(--muted)]">載入中…</p>
      ) : (
        <div className="rounded-2xl bg-[var(--card)] border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-3 font-medium">帳號 / 名字</th>
                  {DAY_LABELS.map((label, i) => (
                    <th
                      key={i}
                      className="p-2 text-center font-medium text-[var(--muted)] whitespace-nowrap"
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
                    <td className="p-3 whitespace-nowrap">
                      <span className="text-[var(--muted)]">{m.uid}</span>
                      <span className="ml-2">{m.name}</span>
                    </td>
                    {([1, 2, 3, 4, 5, 6, 7] as const).map((d) => {
                      const url = m[`day${d}AudioUrl` as keyof MemberRow] as string | null | undefined;
                      return (
                        <td key={d} className="p-2 text-center">
                          {url ? (
                            <div className="flex flex-col gap-1 items-center">
                              <audio
                                src={url}
                                controls
                                preload="none"
                                className="max-h-8 w-full max-w-[120px]"
                              />
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={`${m.uid}_day${d}.webm`}
                                className="text-xs text-[var(--accent)] hover:underline"
                              >
                                下載
                              </a>
                            </div>
                          ) : (
                            <span className="text-[var(--muted)]">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {members.length === 0 && (
            <p className="p-4 text-[var(--muted)] text-center">本週尚無錄音紀錄</p>
          )}
        </div>
      )}
    </main>
  );
}
