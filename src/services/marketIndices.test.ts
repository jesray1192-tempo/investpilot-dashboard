import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLiveMarketIndices } from "./marketIndices";

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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchLiveMarketIndices", () => {
  it("requests the indices endpoint and returns the data array", async () => {
    const indices = [
      { code: "1.000001", name: "上证指数", value: 3000, change: 1.2 }
    ];
    const fetchMock = mockFetch({
      ok: true,
      json: async () => ({ ok: true, status: "live", data: indices })
    });

    const result = await fetchLiveMarketIndices();

    expect(result).toEqual(indices);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/market/indices",
      expect.objectContaining({
        headers: { Accept: "application/json, text/plain, */*" }
      })
    );
  });

  it("throws with the HTTP status when the response is not ok", async () => {
    mockFetch({ ok: false, status: 503, json: async () => ({}) });

    await expect(fetchLiveMarketIndices()).rejects.toThrow("实时行情请求失败（503）。");
  });

  it("throws the payload error when the payload is not ok", async () => {
    mockFetch({
      ok: true,
      json: async () => ({ ok: false, status: "error", error: "上游异常" })
    });

    await expect(fetchLiveMarketIndices()).rejects.toThrow("上游异常");
  });

  it("throws a default message when no indices are returned", async () => {
    mockFetch({
      ok: true,
      json: async () => ({ ok: true, status: "live", data: [] })
    });

    await expect(fetchLiveMarketIndices()).rejects.toThrow("未返回任何指数数据。");
  });
});
