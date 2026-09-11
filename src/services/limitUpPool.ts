import { LimitUpStock } from "../types";
import { fetchJson } from "./http";

type LimitUpPoolResult = {
  qdate?: number;
  pool: LimitUpStock[];
};

type MarketDataResponse<T> = {
  ok: boolean;
  status: "live" | "fresh-cache" | "stale-cache" | "error";
  updatedAt?: string;
  warning?: string;
  error?: string;
  data?: T;
};

export async function fetchLiveLimitUpPool() {
  const response =
    await fetchJson<MarketDataResponse<LimitUpPoolResult>>("/api/market/limit-up-pool");

  if (!response.ok || !response.data?.pool.length) {
    throw new Error(response.error || "最近 10 天都没有取到涨停池数据。");
  }

  return response.data;
}
