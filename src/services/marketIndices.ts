import { MarketIndex } from "../types";
import { fetchJson } from "./http";

type MarketDataResponse<T> = {
  ok: boolean;
  status: "live" | "fresh-cache" | "stale-cache" | "error";
  updatedAt?: string;
  warning?: string;
  error?: string;
  data?: T;
};

export async function fetchLiveMarketIndices(): Promise<MarketIndex[]> {
  const response = await fetchJson<MarketDataResponse<MarketIndex[]>>("/api/market/indices");

  if (!response.ok || !response.data?.length) {
    throw new Error(response.error || "未返回任何指数数据。");
  }

  return response.data;
}
