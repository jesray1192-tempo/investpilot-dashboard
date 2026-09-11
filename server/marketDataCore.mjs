const eastmoneyToken =
  process.env.EASTMONEY_QUOTE_TOKEN || "fa5fd1943c7b386f172d6893dbfba10b";
const limitUpToken =
  process.env.EASTMONEY_LIMIT_UP_TOKEN || "7eea3edcaed734bea9cbfc24409ed989";
const searchToken =
  process.env.EASTMONEY_SEARCH_TOKEN || "D43BF722C8E33BDC906FB84D85E326E8";
const quoteHosts = (
  process.env.EASTMONEY_QUOTE_HOSTS ||
  "https://push2.eastmoney.com,https://push2delay.eastmoney.com"
)
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const cacheTtlMs = Number(process.env.MARKET_DATA_CACHE_TTL_MS ?? 30_000);
const requestTimeoutMs = Number(process.env.MARKET_DATA_TIMEOUT_MS ?? 8_000);

const cache = new Map();

const indexConfig = [
  { code: "1.000001", name: "上证指数" },
  { code: "0.399001", name: "深证成指" },
  { code: "0.399006", name: "创业板指" },
  { code: "1.000688", name: "科创50" },
  { code: "1.000300", name: "沪深300" },
  { code: "1.000905", name: "中证500" }
];

