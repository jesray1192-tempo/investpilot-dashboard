import { LimitUpStock } from "../types";
import { fetchJson, MarketDataResponse } from "../lib/marketDataClient";

type LimitUpPoolResult = {
  qdate?: number;
  pool: LimitUpStock[];
};

export async function fetchLiveLimitUpPool() {
  const response = await fetchJson<MarketDataResponse<LimitUpPoolResult>>(
    "/api/market/limit-up-pool",
    (status) => `涨停池请求失败（${status}）。`
  );

  if (!response.ok || !response.data?.pool.length) {
    throw new Error(response.error || "最近 10 天都没有取到涨停池数据。");
  }

  return response.data;
}
