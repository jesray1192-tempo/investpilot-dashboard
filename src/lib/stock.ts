import { StockDetail } from "../types";

export function isShanghaiCode(code: string): boolean {
  return code.startsWith("6") || code.startsWith("9") || code.startsWith("5");
}

export function inferMarket(code: string): StockDetail["market"] {
  return isShanghaiCode(code) ? "SH" : "SZ";
}

export function resolveSecid(code: string): string {
  return `${isShanghaiCode(code) ? 1 : 0}.${code}`;
}

export function createEmptyStockDetail(
  code: string,
  name: string,
  overrides: Partial<StockDetail> = {}
): StockDetail {
  return {
    code,
    name,
    market: inferMarket(code),
    industry: "未知行业",
    price: 0,
    changeAmount: 0,
    changePercent: 0,
    open: 0,
    high: 0,
    low: 0,
    prevClose: 0,
    averagePrice: 0,
    volume: 0,
    amount: 0,
    volumeRatio: 0,
    turnoverRate: 0,
    amplitude: 0,
    upLimit: 0,
    downLimit: 0,
    totalShares: 0,
    floatShares: 0,
    totalMarketCap: 0,
    floatMarketCap: 0,
    peTtm: null,
    pb: null,
    ...overrides
  };
}
