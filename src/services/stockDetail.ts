import { StockDetail, StockTrendPoint } from "../types";

type StockSearchMatch = {
  code: string;
  name: string;
};

type StockQuoteSnapshot = {
  code: string;
  name: string | null;
  price: number;
  changePercent: number;
};

type EastmoneyStockDetailResponse = {
  data?: {
    f43?: number;
    f44?: number;
    f45?: number;
    f46?: number;
    f47?: number;
    f48?: number;
    f50?: number;
    f51?: number;
    f52?: number;
    f57?: string;
    f58?: string;
    f60?: number;
    f71?: number;
    f84?: number;
    f85?: number;
    f116?: number;
    f117?: number;
    f127?: string;
    f162?: number;
    f167?: number;
    f168?: number;
    f169?: number;
    f170?: number;
    f171?: number;
  };
};

type EastmoneyStockTrendResponse = {
  data?: {
    trends?: string[];
  };
};

type EastmoneyStockSearchResponse = {
  QuotationCodeTable?: {
    Data?: Array<{
      Code?: string;
      Name?: string;
    }>;
  };
};

function jsonp<T>(url: string, callbackParam = "cb") {
  return new Promise<T>((resolve, reject) => {
    const callbackName = `eastmoney_jsonp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const globalWindow = window as unknown as Record<string, unknown>;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("个股详情请求超时。"));
    }, 10000);

    const cleanup = () => {
      window.clearTimeout(timer);
      delete globalWindow[callbackName];
      script.remove();
    };

    globalWindow[callbackName] = (payload: T) => {
      cleanup();
      resolve(payload);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("个股详情脚本加载失败。"));
    };

    script.src = `${url}${url.includes("?") ? "&" : "?"}${callbackParam}=${callbackName}`;
    document.body.appendChild(script);
  });
}

function resolveSecid(code: string) {
  if (code.startsWith("6") || code.startsWith("9") || code.startsWith("5")) {
    return `1.${code}`;
  }

  return `0.${code}`;
}

function normalizePrice(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  return value / 100;
}

function normalizePercent(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  return value / 100;
}

function normalizeNullableRatio(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return value / 100;
}

function parseTrendPoint(item: string): StockTrendPoint | null {
  const [timestamp, openText, closeText, , , volumeText, amountText, averageText] = item.split(",");

  if (!timestamp || !closeText) {
    return null;
  }

  return {
    timestamp,
    price: Number.parseFloat(closeText) || Number.parseFloat(openText) || 0,
    averagePrice: Number.parseFloat(averageText) || Number.parseFloat(closeText) || 0,
    volume: Number.parseFloat(volumeText) || 0,
    amount: Number.parseFloat(amountText) || 0
  };
}

export async function fetchLiveStockDetail(code: string): Promise<StockDetail> {
  const secid = resolveSecid(code);
  const response = await jsonp<EastmoneyStockDetailResponse>(
    `https://push2.eastmoney.com/api/qt/stock/get?fltt=2&invt=2&fields=f43,f44,f45,f46,f47,f48,f50,f51,f52,f57,f58,f60,f71,f84,f85,f116,f117,f127,f162,f167,f168,f169,f170,f171&secid=${secid}&ut=fa5fd1943c7b386f172d6893dbfba10b`
  );
  const data = response.data;

  if (!data?.f57 || !data.f58) {
    throw new Error("未取到个股详情。");
  }

  return {
    code: data.f57,
    name: data.f58,
    market: secid.startsWith("1.") ? "SH" : "SZ",
    industry: data.f127 || "未知行业",
    price: normalizePrice(data.f43),
    changeAmount: normalizePrice(data.f169),
    changePercent: normalizePercent(data.f170),
    open: normalizePrice(data.f46),
    high: normalizePrice(data.f44),
    low: normalizePrice(data.f45),
    prevClose: normalizePrice(data.f60),
    averagePrice: normalizePrice(data.f71),
    volume: data.f47 ?? 0,
    amount: data.f48 ?? 0,
    volumeRatio: typeof data.f50 === "number" ? data.f50 : 0,
    turnoverRate: normalizePercent(data.f168),
    amplitude: normalizePercent(data.f171),
    upLimit: normalizePrice(data.f51),
    downLimit: normalizePrice(data.f52),
    totalShares: data.f84 ?? 0,
    floatShares: data.f85 ?? 0,
    totalMarketCap: data.f116 ?? 0,
    floatMarketCap: data.f117 ?? 0,
    peTtm: normalizeNullableRatio(data.f162),
    pb: normalizeNullableRatio(data.f167)
  };
}

export async function fetchLiveStockTrend(code: string, days: 1 | 5): Promise<StockTrendPoint[]> {
  const secid = resolveSecid(code);
  const response = await jsonp<EastmoneyStockTrendResponse>(
    `https://push2his.eastmoney.com/api/qt/stock/trends2/get?fields1=f1,f2,f3,f4,f5,f6,f7,f8&fields2=f51,f52,f53,f54,f55,f56,f57,f58&iscr=0&ndays=${days}&secid=${secid}&ut=7eea3edcaed734bea9cbfc24409ed989`
  );
  const trends = response.data?.trends ?? [];
  const points = trends.map(parseTrendPoint).filter(Boolean) as StockTrendPoint[];

  if (points.length === 0) {
    throw new Error("未取到个股走势数据。");
  }

  return points;
}

export async function fetchStockSearchMatch(query: string): Promise<StockSearchMatch> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    throw new Error("请输入股票代码或名称。");
  }

  const response = await jsonp<EastmoneyStockSearchResponse>(
    `https://searchadapter.eastmoney.com/api/suggest/get?input=${encodeURIComponent(normalizedQuery)}&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=10`
  );
  const candidates =
    response.QuotationCodeTable?.Data?.filter(
      (item): item is { Code: string; Name: string } => Boolean(item.Code && item.Name)
    ) ?? [];

  const exactMatch =
    candidates.find((item) => item.Code === normalizedQuery || item.Name === normalizedQuery) ??
    candidates[0];

  if (!exactMatch) {
    throw new Error("未找到匹配的股票代码或名称。");
  }

  return {
    code: exactMatch.Code,
    name: exactMatch.Name
  };
}

export async function fetchLiveStockQuoteSnapshot(code: string): Promise<StockQuoteSnapshot> {
  const [detailResult, trendResult] = await Promise.allSettled([
    fetchLiveStockDetail(code),
    fetchLiveStockTrend(code, 1)
  ]);

  if (detailResult.status !== "fulfilled" && trendResult.status !== "fulfilled") {
    throw new Error("未取到实时行情快照。");
  }

  const detail = detailResult.status === "fulfilled" ? detailResult.value : null;
  const trend = trendResult.status === "fulfilled" ? trendResult.value : [];
  const latestTrendPoint = trend.length > 0 ? trend[trend.length - 1] : null;
  const searchMatch =
    detail?.name
      ? null
      : await fetchStockSearchMatch(code).catch(() => null);

  return {
    code: detail?.code ?? code,
    name: detail?.name ?? searchMatch?.name ?? null,
    price: latestTrendPoint?.price ?? detail?.price ?? 0,
    changePercent: detail?.changePercent ?? 0
  };
}
