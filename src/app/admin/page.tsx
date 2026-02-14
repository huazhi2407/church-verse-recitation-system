"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import {
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import {
  getWeekId,
  getPrevWeekId,
  getNextWeekId,
  parseWeekId,
  DAY_LABELS,
} from "@/lib/weekUtils";

type View = "list" | "edit";
type FormState = { weekId: string; reference: string; segments: string[] };

const EMPTY_SEGMENTS = ["", "", "", "", "", "", ""];

function formatWeekLabel(weekId: string): string {
  const d = parseWeekId(weekId);
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  return `${weekId} ～ ${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<View>("list");
  const [weekCursor, setWeekCursor] = useState(() => getWeekId(new Date()));
  const [weeks, setWeeks] = useState<{ id: string; reference: string }[]>([]);
  const [form, setForm] = useState<FormState>({
    weekId: getWeekId(new Date()),
    reference: "",
    segments: [...EMPTY_SEGMENTS],
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/");
    else if (!loading && user?.role !== "admin") router.replace("/dashboard");
  }, [loading, user, router]);

  // 載入週列表（用於列表頁）
  useEffect(() => {
    if (!user || user.role !== "admin") return;
    const load = async () => {
      const ref = collection(db, "weeklyVerses");
      const snap = await getDocs(ref);
      const list = snap.docs.map((d) => ({
        id: d.id,
        reference: (d.data().reference as string) ?? "",
      }));
      list.sort((a, b) => (a.id > b.id ? -1 : 1));
      setWeeks(list.slice(0, 50));
    };
    load();
  }, [user, view]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      await setDoc(doc(db, "weeklyVerses", form.weekId), {
        reference: form.reference.trim(),
        segments: form.segments.map((s) => s.trim()),
        updatedAt: new Date(),
        updatedBy: user?.uid ?? "",
      });
      setMessage({ type: "ok", text: "已儲存本週經文" });
      setView("list");
    } catch (err) {
      setMessage({ type: "err", text: "儲存失敗，請稍後再試" });
    }
    setBusy(false);
  };

  const handleDelete = async (weekId: string) => {
    if (!confirm(`確定要刪除「${formatWeekLabel(weekId)}」的經文嗎？`)) return;
    setDeletingId(weekId);
    try {
      await deleteDoc(doc(db, "weeklyVerses", weekId));
      setWeeks((prev) => prev.filter((w) => w.id !== weekId));
    } catch (err) {
      setMessage({ type: "err", text: "刪除失敗" });
    }
    setDeletingId(null);
  };

  const openEdit = async (weekId: string) => {
    const snap = await getDoc(doc(db, "weeklyVerses", weekId));
    const data = snap.data();
    setForm({
      weekId,
      reference: (data?.reference as string) ?? "",
      segments: Array.isArray(data?.segments)
        ? [...(data.segments as string[]), ...EMPTY_SEGMENTS].slice(0, 7)
        : [...EMPTY_SEGMENTS],
    });
    setView("edit");
    setMessage(null);
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--muted)]">載入中…</p>
      </main>
    );
  }
  if (!user || user.role !== "admin") return null;

  return (
    <main className="min-h-screen p-4 max-w-2xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">管理週經文</h1>
        <Link
          href="/dashboard"
          className="px-3 py-1.5 rounded-lg border border-white/20 text-sm hover:bg-white/5"
        >
          返回首頁
        </Link>
      </header>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === "ok"
              ? "bg-emerald-500/20 text-emerald-300"
              : "bg-red-500/20 text-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      {view === "list" ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[var(--muted)] text-sm">
              每週經文為 7 天累加（第 1 天一段，第 2 天兩段…）
            </p>
            <button
              type="button"
              onClick={() => {
                setForm({
                  weekId: getWeekId(new Date()),
                  reference: "",
                  segments: [...EMPTY_SEGMENTS],
                });
                setView("edit");
                setMessage(null);
              }}
              className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm"
            >
              新增一週
            </button>
          </div>
          <ul className="space-y-2 rounded-2xl bg-[var(--card)] border border-white/10 divide-y divide-white/10 overflow-hidden">
            {weeks.length === 0 ? (
              <li className="p-4 text-[var(--muted)] text-sm">
                尚無週經文，請點「新增一週」填寫。
              </li>
            ) : (
              weeks.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between gap-2 p-4"
                >
                  <div>
                    <p className="font-medium">{formatWeekLabel(w.id)}</p>
                    <p className="text-[var(--muted)] text-sm">{w.reference}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(w.id)}
                      className="px-2 py-1 rounded border border-white/20 text-sm hover:bg-white/5"
                    >
                      編輯
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(w.id)}
                      disabled={deletingId === w.id}
                      className="px-2 py-1 rounded bg-red-500/20 text-red-300 text-sm hover:bg-red-500/30 disabled:opacity-50"
                    >
                      {deletingId === w.id ? "刪除中…" : "刪除"}
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </>
      ) : (
        <form
          onSubmit={handleSave}
          className="rounded-2xl bg-[var(--card)] border border-white/10 p-6 space-y-4"
        >
          <div className="flex justify-between items-center">
            <h2 className="font-semibold">填寫一週經文（累加）</h2>
            <button
              type="button"
              onClick={() => setView("list")}
              className="text-sm text-[var(--muted)] hover:text-white"
            >
              取消
            </button>
          </div>

          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">
              週一日期（該週起點）
            </label>
            <input
              type="date"
              value={form.weekId}
              onChange={(e) =>
                setForm((p) => ({ ...p, weekId: e.target.value }))
              }
              className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--muted)] mb-1">
              經文出處（例：約翰福音 3:16-21）
            </label>
            <input
              type="text"
              value={form.reference}
              onChange={(e) =>
                setForm((p) => ({ ...p, reference: e.target.value }))
              }
              placeholder="約翰福音 3:16-21"
              className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              required
            />
          </div>

          <div>
            <p className="text-sm text-[var(--muted)] mb-2">
              第 1～7 天「當天新增」的段落（第 2 天會顯示 1+2，第 3 天顯示 1+2+3…）
            </p>
            {form.segments.map((seg, i) => (
              <div key={i} className="mb-3">
                <label className="block text-xs text-[var(--muted)] mb-1">
                  第 {DAY_LABELS[i]} 天段落
                </label>
                <textarea
                  value={seg}
                  onChange={(e) => {
                    const next = [...form.segments];
                    next[i] = e.target.value;
                    setForm((p) => ({ ...p, segments: next }));
                  }}
                  rows={2}
                  className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-y"
                  placeholder={`第 ${i + 1} 天經文內容`}
                />
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white font-medium hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "儲存中…" : "儲存本週經文"}
          </button>
        </form>
      )}
    </main>
  );
}
