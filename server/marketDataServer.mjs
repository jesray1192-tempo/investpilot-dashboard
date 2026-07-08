import { createServer } from "node:http";

const port = Number(process.env.MARKET_DATA_PORT ?? 8787);
const eastmoneyToken = "fa5fd1943c7b386f172d6893dbfba10b";
const limitUpToken = "7eea3edcaed734bea9cbfc24409ed989";
const cacheTtlMs = 30_000;
const requestTimeoutMs = 8_000;

const cache = new Map();

const indexConfig = [
  { code: "1.000001", name: "上证指数" },
  { code: "0.399001", name: "深证成指" },
  { code: "0.399006", name: "创业板指" },
  { code: "1.000688", name: "科创50" },
  { code: "1.000300", name: "沪深300" },
  { code: "1.000905", name: "中证500" }
];

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*"
  });
  response.end(JSON.stringify(payload));
}

function sendNotFound(response) {
  sendJson(response, 404, {
    ok: false,
    error: "Not found"
  });
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json, text/plain, */*",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
      }
    });

    if (!response.ok) {
      throw new Error(`Upstream responded ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
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
  const payload = await fetchJson(
    `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=f12,f13,f14,f2,f3&secids=${secids}&ut=${eastmoneyToken}`
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

const server = createServer(async (request, response) => {
  if (!request.url) {
    sendNotFound(response);
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host ?? "127.0.0.1"}`);

  try {
    if (url.pathname === "/api/market/indices") {
      sendJson(response, 200, await cachedEndpoint("indices", loadMarketIndices));
      return;
    }

    if (url.pathname === "/api/market/limit-up-pool") {
      sendJson(response, 200, await cachedEndpoint("limit-up-pool", loadLimitUpPool));
      return;
    }

    if (url.pathname === "/api/stock/detail") {
      const secid = url.searchParams.get("secid");
      if (!secid) {
        sendJson(response, 400, { ok: false, error: "Missing secid" });
        return;
      }

      const payload = await cachedEndpoint(`stock-detail-${secid}`, () =>
        fetchJson(
          `https://push2.eastmoney.com/api/qt/stock/get?fltt=2&invt=2&fields=f43,f44,f45,f46,f47,f48,f50,f51,f52,f57,f58,f60,f71,f84,f85,f116,f117,f127,f162,f167,f168,f169,f170,f171&secid=${encodeURIComponent(secid)}&ut=${eastmoneyToken}`
        )
      );
      sendJson(response, 200, payload);
      return;
    }

    if (url.pathname === "/api/stock/trends") {
      const secid = url.searchParams.get("secid");
      const days = url.searchParams.get("days") ?? "1";
      if (!secid) {
        sendJson(response, 400, { ok: false, error: "Missing secid" });
        return;
      }

      const payload = await cachedEndpoint(`stock-trends-${secid}-${days}`, () =>
        fetchJson(
          `https://push2his.eastmoney.com/api/qt/stock/trends2/get?fields1=f1,f2,f3,f4,f5,f6,f7,f8&fields2=f51,f52,f53,f54,f55,f56,f57,f58&iscr=0&ndays=${encodeURIComponent(days)}&secid=${encodeURIComponent(secid)}&ut=${limitUpToken}`
        )
      );
      sendJson(response, 200, payload);
      return;
    }

    if (url.pathname === "/api/stock/search") {
      const input = url.searchParams.get("input");
      if (!input) {
        sendJson(response, 400, { ok: false, error: "Missing input" });
        return;
      }

      const payload = await cachedEndpoint(`stock-search-${input}`, () =>
        fetchJson(
          `https://searchadapter.eastmoney.com/api/suggest/get?input=${encodeURIComponent(input)}&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=10`
        )
      );
      sendJson(response, 200, payload);
      return;
    }

    sendNotFound(response);
  } catch (error) {
    sendJson(response, 502, {
      ok: false,
      status: "error",
      error: error instanceof Error ? error.message : "Market data request failed"
    });
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Market data server port ${port} is already in use.`);
  } else {
    console.error("Market data server failed:", error);
  }
  process.exit(1);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Market data server listening on http://127.0.0.1:${port}`);
});
