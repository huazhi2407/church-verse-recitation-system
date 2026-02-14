"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

type Tab = "login" | "register";

export default function HomePage() {
  const { user, loading, signInWithToken } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");
  const [loginForm, setLoginForm] = useState({ accountNumber: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ name: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--muted)]">載入中…</p>
      </main>
    );
  }

  if (user) {
    router.replace("/dashboard");
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--muted)]">導向中…</p>
      </main>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountNumber: loginForm.accountNumber.trim(),
          password: loginForm.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error || "登入失敗" });
        setBusy(false);
        return;
      }
      await signInWithToken(data.token);
      router.push("/dashboard");
    } catch {
      setMessage({ type: "err", text: "登入失敗，請稍後再試" });
    }
    setBusy(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: registerForm.name.trim(),
          password: registerForm.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error || "註冊失敗" });
        setBusy(false);
        return;
      }
      setMessage({
        type: "ok",
        text: data.message || `帳號編號：${data.accountNumber}，請用此編號登入。`,
      });
      setRegisterForm({ name: "", password: "" });
      setTab("login");
      setLoginForm((prev) => ({ ...prev, accountNumber: data.accountNumber }));
    } catch {
      setMessage({ type: "err", text: "註冊失敗，請稍後再試" });
    }
    setBusy(false);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--card)] border border-white/10 p-6 shadow-xl">
        <h1 className="text-xl font-bold text-center mb-6">
          教會經文背誦系統
        </h1>

        <div className="flex rounded-lg bg-black/20 p-1 mb-4">
          <button
            type="button"
            onClick={() => setTab("login")}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
              tab === "login"
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--muted)] hover:text-white"
            }`}
          >
            登入
          </button>
          <button
            type="button"
            onClick={() => setTab("register")}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
              tab === "register"
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--muted)] hover:text-white"
            }`}
          >
            註冊
          </button>
        </div>

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

        {tab === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">
                帳號編號
              </label>
              <input
                type="text"
                value={loginForm.accountNumber}
                onChange={(e) =>
                  setLoginForm((p) => ({ ...p, accountNumber: e.target.value }))
                }
                placeholder="例：0001"
                className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">
                密碼
              </label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm((p) => ({ ...p, password: e.target.value }))
                }
                className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                required
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white font-medium hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "登入中…" : "登入"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">
                名字
              </label>
              <input
                type="text"
                value={registerForm.name}
                onChange={(e) =>
                  setRegisterForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="您的姓名"
                className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--muted)] mb-1">
                密碼（至少 6 字元）
              </label>
              <input
                type="password"
                value={registerForm.password}
                onChange={(e) =>
                  setRegisterForm((p) => ({ ...p, password: e.target.value }))
                }
                minLength={6}
                className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                required
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white font-medium hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "註冊中…" : "註冊（系統將分配帳號編號）"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
