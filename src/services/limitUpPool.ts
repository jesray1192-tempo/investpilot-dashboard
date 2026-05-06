import { LimitUpStock } from "../types";

type EastmoneyLimitUpItem = {
  c?: string;
  n?: string;
  p?: number;
  fund?: number;
  zbc?: number;
  fbt?: number;
  lbc?: number;
  hybk?: string;
  zttj?: {
    ct?: number;
  };
};

type EastmoneyLimitUpResponse = {
  data?: {
    qdate?: number;
    pool?: EastmoneyLimitUpItem[];
  };
};

function jsonp<T>(url: string, callbackParam = "cb") {
  return new Promise<T>((resolve, reject) => {
    const callbackName = `eastmoney_jsonp_${Date.now()}_${Math.random()
      .toString(16)
      .slice(2)}`;
    const globalWindow = window as unknown as Record<string, unknown>;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("涨停池请求超时。"));
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
      reject(new Error("涨停池脚本加载失败。"));
    };

    script.src = `${url}${url.includes("?") ? "&" : "?"}${callbackParam}=${callbackName}`;
    document.body.appendChild(script);
  });
}

function formatTradeDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}

function shiftDate(baseDate: Date, days: number) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(baseDate.getDate() - days);
  return nextDate;
}

function formatSealAmount(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return "暂无";
  }

  const amountInYi = value / 100000000;
  return `${amountInYi >= 100 ? amountInYi.toFixed(0) : amountInYi.toFixed(2)}亿`;
}

function formatTime(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return "--:--";
  }

  const text = `${value}`.padStart(6, "0");
  return `${text.slice(0, 2)}:${text.slice(2, 4)}`;
}

function buildSealStrength(sealFund?: number, openBoardCount?: number) {
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

function buildReason(industry?: string, consecutiveBoardCount?: number) {
  const boardLabel = (consecutiveBoardCount ?? 0) > 1 ? "连板晋级" : "首板发酵";

  if (!industry) {
    return boardLabel;
  }

  return `${industry}方向${boardLabel}`;
}

function mapPoolItem(item: EastmoneyLimitUpItem): LimitUpStock | null {
  if (!item.c || !item.n || typeof item.p !== "number") {
    return null;
  }

  const consecutiveBoardCount = item.lbc ?? item.zttj?.ct ?? 1;

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
    reason: buildReason(item.hybk, consecutiveBoardCount),
    industry: item.hybk || "未知行业"
  };
}

async function requestLimitUpPool(tradeDate: string) {
  const response = await jsonp<EastmoneyLimitUpResponse>(
    `https://push2ex.eastmoney.com/getTopicZTPool?ut=7eea3edcaed734bea9cbfc24409ed989&dpt=wz.ztzt&Pageindex=0&pagesize=200&sort=fbt:asc&date=${tradeDate}`
  );

  return {
    qdate: response.data?.qdate,
    pool: (response.data?.pool ?? []).map(mapPoolItem).filter(Boolean) as LimitUpStock[]
  };
}

export async function fetchLiveLimitUpPool() {
  const today = new Date();

  for (let offset = 0; offset < 10; offset += 1) {
    const tradeDate = formatTradeDate(shiftDate(today, offset));
    const result = await requestLimitUpPool(tradeDate);

    if (result.pool.length > 0) {
      return result;
    }
  }

  throw new Error("最近 10 天都没有取到涨停池数据。");
}
