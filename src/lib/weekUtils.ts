/**
 * 週經文：以「週一」為該週起點，weekId = 週一的 YYYY-MM-DD
 * 第 1 天 = 週一 … 第 7 天 = 週日
 */

export function getWeekId(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day; // 調整到週一
  d.setDate(d.getDate() + diff);
  return formatDateKey(d);
}

export function getDayOfWeek(date: Date): number {
  const day = date.getDay(); // 0=Sun, 1=Mon, ...
  return day === 0 ? 7 : day; // 1=Mon ... 7=Sun
}

export function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseWeekId(weekId: string): Date {
  const [y, m, d] = weekId.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 前一週的 weekId */
export function getPrevWeekId(weekId: string): string {
  const d = parseWeekId(weekId);
  d.setDate(d.getDate() - 7);
  return formatDateKey(d);
}

/** 下一週的 weekId */
export function getNextWeekId(weekId: string): string {
  const d = parseWeekId(weekId);
  d.setDate(d.getDate() + 7);
  return formatDateKey(d);
}

/** 取得某週某天的累加經文（segments[0..day-1] 合併） */
export function getCumulativeContent(segments: string[], day: number): string {
  if (!Array.isArray(segments) || day < 1 || day > 7) return "";
  return segments.slice(0, day).filter(Boolean).join("\n\n");
}

/** 週一～週日的顯示用標籤 */
export const DAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];
