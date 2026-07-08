import { describe, expect, it } from "vitest";
import {
  buildSealStrength,
  formatSealAmount,
  formatTime,
  formatTradeDate,
  mapPoolItem,
  shiftDate
} from "./marketDataServer.mjs";

describe("formatTradeDate", () => {
  it("zero-pads month and day into a YYYYMMDD string", () => {
    expect(formatTradeDate(new Date(2026, 0, 5))).toBe("20260105");
    expect(formatTradeDate(new Date(2026, 11, 31))).toBe("20261231");
  });
});

describe("shiftDate", () => {
  it("returns a new date shifted back by the given number of days", () => {
    const base = new Date(2026, 6, 8);
    const shifted = shiftDate(base, 3);

    expect(formatTradeDate(shifted)).toBe("20260705");
    expect(formatTradeDate(base)).toBe("20260708");
  });
});

describe("formatSealAmount", () => {
  it("returns 暂无 for non-positive or invalid values", () => {
    expect(formatSealAmount(0)).toBe("暂无");
    expect(formatSealAmount(-1)).toBe("暂无");
    expect(formatSealAmount(Number.NaN)).toBe("暂无");
    expect(formatSealAmount("x")).toBe("暂无");
  });

  it("formats sub-hundred amounts with two decimals in 亿", () => {
    expect(formatSealAmount(250_000_000)).toBe("2.50亿");
  });

  it("drops decimals for amounts at or above 100 亿", () => {
    expect(formatSealAmount(12_300_000_000)).toBe("123亿");
  });
});

describe("formatTime", () => {
  it("returns a placeholder for invalid values", () => {
    expect(formatTime(0)).toBe("--:--");
    expect(formatTime(Number.NaN)).toBe("--:--");
  });

  it("formats HHMMSS-style integers into HH:MM", () => {
    expect(formatTime(93500)).toBe("09:35");
    expect(formatTime(143012)).toBe("14:30");
  });
});

describe("buildSealStrength", () => {
  it("returns 未知 for invalid seal funds", () => {
    expect(buildSealStrength(0, 0)).toBe("未知");
    expect(buildSealStrength(Number.NaN, 0)).toBe("未知");
  });

  it("classifies seal strength by amount and open-board count", () => {
    expect(buildSealStrength(600_000_000, 0)).toBe("极强");
    expect(buildSealStrength(600_000_000, 1)).toBe("强");
    expect(buildSealStrength(350_000_000, 1)).toBe("强");
    expect(buildSealStrength(150_000_000, 3)).toBe("中强");
    expect(buildSealStrength(50_000_000, 2)).toBe("中");
    expect(buildSealStrength(10_000_000, 5)).toBe("偏弱");
  });
});

describe("mapPoolItem", () => {
  it("returns null when required fields are missing", () => {
    expect(mapPoolItem({ n: "浦发银行", p: 1 })).toBeNull();
    expect(mapPoolItem({ c: "600000", p: 1 })).toBeNull();
    expect(mapPoolItem({ c: "600000", n: "浦发银行" })).toBeNull();
  });

  it("maps a first-board pool item", () => {
    const result = mapPoolItem({
      c: "600000",
      n: "浦发银行",
      p: 10500,
      zbc: 0,
      fbt: 93500,
      fund: 250_000_000,
      hybk: "银行"
    });

    expect(result).toEqual({
      code: "600000",
      name: "浦发银行",
      price: 10.5,
      limitUpCount: 1,
      consecutiveBoardCount: 1,
      openBoardCount: 0,
      sealAmount: "2.50亿",
      firstLimitUpTime: "09:35",
      sealStrength: "中强",
      ladderType: "首板",
      reason: "银行方向首板发酵",
      industry: "银行"
    });
  });

  it("derives consecutive board data and labels for multi-board items", () => {
    const result = mapPoolItem({
      c: "300001",
      n: "某科技",
      p: 20000,
      lbc: 3,
      zttj: { ct: 5 },
      zbc: 1,
      fbt: 100500,
      fund: 400_000_000
    });

    expect(result).toMatchObject({
      consecutiveBoardCount: 3,
      limitUpCount: 5,
      ladderType: "连板",
      reason: "连板晋级",
      industry: "未知行业",
      sealStrength: "强"
    });
  });
});