export const corsHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "Accept, Content-Type"
};

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json, text/plain, */*",
        referer: "https://quote.eastmoney.com/",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
      }
    });

    if (!response.ok) {
      throw new Error(`Upstream responded ${response.status}`);
    }

    const text = await response.text();
    const trimmed = text.trim();

    try {
      return JSON.parse(trimmed);
    } catch {
      const jsonp = trimmed.match(/^[a-zA-Z_$][\w$]*\(([\s\S]*)\)\s*;?\s*$/);
      if (!jsonp) {
        throw new Error("Upstream did not return JSON");
      }
      return JSON.parse(jsonp[1]);
    }
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonFromHosts(pathAndQuery, hosts = quoteHosts) {
  let lastError = new Error("No quote hosts configured");

  for (const host of hosts) {
    try {
      return await fetchJson(`${host.replace(/\/$/, "")}${pathAndQuery}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Upstream request failed");
    }
  }

  throw lastError;
}

function readCache(key) {
  const cached = cache.get(key);

  if (!cached) {
    return null;
  }

  return {
    ...cached,
    isFresh: Date.now() - cached.fetchedAt <= cacheTtlMs
  };
}

async function cachedEndpoint(key, loader) {
  const cached = readCache(key);

  if (cached?.isFresh) {
    return {
      ok: true,
      status: "fresh-cache",
      updatedAt: cached.updatedAt,
      data: cached.data
    };
  }

  try {
    const data = await loader();
    const record = {
      data,
      fetchedAt: Date.now(),
      updatedAt: new Date().toISOString()
    };
    cache.set(key, record);

    return {
      ok: true,
      status: "live",
      updatedAt: record.updatedAt,
      data
    };
  } catch (error) {
    if (cached) {
      return {
        ok: true,
        status: "stale-cache",
        updatedAt: cached.updatedAt,
        warning: error instanceof Error ? error.message : "Upstream request failed",
        data: cached.data
      };
    }

    throw error;
  }
}

async function loadMarketIndices() {
  const secids = indexConfig.map((item) => item.code).join(",");
  const payload = await fetchJsonFromHosts(
    `/api/qt/ulist.np/get?fltt=2&fields=f12,f13,f14,f2,f3&secids=${secids}&ut=${eastmoneyToken}`
  );
  const diff = payload.data?.diff ?? [];
  const quotes = new Map(diff.map((item) => [`${item.f13 ?? ""}.${item.f12 ?? ""}`, item]));

  return indexConfig.map(({ code, name }) => {
    const quote = quotes.get(code);

    if (typeof quote?.f2 !== "number" || typeof quote?.f3 !== "number") {
      throw new Error(`Missing index quote: ${name}`);
    }

    return {
      code,
      name: quote.f14 || name,
      value: quote.f2,
      change: quote.f3
    };
  });
}

function formatTradeDate(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}

function shiftDate(baseDate, days) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(baseDate.getDate() - days);
  return nextDate;
}

function formatSealAmount(value) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return "暂无";
  }

  const amountInYi = value / 100000000;
  return `${amountInYi >= 100 ? amountInYi.toFixed(0) : amountInYi.toFixed(2)}亿`;
}

function formatTime(value) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return "--:--";
  }

  const text = `${value}`.padStart(6, "0");
  return `${text.slice(0, 2)}:${text.slice(2, 4)}`;
}

function buildSealStrength(sealFund, openBoardCount) {
  if (typeof sealFund !== "number" || Number.isNaN(sealFund) || sealFund <= 0) {
    return "未知";
  }

  const amountInYi = sealFund / 100000000;
  const boards = openBoardCount ?? 0;

  if (amountInYi >= 5 && boards === 0) {
    return "极强";
  }
  if (amountInYi >= 3 && boards <= 1) {
    return "强";
  }
  if (amountInYi >= 1) {
    return "中强";
  }
  if (amountInYi >= 0.4) {
    return "中";
  }
  return "偏弱";
}

function mapPoolItem(item) {
  if (!item.c || !item.n || typeof item.p !== "number") {
    return null;
  }

  const consecutiveBoardCount = item.lbc ?? item.zttj?.ct ?? 1;
  const boardLabel = consecutiveBoardCount > 1 ? "连板晋级" : "首板发酵";

  return {
    code: item.c,
    name: item.n,
    price: item.p / 1000,
    limitUpCount: item.zttj?.ct ?? consecutiveBoardCount,
    consecutiveBoardCount,
    openBoardCount: item.zbc ?? 0,
    sealAmount: formatSealAmount(item.fund),
    firstLimitUpTime: formatTime(item.fbt),
    sealStrength: buildSealStrength(item.fund, item.zbc),
    ladderType: consecutiveBoardCount > 1 ? "连板" : "首板",
    reason: item.hybk ? `${item.hybk}方向${boardLabel}` : boardLabel,
    industry: item.hybk || "未知行业"
  };
}

async function requestLimitUpPool(tradeDate) {
  const payload = await fetchJson(
    `https://push2ex.eastmoney.com/getTopicZTPool?ut=${limitUpToken}&dpt=wz.ztzt&Pageindex=0&pagesize=200&sort=fbt:asc&date=${tradeDate}`
  );

  return {
    qdate: payload.data?.qdate,
    pool: (payload.data?.pool ?? []).map(mapPoolItem).filter(Boolean)
  };
}

async function loadLimitUpPool() {
  const today = new Date();

  for (let offset = 0; offset < 10; offset += 1) {
    const tradeDate = formatTradeDate(shiftDate(today, offset));
    const result = await requestLimitUpPool(tradeDate);

    if (result.pool.length > 0) {
      return result;
    }
  }

  throw new Error("No limit-up pool data found in the last 10 days");
}

function errorPayload(error) {
  return {
    ok: false,
    status: "error",
    error: error instanceof Error ? error.message : "Market data request failed"
  };
}

export async function handleMarketApi(pathname, searchParams = new URLSearchParams()) {
  const params =
    searchParams instanceof URLSearchParams
      ? searchParams
      : new URLSearchParams(searchParams ?? {});

  if (pathname === "/api/market/indices") {
    return { statusCode: 200, payload: await cachedEndpoint("indices", loadMarketIndices) };
  }

  if (pathname === "/api/market/limit-up-pool") {
    return { statusCode: 200, payload: await cachedEndpoint("limit-up-pool", loadLimitUpPool) };
  }

  if (pathname === "/api/stock/detail") {
    const secid = params.get("secid");
    if (!secid) {
      return { statusCode: 400, payload: { ok: false, error: "Missing secid" } };
    }

    return {
      statusCode: 200,
      payload: await cachedEndpoint(`stock-detail-${secid}`, () =>
        fetchJsonFromHosts(
          `/api/qt/stock/get?fltt=2&invt=2&fields=f43,f44,f45,f46,f47,f48,f50,f51,f52,f57,f58,f60,f71,f84,f85,f116,f117,f127,f162,f167,f168,f169,f170,f171&secid=${encodeURIComponent(secid)}&ut=${eastmoneyToken}`
        )
      )
    };
  }

  if (pathname === "/api/stock/trends") {
    const secid = params.get("secid");
    const days = params.get("days") ?? "1";
    if (!secid) {
      return { statusCode: 400, payload: { ok: false, error: "Missing secid" } };
    }

    return {
      statusCode: 200,
      payload: await cachedEndpoint(`stock-trends-${secid}-${days}`, () =>
        fetchJson(
          `https://push2his.eastmoney.com/api/qt/stock/trends2/get?fields1=f1,f2,f3,f4,f5,f6,f7,f8&fields2=f51,f52,f53,f54,f55,f56,f57,f58&iscr=0&ndays=${encodeURIComponent(days)}&secid=${encodeURIComponent(secid)}&ut=${limitUpToken}`
        )
      )
    };
  }

  if (pathname === "/api/stock/search") {
    const input = params.get("input");
    if (!input) {
      return { statusCode: 400, payload: { ok: false, error: "Missing input" } };
    }

    return {
      statusCode: 200,
      payload: await cachedEndpoint(`stock-search-${input}`, () =>
        fetchJson(
          `https://searchadapter.eastmoney.com/api/suggest/get?input=${encodeURIComponent(input)}&type=14&token=${searchToken}&count=10`
        )
      )
    };
  }

  return {
    statusCode: 404,
    payload: {
      ok: false,
      error: "Not found"
    }
  };
}

export async function handleMarketApiSafe(pathname, searchParams) {
  try {
    return await handleMarketApi(pathname, searchParams);
  } catch (error) {
    return {
      statusCode: 502,
      payload: errorPayload(error)
    };
  }
}
