"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
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
    </main>
  );
}
