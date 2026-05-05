import { MarketIndex } from "../types";

type EastmoneyQuote = {
  f2?: number;
  f3?: number;
  f12?: string;
  f13?: number;
  f14?: string;
};

type EastmoneyResponse = {
  data?: {
    diff?: EastmoneyQuote[];
  };
};

const INDEX_CONFIG = [
  { code: "1.000001", name: "上证指数" },
  { code: "0.399001", name: "深证成指" },
  { code: "0.399006", name: "创业板指" },
  { code: "1.000300", name: "沪深300" },
  { code: "1.000905", name: "中证500" }
] as const;

function jsonp<T>(url: string, callbackParam = "cb") {
  return new Promise<T>((resolve, reject) => {
    const callbackName = `eastmoney_jsonp_${Date.now()}_${Math.random()
      .toString(16)
      .slice(2)}`;
    const globalWindow = window as unknown as Record<string, unknown>;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("实时行情请求超时。"));
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
      reject(new Error("实时行情脚本加载失败。"));
    };

    script.src = `${url}${url.includes("?") ? "&" : "?"}${callbackParam}=${callbackName}`;
    document.body.appendChild(script);
  });
}

export async function fetchLiveMarketIndices(): Promise<MarketIndex[]> {
  const response = await jsonp<EastmoneyResponse>(
    "https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=f12,f13,f14,f2,f3&secids=1.000001,0.399001,0.399006,1.000300,1.000905&ut=fa5fd1943c7b386f172d6893dbfba10b"
  );
  const diff = response.data?.diff ?? [];

  const quotes = new Map(
    diff.map((item) => [`${item.f13 ?? ""}.${item.f12 ?? ""}`, item] as const)
  );

  const marketIndices = INDEX_CONFIG.map(({ code, name }) => {
    const quote = quotes.get(code);

    if (typeof quote?.f2 !== "number" || typeof quote?.f3 !== "number") {
      throw new Error(`缺少 ${name} 的实时行情。`);
    }

    return {
      code,
      name: quote.f14 || name,
      value: quote.f2,
      change: quote.f3
    };
  });

  if (marketIndices.length === 0) {
    throw new Error("未返回任何指数数据。");
  }

  return marketIndices;
}
