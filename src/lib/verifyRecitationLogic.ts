import { getCumulativeContent } from "@/lib/weekUtils";
import pinyin from "pinyin";

function stripTone(py: string): string {
  return py
    .replace(/ǖ|ǘ|ǚ|ǜ|ü/g, "v")
    .replace(/ā|á|ǎ|à/g, "a")
    .replace(/ē|é|ě|è/g, "e")
    .replace(/ī|í|ǐ|ì/g, "i")
    .replace(/ō|ó|ǒ|ò/g, "o")
    .replace(/ū|ú|ǔ|ù/g, "u")
    .replace(/ń|ň|ǹ|n/g, "n")
    .replace(/ḿ|m̀|m̌|m/g, "m")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const CHUNK_SIZE = 400;

function toPlainPinyin(text: string): string {
  if (!text || !text.trim()) return "";
  const t = text.trim();
  const parts: string[] = [];
  try {
    for (let i = 0; i < t.length; i += CHUNK_SIZE) {
      const chunk = t.slice(i, i + CHUNK_SIZE);
      const arr = pinyin(chunk, { style: pinyin.STYLE_TONE, heteronym: false });
      const syllables = arr.map((readings) => (readings[0] ? stripTone(readings[0]) : ""));
      parts.push(syllables.join(" "));
    }
    return parts.join(" ").replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

function removeVerseNumbers(text: string): string {
  return text
    .replace(/\{[一二三四五六七八九十百千零０-９0-9]+\}/g, "")
    .replace(/\「[一二三四五六七八九十百千零０-９0-9]+\」/g, "")
    .replace(/第[一二三四五六七八九十百千零０-９0-9]+節/g, "")
    .replace(/^[一二三四五六七八九十百千零０-９0-9]+\s*[\「\"]?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 清理 STT 常見雜訊：方括號、全形數字等 */
function normalizeRecitedText(s: string): string {
  return s
    .replace(/\s*\[[^\]]*\]\s*/g, " ")
    .replace(/[\uFF10-\uFF19]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 依「拼音」比對預期經文與背誦內容，回傳是否通過與準確度 (0–100)。
 * testFirstVerseOnly：只驗證第一節；testFirstSixSegments：只驗證前六節累加。
 */
export function verifyRecitation(
  segments: string[],
  day: number,
  recitedText: string,
  testFirstVerseOnly: boolean,
  testFirstSixSegments?: boolean
): { pass: boolean; accuracy: number } {
  const expected = testFirstVerseOnly
    ? (segments[0] ?? "")
    : testFirstSixSegments
      ? getCumulativeContent(segments, 6)
      : getCumulativeContent(segments, day);

  const clean = (s: string) =>
    s
      .replace(/\s+/g, " ")
      .replace(/[,，.。、；;：:]/g, " ")
      .trim();
  const expectedNorm = clean(removeVerseNumbers(expected));
  const recitedNorm = clean(removeVerseNumbers(normalizeRecitedText(recitedText)));
  const expectedPinyin = toPlainPinyin(expectedNorm);
  const recitedPinyin = toPlainPinyin(recitedNorm);

  if (expectedPinyin.length < 2) {
    const acc = recitedPinyin.length >= 1 ? 100 : 0;
    return { pass: acc >= 90, accuracy: acc };
  }

  const expectedSyl = expectedPinyin.split(/\s+/).filter(Boolean);
  const recitedSyl = recitedPinyin.split(/\s+/).filter(Boolean);
  let matchCount = 0;
  let recitedIdx = 0;
  for (let i = 0; i < expectedSyl.length && recitedIdx < recitedSyl.length; i++) {
    if (expectedSyl[i] === recitedSyl[recitedIdx]) {
      matchCount++;
      recitedIdx++;
    } else {
      const next = recitedSyl.indexOf(expectedSyl[i], recitedIdx);
      if (next !== -1) {
        matchCount++;
        recitedIdx = next + 1;
      }
    }
  }
  const accuracy = Math.round((matchCount / expectedSyl.length) * 100);
  const pass = accuracy >= 90;
  return { pass, accuracy };
}
