"use client";

export function VersionBadge({ version }: { version: string }) {
  return (
    <div
      className="fixed top-3 right-3 z-50 text-xs text-[var(--muted)] font-mono bg-[var(--card)]/90 backdrop-blur px-2 py-1 rounded border border-[var(--border)] select-none"
      title="應用版本，部署後可確認是否已更新"
    >
      v{version}
    </div>
  );
}
