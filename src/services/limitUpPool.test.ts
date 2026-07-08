import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLiveLimitUpPool } from "./limitUpPool";

type FetchResult = {
  ok: boolean;
  status?: number;
  json: () => Promise<unknown>;
};

function mockFetch(result: FetchResult) {
  const fetchMock = vi.fn(async () => result as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const sampleStock = {
  code: "600000",
  name: "浦发银行",
  price: 10.5,
  limitUpCount: 1,
  consecutiveBoardCount: 1,
  openBoardCount: 0,
  sealAmount: "2.00亿",
  firstLimitUpTime: "09:35",
  sealStrength: "强",
  ladderType: "首板" as const,
  reason: "银行方向首板发酵",
  industry: "银行"
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchLiveLimitUpPool", () => {
  it("requests the limit-up-pool endpoint and returns the pool payload", async () => {
    const data = { qdate: 20260708, pool: [sampleStock] };
    const fetchMock = mockFetch({
      ok: true,
      json: async () => ({ ok: true, status: "live", data })
    });

    const result = await fetchLiveLimitUpPool();

    expect(result).toEqual(data);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/market/limit-up-pool",
      expect.objectContaining({
        headers: { Accept: "application/json, text/plain, */*" }
      })
    );
  });

  it("throws with the HTTP status when the response is not ok", async () => {
    mockFetch({ ok: false, status: 500, json: async () => ({}) });

    await expect(fetchLiveLimitUpPool()).rejects.toThrow("涨停池请求失败（500）。");
  });

  it("throws the payload error when the payload is not ok", async () => {
    mockFetch({
      ok: true,
      json: async () => ({ ok: false, status: "error", error: "涨停池上游异常" })
    });

    await expect(fetchLiveLimitUpPool()).rejects.toThrow("涨停池上游异常");
  });

  it("throws a default message when the pool is empty", async () => {
    mockFetch({
      ok: true,
      json: async () => ({ ok: true, status: "live", data: { qdate: 20260708, pool: [] } })
    });

    await expect(fetchLiveLimitUpPool()).rejects.toThrow("最近 10 天都没有取到涨停池数据。");
  });
});
