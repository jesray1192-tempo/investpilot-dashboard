export type MarketDataStatus = "live" | "fresh-cache" | "stale-cache" | "error";

export interface MarketDataResponse<T> {
  ok: boolean;
  status: MarketDataStatus;
  updatedAt?: string;
  warning?: string;
  error?: string;
  data?: T;
}

export async function fetchJson<T>(
  url: string,
  formatError: (status: number) => string = (status) => `请求失败: ${status}`
): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json, text/plain, */*"
    }
  });

  if (!response.ok) {
    throw new Error(formatError(response.status));
  }

  return (await response.json()) as T;
}
