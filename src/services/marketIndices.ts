import { MarketIndex } from "../types";

type MarketDataResponse<T> = {
  ok: boolean;
  status: "live" | "fresh-cache" | "stale-cache" | "error";
  updatedAt?: string;
  warning?: string;
  error?: string;
  data?: T;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json, text/plain, */*"
    }
  });

  if (!response.ok) {
    throw new Error(`实时行情请求失败（${response.status}）。`);
  }

  return (await response.json()) as T;
}

export async function fetchLiveMarketIndices(): Promise<MarketIndex[]> {
  const response = await fetchJson<MarketDataResponse<MarketIndex[]>>("/api/market/indices");

  if (!response.ok || !response.data?.length) {
    throw new Error(response.error || "未返回任何指数数据。");
  }

  return response.data;
}
