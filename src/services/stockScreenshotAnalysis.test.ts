import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LimitUpStock, StockDetail } from "../types";

vi.mock("./stockDetail", () => ({
  fetchStockSearchMatch: vi.fn(),
  fetchLiveStockDetail: vi.fn()
}));

vi.mock("tesseract.js", () => ({
  recognize: vi.fn()
}));

import {
  analyzeStockByManualInput,
  analyzeStockScreenshotAsset
} from "./stockScreenshotAnalysis";
import { fetchLiveStockDetail, fetchStockSearchMatch } from "./stockDetail";
import { recognize } from "tesseract.js";

const searchMock = vi.mocked(fetchStockSearchMatch);
const detailMock = vi.mocked(fetchLiveStockDetail);
const recognizeMock = vi.mocked(recognize);

function setRecognizedText(text: string) {
  recognizeMock.mockResolvedValue({ data: { text } } as never);
}

function makeDetail(overrides: Partial<StockDetail> = {}): StockDetail {
  return {
    code: "600000",
    name: "浦发银行",
    market: "SH",
    industry: "银行",
    price: 10.5,
    changeAmount: 0.2,
    changePercent: 2.5,
    open: 10.1,
    high: 10.8,
    low: 10.0,
    prevClose: 10.3,
    averagePrice: 10.4,
    volume: 1000,
    amount: 2000000,
    volumeRatio: 1.2,
    turnoverRate: 1.5,
    amplitude: 3,
    upLimit: 11.3,
    downLimit: 9.3,
    totalShares: 1000,
    floatShares: 900,
    totalMarketCap: 123456789,
    floatMarketCap: 98765432,
    peTtm: 12,
    pb: 1.1,
    ...overrides
  };
}

function makeLimitUpStock(overrides: Partial<LimitUpStock> = {}): LimitUpStock {
  return {
    code: "600000",
    name: "浦发银行",
    price: 10.5,
    limitUpCount: 1,
    consecutiveBoardCount: 1,
    openBoardCount: 0,
    sealAmount: "2.00亿",
    firstLimitUpTime: "09:35",
    sealStrength: "强",
    ladderType: "首板",
    reason: "银行方向首板发酵",
    industry: "银行",
    ...overrides
  };
}

beforeEach(() => {
  searchMock.mockReset();
  detailMock.mockReset();
  recognizeMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("analyzeStockScreenshotAsset", () => {
  it("returns a fallback output when there is no object url", async () => {
    const output = await analyzeStockScreenshotAsset({ name: "chart.png" }, [], 3);

    expect(output.identifiedStock).toBeNull();
    expect(output.entryVerdict).toEqual({ label: "待识别后再判断", tone: "neutral" });
    expect(output.summary).toContain("第 3 轮");
    expect(output.summary).toContain("chart.png");
    expect(output.segmentSummaries[0].label).toBe("OCR");
    expect(recognizeMock).not.toHaveBeenCalled();
  });

  it("returns a fallback output when no stock identity can be resolved", async () => {
    setRecognizedText("这是一张 涨停 分时 截图 没有代码");
    searchMock.mockRejectedValue(new Error("no match"));

    const output = await analyzeStockScreenshotAsset(
      { name: "chart.png", objectUrl: "blob:chart" },
      [],
      1
    );

    expect(output.identifiedStock).toBeNull();
    expect(output.segmentSummaries[0].body).toContain("识别到的文字片段");
  });

  it("resolves identity from a code candidate and builds a full stock output", async () => {
    setRecognizedText("浦发银行 600000 今日封板");
    searchMock.mockResolvedValue({ code: "600000", name: "浦发银行" });
    detailMock.mockResolvedValue(makeDetail());

    const pool = [makeLimitUpStock()];
    const output = await analyzeStockScreenshotAsset(
      { name: "chart.png", objectUrl: "blob:chart" },
      pool,
      2
    );

    expect(searchMock).toHaveBeenCalledWith("600000");
    expect(output.identifiedStock).toMatchObject({ code: "600000", name: "浦发银行" });
    expect(output.summary).toContain("并结合个股详情");
    expect(output.entryVerdict).toEqual({ label: "可列入重点观察", tone: "positive" });
  });

  it("marks detail as unavailable when the detail lookup fails", async () => {
    setRecognizedText("浦发银行 600000");
    searchMock.mockResolvedValue({ code: "600000", name: "浦发银行" });
    detailMock.mockRejectedValue(new Error("detail down"));

    const output = await analyzeStockScreenshotAsset(
      { name: "chart.png", objectUrl: "blob:chart" },
      [],
      1
    );

    expect(output.summary).toContain("个股详情接口暂时不可用");
    const priceStat = output.identifiedStock?.keyStats?.find((stat) => stat.label === "最新价");
    expect(priceStat?.value).toBe("待确认");
  });
});

describe("analyzeStockByManualInput", () => {
  it("flags a cautious verdict for 连板 stocks and lists same-theme peers", async () => {
    searchMock.mockResolvedValue({ code: "600000", name: "浦发银行" });
    detailMock.mockResolvedValue(makeDetail());

    const pool: LimitUpStock[] = [
      makeLimitUpStock({ consecutiveBoardCount: 3, ladderType: "连板" }),
      makeLimitUpStock({
        code: "600001",
        name: "同业银行",
        reason: "银行方向连板晋级",
        ladderType: "连板",
        consecutiveBoardCount: 2
      })
    ];

    const output = await analyzeStockByManualInput("600000", pool, 5);

    expect(output.entryVerdict).toEqual({ label: "高位接力偏谨慎", tone: "cautious" });
    expect(output.peers).toContain("同业银行");
    expect(output.peersTitle).toBe("同题材可选标的");
  });

  it("returns a neutral verdict when the stock is not in the limit-up pool", async () => {
    searchMock.mockResolvedValue({ code: "000001", name: "平安银行" });
    detailMock.mockResolvedValue(makeDetail({ code: "000001", name: "平安银行", market: "SZ" }));

    const output = await analyzeStockByManualInput("平安银行", [], 1);

    expect(output.entryVerdict).toEqual({ label: "先观察承接再决定", tone: "neutral" });
    expect(output.peers).toContain("没有从实时涨停池");
  });

  it("uses a fallback detail when the detail lookup fails", async () => {
    searchMock.mockResolvedValue({ code: "600000", name: "浦发银行" });
    detailMock.mockRejectedValue(new Error("detail down"));

    const output = await analyzeStockByManualInput("600000", [makeLimitUpStock()], 1);

    expect(output.summary).toContain("个股详情接口暂时不可用");
    expect(output.identifiedStock).toMatchObject({ code: "600000", name: "浦发银行" });
  });

  it("propagates search errors when the input cannot be identified", async () => {
    searchMock.mockRejectedValue(new Error("未找到匹配的股票代码或名称。"));

    await expect(analyzeStockByManualInput("???", [], 1)).rejects.toThrow(
      "未找到匹配的股票代码或名称。"
    );
  });
});
