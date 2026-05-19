import { ChangeEvent, ClipboardEvent, DragEvent, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  dataSources,
  fundFlowBoards,
  marketBreadth,
  marketEvents,
  portfolioProfiles,
  riskSignals,
  sectorBoards
} from "./data/mock";
import { fetchLiveLimitUpPool } from "./services/limitUpPool";
import { fetchLiveMarketIndices } from "./services/marketIndices";
import { analyzeStockByManualInput, analyzeStockScreenshotAsset } from "./services/stockScreenshotAnalysis";
import {
  fetchLiveStockDetail,
  fetchLiveStockQuoteSnapshot,
  fetchLiveStockTrend,
  fetchStockSearchMatch
} from "./services/stockDetail";
import {
  Holding,
  LimitUpStock,
  MarketIndex,
  MultimodalOutput,
  PortfolioProfile,
  StockDetail,
  StockTrendPoint
} from "./types";

type NavKey =
  | "home"
  | "portfolio"
  | "ai"
  | "policy"
  | "funds"
  | "hk"
  | "us";

type MarketTabKey = "limitup" | "heat" | "turnover";
type PortfolioTabKey = "holdings" | "trades";
type HomeSubpageKey = "overview" | "events" | "boards" | "stock";
type LimitUpSortField =
  | "name"
  | "price"
  | "limitUpCount"
  | "firstLimitUpTime"
  | "openBoardCount"
  | "sealAmount"
  | "sealStrength"
  | "reason";
type SortDirection = "asc" | "desc";
type StockTrendRange = 1 | 5;
type PolicyMaterial = {
  name: string;
  kind: string;
};

type HoldingFormState = {
  code: string;
  name: string;
  shares: string;
  cost: string;
  targetPrice: string;
  stopLoss: string;
  thesis: string;
};

type UploadAsset = {
  id: string;
  name: string;
  kind: string;
  source: "file" | "link" | "paste";
  fileBlob?: Blob;
  linkUrl?: string;
  objectUrl?: string;
};

type HoldingAiAction = {
  code: string;
  name: string;
  action: string;
  confidence: string;
  priority: string;
  score: number;
  positionAdvice: string;
  executionRatio: string;
  executionShares: string;
  reason: string;
  nextStep: string;
  expectation: string;
};

type AiIdea = {
  sector: string;
  stock: string;
  code: string;
  reason: string;
  expectation: string;
};

type PortfolioAiRoadmap = {
  summary: string;
  rebalance: string;
  cashPlan: string;
  focus: string;
};

type FundingPlan = {
  source: string;
  code: string;
  action: string;
  ratio: string;
  shares: string;
  reason: string;
};

function getAssetSourceLabel(source: UploadAsset["source"]) {
  if (source === "link") {
    return "外部链接";
  }

  if (source === "paste") {
    return "粘贴截图";
  }

  return "本地文件";
}

function FieldValue({
  label,
  value,
  className = "",
  hideLabel = false
}: {
  label: string;
  value: ReactNode;
  className?: string;
  hideLabel?: boolean;
}) {
  return (
    <span className={`field-pair ${className}`.trim()}>
      {!hideLabel && <small className="field-label">{label}</small>}
      <span className="field-value">{value}</span>
    </span>
  );
}

function parseLimitUpTime(time: string) {
  const [hourText = "0", minuteText = "0"] = time.split(":");
  const hour = Number.parseInt(hourText, 10);
  const minute = Number.parseInt(minuteText, 10);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return 0;
  }

  return hour * 60 + minute;
}

function parseSealAmount(sealAmount: string) {
  return Number.parseFloat(sealAmount.replace("亿", "")) || 0;
}

function parseSealStrength(sealStrength: string) {
  const strengthMap: Record<string, number> = {
    极强: 4,
    强: 3,
    中强: 2,
    中: 1,
    弱: 0
  };

  return strengthMap[sealStrength] ?? -1;
}

function sortLimitUpStocks(
  stocks: LimitUpStock[],
  sortField: LimitUpSortField,
  sortDirection: SortDirection
) {
  const directionFactor = sortDirection === "asc" ? 1 : -1;

  return [...stocks].sort((left, right) => {
    let comparison = 0;

    switch (sortField) {
      case "name":
        comparison = left.name.localeCompare(right.name, "zh-CN");
        break;
      case "price":
        comparison = left.price - right.price;
        break;
      case "limitUpCount":
        comparison = left.limitUpCount - right.limitUpCount;
        break;
      case "firstLimitUpTime":
        comparison = parseLimitUpTime(left.firstLimitUpTime) - parseLimitUpTime(right.firstLimitUpTime);
        break;
      case "openBoardCount":
        comparison = left.openBoardCount - right.openBoardCount;
        break;
      case "sealAmount":
        comparison = parseSealAmount(left.sealAmount) - parseSealAmount(right.sealAmount);
        break;
      case "sealStrength":
        comparison = parseSealStrength(left.sealStrength) - parseSealStrength(right.sealStrength);
        break;
      case "reason":
        comparison = left.reason.localeCompare(right.reason, "zh-CN");
        break;
      default:
        comparison = 0;
    }

    if (comparison === 0) {
      comparison = left.code.localeCompare(right.code, "zh-CN");
    }

    return comparison * directionFactor;
  });
}

function SortableLimitUpHeader({
  label,
  field,
  activeField,
  direction,
  onToggle
}: {
  label: string;
  field: LimitUpSortField;
  activeField: LimitUpSortField;
  direction: SortDirection;
  onToggle: (field: LimitUpSortField) => void;
}) {
  const isActive = activeField === field;

  return (
    <button type="button" className={`sort-head-btn ${isActive ? "active" : ""}`} onClick={() => onToggle(field)}>
      <span>{label}</span>
      <span className="sort-head-arrows" aria-hidden="true">
        <span className={isActive && direction === "asc" ? "active" : ""}>▴</span>
        <span className={isActive && direction === "desc" ? "active" : ""}>▾</span>
      </span>
    </button>
  );
}

interface NavItem {
  key: NavKey;
  label: string;
  icon: string;
  description: string;
}

interface SiteStructureItem {
  title: string;
  role: string;
  summary: string;
}

function parseAppHash(hash: string): {
  nav: NavKey;
  homeSubpage: HomeSubpageKey;
  boardName: string | null;
  stockCode: string | null;
  stockBoardName: string | null;
} {
  const normalized = hash.replace(/^#/, "").trim();

  if (!normalized) {
    return { nav: "home", homeSubpage: "overview", boardName: null, stockCode: null, stockBoardName: null };
  }

  const [navSegment = "home", subpageSegment, ...restSegments] = normalized.split("/");
  const nav = navItems.find((item) => item.key === navSegment)?.key ?? "home";

  if (nav !== "home") {
    return { nav, homeSubpage: "overview", boardName: null, stockCode: null, stockBoardName: null };
  }

  if (subpageSegment === "events") {
    return { nav: "home", homeSubpage: "events", boardName: null, stockCode: null, stockBoardName: null };
  }

  if (subpageSegment === "boards") {
    const boardName = restSegments.length > 0 ? decodeURIComponent(restSegments.join("/")) : null;
    return { nav: "home", homeSubpage: "boards", boardName, stockCode: null, stockBoardName: null };
  }

  if (subpageSegment === "stocks") {
    const [stockCodeSegment, boardToken, ...boardSegments] = restSegments;
    const stockCode = stockCodeSegment ? decodeURIComponent(stockCodeSegment) : null;
    const stockBoardName =
      boardToken === "board" && boardSegments.length > 0
        ? decodeURIComponent(boardSegments.join("/"))
        : null;

    return {
      nav: "home",
      homeSubpage: "stock",
      boardName: stockBoardName,
      stockCode,
      stockBoardName
    };
  }

  return { nav: "home", homeSubpage: "overview", boardName: null, stockCode: null, stockBoardName: null };
}

const navItems: NavItem[] = [
  { key: "home", label: "首页", icon: "◎", description: "指数、板块与市场行情" },
  { key: "portfolio", label: "我的持仓", icon: "▣", description: "股票仓位与盈亏跟踪" },
  { key: "ai", label: "AI分析", icon: "✦", description: "多模态内容分析" },
  { key: "policy", label: "政策分析", icon: "◫", description: "政策、行业与主题催化" },
  { key: "funds", label: "基金", icon: "◉", description: "基金池、回撤与风格暴露" },
  { key: "hk", label: "港股", icon: "△", description: "港股通、恒指与主题股" },
  { key: "us", label: "美股", icon: "◇", description: "纳指、标普与中概跟踪" }
];

const siteStructure: SiteStructureItem[] = [
  {
    title: "首页",
    role: "看市场",
    summary: "聚合指数、涨停池、板块强弱、事件快讯和数据来源状态，先回答今天市场在交易什么。"
  },
  {
    title: "我的持仓",
    role: "管账户",
    summary: "记录股票、交易、仓位、盈亏、纪律和组合风险，形成你的个人交易操作台。"
  },
  {
    title: "AI分析",
    role: "解内容",
    summary: "统一接收视频、图片、文件和链接，先做文字总结，再输出分段结论和最终分析。"
  },
  {
    title: "政策分析",
    role: "看催化",
    summary: "跟踪政策、新闻联播、国际局势和行业信号，梳理主题催化与验证路径。"
  },
  {
    title: "基金",
    role: "看风格",
    summary: "放基金池、ETF 看板、风格轮动和回撤统计，判断当前市场偏价值、成长还是主题。"
  },
  {
    title: "港股",
    role: "看南向",
    summary: "跟踪恒指、港股通、互联网、高股息和创新药，补上 A 股之外的重要映射市场。"
  },
  {
    title: "美股",
    role: "看海外",
    summary: "聚焦纳指、标普、AI 主线、中概和利率预期，观察海外风险偏好如何反馈到本地市场。"
  }
];

const policyLinks = [
  {
    title: "“十五五”规划编制工作",
    description: "中国政府网关于“十五五”规划编制与建议解读的官方入口。",
    href: "https://www.gov.cn/yaowen/liebiao/202505/content_7024210.htm",
    tag: "中国政府网"
  },
  {
    title: "“十五五”规划建议解读",
    description: "中国政府网政策解读栏目，可持续跟踪规划建议和相关政策说明。",
    href: "https://www.gov.cn/zhengce/202511/content_7048880.htm",
    tag: "政策解读"
  },
  {
    title: "国际形势与外交动态",
    description: "外交部官网官方入口，适合跟踪国际局势、记者会和外交表态。",
    href: "https://www.mfa.gov.cn/",
    tag: "外交部"
  },
  {
    title: "外交部例行记者会",
    description: "观察国际热点、地缘政策和官方口径变化的直接来源。",
    href: "https://www.mfa.gov.cn/web/",
    tag: "记者会"
  },
  {
    title: "新闻联播",
    description: "央视《新闻联播》官方栏目页，可直接回看每日重点议题。",
    href: "https://tv.cctv.com/lm/xwlb/",
    tag: "央视官方"
  },
  {
    title: "新闻1+1",
    description: "央视官方时事评论栏目，适合作为新闻联播后的热点延伸分析入口。",
    href: "https://news.cctv.com/news_2007/20080627/106156.shtml",
    tag: "热点分析"
  }
];

function currency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2
  }).format(value);
}

function currencyWithPrecision(value: number, digits: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

function percent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatPositionPercent(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0%";
  }

  if (value < 0.01) {
    return "<0.01%";
  }

  if (value < 1) {
    return `${value.toFixed(2)}%`;
  }

  if (value < 10) {
    return `${value.toFixed(1)}%`;
  }

  return `${Math.round(value)}%`;
}

function formatLargeYi(value: number, suffix = "亿") {
  if (!value) {
    return "--";
  }

  const yi = value / 100000000;
  return `${yi >= 100 ? yi.toFixed(0) : yi.toFixed(2)}${suffix}`;
}

function formatShareCount(value: number) {
  if (!value) {
    return "--";
  }

  return `${(value / 100000000).toFixed(2)}亿股`;
}

function formatVolumeInWanHands(value: number) {
  if (!value) {
    return "--";
  }

  return `${(value / 10000).toFixed(2)}万手`;
}

function formatPlainNumber(value: number | null, digits = 2) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }

  return value.toFixed(digits);
}

function formatTrendLabel(timestamp: string, days: StockTrendRange) {
  const [dateText = "", timeText = ""] = timestamp.split(" ");
  if (days === 1) {
    return timeText.slice(0, 5);
  }

  return dateText.slice(5);
}

function formatCompactDate(value: number) {
  const text = `${value}`;

  if (text.length !== 8) {
    return text;
  }

  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
}

const emptyHoldingForm: HoldingFormState = {
  code: "",
  name: "",
  shares: "",
  cost: "",
  targetPrice: "",
  stopLoss: "",
  thesis: ""
};

const portfolioProfilesStorageKey = "investpilot-portfolio-profiles";
const activePortfolioProfileStorageKey = "investpilot-active-portfolio-profile";
const uploadAssetsDbName = "investpilot-upload-assets";
const uploadAssetsStoreName = "assets";

