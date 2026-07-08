import { MarketIndex } from "../types";
import { fetchJson, MarketDataResponse } from "../lib/marketDataClient";

export async function fetchLiveMarketIndices(): Promise<MarketIndex[]> {
  const response = await fetchJson<MarketDataResponse<MarketIndex[]>>(
    "/api/market/indices",
    (status) => `实时行情请求失败（${status}）。`
  );

  if (!response.ok || !response.data?.length) {
    throw new Error(response.error || "未返回任何指数数据。");
  }

  return response.data;
}
