import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchLiveStockDetail,
  fetchLiveStockQuoteSnapshot,
  fetchLiveStockTrend,
  fetchStockSearchMatch
} from "./stockDetail";

type Route = {
  match: string;
  ok?: boolean;
  status?: number;
  body?: unknown;
};

function mockRoutes(routes: Route[]) {
  const fetchMock = vi.fn(async (url: string) => {
    const route = routes.find((candidate) => url.includes(candidate.match));

    if (!route) {
      throw new Error(`Unexpected fetch URL: ${url}`);
    }

    return {
      ok: route.ok ?? true,
      status: route.status ?? 200,
      json: async () => route.body
    } as unknown as Response;
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function cached(data: unknown) {
  return { ok: true, status: "live", data };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchLiveStockDetail", () => {
  it("resolves an SH secid for codes starting with 6/9/5 and normalizes fields", async () => {
    const fetchMock = mockRoutes([
      {
        match: "/api/stock/detail",
        body: cached({
          data: {
            f57: "600000",
            f58: "浦发银行",
            f127: "银行",
            f43: 1050,
            f169: 20,
            f170: 250,
            f168: 130,
            f171: 300,
            f162: 1500,
            f167: undefined,
            f116: 123456,
            f117: 65432,
            f47: 9999,
            f48: 8888,
            f50: 1.5
          }
        })
      }
    ]);

    const detail = await fetchLiveStockDetail("600000");

    expect(fetchMock.mock.calls[0][0]).toContain("secid=1.600000");
    expect(detail).toMatchObject({
      code: "600000",
      name: "浦发银行",
      market: "SH",
      industry: "银行",
      price: 10.5,
      changeAmount: 0.2,
      changePercent: 2.5,
      turnoverRate: 1.3,
      amplitude: 3,
      peTtm: 15,
      pb: null,
      volume: 9999,
      amount: 8888,
      volumeRatio: 1.5,
      totalMarketCap: 123456,
      floatMarketCap: 65432
    });
  });

  it("resolves an SZ secid for other codes and falls back to defaults", async () => {
    const fetchMock = mockRoutes([
      {
        match: "/api/stock/detail",
        body: cached({
          data: {
            f57: "000001",
            f58: "平安银行",
            f127: undefined
          }
        })
      }
    ]);

    const detail = await fetchLiveStockDetail("000001");

    expect(fetchMock.mock.calls[0][0]).toContain("secid=0.000001");
    expect(detail.market).toBe("SZ");
    expect(detail.industry).toBe("未知行业");
    expect(detail.price).toBe(0);
    expect(detail.volumeRatio).toBe(0);
    expect(detail.peTtm).toBeNull();
  });

  it("throws when the payload lacks a name or code", async () => {
    mockRoutes([{ match: "/api/stock/detail", body: cached({ data: { f43: 1000 } }) }]);

    await expect(fetchLiveStockDetail("600000")).rejects.toThrow("未取到个股详情。");
  });

  it("throws when the cached response reports an error", async () => {
    mockRoutes([
      {
        match: "/api/stock/detail",
        body: { ok: false, status: "error", error: "详情上游异常" }
      }
    ]);

    await expect(fetchLiveStockDetail("600000")).rejects.toThrow("详情上游异常");
  });

  it("throws with the HTTP status when the request fails", async () => {
    mockRoutes([{ match: "/api/stock/detail", ok: false, status: 502, body: {} }]);

    await expect(fetchLiveStockDetail("600000")).rejects.toThrow("请求失败: 502");
  });
});

describe("fetchLiveStockTrend", () => {
  it("parses trend points, dropping malformed rows and passing the days param", async () => {
    const fetchMock = mockRoutes([
      {
        match: "/api/stock/trends",
        body: cached({
          data: {
            trends: [
              "2026-07-08 09:30,10.00,10.20,10.30,9.90,1000,2000000,10.10",
              "malformed-without-close",
              "2026-07-08 09:31,,10.40,10.50,10.00,500,1500000,"
            ]
          }
        })
      }
    ]);

    const points = await fetchLiveStockTrend("600000", 5);

    expect(fetchMock.mock.calls[0][0]).toContain("days=5");
    expect(points).toEqual([
      {
        timestamp: "2026-07-08 09:30",
        price: 10.2,
        averagePrice: 10.1,
        volume: 1000,
        amount: 2000000
      },
      {
        timestamp: "2026-07-08 09:31",
        price: 10.4,
        averagePrice: 10.4,
        volume: 500,
        amount: 1500000
      }
    ]);
  });

  it("throws when there are no usable trend points", async () => {
    mockRoutes([{ match: "/api/stock/trends", body: cached({ data: { trends: [] } }) }]);

    await expect(fetchLiveStockTrend("600000", 1)).rejects.toThrow("未取到个股走势数据。");
  });
});

describe("fetchStockSearchMatch", () => {
  it("rejects empty queries before making a request", async () => {
    const fetchMock = mockRoutes([{ match: "/api/stock/search", body: cached({}) }]);

    await expect(fetchStockSearchMatch("   ")).rejects.toThrow("请输入股票代码或名称。");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prefers an exact code or name match over the first candidate", async () => {
    mockRoutes([
      {
        match: "/api/stock/search",
        body: cached({
          QuotationCodeTable: {
            Data: [
              { Code: "600001", Name: "别的股票" },
              { Code: "600000", Name: "浦发银行" },
              { Code: "", Name: "" }
            ]
          }
        })
      }
    ]);

    await expect(fetchStockSearchMatch("600000")).resolves.toEqual({
      code: "600000",
      name: "浦发银行"
    });
  });

  it("falls back to the first candidate when there is no exact match", async () => {
    mockRoutes([
      {
        match: "/api/stock/search",
        body: cached({
          QuotationCodeTable: {
            Data: [{ Code: "600000", Name: "浦发银行" }]
          }
        })
      }
    ]);

    await expect(fetchStockSearchMatch("浦发")).resolves.toEqual({
      code: "600000",
      name: "浦发银行"
    });
  });

  it("throws when there are no candidates", async () => {
    mockRoutes([
      {
        match: "/api/stock/search",
        body: cached({ QuotationCodeTable: { Data: [] } })
      }
    ]);

    await expect(fetchStockSearchMatch("不存在")).rejects.toThrow(
      "未找到匹配的股票代码或名称。"
    );
  });
});

describe("fetchLiveStockQuoteSnapshot", () => {
  it("prefers the latest trend price and detail metadata", async () => {
    mockRoutes([
      {
        match: "/api/stock/detail",
        body: cached({
          data: { f57: "600000", f58: "浦发银行", f43: 1050, f170: 250 }
        })
      },
      {
        match: "/api/stock/trends",
        body: cached({
          data: {
            trends: ["2026-07-08 09:30,10.00,10.20,10.30,9.90,1000,2000000,10.10"]
          }
        })
      }
    ]);

    const snapshot = await fetchLiveStockQuoteSnapshot("600000");

    expect(snapshot).toEqual({
      code: "600000",
      name: "浦发银行",
      price: 10.2,
      changePercent: 2.5
    });
  });

  it("falls back to a search match when the detail lookup fails", async () => {
    mockRoutes([
      { match: "/api/stock/detail", ok: false, status: 500, body: {} },
      {
        match: "/api/stock/trends",
        body: cached({
          data: {
            trends: ["2026-07-08 09:30,10.00,11.00,11.10,9.90,1000,2000000,10.80"]
          }
        })
      },
      {
        match: "/api/stock/search",
        body: cached({
          QuotationCodeTable: { Data: [{ Code: "600000", Name: "浦发银行" }] }
        })
      }
    ]);

    const snapshot = await fetchLiveStockQuoteSnapshot("600000");

    expect(snapshot).toEqual({
      code: "600000",
      name: "浦发银行",
      price: 11,
      changePercent: 0
    });
  });

  it("throws when both detail and trend lookups fail", async () => {
    mockRoutes([
      { match: "/api/stock/detail", ok: false, status: 500, body: {} },
      { match: "/api/stock/trends", ok: false, status: 500, body: {} }
    ]);

    await expect(fetchLiveStockQuoteSnapshot("600000")).rejects.toThrow(
      "未取到实时行情快照。"
    );
  });
});