function createUploadAssetId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `asset-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function openUploadAssetsDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(uploadAssetsDbName, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(uploadAssetsStoreName)) {
        database.createObjectStore(uploadAssetsStoreName, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("打开上传资产数据库失败"));
  });
}

function loadPersistedUploadAssets() {
  return new Promise<UploadAsset[]>(async (resolve, reject) => {
    try {
      const database = await openUploadAssetsDb();
      const transaction = database.transaction(uploadAssetsStoreName, "readonly");
      const store = transaction.objectStore(uploadAssetsStoreName);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = (request.result as UploadAsset[]).map((asset) => ({
          ...asset,
          objectUrl: asset.fileBlob ? URL.createObjectURL(asset.fileBlob) : undefined
        }));
        resolve(records);
      };
      request.onerror = () => reject(request.error ?? new Error("读取上传资产失败"));
    } catch (error) {
      reject(error);
    }
  });
}

function persistUploadAssets(assets: UploadAsset[]) {
  return new Promise<void>(async (resolve, reject) => {
    try {
      const database = await openUploadAssetsDb();
      const transaction = database.transaction(uploadAssetsStoreName, "readwrite");
      const store = transaction.objectStore(uploadAssetsStoreName);
      const clearRequest = store.clear();

      clearRequest.onerror = () => reject(clearRequest.error ?? new Error("清空上传资产失败"));
      clearRequest.onsuccess = () => {
        assets.forEach(({ objectUrl: _objectUrl, ...asset }) => {
          store.put(asset);
        });
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("保存上传资产失败"));
    } catch (error) {
      reject(error);
    }
  });
}

function clonePortfolioProfiles(profiles: PortfolioProfile[]) {
  return profiles.map((profile) => ({
    ...profile,
    holdings: profile.holdings.map((holding) => ({
      ...holding,
      tags: [...holding.tags]
    })),
    trades: profile.trades.map((trade) => ({ ...trade }))
  }));
}

function loadPortfolioProfilesFromStorage() {
  if (typeof window === "undefined") {
    return clonePortfolioProfiles(portfolioProfiles);
  }

  try {
    const raw = window.localStorage.getItem(portfolioProfilesStorageKey);

    if (!raw) {
      return clonePortfolioProfiles(portfolioProfiles);
    }

    const parsed = JSON.parse(raw) as PortfolioProfile[];

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return clonePortfolioProfiles(portfolioProfiles);
    }

    return parsed.map((profile) => ({
      ...profile,
      holdings: Array.isArray(profile.holdings)
        ? profile.holdings.map((holding) => ({
            ...holding,
            tags: Array.isArray(holding.tags) ? holding.tags : []
          }))
        : [],
      trades: Array.isArray(profile.trades) ? profile.trades.map((trade) => ({ ...trade })) : []
    }));
  } catch {
    return clonePortfolioProfiles(portfolioProfiles);
  }
}

function loadActivePortfolioProfileIdFromStorage() {
  if (typeof window === "undefined") {
    return portfolioProfiles[0]?.id ?? "mine";
  }

  const stored = window.localStorage.getItem(activePortfolioProfileStorageKey);
  return stored || portfolioProfiles[0]?.id || "mine";
}

function holdingToFormState(item: Holding): HoldingFormState {
  return {
    code: item.code,
    name: item.name,
    shares: `${item.shares}`,
    cost: `${item.cost}`,
    targetPrice: typeof item.targetPrice === "number" ? `${item.targetPrice}` : "",
    stopLoss: typeof item.stopLoss === "number" ? `${item.stopLoss}` : "",
    thesis: item.thesis
  };
}

function totalMarketValue(items: Holding[]) {
  return items.reduce((sum, item) => sum + holdingMarketValue(item), 0);
}

function totalCostValue(items: Holding[]) {
  return items.reduce((sum, item) => sum + item.shares * item.cost, 0);
}

function holdingMarketValue(item: Holding) {
  return item.shares * item.price;
}

function holdingWeightPercent(item: Holding, portfolioMarketValue: number) {
  if (portfolioMarketValue <= 0) {
    return item.weight ?? 0;
  }

  return (holdingMarketValue(item) / portfolioMarketValue) * 100;
}

function parseExecutionRatioMidpoint(range: string) {
  const matches = range.match(/(\d+(?:\.\d+)?)%/g) ?? [];

  if (matches.length === 0) {
    return 0;
  }

  const values = matches.map((item) => Number.parseFloat(item.replace("%", "")));
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildUploadAssetFromFile(file: File, source: UploadAsset["source"] = "file"): UploadAsset {
  const extension = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf("."))
    : file.type === "image/png"
      ? ".png"
      : file.type === "image/jpeg"
        ? ".jpg"
        : "";
  const generatedName =
    source === "paste"
      ? `粘贴图片 ${new Intl.DateTimeFormat("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        }).format(new Date())}${extension}`
      : file.name;

  return {
    id: createUploadAssetId(),
    name: generatedName,
    kind: file.type.startsWith("image/")
      ? "图片"
      : file.type.startsWith("video/")
        ? "视频"
        : "文件",
    source,
    fileBlob: file,
    objectUrl: URL.createObjectURL(file)
  };
}

function buildHoldingAiActions(items: Holding[]): HoldingAiAction[] {
  const portfolioMarketValue = totalMarketValue(items);

  return items.map((item) => {
    const weight = holdingWeightPercent(item, portfolioMarketValue);
    const pnlPercent = ((item.price - item.cost) / item.cost) * 100;
    const targetGap = typeof item.targetPrice === "number" ? ((item.targetPrice - item.price) / item.price) * 100 : null;
    const stopGap = typeof item.stopLoss === "number" ? ((item.price - item.stopLoss) / item.price) * 100 : null;
    let score = 68;

    let action = "继续持有";
    let confidence = "中";
    let priority = "中优先级";
    let positionAdvice = "维持当前仓位";
    let executionRatio = "0%";
    let reason = "当前盈亏和波动处于可控区间，暂不需要激进调仓。";
    let nextStep = "继续观察量价配合、板块资金承接和目标价兑现节奏。";
    let expectation = "预期未来 1 到 3 周以震荡上行为主，适合边走边看。";

    if (typeof item.stopLoss === "number" && item.price <= item.stopLoss * 1.03) {
      action = "减仓或止损";
      confidence = "高";
      priority = "最高优先级";
      positionAdvice = "快速降仓";
      executionRatio = "50% - 100%";
      score = 28;
      reason = `现价已接近止损位，说明成本防守已经失效，再拖会放大回撤。`;
      nextStep = "优先减掉一半以上仓位，若次日无法快速收回止损线，则执行清仓。";
      expectation = "短期更可能先走弱，先保住资金效率比博反弹更重要。";
    } else if (pnlPercent >= 18 && targetGap !== null && targetGap <= 6) {
      action = "分批止盈";
      confidence = "高";
      priority = "高优先级";
      positionAdvice = "兑现部分利润";
      executionRatio = "20% - 30%";
      score = 74;
      reason = "已有较厚浮盈，且距离目标价不远，继续死扛的赔率开始下降。";
      nextStep = "先兑现 20% 到 30% 仓位，把利润锁住，剩余仓位跟踪趋势。";
      expectation = "后续仍可能有冲高，但更适合用移动止盈去吃尾段。";
    } else if (pnlPercent < -8 && weight >= 20) {
      action = "减仓观察";
      confidence = "中高";
      priority = "高优先级";
      positionAdvice = "降到中性仓位";
      executionRatio = "20% - 40%";
      score = 42;
      reason = "这类亏损幅度叠加较高仓位，会拖累组合修复速度。";
      nextStep = "先把仓位降到组合中性水平，再等量能修复和板块回流确认。";
      expectation = "若没有明显增量资金回流，短期修复弹性有限。";
    } else if (item.dailyChange > 2.5 && pnlPercent > 0) {
      action = "坚定持有";
      confidence = "高";
      priority = "中优先级";
      positionAdvice = weight >= 25 ? "持有不追高" : "可小幅顺势加仓";
      executionRatio = weight >= 25 ? "0%" : "5% - 10%";
      score = 85;
      reason = "价格、浮盈和当日强度同向，说明市场资金仍在强化这笔交易。";
      nextStep = "不追高加仓，重点盯住量能是否继续放大，以及回撤是否守住 5 日节奏。";
      expectation = "若板块热度延续，未来数日仍有继续上冲空间。";
    } else if (targetGap !== null && targetGap > 12 && pnlPercent > -3) {
      action = "持有待涨";
      confidence = "中";
      priority = "中优先级";
      positionAdvice = "保留仓位等待趋势";
      executionRatio = "0% - 10%";
      score = 72;
      reason = "离目标价仍有一段安全收益空间，现阶段更适合给趋势时间。";
      nextStep = "围绕成本附近做防守，若出现放量突破可再小幅顺势加仓。";
      expectation = "后续以趋势修复和估值回归为主，节奏不会特别快。";
    }

    if (weight >= 30 && action === "坚定持有") {
      positionAdvice = "只持有不加仓";
      executionRatio = "0%";
      nextStep = "仓位已经偏重，不建议继续加码，重点做风控和利润保护。";
    }

    if (stopGap !== null && stopGap < 8 && action !== "减仓或止损") {
      priority = "高优先级";
      nextStep = `${nextStep} 同时把止损执行放在首位，避免小亏拖成大亏。`;
    }

    if (weight <= 12 && score >= 80) {
      positionAdvice = "可试探性加仓";
      executionRatio = "5% - 8%";
    }

    return {
      code: item.code,
      name: item.name,
      action,
      confidence,
      priority,
      score,
      positionAdvice,
      executionRatio,
      executionShares:
        parseExecutionRatioMidpoint(executionRatio) > 0
          ? `${Math.max(100, Math.round((item.shares * parseExecutionRatioMidpoint(executionRatio)) / 100 / 100) * 100)} 股`
          : "暂不调整",
      reason,
      nextStep,
      expectation
    };
  }).sort((left, right) => left.score - right.score);
}

function buildAiIdeas(items: Holding[]): AiIdea[] {
  const heldThemes = new Set(items.flatMap((item) => item.tags));
  const preferredBoards = sectorBoards
    .filter((board) => board.change > 0 && !heldThemes.has(board.name))
    .slice(0, 2);
  const flowBoards = fundFlowBoards.filter((board) => board.strength !== "weak").slice(0, 2);

  const boardIdeas = preferredBoards.map((board) => ({
    sector: board.name,
    stock: board.stocks[0]?.name ?? board.leader,
    code: board.stocks[0]?.code ?? "--",
    reason: `${board.note} 当前板块涨幅 ${percent(board.change)}，具备资金继续抱团的基础。`,
    expectation: `预期若主线延续，${board.stocks[0]?.name ?? board.leader} 更容易成为下一阶段的前排承接标的。`
  }));

  const flowIdeas = flowBoards.map((board) => ({
    sector: board.name,
    stock:
      board.name === "证券"
        ? "东方财富"
        : board.name === "汽车零部件"
          ? "沃尔核材"
          : board.name === "消费电子"
            ? "立讯精密"
            : board.name,
    code:
      board.name === "证券"
        ? "300059"
        : board.name === "汽车零部件"
          ? "002130"
          : board.name === "消费电子"
            ? "002475"
            : "--",
    reason: `${board.note} 资金流入方向清晰，适合做组合中新开仓的进攻补充。`,
    expectation: `若市场成交额维持在 ${marketBreadth.turnover} 附近，该方向更容易拿到增量资金。`
  }));

  return [...boardIdeas, ...flowIdeas]
    .filter(
      (idea, index, array) =>
        array.findIndex((candidate) => candidate.code === idea.code) === index
    )
    .slice(0, 3);
}

function buildPortfolioAiRoadmap(
  items: Holding[],
  actions: HoldingAiAction[],
  cashEstimate: number
): PortfolioAiRoadmap {
  const portfolioMarketValue = totalMarketValue(items);
  const highRiskCount = actions.filter((item) => item.score <= 45).length;
  const positiveCount = actions.filter((item) => item.score >= 75).length;
  const averageScore =
    actions.length > 0 ? actions.reduce((sum, item) => sum + item.score, 0) / actions.length : 0;
  const heavyWeights = items.filter((item) => holdingWeightPercent(item, portfolioMarketValue) >= 25).length;

  return {
    summary:
      highRiskCount > 0
        ? `组合里有 ${highRiskCount} 只个股需要优先处理，当前核心任务不是加仓，而是先把低分仓位降下来。`
        : positiveCount >= 2
          ? "组合整体进攻性尚可，可以在不破坏纪律的前提下保留主线仓位。"
          : "组合处于中性偏谨慎状态，适合边持有边优化结构。",
    rebalance:
      heavyWeights >= 2
        ? "先把高波动和大仓位品种错开，避免单一风格回撤同时打击组合。"
        : "优先保留评分更高、资金趋势更顺的持仓，把弱势票压缩到观察仓。",
    cashPlan:
      cashEstimate < totalMarketValue(items) * 0.35
        ? "新增仓位资金建议优先来自减仓弱势股，而不是直接继续加总仓。"
        : "当前现金缓冲尚可，新仓位可以先试探性布局，再看资金承接决定是否扩仓。",
    focus: `当前组合平均评分 ${averageScore.toFixed(0)} 分，后续重点盯量能延续、止损执行和板块资金是否继续向强势方向集中。`
  };
}

function buildFundingPlans(actions: HoldingAiAction[]): FundingPlan[] {
  return actions
    .filter((item) => item.score <= 60 && item.executionShares !== "暂不调整")
    .slice(0, 2)
    .map((item) => ({
      source: item.name,
      code: item.code,
      action: item.action,
      ratio: item.executionRatio,
      shares: item.executionShares,
      reason: `这只股票当前评分偏低，适合作为新开仓资金的主要来源，先腾出 ${item.executionRatio} 的弹性更合理。`
    }));
}

function PlaceholderSection({
  title,
  summary,
  bullets
}: {
  title: string;
  summary: string;
  bullets: string[];
}) {
  return (
    <section className="placeholder-view">
      <article className="card wide">
        <div className="card-head">
          <div>
            <p className="section-kicker">Module</p>
            <h1>{title}</h1>
          </div>
        </div>
        <p className="placeholder-summary">{summary}</p>
        <div className="placeholder-grid">
          {bullets.map((item) => (
            <div className="placeholder-card" key={item}>
              <strong>{item}</strong>
              <p>这个模块我可以继续为你补成真实页面和明细数据表。</p>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function buildPolicyOutput(policyUrl: string, policyTheme: string, policyNote: string) {
  const theme = policyTheme.trim() || "政策热点";
  const source = policyUrl.trim() || "官方材料";
  const note = policyNote.trim() || "当前没有额外备注，默认按政策主线做中性解读。";

  return {
    summary: `AI 识别到本次材料的核心主题是“${theme}”。来源为 ${source}，当前更偏向中期政策传导，而不是单日情绪扰动。`,
    analysis: `从政策传导看，这类表述通常先影响预期，再影响订单、投资节奏和资金关注度。结合你的备注“${note}”，当前更值得观察政策落地速度、配套细则和市场是否已经提前交易。`,
    strategy: `策略上优先跟踪与“${theme}”直接相关的行业龙头、弹性分支和低位补涨方向。若政策仍处在预期发酵阶段，宜先观察主线确认，再分批布局。`,
    risk: `风险主要在三个地方：第一，政策口径偏原则性，细则未落地；第二，市场可能已经提前透支预期；第三，主题扩散过快时容易出现跟风误判。`
  };
}

function buildMultimodalOutput(
  assets: UploadAsset[],
  runCount: number
): MultimodalOutput {
  const videoAssets = assets.filter((asset) => asset.kind === "视频" || asset.kind === "视频链接");
  const imageAssets = assets.filter((asset) => asset.kind === "图片");
  const documentAssets = assets.filter(
    (asset) => asset.kind === "文件" || asset.kind === "文章链接"
  );
  const linkAssets = assets.filter((asset) => asset.source === "link");
  const primaryAssetNames = assets
    .slice(0, 3)
    .map((asset) => asset.name)
    .join("、");
  const isStockScreenshotMode = imageAssets.length > 0 && videoAssets.length === 0;
  const sourceText =
    assets.length > 0
      ? `已导入 ${assets.length} 份材料，覆盖 ${assets.map((asset) => asset.kind).join("、")}`
      : "当前还没有可分析材料";
  const stageText = runCount > 0 ? `已完成第 ${runCount} 轮解读` : "等待开始分析";

  if (isStockScreenshotMode) {
    return {
      summary: `${stageText}。${sourceText}。当前结果会直接围绕这只股票的基本面、涨停驱动、题材位置和可执行交易判断展开。`,
      segmentSummaries: [
        {
          label: "Basic",
          title: "基本面先看什么",
          body: `这张截图更像单只股票的盘面材料。做基本面判断时，优先看公司主营业务、最近一期业绩增速、利润质量、是否有订单/并购/政策催化，以及流通盘大小。若截图里没有这些信息，就要配合公告、财报和 F10 补齐，不能只靠一张盘面图下结论。`
        },
        {
          label: "Reason",
          title: "今天涨停原因",
          body: `今天涨停通常要从四个方向确认：第一，是否有公告、业绩预增、订单落地等直接催化；第二，是否属于当天最强主线题材；第三，是否有板块联动和涨停梯队支撑；第四，是否因小市值、高弹性被资金情绪强化。当前截图更适合作为“盘面强度证据”，但涨停原因仍需要结合消息面核实。`
        },
        {
          label: "Theme",
          title: "题材归属怎么判断",
          body: `题材判断不要只看一个标签，要看它究竟是主线核心、跟风补涨还是消息刺激的一日反应。更实用的做法是把它放回所属行业和概念板块里，确认同题材当天是否有批量涨停、龙头是否继续封板、成交额是否支撑持续性。`
        },
        {
          label: "Position",
          title: "盘面位置和接力价值",
          body: `判断是否值得参与，先看它在板块里的位置：是最先上板的前排，还是跟着龙头拉升的后排；是缩量强封，还是反复炸板后勉强回封；是首次爆发，还是连续加速后的高位板。前排首板或二板通常更有观察价值，后排跟风和高位一致性板更容易次日承压。`
        },
        {
          label: "Checklist",
          title: "AI 还应该继续补什么",
          body: `如果你想让这页真正可用，AI 后续至少还要继续补四个判断点：第一，自动识别截图里的股票名称和代码；第二，对应读取当天涨停原因和概念标签；第三，给出板块内同题材强弱对比；第四，明确提示“可观察”“不建议追”“只适合低吸回踩”等执行结论。`
        }
      ],
      finalAnalysis: `本轮分析围绕 ${primaryAssetNames || "当前股票截图"} 展开。当前更合理的解读方式不是泛泛而谈“材料内容”，而是把这只股票放回它所在板块中看强度位置。如果它是主线题材里的前排涨停，且有明确公告、业绩或事件催化，分析重点就该放在持续性、换手质量和次日接力位置；如果只是后排跟风或午后情绪板，判断标准就要转向次日溢价和兑现压力。`,
      entryDecision: "是否值得进入，核心看四点：一是它是不是当前最强题材的前排；二是涨停原因是否有硬逻辑而不是纯情绪；三是封单、换手和炸板回封是否健康；四是次日有没有比它位置更优的低位同题材票。如果已经是高位缩量一致性板，追进去的性价比通常不高，更适合等分歧换手后再判断。",
      peers: "同题材下优先找三类票：第一，板块龙头或辨识度最高的核心股；第二，位置更低、逻辑相同、还没被完全发散的补涨股；第三，成交更大、换手更充分、次日更容易承接的中军品种。理想状态下，这里应该进一步列出“同题材龙头 / 中军 / 低位补涨”三个候选方向，而不是只给原则。",
      risk: "最大风险是：当前只看到了一张股票截图，没有完整读到公司名称、代码、题材标签、涨停时间结构和公告内容。这样可以先做交易框架分析，但还不足以给出精确买点。真正下判断前，至少要补齐股票名称、今日涨停原因、所属题材、板块梯队位置和是否有龙虎榜/公告支撑。"
    };
  }

  if (videoAssets.length > 0) {
    return {
      summary: `${stageText}。${sourceText}。当前结果会直接提炼这套方法适用于什么市场、靠什么信号触发、执行时最容易犯什么错。`,
      segmentSummaries: [
        {
          label: "Method",
          title: "这套方法在讲什么",
          body: "这类视频通常不是在讲某一只股票，而是在讲一套选股、择时、仓位或复盘方法。分析重点应该先落在方法本身：它到底依赖趋势、情绪、基本面、题材轮动，还是均线/量价之类的技术条件。"
        },
        {
          label: "Scenario",
          title: "适用场景是什么",
          body: "投资方法最关键的是边界。要先确认它更适合牛市主升、震荡轮动、短线连板、趋势波段，还是偏中线基本面跟踪。只有先把适用场景讲清楚，后面“能不能用”才有意义。"
        },
        {
          label: "Execution",
          title: "执行步骤怎么拆",
          body: "AI 应把这类方法拆成明确步骤：先看哪些筛选条件，再看哪些确认信号，什么情况下入场，什么时候减仓，什么时候止损。否则视频里听起来有逻辑，真正执行时会变成只记得观点，不知道动作。"
        },
        {
          label: "Discipline",
          title: "仓位和纪律要求",
          body: "一套方法能不能落地，往往不取决于逻辑本身，而取决于它对仓位、止损、持股周期和容错率的要求。短线方法如果没有纪律约束，很容易被误用成频繁追涨；中线方法如果拿去做日内判断，也会失真。"
        },
        {
          label: "Mistake",
          title: "最常见的误区",
          body: "方法视频最容易让人误解的地方有三种：第一，把回测结论当成实时结论；第二，只学买点不学退出；第三，忽略这套方法只在特定市场环境下才有效。AI 应该把这些误区明确标出来。"
        }
      ],
      finalAnalysis: `本轮分析围绕 ${primaryAssetNames || "当前投资方法材料"} 展开。更合理的解读方式不是把它翻成一段摘要，而是判断这套方法到底属于“短线交易框架”“波段策略”“题材跟踪法”还是“仓位纪律法”。只有先识别方法类型，后面才能判断它适不适合你当前的交易风格。`,
      finalAnalysisTitle: "方法核心判断",
      entryDecision: "如果你想判断这套方法值不值得学，不要先问收益，先问四个问题：第一，它适用于什么市场环境；第二，它有没有明确入场和退出标准；第三，它对执行纪律要求高不高；第四，你当前的交易风格能不能稳定复现它。四个问题答不清，这套方法就不适合直接照搬。",
      entryDecisionTitle: "这套方法值不值得用",
      peers: "同类方法里建议继续对比三类内容：第一，是否有更明确的信号定义；第二，是否给出完整的仓位和止损规则；第三，是否有历史案例说明它在不同市场环境下的表现。后续这页最好把方法按“短线 / 波段 / 中线 / 仓位纪律”分类，便于横向比较。",
      peersTitle: "同类方法还该看什么",
      risk: "这类材料的最大风险不是看不懂，而是看懂了却用错场景。任何投资方法只要脱离适用环境、仓位纪律和退出条件，就容易从“方法”变成“故事”。"
    };
  }

  return {
    summary: `${stageText}。${sourceText}。当前材料以${videoAssets.length > 0 ? `${videoAssets.length} 份视频` : ""}${videoAssets.length > 0 && (imageAssets.length > 0 || documentAssets.length > 0) ? "、" : ""}${imageAssets.length > 0 ? `${imageAssets.length} 份图片` : ""}${imageAssets.length > 0 && documentAssets.length > 0 ? "、" : ""}${documentAssets.length > 0 ? `${documentAssets.length} 份文档` : ""}为主，已优先提炼事实信息、关键观点和可验证线索。`,
    segmentSummaries: videoAssets.length > 0
      ? [
          {
            label: "Segment 1",
            title: "分段总结 1",
            body: "片段一：视频前段主要在交代背景和问题定义，核心线索先落在行业催化、市场预期和事件起点上。"
          },
          {
            label: "Segment 2",
            title: "分段总结 2",
            body: "片段二：视频中段更适合由 AI 自动分段抽取关键观点，重点看哪些表述对应真实订单、政策推进或资金共识，而不是情绪噪音。"
          },
          {
            label: "Segment 3",
            title: "分段总结 3",
            body: "片段三：视频后段应重点归纳验证条件、时间窗口和风险点，避免只记住观点而忽略兑现路径。"
          }
        ]
      : [
          {
            label: "Segment 1",
            title: "分段总结 1",
            body: "材料总结：当前材料更适合先提炼事实、观点和潜在催化的边界。"
          },
          {
            label: "Segment 2",
            title: "分段总结 2",
            body: "交叉验证：链接与截图内容需要和公告、官方口径或行业数据互相印证，避免单点信息误导。"
          }
        ],
    finalAnalysis: `本轮分析围绕 ${primaryAssetNames || "当前材料"} 展开。${videoAssets.length > 0 ? "视频材料已按内容逻辑拆成阶段片段，优先识别事件背景、核心观点和结论依据。" : ""}${imageAssets.length > 0 ? "图片材料更偏向抓取关键信息、结论口径和局部证据。" : ""}${documentAssets.length > 0 ? "文档材料则更适合提炼事实表述、数据口径和潜在催化路径。" : ""}${linkAssets.length > 0 ? "外部链接已并入同一轮分析，结果会优先参考链接内容与已上传材料的一致性。" : ""}`,
    finalAnalysisTitle: "核心判断",
    entryDecision: "策略上建议先把材料拆成“已确认事实”“待验证观点”“潜在催化映射”三层，再优先跟踪最容易形成市场共识的主线方向。",
    entryDecisionTitle: "下一步怎么用",
    peers: "若材料对应到具体主题或个股，下一步应把同题材龙头、中军和补涨方向拉出来并排比较，而不是只看单一材料本身。",
    peersTitle: "可继续延伸什么",
    risk: "风险主要在材料片段不完整、单一截图缺少上下文、视频观点带情绪表达，以及文档或外链结论未经公告和行业数据交叉验证。"
  };
}

export default function App() {
  const initialHashState = useMemo(() => parseAppHash(window.location.hash), []);
  const [activeNav, setActiveNav] = useState<NavKey>(initialHashState.nav);
  const [activeHomeSubpage, setActiveHomeSubpage] = useState<HomeSubpageKey>(
    initialHashState.homeSubpage
  );
  const [activeMarketTab, setActiveMarketTab] = useState<MarketTabKey>("limitup");
  const [activePortfolioTab, setActivePortfolioTab] = useState<PortfolioTabKey>("holdings");
  const [aiLinkInput, setAiLinkInput] = useState("");
  const [uploadAssets, setUploadAssets] = useState<UploadAsset[]>([]);
  const [uploadAssetsReady, setUploadAssetsReady] = useState(false);
  const [analysisRuns, setAnalysisRuns] = useState(0);
  const [multimodalOutput, setMultimodalOutput] = useState<MultimodalOutput | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [manualStockInput, setManualStockInput] = useState("");
  const shouldShowManualStockConfirm =
    uploadAssets.some((asset) => asset.kind === "图片") &&
    !uploadAssets.some((asset) => asset.kind === "视频" || asset.kind === "视频链接");
  const [policyUrl, setPolicyUrl] = useState("https://www.gov.cn/yaowen/liebiao/202505/content_7024210.htm");
  const [policyTheme, setPolicyTheme] = useState("十五五规划");
  const [policyNote, setPolicyNote] = useState("重点看低空经济、自主可控和设备更新链条。");
  const [policyMaterials] = useState<PolicyMaterial[]>([
    { name: "中国政府网政策链接", kind: "网页链接" },
    { name: "新闻联播截图摘要", kind: "图片材料" },
    { name: "行业纪要补充说明", kind: "文本备注" }
  ]);
  const [marketIndices, setMarketIndices] = useState<MarketIndex[]>([]);
  const [marketIndicesLoading, setMarketIndicesLoading] = useState(true);
  const [marketIndicesError, setMarketIndicesError] = useState("");
  const [marketIndicesUpdatedAt, setMarketIndicesUpdatedAt] = useState("");
  const [limitUpStocks, setLimitUpStocks] = useState<LimitUpStock[]>([]);
  const [limitUpLoading, setLimitUpLoading] = useState(true);
  const [limitUpError, setLimitUpError] = useState("");
  const [limitUpUpdatedAt, setLimitUpUpdatedAt] = useState("");
  const [limitUpSortField, setLimitUpSortField] = useState<LimitUpSortField>("firstLimitUpTime");
  const [limitUpSortDirection, setLimitUpSortDirection] = useState<SortDirection>("asc");
  const [selectedLimitUpBoard, setSelectedLimitUpBoard] = useState<string | null>(
    initialHashState.boardName
  );
  const [selectedStockCode, setSelectedStockCode] = useState<string | null>(
    initialHashState.stockCode
  );
  const [selectedStockBoardName, setSelectedStockBoardName] = useState<string | null>(
    initialHashState.stockBoardName
  );
  const [stockTrendRange, setStockTrendRange] = useState<StockTrendRange>(1);
  const [stockDetail, setStockDetail] = useState<StockDetail | null>(null);
  const [stockDetailLoading, setStockDetailLoading] = useState(false);
  const [stockDetailError, setStockDetailError] = useState("");
  const [stockDetailUpdatedAt, setStockDetailUpdatedAt] = useState("");
  const [stockTrendPoints, setStockTrendPoints] = useState<StockTrendPoint[]>([]);
  const [stockTrendLoading, setStockTrendLoading] = useState(false);
  const [stockTrendError, setStockTrendError] = useState("");
  const [portfolioProfilesState, setPortfolioProfilesState] = useState<PortfolioProfile[]>(() =>
    loadPortfolioProfilesFromStorage()
  );
  const [activePortfolioProfileId, setActivePortfolioProfileId] = useState<string>(() =>
    loadActivePortfolioProfileIdFromStorage()
  );
  const [isHoldingEditorOpen, setIsHoldingEditorOpen] = useState(false);
  const [holdingEditorMode, setHoldingEditorMode] = useState<"create" | "edit">("create");
  const [editingHoldingCode, setEditingHoldingCode] = useState<string | null>(null);
  const [holdingForm, setHoldingForm] = useState<HoldingFormState>(emptyHoldingForm);
  const [holdingFormError, setHoldingFormError] = useState("");
  const [holdingQuotePreview, setHoldingQuotePreview] = useState<number | null>(null);
  const [portfolioQuotesUpdatedAt, setPortfolioQuotesUpdatedAt] = useState("");
  const activePortfolioProfile = useMemo(
    () =>
      portfolioProfilesState.find((profile) => profile.id === activePortfolioProfileId) ??
      portfolioProfilesState[0],
    [activePortfolioProfileId, portfolioProfilesState]
  );
  const portfolio = activePortfolioProfile?.holdings ?? [];
  const activeTradeRecords = activePortfolioProfile?.trades ?? [];
  const activePortfolioCashEstimate = activePortfolioProfile?.cashEstimate ?? 0;
  const marketValue = useMemo(() => totalMarketValue(portfolio), [portfolio]);
  const costValue = useMemo(() => totalCostValue(portfolio), [portfolio]);
  const pnl = marketValue - costValue;
  const pnlPercent = (pnl / costValue) * 100;
  const isEditablePortfolio = activePortfolioProfile?.id === "mine";
  const holdingAiActions = useMemo(() => buildHoldingAiActions(portfolio), [portfolio]);
  const aiIdeas = useMemo(() => buildAiIdeas(portfolio), [portfolio]);
  const portfolioAiRoadmap = useMemo(
    () => buildPortfolioAiRoadmap(portfolio, holdingAiActions, activePortfolioCashEstimate),
    [activePortfolioCashEstimate, holdingAiActions, portfolio]
  );
  const fundingPlans = useMemo(() => buildFundingPlans(holdingAiActions), [holdingAiActions]);

  useEffect(() => {
    if (portfolioProfilesState.some((profile) => profile.id === activePortfolioProfileId)) {
      return;
    }

    setActivePortfolioProfileId(portfolioProfilesState[0]?.id ?? "mine");
  }, [activePortfolioProfileId, portfolioProfilesState]);

  const riskScore = useMemo(() => {
    return Math.round(
      (portfolio.reduce((sum, item) => sum + Math.abs(item.dailyChange), 0) /
        portfolio.length) *
        20
    );
  }, [portfolio]);

  useEffect(() => {
    let disposed = false;

    const loadMarketIndices = async () => {
      try {
        setMarketIndicesError("");
        const nextIndices = await fetchLiveMarketIndices();

        if (disposed) {
          return;
        }

        setMarketIndices(nextIndices);
        setMarketIndicesUpdatedAt(
          new Intl.DateTimeFormat("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
          }).format(new Date())
        );
      } catch (error) {
        if (disposed) {
          return;
        }

        setMarketIndicesError(
          error instanceof Error ? error.message : "实时行情获取失败，请稍后重试。"
        );
      } finally {
        if (!disposed) {
          setMarketIndicesLoading(false);
        }
      }
    };

    void loadMarketIndices();
    const timer = window.setInterval(() => {
      void loadMarketIndices();
    }, 60_000);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let disposed = false;

    const loadLimitUpPool = async () => {
      try {
        setLimitUpError("");
        const nextPool = await fetchLiveLimitUpPool();

        if (disposed) {
          return;
        }

        setLimitUpStocks(nextPool.pool);
        setLimitUpUpdatedAt(
          `${formatCompactDate(nextPool.qdate ?? 0)} · ${new Intl.DateTimeFormat("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
          }).format(new Date())}`
        );
      } catch (error) {
        if (disposed) {
          return;
        }

        setLimitUpError(error instanceof Error ? error.message : "涨停池获取失败，请稍后重试。");
      } finally {
        if (!disposed) {
          setLimitUpLoading(false);
        }
      }
    };

    void loadLimitUpPool();
    const timer = window.setInterval(() => {
      void loadLimitUpPool();
    }, 60_000);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

  const limitUpBoards = useMemo(() => {
    const grouped = limitUpStocks.reduce<
      Record<
        string,
        {
          name: string;
          stocks: LimitUpStock[];
          firstBoardCount: number;
          consecutiveBoardCount: number;
          maxBoardHeight: number;
          totalSealAmount: number;
        }
      >
    >((acc, stock) => {
      const boardName = stock.industry || "未知行业";
      const numericSealAmount = Number.parseFloat(stock.sealAmount.replace("亿", "")) || 0;

      if (!acc[boardName]) {
        acc[boardName] = {
          name: boardName,
          stocks: [],
          firstBoardCount: 0,
          consecutiveBoardCount: 0,
          maxBoardHeight: 0,
          totalSealAmount: 0
        };
      }

      acc[boardName].stocks.push(stock);
      acc[boardName].totalSealAmount += numericSealAmount;
      acc[boardName].maxBoardHeight = Math.max(
        acc[boardName].maxBoardHeight,
        stock.consecutiveBoardCount
      );

      if (stock.ladderType === "首板") {
        acc[boardName].firstBoardCount += 1;
      } else {
        acc[boardName].consecutiveBoardCount += 1;
      }

      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) => {
      if (b.stocks.length !== a.stocks.length) {
        return b.stocks.length - a.stocks.length;
      }

      if (b.maxBoardHeight !== a.maxBoardHeight) {
        return b.maxBoardHeight - a.maxBoardHeight;
      }

      return b.totalSealAmount - a.totalSealAmount;
    });
  }, [limitUpStocks]);

  const selectedLimitUpBoardData = useMemo(
    () => limitUpBoards.find((board) => board.name === selectedLimitUpBoard) ?? null,
    [limitUpBoards, selectedLimitUpBoard]
  );
  const sortedLimitUpStocks = useMemo(
    () => sortLimitUpStocks(limitUpStocks, limitUpSortField, limitUpSortDirection),
    [limitUpSortDirection, limitUpSortField, limitUpStocks]
  );
  const sortedSelectedBoardStocks = useMemo(
    () =>
      selectedLimitUpBoardData
        ? sortLimitUpStocks(
            selectedLimitUpBoardData.stocks,
            limitUpSortField,
            limitUpSortDirection
          )
        : [],
    [limitUpSortDirection, limitUpSortField, selectedLimitUpBoardData]
  );

  const visibleLimitUpBoards = useMemo(() => limitUpBoards.slice(0, 4), [limitUpBoards]);
  const effectiveStockBoardName = selectedStockBoardName ?? stockDetail?.industry ?? null;
  const relatedBoardData = useMemo(() => {
    if (!effectiveStockBoardName) {
      return null;
    }

    return limitUpBoards.find((board) => board.name === effectiveStockBoardName) ?? null;
  }, [effectiveStockBoardName, limitUpBoards]);
  const stockTrendStats = useMemo(() => {
    if (stockTrendPoints.length === 0) {
      return null;
    }

    const prices = stockTrendPoints.map((point) => point.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const basePrice = stockDetail?.prevClose || stockTrendPoints[0]?.price || 0;
    const spread = Math.max(maxPrice - minPrice, basePrice * 0.01, 0.01);
    const top = Math.max(maxPrice, basePrice) + spread * 0.3;
    const bottom = Math.min(minPrice, basePrice) - spread * 0.3;
    const width = 720;
    const height = 280;

    const path = stockTrendPoints
      .map((point, index) => {
        const x =
          stockTrendPoints.length === 1
            ? width / 2
            : (index / (stockTrendPoints.length - 1)) * width;
        const y = height - ((point.price - bottom) / (top - bottom)) * height;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");

    const avgPath = stockTrendPoints
      .map((point, index) => {
        const x =
          stockTrendPoints.length === 1
            ? width / 2
            : (index / (stockTrendPoints.length - 1)) * width;
        const y = height - ((point.averagePrice - bottom) / (top - bottom)) * height;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");

    const tickIndexes = [0, Math.floor((stockTrendPoints.length - 1) / 2), stockTrendPoints.length - 1];
    const ticks = tickIndexes.map((index) => ({
      index,
      label: formatTrendLabel(stockTrendPoints[index].timestamp, stockTrendRange)
    }));

    return {
      width,
      height,
      top,
      bottom,
      basePrice,
      path,
      avgPath,
      ticks
    };
  }, [stockDetail?.prevClose, stockTrendPoints, stockTrendRange]);

  const currentNav = navItems.find((item) => item.key === activeNav) ?? navItems[0];
  const homeHeadline = marketEvents[0];
  const investedRatio =
    marketValue + activePortfolioCashEstimate > 0
      ? (marketValue / (marketValue + activePortfolioCashEstimate)) * 100
      : 0;
  const dailyPnl = portfolio.reduce(
    (sum, item) => sum + item.shares * item.price * (item.dailyChange / 100),
    0
  );
  const disciplineCoverageCount = portfolio.filter(
    (item) => typeof item.targetPrice === "number" && typeof item.stopLoss === "number"
  ).length;
  const maxLimitUpHeight = limitUpStocks.length
    ? Math.max(...limitUpStocks.map((stock) => stock.consecutiveBoardCount))
    : 0;
  const totalOpenBoardCount = limitUpStocks.reduce((sum, stock) => sum + stock.openBoardCount, 0);
  const firstBoardCount = limitUpStocks.filter((stock) => stock.ladderType === "首板").length;
  const consecutiveBoardCount = limitUpStocks.filter(
    (stock) => stock.ladderType === "连板"
  ).length;
  const policyOutput = useMemo(
    () => buildPolicyOutput(policyUrl, policyTheme, policyNote),
    [policyUrl, policyTheme, policyNote]
  );
  const uploadedVideos = useMemo(
    () => uploadAssets.filter((asset) => asset.kind === "视频" && asset.objectUrl),
    [uploadAssets]
  );
  const portfolioCodes = useMemo(() => portfolio.map((item) => item.code), [portfolio]);
  const portfolioCodeSignature = useMemo(
    () => [...portfolioCodes].sort((left, right) => left.localeCompare(right, "zh-CN")).join(","),
    [portfolioCodes]
  );

  function openCreateHoldingEditor() {
    setHoldingEditorMode("create");
    setEditingHoldingCode(null);
    setHoldingForm(emptyHoldingForm);
    setHoldingFormError("");
    setHoldingQuotePreview(null);
    setIsHoldingEditorOpen(true);
  }

  function openEditHoldingEditor(item: Holding) {
    setHoldingEditorMode("edit");
    setEditingHoldingCode(item.code);
    setHoldingForm(holdingToFormState(item));
    setHoldingFormError("");
    setHoldingQuotePreview(item.price);
    setIsHoldingEditorOpen(true);
  }

  function closeHoldingEditor() {
    setIsHoldingEditorOpen(false);
    setHoldingFormError("");
    setEditingHoldingCode(null);
    setHoldingForm(emptyHoldingForm);
    setHoldingQuotePreview(null);
  }

  function updateActivePortfolioHoldings(updater: (current: Holding[]) => Holding[]) {
    setPortfolioProfilesState((current) =>
      current.map((profile) =>
        profile.id === activePortfolioProfileId
          ? {
              ...profile,
              holdings: updater(profile.holdings)
            }
          : profile
      )
    );
  }

  function handleHoldingFormChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    setHoldingForm((current) => ({ ...current, [name]: value }));
  }

  function handleHoldingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedCode = holdingForm.code.trim();
    const normalizedName = holdingForm.name.trim();
    const normalizedThesis = holdingForm.thesis.trim();
    const shares = Number(holdingForm.shares);
    const cost = Number(holdingForm.cost);
    const targetPrice = holdingForm.targetPrice.trim() ? Number(holdingForm.targetPrice) : undefined;
    const stopLoss = holdingForm.stopLoss.trim() ? Number(holdingForm.stopLoss) : undefined;

    if (!normalizedCode || !normalizedName || !normalizedThesis) {
      setHoldingFormError("请完整填写股票代码、名称和买入逻辑。");
      return;
    }

    if ([shares, cost].some((value) => !Number.isFinite(value) || value <= 0)) {
      setHoldingFormError("持仓股数和成本价必须是大于 0 的数字。");
      return;
    }

    if (
      (typeof targetPrice === "number" && (!Number.isFinite(targetPrice) || targetPrice <= 0)) ||
      (typeof stopLoss === "number" && (!Number.isFinite(stopLoss) || stopLoss <= 0))
    ) {
      setHoldingFormError("目标价和止损价如果填写，必须是大于 0 的数字。");
      return;
    }

    const editingItem = portfolio.find((item) => item.code === editingHoldingCode);
    const existingCodeItem = portfolio.find((item) => item.code === normalizedCode);
    const duplicatedCode = existingCodeItem && existingCodeItem.code !== editingHoldingCode;

    if (duplicatedCode) {
      setHoldingFormError("该股票代码已经存在，请直接编辑原有持仓。");
      return;
    }

    const nextHolding: Holding = {
      code: normalizedCode,
      name: normalizedName,
      shares,
      cost,
      price: editingItem?.price ?? existingCodeItem?.price ?? 0,
      dailyChange: editingItem?.dailyChange ?? existingCodeItem?.dailyChange ?? 0,
      thesis: normalizedThesis,
      tags: editingItem?.tags ?? existingCodeItem?.tags ?? [],
      targetPrice,
      stopLoss
    };

    updateActivePortfolioHoldings((current) => {
      if (holdingEditorMode === "edit" && editingHoldingCode) {
        return current.map((item) => (item.code === editingHoldingCode ? nextHolding : item));
      }

      return [nextHolding, ...current];
    });

    closeHoldingEditor();
  }

  function handleDeleteHolding(code: string) {
    const item = portfolio.find((entry) => entry.code === code);

    if (!item) {
      return;
    }

    if (!window.confirm(`确认删除 ${item.name}（${item.code}）这条持仓吗？`)) {
      return;
    }

    updateActivePortfolioHoldings((current) => current.filter((entry) => entry.code !== code));
  }

  useEffect(() => {
    closeHoldingEditor();
    setActivePortfolioTab("holdings");
  }, [activePortfolioProfileId]);

  useEffect(() => {
    window.localStorage.setItem(
      portfolioProfilesStorageKey,
      JSON.stringify(portfolioProfilesState)
    );
  }, [portfolioProfilesState]);

  useEffect(() => {
    window.localStorage.setItem(
      activePortfolioProfileStorageKey,
      activePortfolioProfileId
    );
  }, [activePortfolioProfileId]);

  useEffect(() => {
    let disposed = false;

    const loadAssets = async () => {
      try {
        const assets = await loadPersistedUploadAssets();
        if (!disposed) {
          setUploadAssets(assets);
        }
      } catch {
        if (!disposed) {
          setUploadAssets([]);
        }
      } finally {
        if (!disposed) {
          setUploadAssetsReady(true);
        }
      }
    };

    void loadAssets();

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!uploadAssetsReady) {
      return;
    }

    void persistUploadAssets(uploadAssets);
  }, [uploadAssets, uploadAssetsReady]);

  useEffect(() => {
    if (!isHoldingEditorOpen) {
      return;
    }

    const normalizedCode = holdingForm.code.trim();

    if (!/^\d{6}$/.test(normalizedCode)) {
      return;
    }

    let disposed = false;
    const timer = window.setTimeout(async () => {
      try {
        const [matchResult, quoteResult] = await Promise.allSettled([
          fetchStockSearchMatch(normalizedCode),
          fetchLiveStockQuoteSnapshot(normalizedCode)
        ]);

        if (disposed) {
          return;
        }

        const matchedCode =
          matchResult.status === "fulfilled" ? matchResult.value.code : normalizedCode;
        const matchedName =
          matchResult.status === "fulfilled"
            ? matchResult.value.name
            : quoteResult.status === "fulfilled" && quoteResult.value.name
              ? quoteResult.value.name
              : "";

        setHoldingForm((current) => {
          if (current.code.trim() !== normalizedCode) {
            return current;
          }

          if (current.code === matchedCode && current.name === matchedName) {
            return current;
          }

          return {
            ...current,
            code: matchedCode,
            name: matchedName
          };
        });

        if (quoteResult.status === "fulfilled") {
          setHoldingQuotePreview(quoteResult.value.price);
        } else if (matchResult.status === "rejected") {
          setHoldingQuotePreview(null);
        }
      } catch {
        if (!disposed) {
          setHoldingQuotePreview(null);
        }
      }
    }, 300);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [holdingForm.code, isHoldingEditorOpen]);

  useEffect(() => {
    if (!isHoldingEditorOpen) {
      return;
    }

    const normalizedName = holdingForm.name.trim();
    const normalizedCode = holdingForm.code.trim();

    if (normalizedName.length < 2 || /^\d{6}$/.test(normalizedCode)) {
      return;
    }

    let disposed = false;
    const timer = window.setTimeout(async () => {
      try {
        const match = await fetchStockSearchMatch(normalizedName);

        if (disposed) {
          return;
        }

        const detail = await fetchLiveStockQuoteSnapshot(match.code);

        if (disposed) {
          return;
        }

        setHoldingForm((current) => {
          if (current.name.trim() !== normalizedName) {
            return current;
          }

          if (current.code === detail.code && current.name === (detail.name ?? current.name)) {
            return current;
          }

          return {
            ...current,
            code: detail.code,
            name: detail.name ?? current.name
          };
        });
        setHoldingQuotePreview(detail.price);
      } catch {
        if (!disposed && normalizedCode === "") {
          setHoldingQuotePreview(null);
        }
      }
    }, 300);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [holdingForm.code, holdingForm.name, isHoldingEditorOpen]);

  useEffect(() => {
    if (!portfolioCodeSignature) {
      setPortfolioQuotesUpdatedAt("");
      return;
    }

    let disposed = false;
    let refreshTimer = 0;

    const refreshPortfolioQuotes = async () => {
      const results = await Promise.allSettled(
        portfolioCodes.map((code) => fetchLiveStockQuoteSnapshot(code))
      );

      if (disposed) {
        return;
      }

      const detailMap = new Map(
        results.flatMap((result) =>
          result.status === "fulfilled" ? [[result.value.code, result.value] as const] : []
        )
      );

      if (detailMap.size === 0) {
        return;
      }

      updateActivePortfolioHoldings((current) =>
        current.map((item) => {
          const detail = detailMap.get(item.code);

          if (!detail) {
            return item;
          }

          if (
            item.name === (detail.name ?? item.name) &&
            item.price === detail.price &&
            item.dailyChange === detail.changePercent
          ) {
            return item;
          }

          return {
            ...item,
            name: detail.name ?? item.name,
            price: detail.price,
            dailyChange: detail.changePercent
          };
        })
      );
      setPortfolioQuotesUpdatedAt(
        new Date().toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        })
      );
    };

    refreshPortfolioQuotes();
    refreshTimer = window.setInterval(refreshPortfolioQuotes, 30000);

    return () => {
      disposed = true;
      window.clearInterval(refreshTimer);
    };
  }, [activePortfolioProfileId, portfolioCodeSignature, portfolioCodes]);

  useEffect(() => {
    if (!selectedLimitUpBoard) {
      return;
    }

    const boardExists = limitUpBoards.some((board) => board.name === selectedLimitUpBoard);
    if (!boardExists) {
      setSelectedLimitUpBoard(null);
    }
  }, [limitUpBoards, selectedLimitUpBoard]);

  useEffect(() => {
    const syncFromHash = () => {
      const nextState = parseAppHash(window.location.hash);
      setActiveNav(nextState.nav);
      setActiveHomeSubpage(nextState.homeSubpage);
      setSelectedLimitUpBoard(nextState.boardName);
      setSelectedStockCode(nextState.stockCode);
      setSelectedStockBoardName(nextState.stockBoardName);
    };

    window.addEventListener("hashchange", syncFromHash);
    syncFromHash();

    return () => {
      window.removeEventListener("hashchange", syncFromHash);
    };
  }, []);

  useEffect(() => {
    if (activeHomeSubpage !== "stock" || !selectedStockCode) {
      return;
    }

    let disposed = false;

    const loadStockDetail = async () => {
      try {
        setStockDetailLoading(true);
        setStockDetailError("");
        const nextDetail = await fetchLiveStockDetail(selectedStockCode);

        if (disposed) {
          return;
        }

        setStockDetail(nextDetail);
        if (!selectedStockBoardName) {
          setSelectedStockBoardName(nextDetail.industry || null);
        }
        setStockDetailUpdatedAt(
          new Intl.DateTimeFormat("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
          }).format(new Date())
        );
      } catch (error) {
        if (disposed) {
          return;
        }

        setStockDetailError(error instanceof Error ? error.message : "个股详情获取失败。");
      } finally {
        if (!disposed) {
          setStockDetailLoading(false);
        }
      }
    };

    void loadStockDetail();

    return () => {
      disposed = true;
    };
  }, [activeHomeSubpage, selectedStockBoardName, selectedStockCode]);

  useEffect(() => {
    if (activeHomeSubpage !== "stock" || !selectedStockCode) {
      return;
    }

    let disposed = false;

    const loadStockTrend = async () => {
      try {
        setStockTrendLoading(true);
        setStockTrendError("");
        const nextTrend = await fetchLiveStockTrend(selectedStockCode, stockTrendRange);

        if (disposed) {
          return;
        }

        setStockTrendPoints(nextTrend);
      } catch (error) {
        if (disposed) {
          return;
        }

        setStockTrendError(error instanceof Error ? error.message : "个股走势获取失败。");
      } finally {
        if (!disposed) {
          setStockTrendLoading(false);
        }
      }
    };

    void loadStockTrend();

    return () => {
      disposed = true;
    };
  }, [activeHomeSubpage, selectedStockCode, stockTrendRange]);

  function updateHash(
    nextNav: NavKey,
    nextHomeSubpage: HomeSubpageKey,
    nextBoard: string | null,
    nextStockCode: string | null = null,
    nextStockBoardName: string | null = null
  ) {
    const nextHash =
      nextNav !== "home"
        ? `#${nextNav}`
        : nextHomeSubpage === "events"
          ? "#home/events"
          : nextHomeSubpage === "stock"
            ? nextStockCode
              ? nextStockBoardName
                ? `#home/stocks/${encodeURIComponent(nextStockCode)}/board/${encodeURIComponent(nextStockBoardName)}`
                : `#home/stocks/${encodeURIComponent(nextStockCode)}`
              : "#home/overview"
          : nextHomeSubpage === "boards"
            ? nextBoard
              ? `#home/boards/${encodeURIComponent(nextBoard)}`
              : "#home/boards"
            : "#home/overview";

    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }

  function navigateHomeSubpage(nextSubpage: HomeSubpageKey, nextBoard: string | null = null) {
    setActiveNav("home");
    setActiveHomeSubpage(nextSubpage);
    setSelectedLimitUpBoard(nextBoard);
    setSelectedStockCode(null);
    setStockDetail(null);
    setStockTrendPoints([]);
    updateHash("home", nextSubpage, nextBoard, null, null);
  }

  function navigateStockDetail(code: string, boardName: string | null = null) {
    setActiveNav("home");
    setActiveHomeSubpage("stock");
    setSelectedStockCode(code);
    setSelectedStockBoardName(boardName);
    updateHash("home", "stock", boardName, code, boardName);
  }

  function handleLimitUpSort(field: LimitUpSortField) {
    if (limitUpSortField === field) {
      setLimitUpSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setLimitUpSortField(field);
    setLimitUpSortDirection(field === "reason" || field === "name" ? "asc" : "desc");
  }

  function mergeAssets(nextAssets: UploadAsset[]) {
    setUploadAssets((current) => [...current, ...nextAssets]);
  }

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    mergeAssets(files.map((file) => buildUploadAssetFromFile(file)));
    event.target.value = "";
  }

  function handleUploadDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length === 0) {
      return;
    }

    mergeAssets(files.map((file) => buildUploadAssetFromFile(file)));
  }

  function handleUploadPaste(event: ClipboardEvent<HTMLDivElement>) {
    const clipboardFiles = Array.from(event.clipboardData.items ?? [])
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    if (clipboardFiles.length === 0) {
      return;
    }

    event.preventDefault();
    mergeAssets(clipboardFiles.map((file) => buildUploadAssetFromFile(file, "paste")));
  }

  function buildLinkAsset(link: string): UploadAsset {
    return {
      id: createUploadAssetId(),
      name: link,
      kind: link.includes("video") || link.includes("bilibili") ? "视频链接" : "文章链接",
      source: "link",
      linkUrl: link
    };
  }

  function handleRemoveAsset(assetId: string) {
    setUploadAssets((current) => {
      const target = current.find((asset) => asset.id === assetId);

      if (target?.objectUrl) {
        URL.revokeObjectURL(target.objectUrl);
      }

      return current.filter((asset) => asset.id !== assetId);
    });
  }

  async function handleAnalyze() {
    const trimmedLink = aiLinkInput.trim();
    let nextAssets = uploadAssets;

    if (trimmedLink) {
      const alreadyExists = uploadAssets.some(
        (asset) => asset.source === "link" && asset.linkUrl === trimmedLink
      );

      nextAssets = alreadyExists ? uploadAssets : [...uploadAssets, buildLinkAsset(trimmedLink)];

      if (!alreadyExists) {
        setUploadAssets(nextAssets);
      }
      setAiLinkInput("");
    }

    if (nextAssets.length === 0) {
      return;
    }

    const nextRun = analysisRuns + 1;
    const nextImageAsset = nextAssets.find((asset) => asset.kind === "图片" && asset.objectUrl);
    const shouldUseStockScreenshotAnalysis =
      Boolean(nextImageAsset) &&
      nextAssets.every((asset) => asset.kind !== "视频" && asset.kind !== "视频链接");

    setAnalysisLoading(true);
    setAnalysisError("");

    try {
      const nextOutput = shouldUseStockScreenshotAnalysis && nextImageAsset
        ? await analyzeStockScreenshotAsset(nextImageAsset, limitUpStocks, nextRun)
        : buildMultimodalOutput(nextAssets, nextRun);

      setMultimodalOutput(nextOutput);
      setAnalysisRuns(nextRun);
      setManualStockInput(nextOutput.identifiedStock?.code ?? nextOutput.identifiedStock?.name ?? "");
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "AI 分析生成失败，请稍后重试。");
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function handleManualStockAnalyze() {
    const trimmedInput = manualStockInput.trim();

    if (!trimmedInput) {
      setAnalysisError("请先输入股票代码或名称。");
      return;
    }

    setAnalysisLoading(true);
    setAnalysisError("");

    try {
      const nextRun = analysisRuns + 1;
      const nextOutput = await analyzeStockByManualInput(trimmedInput, limitUpStocks, nextRun);

      setMultimodalOutput(nextOutput);
      setAnalysisRuns(nextRun);
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "手动确认股票后分析失败，请稍后重试。");
    } finally {
      setAnalysisLoading(false);
    }
  }

  function handleNavChange(nextNav: NavKey) {
    setActiveNav(nextNav);
    if (nextNav !== "home") {
      setActiveHomeSubpage("overview");
      setSelectedLimitUpBoard(null);
      setSelectedStockCode(null);
      setSelectedStockBoardName(null);
      updateHash(nextNav, "overview", null);
      return;
    }

    navigateHomeSubpage("overview");
  }

  const topbarTitle =
    activeNav === "home" && activeHomeSubpage === "events"
      ? "事件与快讯"
      : activeNav === "home" && activeHomeSubpage === "stock"
        ? stockDetail?.name ?? selectedStockCode ?? "个股详情"
      : activeNav === "home" && activeHomeSubpage === "boards"
        ? selectedLimitUpBoardData?.name ?? "全部板块"
        : currentNav.label;
  const topbarDescription =
    activeNav === "home" && activeHomeSubpage === "events"
      ? "当天热点、快讯与情绪扰动列表"
      : activeNav === "home" && activeHomeSubpage === "stock"
        ? "实时行情、涨停原因与分时走势"
      : activeNav === "home" && activeHomeSubpage === "boards"
        ? selectedLimitUpBoardData
          ? "板块内涨停股票列表"
          : "按板块查看当日涨停方向"
      : currentNav.description;

  return (
    <main className="app-shell">
      <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">IP</span>
          <div>
            <strong>InvestPilot</strong>
            <p>Personal Market Terminal</p>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`nav-item ${item.key === activeNav ? "active" : ""}`}
              onClick={() => handleNavChange(item.key)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-copy">
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="content-area">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark">IP</span>
            <div>
              <strong>InvestPilot</strong>
              <p>Personal Market Terminal</p>
            </div>
          </div>
          <div>
            <p className="section-kicker">Workspace</p>
            <h2>{topbarTitle}</h2>
          </div>
          <div className="topbar-note">{topbarDescription}</div>
        </header>

        {activeNav === "home" && activeHomeSubpage === "overview" && (
          <>
            <section className="home-top-feed">
              <article className="card wide">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Feeds</p>
                    <h2>事件与快讯</h2>
                  </div>
                  <button
                    type="button"
                    className="secondary action-link"
                    onClick={() => navigateHomeSubpage("events")}
                  >
                    查看更多
                  </button>
                </div>
                <div className="headline-feed">
                  <div className={`impact-dot ${homeHeadline.impact}`} />
                  <div className="headline-feed-copy">
                    <strong>{homeHeadline.title}</strong>
                    <p>
                      {homeHeadline.time} · {homeHeadline.source}
                    </p>
                  </div>
                </div>
              </article>
            </section>

            <section className="market-strip card">
              <div className="market-strip-head">
                <div className="market-strip-title">
                  <p className="section-kicker">Market Pulse</p>
                  <h1>今日市场总览</h1>
                  <p className="market-strip-meta">
                    {marketIndicesError
                      ? `数据源异常：${marketIndicesError}`
                      : marketIndicesLoading
                        ? "正在获取真实指数行情..."
                        : `数据来源：东方财富实时行情 · ${marketIndicesUpdatedAt} 更新`}
                  </p>
                </div>
              </div>
              <div className="index-row">
                {marketIndices.map((index) => (
                  <div className="index-item" key={index.code ?? index.name}>
                    <span className="index-name">{index.name}</span>
                    <strong className={index.change >= 0 ? "up" : "down"}>
                      {index.value.toFixed(2)}
                    </strong>
                    <span className={`index-change ${index.change >= 0 ? "up" : "down"}`}>
                      {percent(index.change)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="overview-grid">
              <article className="card wide metric-card market-tabs-card">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Pulse Board</p>
                    <h2>市场热度与情绪指标</h2>
                  </div>
                </div>
                <div className="subnav-row market-subnav">
                  <button
                    type="button"
                    className={`subnav-btn ${activeMarketTab === "limitup" ? "active" : ""}`}
                    onClick={() => setActiveMarketTab("limitup")}
                  >
                    涨停板
                  </button>
                  <button
                    type="button"
                    className={`subnav-btn ${activeMarketTab === "heat" ? "active" : ""}`}
                    onClick={() => setActiveMarketTab("heat")}
                  >
                    市场热度
                  </button>
                  <button
                    type="button"
                    className={`subnav-btn ${activeMarketTab === "turnover" ? "active" : ""}`}
                    onClick={() => setActiveMarketTab("turnover")}
                  >
                    成交额
                  </button>
                </div>

                {activeMarketTab === "heat" && (
                  <>
                    <div className="gauge">
                      <div className="gauge-ring">
                        <div className="gauge-value">{marketBreadth.heat.toFixed(1)}°</div>
                      </div>
                    </div>
                    <div className="duel-line">
                      <strong className="up">涨停 {marketBreadth.limitUp}</strong>
                      <span>VS</span>
                      <strong className="down">开板 {marketBreadth.openBoard}</strong>
                    </div>
                  </>
                )}

                {activeMarketTab === "turnover" && (
                  <>
                    <div className="big-metric">{marketBreadth.turnover}</div>
                    <div className="dual-metrics">
                      <div>
                        <span>较上日</span>
                        <strong className="up">{marketBreadth.turnoverDelta}</strong>
                      </div>
                      <div>
                        <span>波动风险分</span>
                        <strong>{riskScore}/100</strong>
                      </div>
                    </div>
                  </>
                )}

                {activeMarketTab === "limitup" && (
                  <div className="limitup-table">
                    <p className="market-strip-meta">
                      {limitUpError
                        ? `数据源异常：${limitUpError}`
                        : limitUpLoading
                          ? "正在获取真实涨停池数据..."
                          : `数据来源：东方财富涨停池 · ${limitUpUpdatedAt} 更新`}
                    </p>
                    <div className="limitup-summary-grid">
                      <div className="limitup-summary-card">
                        <span>连板高度</span>
                        <strong>{maxLimitUpHeight} 板</strong>
                      </div>
                      <div className="limitup-summary-card">
                        <span>开板次数</span>
                        <strong>{totalOpenBoardCount} 次</strong>
                      </div>
                      <div className="limitup-summary-card">
                        <span>首板家数</span>
                        <strong>{firstBoardCount} 家</strong>
                      </div>
                      <div className="limitup-summary-card">
                        <span>连板家数</span>
                        <strong>{consecutiveBoardCount} 家</strong>
                      </div>
                    </div>
                    <div className="table-scroll">
                      <div className="limitup-head">
                        <span>股票</span>
                        <SortableLimitUpHeader
                          label="价格"
                          field="price"
                          activeField={limitUpSortField}
                          direction={limitUpSortDirection}
                          onToggle={handleLimitUpSort}
                        />
                        <SortableLimitUpHeader
                          label="涨停次数"
                          field="limitUpCount"
                          activeField={limitUpSortField}
                          direction={limitUpSortDirection}
                          onToggle={handleLimitUpSort}
                        />
                        <SortableLimitUpHeader
                          label="首次涨停"
                          field="firstLimitUpTime"
                          activeField={limitUpSortField}
                          direction={limitUpSortDirection}
                          onToggle={handleLimitUpSort}
                        />
                        <SortableLimitUpHeader
                          label="开板次数"
                          field="openBoardCount"
                          activeField={limitUpSortField}
                          direction={limitUpSortDirection}
                          onToggle={handleLimitUpSort}
                        />
                        <SortableLimitUpHeader
                          label="封单额"
                          field="sealAmount"
                          activeField={limitUpSortField}
                          direction={limitUpSortDirection}
                          onToggle={handleLimitUpSort}
                        />
                        <SortableLimitUpHeader
                          label="封单强度"
                          field="sealStrength"
                          activeField={limitUpSortField}
                          direction={limitUpSortDirection}
                          onToggle={handleLimitUpSort}
                        />
                        <SortableLimitUpHeader
                          label="涨停原因"
                          field="reason"
                          activeField={limitUpSortField}
                          direction={limitUpSortDirection}
                          onToggle={handleLimitUpSort}
                        />
                      </div>
                      {sortedLimitUpStocks.map((stock) => (
                        <div
                          className="limitup-row limitup-row-clickable"
                          key={stock.code}
                          onClick={() => navigateStockDetail(stock.code)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              navigateStockDetail(stock.code);
                            }
                          }}
                        >
                          <FieldValue
                            label="股票"
                            value={
                              <>
                                <strong>{stock.name}</strong>
                                <small>{stock.code}</small>
                              </>
                            }
                          />
                          <FieldValue label="价格" value={currency(stock.price)} />
                          <FieldValue label="涨停次数" value={`${stock.limitUpCount} 次`} />
                          <FieldValue label="首次涨停" value={stock.firstLimitUpTime} />
                          <FieldValue label="开板次数" value={`${stock.openBoardCount} 次`} />
                          <FieldValue label="封单额" value={stock.sealAmount} />
                          <FieldValue label="封单强度" value={stock.sealStrength} />
                          <FieldValue label="涨停原因" value={stock.reason} />
                        </div>
                      ))}
                      {!limitUpLoading && limitUpStocks.length === 0 && (
                        <div className="limitup-row">
                          <strong>暂无涨停池数据</strong>
                          <span className="topbar-note">
                            当前没有可展示的真实涨停池记录，可能是非交易时段或数据源暂时不可用。
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </article>

              <article className="card wide board-trend-card">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Board View</p>
                    <h2>当日板块</h2>
                  </div>
                  <button
                    type="button"
                    className="secondary action-link"
                    onClick={() => {
                      navigateHomeSubpage("boards");
                    }}
                  >
                    查看更多
                  </button>
                </div>

                <div className="limitup-board-panel">
                  <p className="market-strip-meta">
                    {limitUpError
                      ? `数据源异常：${limitUpError}`
                      : limitUpLoading
                        ? "正在获取真实板块数据..."
                        : `数据来源：东方财富涨停池 · ${limitUpUpdatedAt} 更新`}
                  </p>
                  <div className="limitup-board-grid">
                    {visibleLimitUpBoards.map((board) => (
                      <button
                        key={board.name}
                        type="button"
                        className="limitup-board-card"
                        onClick={() => {
                          navigateHomeSubpage("boards", board.name);
                        }}
                      >
                        <div className="limitup-board-card-head">
                          <strong>{board.name}</strong>
                          <span>{board.stocks.length} 家</span>
                        </div>
                        <div className="limitup-board-card-metrics">
                          <span>连板高度 {board.maxBoardHeight} 板</span>
                          <span>连板 {board.consecutiveBoardCount} 家</span>
                          <span>首板 {board.firstBoardCount} 家</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  {!limitUpLoading && limitUpBoards.length === 0 && (
                    <div className="limitup-empty-state">
                      <strong>暂无板块数据</strong>
                      <span className="topbar-note">当前没有可展示的真实板块记录。</span>
                    </div>
                  )}
                </div>
              </article>
            </section>

            <section className="dashboard-grid">
              <article className="card full-span">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Structure</p>
                    <h2>网站结构</h2>
                  </div>
                </div>
                <p className="placeholder-summary">
                  这一版先把产品骨架定清楚。首页负责看市场，我的持仓负责管账户，AI 分析负责解读材料，政策/基金/港股/美股负责补足不同维度的决策上下文。
                </p>
                <div className="placeholder-grid">
                  {siteStructure.map((item) => (
                    <div className="placeholder-card" key={item.title}>
                      <span className="structure-role">{item.role}</span>
                      <strong>{item.title}</strong>
                      <p>{item.summary}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="card source-card">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Connectors</p>
                    <h2>数据来源</h2>
                  </div>
                </div>
                <div className="source-list source-list-compact">
                  {dataSources.map((source) => (
                    <div className="source-item" key={source.id}>
                      <strong>{source.name}</strong>
                    </div>
                  ))}
                </div>
              </article>

            </section>
          </>
        )}

        {activeNav === "home" && activeHomeSubpage === "events" && (
          <section className="home-top-feed">
            <article className="card wide">
              <div className="card-head">
                <div>
                  <p className="section-kicker">Feeds</p>
                  <h2>当天热点</h2>
                </div>
                <button
                  type="button"
                  className="secondary action-link"
                  onClick={() => navigateHomeSubpage("overview")}
                >
                  返回首页
                </button>
              </div>
              <div className="event-list">
                {marketEvents.map((event) => (
                  <div className="event-item" key={`${event.time}-${event.title}`}>
                    <div className={`impact-dot ${event.impact}`} />
                    <div>
                      <strong>{event.title}</strong>
                      <p>
                        {event.time} · {event.source}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}

        {activeNav === "home" && activeHomeSubpage === "boards" && (
          <section className="home-top-feed">
            <article className="card wide">
              <div className="card-head">
                <div>
                  <p className="section-kicker">
                    {selectedLimitUpBoardData ? "Board Detail" : "All Boards"}
                  </p>
                  <h2>{selectedLimitUpBoardData ? selectedLimitUpBoardData.name : "全部板块"}</h2>
                </div>
                <button
                  type="button"
                  className="secondary action-link"
                  onClick={() => {
                    if (selectedLimitUpBoardData) {
                      navigateHomeSubpage("boards");
                      return;
                    }

                    navigateHomeSubpage("overview");
                  }}
                >
                  {selectedLimitUpBoardData ? "返回全部板块" : "返回首页"}
                </button>
              </div>

              {selectedLimitUpBoardData ? (
                <div className="limitup-table limitup-detail-page">
                  <p className="market-strip-meta">
                    数据来源：东方财富涨停池 · {limitUpUpdatedAt} 更新
                  </p>
                  <div className="limitup-board-focus">
                    <div className="limitup-board-focus-card">
                      <span>板块家数</span>
                      <strong>{selectedLimitUpBoardData.stocks.length} 家</strong>
                    </div>
                    <div className="limitup-board-focus-card">
                      <span>板块高度</span>
                      <strong>{selectedLimitUpBoardData.maxBoardHeight} 板</strong>
                    </div>
                    <div className="limitup-board-focus-card">
                      <span>连板家数</span>
                      <strong>{selectedLimitUpBoardData.consecutiveBoardCount} 家</strong>
                    </div>
                    <div className="limitup-board-focus-card">
                      <span>首板家数</span>
                      <strong>{selectedLimitUpBoardData.firstBoardCount} 家</strong>
                    </div>
                  </div>
                  <div className="table-scroll">
                    <div className="limitup-head">
                      <span>股票</span>
                      <SortableLimitUpHeader
                        label="价格"
                        field="price"
                        activeField={limitUpSortField}
                        direction={limitUpSortDirection}
                        onToggle={handleLimitUpSort}
                      />
                      <SortableLimitUpHeader
                        label="涨停次数"
                        field="limitUpCount"
                        activeField={limitUpSortField}
                        direction={limitUpSortDirection}
                        onToggle={handleLimitUpSort}
                      />
                      <SortableLimitUpHeader
                        label="首次涨停"
                        field="firstLimitUpTime"
                        activeField={limitUpSortField}
                        direction={limitUpSortDirection}
                        onToggle={handleLimitUpSort}
                      />
                      <SortableLimitUpHeader
                        label="开板次数"
                        field="openBoardCount"
                        activeField={limitUpSortField}
                        direction={limitUpSortDirection}
                        onToggle={handleLimitUpSort}
                      />
                      <SortableLimitUpHeader
                        label="封单额"
                        field="sealAmount"
                        activeField={limitUpSortField}
                        direction={limitUpSortDirection}
                        onToggle={handleLimitUpSort}
                      />
                      <SortableLimitUpHeader
                        label="封单强度"
                        field="sealStrength"
                        activeField={limitUpSortField}
                        direction={limitUpSortDirection}
                        onToggle={handleLimitUpSort}
                      />
                      <SortableLimitUpHeader
                        label="涨停原因"
                        field="reason"
                        activeField={limitUpSortField}
                        direction={limitUpSortDirection}
                        onToggle={handleLimitUpSort}
                      />
                    </div>
                    {sortedSelectedBoardStocks.map((stock) => (
                      <div
                        className="limitup-row limitup-row-clickable"
                        key={stock.code}
                        onClick={() =>
                          navigateStockDetail(stock.code, selectedLimitUpBoardData.name)
                        }
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            navigateStockDetail(stock.code, selectedLimitUpBoardData.name);
                          }
                        }}
                      >
                        <FieldValue
                          label="股票"
                          value={
                            <>
                              <strong>{stock.name}</strong>
                              <small>{stock.code}</small>
                            </>
                          }
                        />
                        <FieldValue label="价格" value={currency(stock.price)} />
                        <FieldValue label="涨停次数" value={`${stock.limitUpCount} 次`} />
                        <FieldValue label="首次涨停" value={stock.firstLimitUpTime} />
                        <FieldValue label="开板次数" value={`${stock.openBoardCount} 次`} />
                        <FieldValue label="封单额" value={stock.sealAmount} />
                        <FieldValue label="封单强度" value={stock.sealStrength} />
                        <FieldValue label="涨停原因" value={stock.reason} />
                      </div>
                    ))}
                    {!limitUpLoading && selectedLimitUpBoardData.stocks.length === 0 && (
                      <div className="limitup-row">
                        <strong>该板块暂无涨停股</strong>
                        <span className="topbar-note">当前板块筛选下没有可展示的记录。</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="limitup-board-panel">
                  <p className="market-strip-meta">
                    {limitUpError
                      ? `数据源异常：${limitUpError}`
                      : limitUpLoading
                        ? "正在获取真实板块数据..."
                        : `数据来源：东方财富涨停池 · ${limitUpUpdatedAt} 更新`}
                  </p>
                  <div className="limitup-board-grid">
                    {limitUpBoards.map((board) => (
                      <button
                        key={board.name}
                        type="button"
                        className="limitup-board-card"
                        onClick={() => {
                          navigateHomeSubpage("boards", board.name);
                        }}
                      >
                        <div className="limitup-board-card-head">
                          <strong>{board.name}</strong>
                          <span>{board.stocks.length} 家</span>
                        </div>
                        <div className="limitup-board-card-metrics">
                          <span>连板高度 {board.maxBoardHeight} 板</span>
                          <span>连板 {board.consecutiveBoardCount} 家</span>
                          <span>首板 {board.firstBoardCount} 家</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  {!limitUpLoading && limitUpBoards.length === 0 && (
                    <div className="limitup-empty-state">
                      <strong>暂无板块数据</strong>
                      <span className="topbar-note">当前没有可展示的真实板块记录。</span>
                    </div>
                  )}
                </div>
              )}
            </article>
          </section>
        )}

        {activeNav === "home" && activeHomeSubpage === "stock" && (
          <section className="home-top-feed">
            <article className="card wide stock-detail-card">
              <div className="card-head">
                <div>
                  <p className="section-kicker">Stock Detail</p>
                  <h2>{stockDetail?.name ?? selectedStockCode ?? "个股详情"}</h2>
                </div>
                <button
                  type="button"
                  className="secondary action-link"
                  onClick={() => {
                    if (selectedLimitUpBoard) {
                      navigateHomeSubpage("boards", selectedLimitUpBoard);
                      return;
                    }

                    navigateHomeSubpage("overview");
                  }}
                >
                  返回上一页
                </button>
              </div>

              <p className="market-strip-meta">
                {stockDetailError
                  ? `数据源异常：${stockDetailError}`
                  : stockDetailLoading
                    ? "正在获取个股实时详情..."
                    : `数据来源：东方财富实时个股行情 · ${stockDetailUpdatedAt} 更新`}
              </p>

              {stockDetail ? (
                <div className="stock-detail-layout">
                  <div className="stock-detail-main">
                    <div className="stock-hero">
                      <div className="stock-hero-title">
                        <div className="stock-name-row">
                          <strong>{stockDetail.name}</strong>
                          <span className="stock-market-tag">
                            {stockDetail.market}
                            {stockDetail.code}
                          </span>
                          <span className="stock-market-tag muted">{stockDetail.industry}</span>
                        </div>
                        <div className="stock-price-row">
                          <strong className={stockDetail.changePercent >= 0 ? "up" : "down"}>
                            {stockDetail.price.toFixed(2)}
                          </strong>
                          <span className={stockDetail.changePercent >= 0 ? "up" : "down"}>
                            {`${stockDetail.changeAmount >= 0 ? "+" : ""}${stockDetail.changeAmount.toFixed(2)} (${percent(stockDetail.changePercent)})`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="stock-quote-grid">
                      <div className="stock-quote-item">
                        <span>今开</span>
                        <strong>{stockDetail.open.toFixed(2)}</strong>
                      </div>
                      <div className="stock-quote-item">
                        <span>最高</span>
                        <strong>{stockDetail.high.toFixed(2)}</strong>
                      </div>
                      <div className="stock-quote-item">
                        <span>最低</span>
                        <strong>{stockDetail.low.toFixed(2)}</strong>
                      </div>
                      <div className="stock-quote-item">
                        <span>昨收</span>
                        <strong>{stockDetail.prevClose.toFixed(2)}</strong>
                      </div>
                      <div className="stock-quote-item">
                        <span>均价</span>
                        <strong>{stockDetail.averagePrice.toFixed(2)}</strong>
                      </div>
                      <div className="stock-quote-item">
                        <span>涨停价</span>
                        <strong className="up">{stockDetail.upLimit.toFixed(2)}</strong>
                      </div>
                      <div className="stock-quote-item">
                        <span>跌停价</span>
                        <strong className="down">{stockDetail.downLimit.toFixed(2)}</strong>
                      </div>
                      <div className="stock-quote-item">
                        <span>量比</span>
                        <strong>{formatPlainNumber(stockDetail.volumeRatio)}</strong>
                      </div>
                      <div className="stock-quote-item">
                        <span>换手率</span>
                        <strong>{formatPlainNumber(stockDetail.turnoverRate)}%</strong>
                      </div>
                      <div className="stock-quote-item">
                        <span>振幅</span>
                        <strong>{formatPlainNumber(stockDetail.amplitude)}%</strong>
                      </div>
                      <div className="stock-quote-item">
                        <span>成交量</span>
                        <strong>{formatVolumeInWanHands(stockDetail.volume)}</strong>
                      </div>
                      <div className="stock-quote-item">
                        <span>成交额</span>
                        <strong>{formatLargeYi(stockDetail.amount)}</strong>
                      </div>
                      <div className="stock-quote-item">
                        <span>总股本</span>
                        <strong>{formatShareCount(stockDetail.totalShares)}</strong>
                      </div>
                      <div className="stock-quote-item">
                        <span>流通股</span>
                        <strong>{formatShareCount(stockDetail.floatShares)}</strong>
                      </div>
                      <div className="stock-quote-item">
                        <span>总市值</span>
                        <strong>{formatLargeYi(stockDetail.totalMarketCap)}</strong>
                      </div>
                      <div className="stock-quote-item">
                        <span>流通市值</span>
                        <strong>{formatLargeYi(stockDetail.floatMarketCap)}</strong>
                      </div>
                      <div className="stock-quote-item">
                        <span>市盈率 TTM</span>
                        <strong>{formatPlainNumber(stockDetail.peTtm)}</strong>
                      </div>
                      <div className="stock-quote-item">
                        <span>市净率</span>
                        <strong>{formatPlainNumber(stockDetail.pb)}</strong>
                      </div>
                    </div>

                    <div className="stock-trend-card">
                      <div className="stock-trend-toolbar">
                        <div className="stock-trend-tabs">
                          {[1, 5].map((range) => (
                            <button
                              key={range}
                              type="button"
                              className={`stock-trend-tab ${stockTrendRange === range ? "active" : ""}`}
                              onClick={() => setStockTrendRange(range as StockTrendRange)}
                            >
                              {range === 1 ? "分时" : "五日"}
                            </button>
                          ))}
                        </div>
                        <span className="topbar-note">
                          {stockTrendError
                            ? `走势异常：${stockTrendError}`
                            : stockTrendLoading
                              ? "正在获取真实走势..."
                              : `${stockTrendRange === 1 ? "分时" : "五日"} 走势`}
                        </span>
                      </div>

                      {stockTrendStats ? (
                        <div className="stock-trend-visual">
                          <div className="stock-trend-scale">
                            <span>{stockTrendStats.top.toFixed(2)}</span>
                            <span>{stockTrendStats.basePrice.toFixed(2)}</span>
                            <span>{stockTrendStats.bottom.toFixed(2)}</span>
                          </div>
                          <div className="stock-trend-canvas">
                            <svg
                              viewBox={`0 0 ${stockTrendStats.width} ${stockTrendStats.height}`}
                              className="stock-trend-svg"
                              preserveAspectRatio="none"
                            >
                              <line
                                x1="0"
                                y1={stockTrendStats.height / 2}
                                x2={stockTrendStats.width}
                                y2={stockTrendStats.height / 2}
                                className="stock-trend-baseline"
                              />
                              <path d={stockTrendStats.avgPath} className="stock-trend-average" />
                              <path d={stockTrendStats.path} className="stock-trend-line" />
                            </svg>
                            <div className="stock-trend-axis">
                              {stockTrendStats.ticks.map((tick) => (
                                <span key={`${tick.index}-${tick.label}`}>{tick.label}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="limitup-empty-state">
                          <strong>暂无走势数据</strong>
                          <span className="topbar-note">当前没有可展示的实时走势图。</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <aside className="stock-detail-side">
                    <div className="stock-side-card">
                      <span className="section-kicker">Related Board</span>
                      <h3>{effectiveStockBoardName ?? "相关板块"}</h3>
                      {relatedBoardData ? (
                        <>
                          <div className="stock-side-board-metrics">
                            <span>{relatedBoardData.stocks.length} 家涨停</span>
                            <span>高度 {relatedBoardData.maxBoardHeight} 板</span>
                          </div>
                          <div className="stock-side-list">
                            {relatedBoardData.stocks
                              .filter((stock) => stock.code !== selectedStockCode)
                              .slice(0, 6)
                              .map((stock) => (
                                <button
                                  key={stock.code}
                                  type="button"
                                  className="stock-side-item"
                                  onClick={() => navigateStockDetail(stock.code, relatedBoardData.name)}
                                >
                                  <strong>{stock.name}</strong>
                                  <span>
                                    {stock.code} · {stock.price.toFixed(2)}
                                  </span>
                                </button>
                              ))}
                          </div>
                        </>
                      ) : (
                        <div className="limitup-empty-state">
                          <strong>暂无相关板块数据</strong>
                          <span className="topbar-note">当前板块联动数据暂不可用。</span>
                        </div>
                      )}
                    </div>

                    <div className="stock-side-card">
                      <span className="section-kicker">Limit Up Context</span>
                      <h3>涨停背景</h3>
                      <p className="stock-side-reason">
                        {limitUpStocks.find((stock) => stock.code === selectedStockCode)?.reason ??
                          "当前未命中涨停池原因描述。"}
                      </p>
                    </div>
                  </aside>
                </div>
              ) : (
                <div className="limitup-empty-state">
                  <strong>{stockDetailLoading ? "正在加载个股详情" : "暂无个股详情"}</strong>
                  <span className="topbar-note">
                    {stockDetailLoading ? "请稍候，正在获取真实行情与走势。" : "当前没有可展示的个股详情数据。"}
                  </span>
                </div>
              )}
            </article>
          </section>
        )}

        {activeNav === "portfolio" && (
          <section className="portfolio-view">
            <div className="portfolio-profile-tabs">
              {portfolioProfilesState.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  className={`portfolio-profile-tab ${activePortfolioProfileId === profile.id ? "active" : ""}`}
                  onClick={() => setActivePortfolioProfileId(profile.id)}
                >
                  <strong>{profile.label}</strong>
                  <span>{profile.description}</span>
                </button>
              ))}
            </div>

            <section className="overview-grid">
              <article className="card full-span portfolio-overview-card">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Portfolio Overview</p>
                    <h2>{activePortfolioProfile?.label ?? "持仓总览"}</h2>
                  </div>
                </div>
                <div className="portfolio-metric-grid">
                  <div className="portfolio-metric-tile">
                    <span>市值</span>
                    <strong>{currency(marketValue)}</strong>
                    <small>累计收益率 {percent(pnlPercent)}</small>
                  </div>
                  <div className="portfolio-metric-tile">
                    <span>盈亏</span>
                    <strong className={dailyPnl >= 0 ? "up" : "down"}>{currency(dailyPnl)}</strong>
                    <small>累计盈亏 {currency(pnl)}</small>
                  </div>
                  <div className="portfolio-metric-tile">
                    <span>仓位</span>
                    <strong>{formatPositionPercent(investedRatio)}</strong>
                    <small>现金估算 {currency(activePortfolioCashEstimate)}</small>
                  </div>
                  <div className="portfolio-metric-tile">
                    <span>纪律执行</span>
                    <strong className="up">
                      {disciplineCoverageCount} / {portfolio.length}
                    </strong>
                    <small>目标价与止损覆盖 {portfolio.length ? Math.round((disciplineCoverageCount / portfolio.length) * 100) : 0}%</small>
                  </div>
                </div>
              </article>
            </section>

            <section className="dashboard-grid">
              <article className="card full-span">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Portfolio Book</p>
                    <h2>{activePortfolioProfile?.label ?? "持仓与交易"}</h2>
                  </div>
                </div>
                <div className="subnav-row">
                  <button
                    type="button"
                    className={`subnav-btn ${activePortfolioTab === "holdings" ? "active" : ""}`}
                    onClick={() => setActivePortfolioTab("holdings")}
                  >
                    持仓列表
                  </button>
                  <button
                    type="button"
                    className={`subnav-btn ${activePortfolioTab === "trades" ? "active" : ""}`}
                    onClick={() => setActivePortfolioTab("trades")}
                  >
                    交易记录
                  </button>
                </div>

                {activePortfolioTab === "holdings" && (
                  <div className="portfolio-manager">
                    <div className="portfolio-toolbar">
                      <div className="portfolio-toolbar-copy">
                        <strong>{isEditablePortfolio ? "持仓管理" : "实盘持仓"}</strong>
                        <span>
                          {isEditablePortfolio ? "支持新增、编辑和删除当前持仓股票。" : "当前组合用于对比观察，支持整页切换查看。"} 现价按实时行情更新
                          {portfolioQuotesUpdatedAt ? ` · ${portfolioQuotesUpdatedAt}` : ""}。
                        </span>
                      </div>
                      {isEditablePortfolio && (
                        <button type="button" className="action-btn" onClick={openCreateHoldingEditor}>
                          新增股票
                        </button>
                      )}
                    </div>

                    {isEditablePortfolio && isHoldingEditorOpen && (
                      <form className="holding-editor" onSubmit={handleHoldingSubmit}>
                        <div className="holding-editor-head">
                          <div>
                            <strong>{holdingEditorMode === "create" ? "新增持仓" : "编辑持仓"}</strong>
                            <span>保存后会立即更新当前持仓列表。</span>
                          </div>
                          <button type="button" className="ghost-btn" onClick={closeHoldingEditor}>
                            取消
                          </button>
                        </div>

                        <div className="holding-form-grid">
                          <label className="holding-form-field">
                            <span>股票代码</span>
                            <input
                              className="real-input"
                              name="code"
                              value={holdingForm.code}
                              onChange={handleHoldingFormChange}
                              placeholder="如 600519"
                            />
                          </label>
                          <label className="holding-form-field">
                            <span>股票名称</span>
                            <input
                              className="real-input"
                              name="name"
                              value={holdingForm.name}
                              onChange={handleHoldingFormChange}
                              placeholder="如 贵州茅台"
                            />
                          </label>
                          <label className="holding-form-field">
                            <span>持仓股数</span>
                            <input
                              className="real-input"
                              name="shares"
                              type="number"
                              min="1"
                              step="1"
                              value={holdingForm.shares}
                              onChange={handleHoldingFormChange}
                              placeholder="如 100"
                            />
                          </label>
                          <label className="holding-form-field">
                            <span>成本价</span>
                            <input
                              className="real-input"
                              name="cost"
                              type="number"
                              min="0"
                              step="0.001"
                              value={holdingForm.cost}
                              onChange={handleHoldingFormChange}
                              placeholder="如 23.568"
                            />
                          </label>
                          <div className="holding-form-field">
                            <span>现价</span>
                            <div className="fake-input">
                              {holdingQuotePreview === null
                                ? "自动按股票代码或名称拉取实时行情"
                                : currency(holdingQuotePreview)}
                            </div>
                          </div>
                          <label className="holding-form-field">
                            <span>目标价</span>
                            <input
                              className="real-input"
                              name="targetPrice"
                              type="number"
                              min="0"
                              step="0.001"
                              value={holdingForm.targetPrice}
                              onChange={handleHoldingFormChange}
                              placeholder="如 28.123"
                            />
                          </label>
                          <label className="holding-form-field">
                            <span>止损价</span>
                            <input
                              className="real-input"
                              name="stopLoss"
                              type="number"
                              min="0"
                              step="0.001"
                              value={holdingForm.stopLoss}
                              onChange={handleHoldingFormChange}
                              placeholder="如 21.456"
                            />
                          </label>
                          <label className="holding-form-field holding-form-field-wide">
                            <span>买入逻辑</span>
                            <textarea
                              className="real-textarea compact-textarea"
                              name="thesis"
                              value={holdingForm.thesis}
                              onChange={handleHoldingFormChange}
                              placeholder="补充这只股票的买入逻辑、仓位用途和观察点。"
                            />
                          </label>
                        </div>

                        <div className="holding-editor-actions">
                          {holdingFormError && <p className="form-error">{holdingFormError}</p>}
                          <button type="submit" className="action-btn">
                            {holdingEditorMode === "create" ? "确认新增" : "保存修改"}
                          </button>
                        </div>
                      </form>
                    )}

                    <div className="table-scroll">
                      <div className="position-table position-table-managed">
                        <div className="table-head">
                          <span>股票</span>
                          <span>持仓股数</span>
                          <span>成本价</span>
                          <span>现价</span>
                          <span>总盈亏</span>
                          <span>收益率</span>
                          <span>纪律</span>
                          <span>买入逻辑</span>
                          <span>操作</span>
                        </div>
                        {portfolio.map((item) => {
                          const currentValue = item.shares * item.price;
                          const currentCost = item.shares * item.cost;
                          const totalPnl = currentValue - currentCost;
                          const returnRate = (totalPnl / currentCost) * 100;

                          return (
                            <div className="table-row wide-table-row holding-table-row" key={item.code}>
                              <FieldValue
                                label="股票"
                                hideLabel
                                value={
                                  <>
                                    <strong>{item.name}</strong>
                                    <small>{item.code}</small>
                                  </>
                                }
                              />
                              <FieldValue label="持仓股数" value={item.shares} />
                              <FieldValue label="成本价" value={currencyWithPrecision(item.cost, 3)} />
                              <FieldValue label="现价" value={currency(item.price)} />
                              <FieldValue
                                label="总盈亏"
                                value={<span className={totalPnl >= 0 ? "up" : "down"}>{currency(totalPnl)}</span>}
                              />
                              <FieldValue
                                label="收益率"
                                value={<span className={returnRate >= 0 ? "up" : "down"}>{percent(returnRate)}</span>}
                              />
                              <FieldValue
                                label="纪律"
                                value={`目标 ${formatPlainNumber(item.targetPrice ?? null, 3)} / 止损 ${formatPlainNumber(item.stopLoss ?? null, 3)}`}
                              />
                              <FieldValue
                                label="买入逻辑"
                                className="inline-thesis-cell"
                                value={item.thesis}
                              />
                              <FieldValue
                                label="操作"
                                className="row-action-cell"
                                value={
                                  isEditablePortfolio ? (
                                    <div className="row-actions">
                                      <button
                                        type="button"
                                        className="inline-action-btn"
                                        onClick={() => openEditHoldingEditor(item)}
                                      >
                                        编辑
                                      </button>
                                      <button
                                        type="button"
                                        className="inline-action-btn danger"
                                        onClick={() => handleDeleteHolding(item.code)}
                                      >
                                        删除
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="topbar-note">只读对比</span>
                                  )
                                }
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {activePortfolioTab === "trades" && (
                  <div className="trade-list">
                    {activeTradeRecords.map((trade) => (
                      <div className="trade-item" key={trade.id}>
                        <div>
                          <strong>
                            {trade.action === "buy" ? "买入" : "卖出"} {trade.name}
                          </strong>
                          <p>
                            {trade.date} · {trade.code}
                          </p>
                        </div>
                        <div className="trade-side">
                          <span className={trade.action === "buy" ? "up" : "down"}>
                            {trade.action === "buy" ? "+" : "-"}
                            {trade.shares} 股
                          </span>
                          <p>
                            成交价 {currency(trade.price)} · {trade.note}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>

              <article className="card full-span">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">AI Portfolio Coach</p>
                    <h2>AI持仓建议</h2>
                  </div>
                </div>
                <section className="portfolio-ai-roadmap">
                  <div className="portfolio-ai-roadmap-item">
                    <span>组合路线</span>
                    <strong>{portfolioAiRoadmap.summary}</strong>
                    <p>{portfolioAiRoadmap.rebalance}</p>
                  </div>
                  <div className="portfolio-ai-roadmap-item">
                    <span>资金安排</span>
                    <strong>{portfolioAiRoadmap.cashPlan}</strong>
                    <p>{portfolioAiRoadmap.focus}</p>
                  </div>
                </section>
                <div className="portfolio-ai-grid">
                  <section className="portfolio-ai-panel">
                    <div className="portfolio-ai-head">
                      <strong>逐股操作建议</strong>
                      <span>结合成本、浮盈亏、仓位暴露、止损距离和当日强弱给出下一步动作。</span>
                    </div>
                    <div className="portfolio-ai-list">
                      {holdingAiActions.map((item) => (
                        <article className="portfolio-ai-item" key={item.code}>
                          <div className="portfolio-ai-item-head">
                            <div>
                              <strong>
                                {item.name}
                                <span>{item.code}</span>
                              </strong>
                              <small>{item.action}</small>
                            </div>
                            <div className="portfolio-ai-sidebadges">
                              <span className="portfolio-ai-score">{item.score}分</span>
                              <span className="portfolio-ai-confidence">{item.confidence}置信度</span>
                            </div>
                          </div>
                          <div className="portfolio-ai-meta">
                            <span>{item.priority}</span>
                            <span>{item.positionAdvice}</span>
                            <span>建议动作比例 {item.executionRatio}</span>
                            <span>约 {item.executionShares}</span>
                          </div>
                          <p>{item.reason}</p>
                          <p>
                            <strong>下一步：</strong>
                            {item.nextStep}
                          </p>
                          <p>
                            <strong>预期：</strong>
                            {item.expectation}
                          </p>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="portfolio-ai-panel">
                    <div className="portfolio-ai-head">
                      <strong>可新入方向</strong>
                      <span>基于当前组合缺口、板块强度和资金趋势，给出更值得新开仓的行业与个股。</span>
                    </div>
                    {fundingPlans.length > 0 && (
                      <div className="portfolio-ai-funding">
                        <strong>建议从以下持仓腾挪新仓资金</strong>
                        <div className="portfolio-ai-funding-list">
                          {fundingPlans.map((plan) => (
                            <article className="portfolio-ai-funding-item" key={`${plan.code}-${plan.ratio}`}>
                              <strong>
                                {plan.source}
                                <span>{plan.code}</span>
                              </strong>
                              <small>
                                {plan.action} · {plan.ratio} · 约 {plan.shares}
                              </small>
                              <p>{plan.reason}</p>
                            </article>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="portfolio-ai-list">
                      {aiIdeas.map((idea) => (
                        <article className="portfolio-ai-item" key={`${idea.code}-${idea.sector}`}>
                          <div className="portfolio-ai-item-head">
                            <div>
                              <strong>
                                {idea.stock}
                                <span>{idea.code}</span>
                              </strong>
                              <small>{idea.sector}</small>
                            </div>
                          </div>
                          <p>{idea.reason}</p>
                          <p>
                            <strong>预期：</strong>
                            {idea.expectation}
                          </p>
                        </article>
                      ))}
                    </div>
                  </section>
                </div>
              </article>

              <article className="card full-span">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Risk</p>
                    <h2>风险提示</h2>
                  </div>
                </div>
                <div className="signal-list">
                  {riskSignals.map((signal) => (
                    <div className="signal-item" key={signal.title}>
                      <span className={`signal-level ${signal.level}`}>{signal.level}</span>
                      <div>
                        <strong>{signal.title}</strong>
                        <p>{signal.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

            </section>
          </section>
        )}

        {activeNav === "ai" && (
          <section className="placeholder-view">
            <article className="card wide">
              <div className="card-head">
                <div>
                  <p className="section-kicker">Workspace</p>
                  <h1>AI分析工作台</h1>
                </div>
              </div>
              <section className="multimodal-layout">
                <div className="upload-panel">
                  <div
                    className="upload-composer-card"
                    onPaste={handleUploadPaste}
                    tabIndex={0}
                  >
                    <div
                      className="upload-dropzone"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={handleUploadDrop}
                    >
                      <strong>上传视频 / 图片 / 文件</strong>
                      <p>支持视频、截图、研报 PDF、会议纪要、政策文件、财报和各类文档。视频时长不做限制，AI 会按内容自动分段总结。</p>
                      <div className="upload-actions">
                        <label className="upload-trigger">
                          选择本地文件
                          <input
                            className="hidden-file-input"
                            type="file"
                            multiple
                            onChange={handleFileSelection}
                          />
                        </label>
                        <span className="upload-hint">也可以直接拖拽文件到这里，或在这个模块里粘贴截图</span>
                      </div>
                    </div>

                    <div className="upload-inline-grid">
                      <div className="upload-input-card upload-input-card-wide">
                        <strong>补充视频地址 / 文章地址</strong>
                        <input
                          className="real-input"
                          value={aiLinkInput}
                          onChange={(event) => setAiLinkInput(event.target.value)}
                          placeholder="可选：粘贴视频链接、文章链接、网页地址"
                        />
                        <p>如果有外部链接，点击 AI分析 时会自动并入当前材料队列一起解析。</p>
                      </div>
                    </div>

                    <div className="upload-toolbar">
                      <button
                        type="button"
                        className="action-btn"
                        onClick={() => {
                          void handleAnalyze();
                        }}
                        disabled={analysisLoading}
                      >
                        {analysisLoading ? "分析中..." : "AI分析"}
                      </button>
                    </div>

                    <div className="material-list-card">
                      <div className="card-head compact-head">
                        <div>
                          <p className="section-kicker">Assets</p>
                          <h2>已导入文件列表</h2>
                        </div>
                      </div>
                      {uploadAssets.length > 0 ? (
                        <div className="material-list">
                          {uploadAssets.map((asset) => (
                            <div className="material-item" key={asset.id}>
                              <div className="material-item-main">
                                <span className="material-kind-badge">{asset.kind}</span>
                                <div>
                                  <strong>{asset.name}</strong>
                                  <span>{getAssetSourceLabel(asset.source)}</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                className="material-remove-btn"
                                onClick={() => handleRemoveAsset(asset.id)}
                              >
                                移除
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="ai-empty-state">
                          <strong>材料队列还是空的</strong>
                          <p>先拖入视频、文档或截图，再让 AI 基于同一批材料做首轮拆解。</p>
                        </div>
                      )}
                    </div>

                    {uploadedVideos.length > 0 && (
                      <div className="saved-video-card">
                        <div className="card-head compact-head">
                          <div>
                            <p className="section-kicker">Saved Videos</p>
                            <h2>已保存视频</h2>
                          </div>
                        </div>
                        <div className="saved-video-list">
                          {uploadedVideos.map((asset) => (
                            <article className="saved-video-item" key={asset.id}>
                              <strong>{asset.name}</strong>
                              <video className="saved-video-player" controls preload="metadata" src={asset.objectUrl} />
                            </article>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {analysisError && (
                  <div className="placeholder-card analysis-summary-card">
                    <strong>AI 分析失败</strong>
                    <p>{analysisError}</p>
                  </div>
                )}

                {analysisLoading && (
                  <div className="placeholder-card analysis-summary-card">
                    <strong>AI 正在分析当前材料</strong>
                    <p>如果是股票截图，当前会先识别图片文字，再提取股票名称/代码，并结合个股详情与涨停池生成分析。</p>
                  </div>
                )}

                {!analysisLoading && multimodalOutput && (
                  <div className="analysis-flow">
                    {multimodalOutput.entryVerdict && (
                      <div className="placeholder-card analysis-summary-card">
                        <span className={`analysis-verdict-chip ${multimodalOutput.entryVerdict.tone}`}>
                          {multimodalOutput.entryVerdict.label}
                        </span>
                      </div>
                    )}

                    {multimodalOutput.identifiedStock && (
                      <div className="placeholder-card analysis-summary-card">
                        <strong>
                          已识别股票：{multimodalOutput.identifiedStock.name}（{multimodalOutput.identifiedStock.code}）
                        </strong>
                        <div className="analysis-detected-grid">
                          <div className="analysis-detected-item">
                            <span>股票名称</span>
                            <strong>{multimodalOutput.identifiedStock.name}</strong>
                          </div>
                          <div className="analysis-detected-item">
                            <span>股票代码</span>
                            <strong>{multimodalOutput.identifiedStock.code}</strong>
                          </div>
                          <div className="analysis-detected-item">
                            <span>所属行业</span>
                            <strong>{multimodalOutput.identifiedStock.industry ?? "待补充"}</strong>
                          </div>
                          <div className="analysis-detected-item">
                            <span>今日涨停原因</span>
                            <strong>{multimodalOutput.identifiedStock.limitUpReason ?? "待确认"}</strong>
                          </div>
                          <div className="analysis-detected-item analysis-detected-wide">
                            <span>题材判断</span>
                            <strong>{multimodalOutput.identifiedStock.themeJudgement ?? "待确认"}</strong>
                          </div>
                          <div className="analysis-detected-item analysis-detected-wide">
                            <span>OCR 原始识别摘要</span>
                            <strong>{multimodalOutput.identifiedStock.ocrPreview ?? "暂无识别摘要"}</strong>
                          </div>
                        </div>
                        {multimodalOutput.identifiedStock.keyStats && (
                          <div className="analysis-stock-stats-grid">
                            {multimodalOutput.identifiedStock.keyStats.map((item) => (
                              <div className="analysis-stock-stat-card" key={item.label}>
                                <span>{item.label}</span>
                                <strong>{item.value}</strong>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {shouldShowManualStockConfirm && (
                      <div className="placeholder-card analysis-summary-card">
                        <span className="structure-role">Manual Confirm</span>
                        <strong>如果识别不准，可手动确认股票</strong>
                        <div className="analysis-manual-row">
                          <input
                            className="real-input"
                            value={manualStockInput}
                            onChange={(event) => setManualStockInput(event.target.value)}
                            placeholder="输入股票代码或名称，例如 600519 或 贵州茅台"
                          />
                          <button
                            type="button"
                            className="action-btn"
                            onClick={() => {
                              void handleManualStockAnalyze();
                            }}
                            disabled={analysisLoading}
                          >
                            按这只股票重跑分析
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="placeholder-card analysis-summary-card">
                      <strong>文字总结</strong>
                      <p>{multimodalOutput.summary}</p>
                    </div>

                    <div className="generated-grid">
                      {multimodalOutput.segmentSummaries.map((segment, index) => (
                        <div className="placeholder-card analysis-segment-card" key={`segment-${index}`}>
                          <span className="structure-role">{segment.label}</span>
                          <strong>{segment.title}</strong>
                          <p>{segment.body}</p>
                        </div>
                      ))}
                    </div>

                    <div className="analysis-final-grid">
                      <div className="placeholder-card analysis-final-card">
                        <strong>{multimodalOutput.finalAnalysisTitle ?? "核心判断"}</strong>
                        <p>{multimodalOutput.finalAnalysis}</p>
                      </div>
                      <div className="placeholder-card">
                        <strong>{multimodalOutput.entryDecisionTitle ?? "现在是否值得进入"}</strong>
                        <p>{multimodalOutput.entryDecision}</p>
                      </div>
                      <div className="placeholder-card">
                        <strong>{multimodalOutput.peersTitle ?? "同题材可选标的"}</strong>
                        <p>{multimodalOutput.peers}</p>
                      </div>
                      <div className="placeholder-card">
                        <strong>风险提醒</strong>
                        <p>{multimodalOutput.risk}</p>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </article>
          </section>
        )}

        {activeNav === "policy" && (
          <section className="placeholder-view">
            <article className="card wide">
              <p className="placeholder-summary">
                这里直接汇总政策分析常用的官方来源，优先用于跟踪“十五五”规划、国际形势，以及每日《新闻联播》后的热点延伸分析。
              </p>
              <div className="policy-link-grid">
                {policyLinks.map((link) => (
                  <a
                    className="policy-link-card"
                    href={link.href}
                    key={link.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="policy-link-tag">{link.tag}</span>
                    <strong>{link.title}</strong>
                    <p>{link.description}</p>
                    <span className="policy-link-action">打开官方页面</span>
                  </a>
                ))}
              </div>
            </article>

            <article className="card wide">
              <div className="card-head">
                <div>
                  <p className="section-kicker">AI Interpretation</p>
                  <h2>AI 热点解读区</h2>
                </div>
              </div>

              <div className="policy-ai-panel">
                <div className="upload-panel">
                  <div className="upload-dropzone">
                    <strong>粘贴官方链接 / 上传政策材料</strong>
                    <p>支持政府官网链接、外交部页面、新闻联播回放链接、PDF、截图和纪要材料。</p>
                    <button type="button">导入政策材料</button>
                  </div>

                  <div className="upload-inline-grid">
                    <div className="upload-input-card">
                      <strong>政策链接或文章地址</strong>
                      <input
                        className="real-input"
                        value={policyUrl}
                        onChange={(event) => setPolicyUrl(event.target.value)}
                        placeholder="粘贴中国政府网、外交部、央视网等官方页面地址"
                      />
                    </div>
                    <div className="upload-input-card">
                      <strong>你的关注主题</strong>
                      <input
                        className="real-input"
                        value={policyTheme}
                        onChange={(event) => setPolicyTheme(event.target.value)}
                        placeholder="例如：低空经济、算力、自主可控、外贸、国企改革"
                      />
                    </div>
                  </div>

                  <div className="upload-input-card">
                    <strong>补充说明 / 你的判断</strong>
                    <textarea
                      className="real-textarea"
                      value={policyNote}
                      onChange={(event) => setPolicyNote(event.target.value)}
                      placeholder="写下你最关心的政策传导方向、怀疑点或想让 AI 重点判断的内容"
                    />
                  </div>

                  <div className="material-list-card">
                    <div className="card-head compact-head">
                      <div>
                        <p className="section-kicker">Imported</p>
                        <h2>已导入材料</h2>
                      </div>
                    </div>
                    <div className="material-list">
                      {policyMaterials.map((material) => (
                        <div className="material-item" key={`${material.kind}-${material.name}`}>
                          <strong>{material.name}</strong>
                          <span>{material.kind}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="generated-grid">
                  <div className="placeholder-card">
                    <strong>政策要点摘要</strong>
                    <p>{policyOutput.summary}</p>
                  </div>
                  <div className="placeholder-card">
                    <strong>热点影响分析</strong>
                    <p>{policyOutput.analysis}</p>
                  </div>
                  <div className="placeholder-card">
                    <strong>投资策略建议</strong>
                    <p>{policyOutput.strategy}</p>
                  </div>
                  <div className="placeholder-card">
                    <strong>风险与偏差提醒</strong>
                    <p>{policyOutput.risk}</p>
                  </div>
                </div>
              </div>
            </article>
          </section>
        )}

        {activeNav === "funds" && (
          <PlaceholderSection
            title="基金"
            summary="这里会放基金池、ETF 看板、风格轮动、回撤分析和申赎跟踪。"
            bullets={["基金池", "ETF 看板", "风格轮动", "回撤统计"]}
          />
        )}

        {activeNav === "hk" && (
          <PlaceholderSection
            title="港股"
            summary="这里会放恒指、科技指数、港股通资金流、互联网和高股息板块跟踪。"
            bullets={["恒指概览", "港股通", "科技龙头", "高股息观察"]}
          />
        )}

        {activeNav === "us" && (
          <PlaceholderSection
            title="美股"
            summary="这里会放标普、纳指、AI 算力链、中概股和美元流动性观察。"
            bullets={["三大指数", "AI 主线", "中概股", "流动性"]}
          />
        )}
      </div>
      </div>

      <nav className="mobile-tabbar" aria-label="移动导航">
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`mobile-tab-item ${item.key === activeNav ? "active" : ""}`}
            onClick={() => handleNavChange(item.key)}
          >
            <span className="mobile-tab-icon">{item.icon}</span>
            <span className="mobile-tab-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}
