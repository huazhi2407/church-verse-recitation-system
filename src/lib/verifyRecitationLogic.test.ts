import { describe, it, expect } from "vitest";
import { verifyRecitation } from "./verifyRecitationLogic";

describe("verifyRecitation", () => {
  const segments = ["起初神創造天地", "神說要有光就有了光", "神看光是好的"];

  it("僅驗證第一節：辨識與預期一致應通過", () => {
    const r = verifyRecitation(segments, 1, "起初神創造天地", true, false);
    expect(r.pass).toBe(true);
    expect(r.accuracy).toBe(100);
  });

  it("僅驗證第一節：辨識結果含全形、標點仍通過", () => {
    const r = verifyRecitation(segments, 1, "起初神創造天地，", true, false);
    expect(r.pass).toBe(true);
    expect(r.accuracy).toBeGreaterThanOrEqual(90);
  });

  it("僅驗證第一節：唸錯應未通過", () => {
    const r = verifyRecitation(segments, 1, "起初神創造世界", true, false);
    expect(r.pass).toBe(false);
    expect(r.accuracy).toBeLessThan(100);
  });

  it("僅驗證第一節：辨識少字準確度低於 90", () => {
    const r = verifyRecitation(segments, 1, "起初神創造", true, false);
    expect(r.pass).toBe(false);
    expect(r.accuracy).toBeLessThan(90);
  });

  it("驗證多天：day=2 比對前兩段", () => {
    const expected = "起初神創造天地\n\n神說要有光就有了光";
    const recited = "起初神創造天地 神說要有光就有了光";
    const r = verifyRecitation(segments, 2, recited, false, false);
    expect(r.pass).toBe(true);
    expect(r.accuracy).toBeGreaterThanOrEqual(90);
  });

  it("測試六節：testFirstSixSegments 只比對前六段", () => {
    const six = ["第一段", "第二段", "第三段", "第四段", "第五段", "第六段"];
    const recited = "第一段 第二段 第三段 第四段 第五段 第六段";
    const r = verifyRecitation(six, 7, recited, false, true);
    expect(r.pass).toBe(true);
    expect(r.accuracy).toBe(100);
  });

  it("空辨識結果應 0% 未通過", () => {
    const r = verifyRecitation(segments, 1, "", true, false);
    expect(r.pass).toBe(false);
    expect(r.accuracy).toBe(0);
  });

  it("預期經文過短時仍回傳合理準確度", () => {
    const r = verifyRecitation(["好"], 1, "好", true, false);
    expect(r.pass).toBe(true);
    expect(r.accuracy).toBe(100);
  });
});
