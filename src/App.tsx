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
  StockTrendPoint,
  TradeRecord
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
type PortfolioTabKey = "holdings" | "trades" | "review";
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

type HoldingFormState = {
  code: string;
  name: string;
  shares: string;
  cost: string;
  targetPrice: string;
  stopLoss: string;
  thesis: string;
};

type TradeFormState = {
  date: string;
  action: "buy" | "sell";
  code: string;
  name: string;
  price: string;
  shares: string;
  setup: string;
  note: string;
};

type ReviewEmotion = "冷静" | "犹豫" | "冲动" | "恐惧" | "贪婪";

type ReviewFormState = {
  marketContext: string;
  plan: string;
  execution: string;
  followedPlan: boolean;
  emotion: ReviewEmotion;
  mistake: string;
  lesson: string;
  outcomePercent: string;
  rating: string;
};

type LimitUpBoardSummary = {
  name: string;
  stocks: LimitUpStock[];
  firstBoardCount: number;
  consecutiveBoardCount: number;
  maxBoardHeight: number;
  totalSealAmount: number;
  openBoardCount: number;
};

type InvestableBoardInsight = {
  name: string;
  score: number;
  stance: string;
  reason: string;
  risk: string;
  board: LimitUpBoardSummary;
};

type HoldingThemeMatch = {
  holding: Holding;
  relation: "主线相关" | "部分相关" | "暂无关联";
  matchedBoard: string;
  action: string;
  reason: string;
};

type StockDecisionInsight = {
  verdict: string;
  action: string;
  position: string;
  reason: string;
  risk: string;
  nextStep: string;
};

type StockBackgroundInsight = {
  title: string;
  subtitle: string;
  themeTags: string[];
  companyContext: string;
  themeContext: string;
  boardPosition: string;
  catalyst: string;
  compare: string;
  dataGap: string;
};

type SimpleQuestionSignal = {
  name: string;
  status: "passed" | "pending" | "failed";
  text: string;
};

type SimpleQuestionInsight = {
  verdict: string;
  summary: string;
  action: string;
  signals: SimpleQuestionSignal[];
};

type DecisionQueueStock = {
  code: string;
  name: string;
  boardName: string | null;
};

type DisciplineRule = {
  id: string;
  name: string;
  entryRule: string;
  exitRule: string;
  positionRule: string;
  forbiddenRule: string;
  createdAt: string;
};

type DisciplineFormState = Omit<DisciplineRule, "id" | "createdAt">;

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
  holdingState: string;
  themeRelation: string;
  disciplineAction: string;
  riskPosition: string;
  reviewCheck: string;
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
    if (nav === "policy" && subpageSegment === "stocks") {
      const [stockCodeSegment, boardToken, ...boardSegments] = restSegments;
      const stockCode = stockCodeSegment ? decodeURIComponent(stockCodeSegment) : null;
      const stockBoardName =
        boardToken === "board" && boardSegments.length > 0
          ? decodeURIComponent(boardSegments.join("/"))
          : null;

      return {
        nav: "policy",
        homeSubpage: "overview",
        boardName: stockBoardName,
        stockCode,
        stockBoardName
      };
    }

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
  { key: "home", label: "主线看板", icon: "◎", description: "先看今天市场在交易什么" },
  { key: "policy", label: "个股决策", icon: "◫", description: "围绕单只股票做判断、比较和跟踪" },
  { key: "ai", label: "材料解读", icon: "✦", description: "上传材料，直接输出个股或题材结论" },
  { key: "portfolio", label: "我的交易台", icon: "▣", description: "持仓、交易、纪律与复盘执行" }
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

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createEmptyTradeForm(): TradeFormState {
  return {
    date: formatDateInput(new Date()),
    action: "buy",
    code: "",
    name: "",
    price: "",
    shares: "",
    setup: "",
    note: ""
  };
}

const emptyReviewForm: ReviewFormState = {
  marketContext: "",
  plan: "",
  execution: "",
  followedPlan: true,
  emotion: "冷静",
  mistake: "",
  lesson: "",
  outcomePercent: "",
  rating: "3"
};

const emptyDisciplineForm: DisciplineFormState = {
  name: "",
  entryRule: "",
  exitRule: "",
  positionRule: "",
  forbiddenRule: ""
};

const portfolioProfilesStorageKey = "investpilot-portfolio-profiles";
const activePortfolioProfileStorageKey = "investpilot-active-portfolio-profile";
const disciplineRulesStorageKey = "investpilot-discipline-rules";
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

function loadDisciplineRulesFromStorage(): DisciplineRule[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(disciplineRulesStorageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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

function buildFallbackStockDetail(
  code: string,
  name: string,
  industry: string | null
): StockDetail {
  return {
    code,
    name,
    market: code.startsWith("6") ? "SH" : "SZ",
    industry: industry || "未知行业",
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
    pb: null
  };
}

function totalMarketValue(items: Holding[]) {
  return items.reduce((sum, item) => sum + holdingMarketValue(item), 0);
}

function buildIntradayDecision({
  indices,
  limitUpStocks,
  strongestTheme,
  leadStock,
  backupStock,
  totalOpenBoardCount,
  maxLimitUpHeight,
  firstBoardCount,
  consecutiveBoardCount
}: {
  indices: MarketIndex[];
  limitUpStocks: LimitUpStock[];
  strongestTheme: string | null;
  leadStock: LimitUpStock | null;
  backupStock: LimitUpStock | null;
  totalOpenBoardCount: number;
  maxLimitUpHeight: number;
  firstBoardCount: number;
  consecutiveBoardCount: number;
}) {
  const indexByName = new Map(indices.map((index) => [index.name, index.change]));
  const indexChange = (name: string) => indexByName.get(name) ?? 0;
  const upIndexCount = indices.filter((index) => index.change > 0).length;
  const downIndexCount = indices.filter((index) => index.change < 0).length;
  const growthChange = (indexChange("创业板指") + indexChange("科创50")) / 2;
  const coreChange = (indexChange("上证指数") + indexChange("沪深300")) / 2;
  const openBoardPressure = limitUpStocks.length ? totalOpenBoardCount / limitUpStocks.length : 0;
  const hasStrongTheme = Boolean(strongestTheme && limitUpStocks.length >= 20);
  const hasHighBoard = maxLimitUpHeight >= 3;

  let tradeStatus = "观望";
  let positionAdvice = "0-2成";

  if (indices.length === 0 || limitUpStocks.length === 0) {
    tradeStatus = "等待数据";
    positionAdvice = "不主动开新仓";
  } else if (upIndexCount >= 4 && hasStrongTheme && openBoardPressure <= 1.2) {
    tradeStatus = "可交易";
    positionAdvice = hasHighBoard ? "3-5成" : "2-3成";
  } else if (downIndexCount >= 4 || openBoardPressure >= 2.2 || !hasStrongTheme) {
    tradeStatus = "谨慎";
    positionAdvice = "0-2成";
  } else {
    tradeStatus = "谨慎";
    positionAdvice = "2-3成";
  }

  const styleBias =
    growthChange > coreChange + 0.4
      ? "成长/硬科技强于权重"
      : coreChange > growthChange + 0.4
        ? "权重强于成长"
        : "指数风格相对均衡";

  const leaderStatus =
    !leadStock
      ? "暂无可跟踪龙头"
      : leadStock.openBoardCount >= 2 || leadStock.consecutiveBoardCount >= 4
        ? "不适合追高"
        : leadStock.sealStrength === "强" || leadStock.sealStrength === "极强"
          ? "可观察"
          : "只适合低吸确认";

  const backupStrategy =
    tradeStatus === "可交易"
      ? backupStock
        ? `优先看 ${backupStock.name} 这类同题材前排确认，不做后排随手买。`
        : "优先做前排确认，不做后排随手买。"
      : tradeStatus === "谨慎"
        ? "备选只做低吸确认，放弃临盘追高。"
        : "先看不买，等主线和指数方向同步。";

  const risks = [
    openBoardPressure >= 1.5 ? "开板压力偏高" : "",
    downIndexCount >= 3 ? "指数分化或拖累" : "",
    firstBoardCount > consecutiveBoardCount * 4 && consecutiveBoardCount < 5 ? "首板多但连板不足" : "",
    !hasStrongTheme ? "主线集中度不足" : ""
  ].filter(Boolean);

  const summary =
    tradeStatus === "等待数据"
      ? "正在等待指数和涨停池数据，先不生成交易判断。"
      : `今日${tradeStatus}。${styleBias}，${strongestTheme ? `最强主线偏向${strongestTheme}` : "主线尚不集中"}，涨停 ${limitUpStocks.length} 家、连板高度 ${maxLimitUpHeight} 板。龙头${leaderStatus}，${backupStrategy}`;

  return {
    tradeStatus,
    positionAdvice,
    strongestTheme: strongestTheme ?? "待识别",
    leaderStatus,
    backupStrategy,
    riskText: risks.length ? risks.join("、") : "暂无明显风险",
    summary
  };
}

function buildInvestableBoardInsights(boards: LimitUpBoardSummary[]): InvestableBoardInsight[] {
  return boards
    .map((board) => {
      const openPressure = board.stocks.length ? board.openBoardCount / board.stocks.length : 0;
      const sealScore = Math.min(board.totalSealAmount, 20) * 2;
      const breadthScore = Math.min(board.stocks.length, 12) * 5;
      const ladderScore = board.consecutiveBoardCount * 8 + board.maxBoardHeight * 7;
      const pressurePenalty = Math.min(openPressure * 12, 28);
      const score = Math.max(0, Math.round(breadthScore + ladderScore + sealScore - pressurePenalty));
      const hasLeader = board.maxBoardHeight >= 3 || board.consecutiveBoardCount >= 2;
      const stance =
        score >= 85 && openPressure <= 1.2 && hasLeader
          ? "重点跟踪"
          : score >= 62 && openPressure <= 1.8
            ? "观察前排"
            : "谨慎观察";
      const reason = `涨停 ${board.stocks.length} 家，连板 ${board.consecutiveBoardCount} 家，高度 ${board.maxBoardHeight} 板，封单合计约 ${board.totalSealAmount.toFixed(2)} 亿。`;
      const risk =
        openPressure >= 1.8
          ? `开板压力偏高，平均每只约 ${openPressure.toFixed(1)} 次。`
          : board.consecutiveBoardCount === 0
            ? "首板为主，持续性还需要次日确认。"
            : "分歧压力可控，重点看前排能否继续封住。";

      return {
        name: board.name,
        score,
        stance,
        reason,
        risk,
        board
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return right.board.totalSealAmount - left.board.totalSealAmount;
    })
    .slice(0, 3);
}

function buildMarketSimpleQuestionInsight({
  strongestBoard,
  limitUpStocks,
  totalOpenBoardCount,
  consecutiveBoardCount
}: {
  strongestBoard: LimitUpBoardSummary | null;
  limitUpStocks: LimitUpStock[];
  totalOpenBoardCount: number;
  consecutiveBoardCount: number;
}): SimpleQuestionInsight {
  const boardStockCount = strongestBoard?.stocks.length ?? 0;
  const openPressure = limitUpStocks.length ? totalOpenBoardCount / limitUpStocks.length : 0;
  const hasBreadth = boardStockCount >= 5;
  const hasTrend = Boolean(strongestBoard && strongestBoard.maxBoardHeight >= 2 && consecutiveBoardCount >= 2);
  const hasChainSpread = Boolean(
    strongestBoard &&
      strongestBoard.stocks.filter((stock) => stock.consecutiveBoardCount >= 1).length >= 3
  );
  const hasAcceptance = Boolean(strongestBoard && openPressure <= 1.6);
  const passedCount = [hasBreadth, hasTrend, hasChainSpread, hasAcceptance].filter(Boolean).length;

  return {
    verdict:
      passedCount >= 3
        ? "有简单题"
        : passedCount === 2
          ? "半简单题"
          : "暂无简单题",
    summary: strongestBoard
      ? `${strongestBoard.name} 当前是最强主线候选。简单题不是猜涨停，而是看成交、趋势、产业链扩散和回踩承接是否站到同一边。`
      : "当前还没有明确主线，先不急着给自己出难题。",
    action:
      passedCount >= 3
        ? "只在主线前排里做选择，不去轮动题材里反复横跳。"
        : passedCount === 2
          ? "可以观察，但必须等更多信号确认，不追单日涨幅。"
          : "先看不买，等市场把答案写清楚。",
    signals: [
      {
        name: "产业链扩散",
        status: hasBreadth ? "passed" : "pending",
        text: strongestBoard
          ? `${strongestBoard.name} 涨停 ${boardStockCount} 家，${hasBreadth ? "已经不是单点上涨" : "扩散还不够"}。`
          : "等待板块涨停家数。"
      },
      {
        name: "趋势确认",
        status: hasTrend ? "passed" : "pending",
        text: strongestBoard
          ? `连板 ${consecutiveBoardCount} 家，高度 ${strongestBoard.maxBoardHeight} 板，${hasTrend ? "趋势有延续" : "持续性还要确认"}。`
          : "等待连板和高度数据。"
      },
      {
        name: "前排梯队",
        status: hasChainSpread ? "passed" : "pending",
        text: strongestBoard
          ? `${hasChainSpread ? "板块内有多只前排共同表现" : "前排梯队还不够厚"}，避免只看单票强。`
          : "等待前排梯队。"
      },
      {
        name: "回踩承接",
        status: hasAcceptance ? "passed" : "failed",
        text: `平均开板压力约 ${openPressure.toFixed(1)} 次，${hasAcceptance ? "资金没有明显快速消失" : "分歧压力偏高"}。`
      }
    ]
  };
}

function buildHoldingThemeMatches(
  holdings: Holding[],
  boardInsights: InvestableBoardInsight[],
  limitUpStocks: LimitUpStock[]
): HoldingThemeMatch[] {
  const topBoardNames = boardInsights.map((item) => item.name);
  const limitUpByCode = new Map(limitUpStocks.map((stock) => [stock.code, stock]));

  return holdings.map((holding) => {
    const limitUpStock = limitUpByCode.get(holding.code);
    const text = [holding.thesis, ...holding.tags].join(" ");
    const matchedBoard =
      limitUpStock?.industry ??
      topBoardNames.find((boardName) => text.includes(boardName)) ??
      "";
    const isTopBoard = Boolean(matchedBoard && topBoardNames.includes(matchedBoard));

    if (limitUpStock && isTopBoard) {
      return {
        holding,
        relation: "主线相关",
        matchedBoard,
        action: "优先跟踪，按纪律决定是否加减仓",
        reason: `${holding.name} 已进入涨停池，且属于今日 Top 3 板块 ${matchedBoard}。重点看封单、开板和次日承接。`
      };
    }

    if (limitUpStock) {
      return {
        holding,
        relation: "部分相关",
        matchedBoard: limitUpStock.industry,
        action: "持有观察，不因单票涨停盲目加仓",
        reason: `${holding.name} 在涨停池内，但所属板块暂未进入今日 Top 3。先看它能否带动板块，而不是只看单票。`
      };
    }

    if (matchedBoard) {
      return {
        holding,
        relation: isTopBoard ? "部分相关" : "暂无关联",
        matchedBoard,
        action: isTopBoard ? "观察是否被主线带动" : "不因今日主线随意调整",
        reason: isTopBoard
          ? `${holding.name} 的持仓逻辑提到 ${matchedBoard}，但个股未进入涨停池。适合观察主线外溢，不适合追涨补仓。`
          : `${holding.name} 当前没有进入涨停池，和今日 Top 3 主线暂无直接联动。`
      };
    }

    return {
      holding,
      relation: "暂无关联",
      matchedBoard: "未匹配",
      action: "按原计划执行，不被盘面热点干扰",
      reason: `${holding.name} 暂未匹配今日 Top 3 板块，也未进入涨停池。优先检查原持仓逻辑和止损纪律。`
    };
  });
}

function extractThemeTags(
  detail: StockDetail | null,
  limitUpStock: LimitUpStock | null,
  relatedBoard: LimitUpBoardSummary | null,
  boardName: string | null
) {
  const rawTags = [
    boardName,
    relatedBoard?.name,
    detail?.industry,
    limitUpStock?.industry,
    ...(limitUpStock?.reason
      .split(/[、，,；;。.\s]+/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2 && !item.includes("方向") && !item.includes("涨停")) ?? [])
  ];

  return Array.from(new Set(rawTags.filter(Boolean) as string[])).slice(0, 5);
}

function buildStockBackgroundInsight(
  detail: StockDetail | null,
  limitUpStock: LimitUpStock | null,
  relatedBoard: LimitUpBoardSummary | null,
  boardName: string | null
): StockBackgroundInsight {
  const name = detail?.name ?? limitUpStock?.name ?? "当前股票";
  const code = detail?.code ?? limitUpStock?.code ?? "";
  const resolvedBoard = boardName ?? relatedBoard?.name ?? detail?.industry ?? limitUpStock?.industry ?? "待识别";
  const themeTags = extractThemeTags(detail, limitUpStock, relatedBoard, boardName);
  const relatedRank = relatedBoard?.stocks.findIndex((stock) => stock.code === code) ?? -1;
  const frontRankText = relatedRank >= 0 ? `板块涨停池第 ${relatedRank + 1} 位` : "暂未进入当前板块涨停池前排";

  return {
    title: `${name}${code ? ` ${code}` : ""}`,
    subtitle: `${resolvedBoard} · ${limitUpStock?.ladderType ?? "非涨停池"} · ${limitUpStock ? `${limitUpStock.consecutiveBoardCount} 板` : "待确认强度"}`,
    themeTags: themeTags.length > 0 ? themeTags : ["题材待补齐"],
    companyContext:
      detail && detail.industry !== "未知行业"
        ? `${name} 当前按行情数据归入 ${detail.industry}。这里先把它当作 ${resolvedBoard} 方向里的候选标的观察。`
        : `${name} 的实时行业/主营资料暂不完整，当前只能先用名称、代码、所选板块和涨停池关系做背景判断。`,
    themeContext: relatedBoard
      ? `${resolvedBoard} 今日有 ${relatedBoard.stocks.length} 家涨停，连板 ${relatedBoard.consecutiveBoardCount} 家，高度 ${relatedBoard.maxBoardHeight} 板，是判断这只股票题材强弱的主要参照。`
      : `${resolvedBoard} 的板块联动数据暂不完整，不能单独因为个股波动就认定它是主线。`,
    boardPosition: limitUpStock
      ? `${frontRankText}，首次涨停 ${limitUpStock.firstLimitUpTime}，开板 ${limitUpStock.openBoardCount} 次，封单 ${limitUpStock.sealAmount}，封单强度 ${limitUpStock.sealStrength}。`
      : `${frontRankText}，说明它当前不是涨停池里最明确的前排标的，需要和同题材强势股比较后再判断。`,
    catalyst: limitUpStock?.reason ?? "暂未命中涨停池原因描述，题材催化需要继续补充公告、新闻或研报材料。",
    compare: relatedBoard
      ? `同题材优先比较 ${relatedBoard.stocks
          .filter((stock) => stock.code !== code)
          .slice(0, 3)
          .map((stock) => `${stock.name} ${stock.code}`)
          .join("、") || "板块内其它前排股"}。如果它弱于前排，就不应该只因为熟悉这只票而买。`
      : "同题材对比对象暂缺，先回到首页或板块页找前排，再决定它是否值得进入交易计划。",
    dataGap: detail?.price && detail.price > 0
      ? "实时行情已接入，可以继续结合成交额、换手率和分时承接判断买点。"
      : "实时行情明细暂不可用，背景介绍可用，但不能直接形成买入结论。"
  };
}

function buildStockSimpleQuestionInsight(
  detail: StockDetail | null,
  limitUpStock: LimitUpStock | null,
  relatedBoard: LimitUpBoardSummary | null
): SimpleQuestionInsight {
  const stockName = detail?.name ?? limitUpStock?.name ?? "这只股票";
  const boardName = relatedBoard?.name ?? detail?.industry ?? limitUpStock?.industry ?? "待识别板块";
  const hasBoardAnswer = Boolean(relatedBoard && relatedBoard.stocks.length >= 5);
  const hasTrendAnswer = Boolean(
    limitUpStock
      ? limitUpStock.consecutiveBoardCount >= 2 || limitUpStock.firstLimitUpTime <= "10:00"
      : detail && detail.changePercent >= 5
  );
  const hasChainAnswer = Boolean(
    relatedBoard &&
      relatedBoard.stocks.filter((stock) => stock.consecutiveBoardCount >= 1).length >= 3
  );
  const hasAcceptanceAnswer = Boolean(
    limitUpStock
      ? limitUpStock.openBoardCount <= 1
      : detail && detail.amount >= 500_000_000 && detail.turnoverRate <= 18
  );
  const passedCount = [hasBoardAnswer, hasTrendAnswer, hasChainAnswer, hasAcceptanceAnswer].filter(Boolean).length;

  return {
    verdict:
      passedCount >= 3
        ? "简单题候选"
        : passedCount === 2
          ? "需要确认"
          : "不是简单题",
    summary:
      passedCount >= 3
        ? `${stockName} 当前更像 ${boardName} 主线里的前排题，不是孤立单票。`
        : `${stockName} 还没有同时满足主线、趋势、产业链扩散和承接，不能把它当简单题。`,
    action:
      passedCount >= 3
        ? "只等纪律买点，不临盘追高。"
        : "先做比较和记录，不急着交易。",
    signals: [
      {
        name: "不是单票强",
        status: hasBoardAnswer ? "passed" : "pending",
        text: relatedBoard
          ? `${boardName} 有 ${relatedBoard.stocks.length} 家涨停，${hasBoardAnswer ? "有板块支撑" : "板块扩散不足"}。`
          : "缺少相关板块数据。"
      },
      {
        name: "趋势已走出",
        status: hasTrendAnswer ? "passed" : "pending",
        text: limitUpStock
          ? `${limitUpStock.ladderType}，首次涨停 ${limitUpStock.firstLimitUpTime}，${hasTrendAnswer ? "有前排迹象" : "趋势还不够明确"}。`
          : "未命中涨停池，需要用分时和趋势补充确认。"
      },
      {
        name: "产业链扩散",
        status: hasChainAnswer ? "passed" : "pending",
        text: relatedBoard
          ? `${hasChainAnswer ? "同板块多只股票共同表现" : "同题材梯队还不厚"}，不能只看单日涨幅。`
          : "同题材比较对象不足。"
      },
      {
        name: "资金承接",
        status: hasAcceptanceAnswer ? "passed" : "pending",
        text: limitUpStock
          ? `开板 ${limitUpStock.openBoardCount} 次，封单 ${limitUpStock.sealAmount}，${hasAcceptanceAnswer ? "承接暂可" : "分歧偏大"}。`
          : "缺少成交额、换手率和分时承接，不能判断买点。"
      }
    ]
  };
}

function buildStockDecisionInsight(
  detail: StockDetail | null,
  limitUpStock: LimitUpStock | null,
  relatedBoard: LimitUpBoardSummary | null
): StockDecisionInsight {
  if (!detail) {
    return {
      verdict: "等待数据",
      action: "先不决策",
      position: "不加仓",
      reason: "当前还没有取到个股实时行情，不能给出有效判断。",
      risk: "缺少价格、成交额、换手率和板块位置。",
      nextStep: "先确认股票代码是否正确，等待行情数据恢复后再判断。"
    };
  }

  if (detail.price <= 0) {
    return {
      verdict: "基础分析",
      action: "先不交易",
      position: "不新增仓",
      reason: `${detail.name} 的实时行情暂不可用，当前只能基于股票代码、名称、板块和涨停池关系做初步判断。`,
      risk: "缺少实时价格、成交额、换手率和分时走势，不能判断买点。",
      nextStep: "等待行情恢复，或从首页 Top 3 板块进入有完整数据的前排个股。"
    };
  }

  const boardStrength = relatedBoard
    ? relatedBoard.stocks.length + relatedBoard.consecutiveBoardCount * 2 + relatedBoard.maxBoardHeight
    : 0;
  const isBoardStrong = boardStrength >= 10;
  const isExtended = detail.changePercent >= 8 || (limitUpStock?.consecutiveBoardCount ?? 0) >= 3;
  const hasHeavyTurnover = detail.turnoverRate >= 18;
  const hasGoodLiquidity = detail.amount >= 500_000_000;

  if (limitUpStock && isBoardStrong && !isExtended && limitUpStock.openBoardCount <= 1) {
    return {
      verdict: "前排可观察",
      action: "只按计划低吸或次日确认",
      position: "试错仓",
      reason: `${detail.name} 命中涨停池，所属板块有 ${relatedBoard?.stocks.length ?? 0} 家涨停，开板次数 ${limitUpStock.openBoardCount} 次，仍有板块支撑。`,
      risk: "涨停后直接追高的性价比不高，必须等换手和承接确认。",
      nextStep: "记录入场条件：回踩不破关键均价、板块前排继续封住、指数不明显转弱。"
    };
  }

  if (limitUpStock && (isExtended || limitUpStock.openBoardCount >= 2)) {
    return {
      verdict: "不适合追高",
      action: "观察，不追",
      position: "不新增仓",
      reason: `${detail.name} 已在强势位置，${limitUpStock.consecutiveBoardCount} 板，开板 ${limitUpStock.openBoardCount} 次，追高容易承担分歧风险。`,
      risk: "高位一致性或反复开板后，次日承接不确定。",
      nextStep: "只看板块是否继续扩散；若已有持仓，按止盈和开板纪律处理。"
    };
  }

  if (relatedBoard && isBoardStrong && hasGoodLiquidity) {
    return {
      verdict: "板块内观察",
      action: "等确认，不抢先手",
      position: "观察仓或不动",
      reason: `${detail.name} 属于 ${relatedBoard.name}，板块有 ${relatedBoard.stocks.length} 家涨停，但个股未进入涨停池，需要确认是否能跟随主线。`,
      risk: hasHeavyTurnover ? "换手较高，资金分歧偏大。" : "未进入涨停池，辨识度弱于前排。",
      nextStep: "和同板块前排比较：强度不足就放弃，只有放量向上且板块继续加强才考虑。"
    };
  }

  return {
    verdict: "暂无交易优势",
    action: "不主动买入",
    position: "空仓观察",
    reason: `${detail.name} 当前没有明显涨停池或强板块位置优势，交易依据不足。`,
    risk: "容易被单只股票波动吸引，偏离今日主线和自己的交易纪律。",
    nextStep: "回到首页先确认今日 Top 3 板块，再决定这只股票是否值得继续跟踪。"
  };
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

function buildHoldingAiActions(
  items: Holding[],
  limitUpStocks: LimitUpStock[] = [],
  boards: LimitUpBoardSummary[] = []
): HoldingAiAction[] {
  const portfolioMarketValue = totalMarketValue(items);
  const topBoards = boards.slice(0, 3);
  const topBoardNames = topBoards.map((board) => board.name);
  const limitUpByCode = new Map(limitUpStocks.map((stock) => [stock.code, stock]));

  return items.map((item) => {
    const weight = holdingWeightPercent(item, portfolioMarketValue);
    const pnlPercent = ((item.price - item.cost) / item.cost) * 100;
    const targetGap = typeof item.targetPrice === "number" ? ((item.targetPrice - item.price) / item.price) * 100 : null;
    const stopGap = typeof item.stopLoss === "number" ? ((item.price - item.stopLoss) / item.price) * 100 : null;
    const limitUpStock = limitUpByCode.get(item.code) ?? null;
    const matchedTopBoard =
      limitUpStock && topBoardNames.includes(limitUpStock.industry)
        ? limitUpStock.industry
        : item.tags.find((tag) => topBoardNames.includes(tag)) ?? null;
    const partialBoard =
      limitUpStock?.industry ??
      item.tags.find((tag) => boards.some((board) => board.name === tag)) ??
      null;
    const themeRelation = matchedTopBoard
      ? `今日主线相关：${matchedTopBoard}`
      : partialBoard
        ? `部分相关：${partialBoard}`
        : "今日主线无关";
    const holdingState =
      pnlPercent >= 10
        ? `盈利持仓，浮盈 ${percent(pnlPercent)}`
        : pnlPercent <= -8
          ? `亏损持仓，浮亏 ${Math.abs(pnlPercent).toFixed(2)}%`
          : `震荡持仓，收益 ${percent(pnlPercent)}`;
    const riskPosition =
      stopGap !== null
        ? stopGap < 0
          ? `已跌破止损 ${Math.abs(stopGap).toFixed(1)}%，防守失效`
          : stopGap <= 5
          ? `距离止损 ${stopGap.toFixed(1)}%，防守很近`
          : `距离止损 ${stopGap.toFixed(1)}%，仍有缓冲`
        : "未设置止损，风险边界不清";
    const targetPosition =
      targetGap !== null
        ? targetGap < 0
          ? `已超过目标 ${Math.abs(targetGap).toFixed(1)}%，进入兑现区`
          : targetGap <= 5
          ? `距离目标 ${targetGap.toFixed(1)}%，接近兑现区`
          : `距离目标 ${targetGap.toFixed(1)}%，仍有空间`
        : "未设置目标价，止盈边界不清";
    let score = 68;

    let action = "继续持有";
    let confidence = "中";
    let priority = "中优先级";
    let positionAdvice = "维持当前仓位";
    let executionRatio = "0%";
    let disciplineAction = "今日不动";
    let reason = "当前盈亏和波动处于可控区间，暂不需要激进调仓。";
    let nextStep = "继续观察量价配合、板块资金承接和目标价兑现节奏。";
    let expectation = "预期未来 1 到 3 周以震荡上行为主，适合边走边看。";

    if (typeof item.stopLoss === "number" && item.price <= item.stopLoss * 1.03) {
      action = "减仓或止损";
      confidence = "高";
      priority = "最高优先级";
      positionAdvice = "快速降仓";
      executionRatio = "50% - 100%";
      disciplineAction = "到价止损";
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
      disciplineAction = "分批止盈";
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
      disciplineAction = "降低风险";
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
      disciplineAction = weight >= 25 ? "持仓不动" : "顺势小加";
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
      disciplineAction = "观察持有";
      score = 72;
      reason = "离目标价仍有一段安全收益空间，现阶段更适合给趋势时间。";
      nextStep = "围绕成本附近做防守，若出现放量突破可再小幅顺势加仓。";
      expectation = "后续以趋势修复和估值回归为主，节奏不会特别快。";
    }

    if (matchedTopBoard && action === "继续持有") {
      score += 8;
      reason = `${reason} 同时它和今日主线 ${matchedTopBoard} 有直接关系，优先看板块承接而不是只看单票分时。`;
      nextStep = `${nextStep} 若主线继续扩散且个股不破成本防守，可以继续持有。`;
    } else if (!matchedTopBoard && action === "继续持有") {
      score -= 6;
      nextStep = `${nextStep} 由于暂不贴近今日 Top 3 主线，不因盘面热点临时加仓。`;
    }

    if (weight >= 30 && action === "坚定持有") {
      positionAdvice = "只持有不加仓";
      executionRatio = "0%";
      disciplineAction = "仓位过重不加";
      nextStep = "仓位已经偏重，不建议继续加码，重点做风控和利润保护。";
    }

    if (stopGap !== null && stopGap < 8 && action !== "减仓或止损") {
      priority = "高优先级";
      disciplineAction = "盯止损线";
      nextStep = `${nextStep} 同时把止损执行放在首位，避免小亏拖成大亏。`;
    }

    if (weight <= 12 && score >= 80) {
      positionAdvice = "可试探性加仓";
      executionRatio = "5% - 8%";
      disciplineAction = "小仓验证";
    }

    score = Math.max(0, Math.min(100, score));
    const thesisText = item.thesis.trim().replace(/[。.!！?？]+$/, "");

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
      holdingState,
      themeRelation,
      disciplineAction,
      riskPosition: `${riskPosition}；${targetPosition}；仓位 ${weight.toFixed(1)}%`,
      reviewCheck: `${thesisText ? `买入逻辑：${thesisText}` : "买入逻辑未记录"}。明日验证：${matchedTopBoard ? "主线是否继续扩散、前排是否继续承接" : "原逻辑是否仍成立、是否被热点干扰"}。`,
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
  const [decisionInput, setDecisionInput] = useState("");
  const shouldShowManualStockConfirm =
    uploadAssets.some((asset) => asset.kind === "图片") &&
    !uploadAssets.some((asset) => asset.kind === "视频" || asset.kind === "视频链接");
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
  const [decisionQueue, setDecisionQueue] = useState<DecisionQueueStock[]>([]);
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
  const [isTradeEditorOpen, setIsTradeEditorOpen] = useState(false);
  const [tradeForm, setTradeForm] = useState<TradeFormState>(() => createEmptyTradeForm());
  const [tradeFormError, setTradeFormError] = useState("");
  const [selectedReviewTradeId, setSelectedReviewTradeId] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState<ReviewFormState>(emptyReviewForm);
  const [reviewFormError, setReviewFormError] = useState("");
  const [disciplineRules, setDisciplineRules] = useState<DisciplineRule[]>(() =>
    loadDisciplineRulesFromStorage()
  );
  const [disciplineForm, setDisciplineForm] = useState<DisciplineFormState>(emptyDisciplineForm);
  const [disciplineFormError, setDisciplineFormError] = useState("");
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
  const aiIdeas = useMemo(() => buildAiIdeas(portfolio), [portfolio]);
  const reviewedTrades = useMemo(
    () => activeTradeRecords.filter((trade) => trade.review),
    [activeTradeRecords]
  );
  const reviewStats = useMemo(() => {
    const reviewedCount = reviewedTrades.length;
    const followedPlanCount = reviewedTrades.filter((trade) => trade.review?.followedPlan).length;
    const positiveCount = reviewedTrades.filter((trade) => (trade.review?.outcomePercent ?? 0) > 0).length;
    const averageRating =
      reviewedCount > 0
        ? reviewedTrades.reduce((sum, trade) => sum + (trade.review?.rating ?? 0), 0) / reviewedCount
        : 0;
    const setupCounts = activeTradeRecords.reduce<Record<string, number>>((counts, trade) => {
      const setup = trade.setup?.trim();
      if (setup) {
        counts[setup] = (counts[setup] ?? 0) + 1;
      }
      return counts;
    }, {});
    const topSetup =
      Object.entries(setupCounts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "尚未形成";

    return {
      reviewedCount,
      adherenceRate: reviewedCount ? Math.round((followedPlanCount / reviewedCount) * 100) : 0,
      positiveRate: reviewedCount ? Math.round((positiveCount / reviewedCount) * 100) : 0,
      averageRating,
      topSetup
    };
  }, [activeTradeRecords, reviewedTrades]);
  const selectedReviewTrade =
    activeTradeRecords.find((trade) => trade.id === selectedReviewTradeId) ?? null;
  const reviewPatternSummary =
    reviewStats.reviewedCount < 3
      ? "至少完成 3 笔复盘后，系统才会开始给出相对可靠的个人模式判断。"
      : reviewStats.adherenceRate >= 70 && reviewStats.positiveRate >= 50
        ? `你当前最常使用“${reviewStats.topSetup}”，且计划执行率较高。下一步重点是扩大有效样本，并保持同一套入场和退出标准。`
        : reviewStats.adherenceRate < 70
          ? `你当前最常使用“${reviewStats.topSetup}”，但计划执行率偏低。先减少临盘改动，比增加新策略更重要。`
          : `你当前最常使用“${reviewStats.topSetup}”，执行较稳定，但正收益样本不足。需要收紧入场条件或重新检查退出规则。`;

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
      Record<string, LimitUpBoardSummary>
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
          totalSealAmount: 0,
          openBoardCount: 0
        };
      }

      acc[boardName].stocks.push(stock);
      acc[boardName].totalSealAmount += numericSealAmount;
      acc[boardName].openBoardCount += stock.openBoardCount;
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
  const investableBoardInsights = useMemo(
    () => buildInvestableBoardInsights(limitUpBoards),
    [limitUpBoards]
  );
  const holdingAiActions = useMemo(
    () => buildHoldingAiActions(portfolio, limitUpStocks, limitUpBoards),
    [limitUpBoards, limitUpStocks, portfolio]
  );
  const portfolioAiRoadmap = useMemo(
    () => buildPortfolioAiRoadmap(portfolio, holdingAiActions, activePortfolioCashEstimate),
    [activePortfolioCashEstimate, holdingAiActions, portfolio]
  );
  const fundingPlans = useMemo(() => buildFundingPlans(holdingAiActions), [holdingAiActions]);
  const holdingThemeMatches = useMemo(
    () => buildHoldingThemeMatches(portfolio, investableBoardInsights, limitUpStocks),
    [investableBoardInsights, limitUpStocks, portfolio]
  );
  const holdingThemeSummary = useMemo(() => {
    const directCount = holdingThemeMatches.filter((item) => item.relation === "主线相关").length;
    const partialCount = holdingThemeMatches.filter((item) => item.relation === "部分相关").length;

    if (holdingThemeMatches.length === 0) {
      return "当前还没有录入持仓，无法判断你的组合和今日主线的关系。";
    }

    if (directCount > 0) {
      return `当前有 ${directCount} 只持仓直接贴近今日主线，优先按交易纪律处理这些仓位。`;
    }

    if (partialCount > 0) {
      return `当前有 ${partialCount} 只持仓和今日主线存在弱关联，适合观察外溢，不适合随意追涨。`;
    }

    return "当前持仓与今日 Top 3 主线暂无明显关系，重点是守住原计划，不被热点干扰。";
  }, [holdingThemeMatches]);

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
  const visibleSelectedBoardStocks = useMemo(
    () => sortedSelectedBoardStocks.slice(0, 20),
    [sortedSelectedBoardStocks]
  );

  const visibleLimitUpBoards = useMemo(() => limitUpBoards.slice(0, 4), [limitUpBoards]);
  const strongestThemeBoard = limitUpBoards[0] ?? null;
  const frontRunnerStocks = useMemo(
    () =>
      [...(strongestThemeBoard?.stocks ?? [])]
        .sort((left, right) => {
          if (right.consecutiveBoardCount !== left.consecutiveBoardCount) {
            return right.consecutiveBoardCount - left.consecutiveBoardCount;
          }

          const sealStrengthGap = parseSealStrength(right.sealStrength) - parseSealStrength(left.sealStrength);
          if (sealStrengthGap !== 0) {
            return sealStrengthGap;
          }

          if (left.openBoardCount !== right.openBoardCount) {
            return left.openBoardCount - right.openBoardCount;
          }

          return parseLimitUpTime(left.firstLimitUpTime) - parseLimitUpTime(right.firstLimitUpTime);
        })
        .slice(0, 10),
    [strongestThemeBoard?.stocks]
  );
  const leadStock = frontRunnerStocks[0] ?? null;
  const backupStock = useMemo(() => {
    if (!leadStock) {
      return frontRunnerStocks[1] ?? null;
    }

    return (
      frontRunnerStocks.find(
        (stock) => stock.code !== leadStock.code && stock.industry === leadStock.industry
      ) ??
      frontRunnerStocks.find((stock) => stock.code !== leadStock.code) ??
      null
    );
  }, [frontRunnerStocks, leadStock]);
  const effectiveStockBoardName = selectedStockBoardName ?? stockDetail?.industry ?? null;
  const relatedBoardData = useMemo(() => {
    if (!effectiveStockBoardName) {
      return null;
    }

    return limitUpBoards.find((board) => board.name === effectiveStockBoardName) ?? null;
  }, [effectiveStockBoardName, limitUpBoards]);
  const selectedLimitUpStock = useMemo(
    () => limitUpStocks.find((stock) => stock.code === selectedStockCode) ?? null,
    [limitUpStocks, selectedStockCode]
  );
  const selectedDecisionQueueCodes = useMemo(
    () => new Set(decisionQueue.map((stock) => stock.code)),
    [decisionQueue]
  );
  const activeQueueIndex = useMemo(
    () => decisionQueue.findIndex((stock) => stock.code === selectedStockCode),
    [decisionQueue, selectedStockCode]
  );
  const stockBackgroundInsight = useMemo(
    () =>
      buildStockBackgroundInsight(
        stockDetail,
        selectedLimitUpStock,
        relatedBoardData,
        effectiveStockBoardName
      ),
    [effectiveStockBoardName, relatedBoardData, selectedLimitUpStock, stockDetail]
  );
  const stockSimpleQuestionInsight = useMemo(
    () => buildStockSimpleQuestionInsight(stockDetail, selectedLimitUpStock, relatedBoardData),
    [relatedBoardData, selectedLimitUpStock, stockDetail]
  );
  const stockDecisionInsight = useMemo(
    () => buildStockDecisionInsight(stockDetail, selectedLimitUpStock, relatedBoardData),
    [relatedBoardData, selectedLimitUpStock, stockDetail]
  );
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
  const intradayDecision = useMemo(
    () =>
      buildIntradayDecision({
        indices: marketIndices,
        limitUpStocks,
        strongestTheme: strongestThemeBoard?.name ?? null,
        leadStock,
        backupStock,
        totalOpenBoardCount,
        maxLimitUpHeight,
        firstBoardCount,
        consecutiveBoardCount
      }),
    [
      backupStock,
      consecutiveBoardCount,
      firstBoardCount,
      leadStock,
      limitUpStocks,
      marketIndices,
      maxLimitUpHeight,
      strongestThemeBoard?.name,
      totalOpenBoardCount
    ]
  );
  const marketSimpleQuestionInsight = useMemo(
    () =>
      buildMarketSimpleQuestionInsight({
        strongestBoard: strongestThemeBoard,
        limitUpStocks,
        totalOpenBoardCount,
        consecutiveBoardCount
      }),
    [consecutiveBoardCount, limitUpStocks, strongestThemeBoard, totalOpenBoardCount]
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

  function updateActivePortfolioTrades(updater: (current: TradeRecord[]) => TradeRecord[]) {
    setPortfolioProfilesState((current) =>
      current.map((profile) =>
        profile.id === activePortfolioProfileId
          ? {
              ...profile,
              trades: updater(profile.trades)
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

  function handleTradeFormChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;
    setTradeForm((current) => ({ ...current, [name]: value }));
  }

  function handleTradeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = tradeForm.code.trim();
    const name = tradeForm.name.trim();
    const price = Number(tradeForm.price);
    const shares = Number(tradeForm.shares);

    if (!tradeForm.date || !code || !name || !tradeForm.setup.trim()) {
      setTradeFormError("请完整填写日期、股票、代码和交易模式。");
      return;
    }

    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(shares) || shares <= 0) {
      setTradeFormError("成交价和成交股数必须大于 0。");
      return;
    }

    const nextTrade: TradeRecord = {
      id: `trade-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: tradeForm.date,
      action: tradeForm.action,
      code,
      name,
      price,
      shares,
      setup: tradeForm.setup.trim(),
      note: tradeForm.note.trim() || "未补充交易备注"
    };

    updateActivePortfolioTrades((current) => [nextTrade, ...current]);
    setTradeForm(createEmptyTradeForm());
    setTradeFormError("");
    setIsTradeEditorOpen(false);
  }

  function openTradeReview(trade: TradeRecord) {
    setSelectedReviewTradeId(trade.id);
    setReviewForm(
      trade.review
        ? {
            marketContext: trade.review.marketContext,
            plan: trade.review.plan,
            execution: trade.review.execution,
            followedPlan: trade.review.followedPlan,
            emotion: trade.review.emotion,
            mistake: trade.review.mistake,
            lesson: trade.review.lesson,
            outcomePercent: `${trade.review.outcomePercent}`,
            rating: `${trade.review.rating}`
          }
        : emptyReviewForm
    );
    setReviewFormError("");
    setActivePortfolioTab("review");
  }

  function handleReviewFormChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;
    const checked = event.target instanceof HTMLInputElement ? event.target.checked : false;
    setReviewForm((current) => ({
      ...current,
      [name]: name === "followedPlan" ? checked : value
    }));
  }

  function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedReviewTradeId) {
      setReviewFormError("请先选择一笔交易。");
      return;
    }

    const outcomePercent = Number(reviewForm.outcomePercent);
    const rating = Number(reviewForm.rating);

    if (!reviewForm.marketContext.trim() || !reviewForm.plan.trim() || !reviewForm.execution.trim()) {
      setReviewFormError("请补充市场环境、交易计划和实际执行。");
      return;
    }

    if (!Number.isFinite(outcomePercent) || !Number.isFinite(rating) || rating < 1 || rating > 5) {
      setReviewFormError("请填写有效的结果收益率，执行评分需为 1 到 5 分。");
      return;
    }

    updateActivePortfolioTrades((current) =>
      current.map((trade) =>
        trade.id === selectedReviewTradeId
          ? {
              ...trade,
              review: {
                marketContext: reviewForm.marketContext.trim(),
                plan: reviewForm.plan.trim(),
                execution: reviewForm.execution.trim(),
                followedPlan: reviewForm.followedPlan,
                emotion: reviewForm.emotion,
                mistake: reviewForm.mistake.trim(),
                lesson: reviewForm.lesson.trim(),
                outcomePercent,
                rating,
                reviewedAt: new Date().toISOString()
              }
            }
          : trade
      )
    );
    setReviewFormError("");
  }

  function handleDisciplineFormChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = event.target;
    setDisciplineForm((current) => ({ ...current, [name]: value }));
  }

  function handleDisciplineSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!disciplineForm.name.trim() || !disciplineForm.entryRule.trim() || !disciplineForm.exitRule.trim()) {
      setDisciplineFormError("请至少填写模式名称、入场条件和退出条件。");
      return;
    }

    setDisciplineRules((current) => [
      {
        id: `discipline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: disciplineForm.name.trim(),
        entryRule: disciplineForm.entryRule.trim(),
        exitRule: disciplineForm.exitRule.trim(),
        positionRule: disciplineForm.positionRule.trim() || "未设置仓位规则",
        forbiddenRule: disciplineForm.forbiddenRule.trim() || "未设置禁做项",
        createdAt: new Date().toISOString()
      },
      ...current
    ]);
    setDisciplineForm(emptyDisciplineForm);
    setDisciplineFormError("");
  }

  function handleDeleteDisciplineRule(id: string) {
    setDisciplineRules((current) => current.filter((rule) => rule.id !== id));
  }

  useEffect(() => {
    closeHoldingEditor();
    setIsTradeEditorOpen(false);
    setSelectedReviewTradeId(null);
    setReviewForm(emptyReviewForm);
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
    window.localStorage.setItem(disciplineRulesStorageKey, JSON.stringify(disciplineRules));
  }, [disciplineRules]);

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

    void persistUploadAssets(uploadAssets).catch((error) => {
      console.error("保存上传资产失败：", error);
    });
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

    const runRefresh = () => {
      void refreshPortfolioQuotes().catch((error) => {
        console.error("刷新持仓行情失败：", error);
      });
    };

    runRefresh();
    refreshTimer = window.setInterval(runRefresh, 30000);

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
    const shouldLoadStock = Boolean(
      selectedStockCode && (activeNav === "policy" || activeHomeSubpage === "stock")
    );

    if (!shouldLoadStock || !selectedStockCode) {
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

        try {
          const fallbackMatch = await fetchStockSearchMatch(selectedStockCode);

          if (disposed) {
            return;
          }

          setStockDetail(
            buildFallbackStockDetail(
              fallbackMatch.code,
              fallbackMatch.name,
              selectedStockBoardName
            )
          );
          setStockDetailUpdatedAt(
            new Intl.DateTimeFormat("zh-CN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false
            }).format(new Date())
          );
          setStockDetailError("实时行情暂不可用，已使用基础股票信息生成分析。");
        } catch {
          if (disposed) {
            return;
          }

          setStockDetail(null);
          setStockDetailError(error instanceof Error ? error.message : "个股详情获取失败。");
        }
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
  }, [activeHomeSubpage, activeNav, selectedStockBoardName, selectedStockCode]);

  useEffect(() => {
    const shouldLoadStock = Boolean(
      selectedStockCode && (activeNav === "policy" || activeHomeSubpage === "stock")
    );

    if (!shouldLoadStock || !selectedStockCode) {
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
  }, [activeHomeSubpage, activeNav, selectedStockCode, stockTrendRange]);

  function updateHash(
    nextNav: NavKey,
    nextHomeSubpage: HomeSubpageKey,
    nextBoard: string | null,
    nextStockCode: string | null = null,
    nextStockBoardName: string | null = null
  ) {
    const nextHash =
      nextNav === "policy" && nextStockCode
        ? nextStockBoardName
          ? `#policy/stocks/${encodeURIComponent(nextStockCode)}/board/${encodeURIComponent(nextStockBoardName)}`
          : `#policy/stocks/${encodeURIComponent(nextStockCode)}`
        : nextNav !== "home"
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
    setActiveNav("policy");
    setActiveHomeSubpage("overview");
    setSelectedStockCode(code);
    setSelectedStockBoardName(boardName);
    updateHash("policy", "overview", boardName, code, boardName);
  }

  function toggleDecisionQueueStock(stock: LimitUpStock, boardName: string | null) {
    setDecisionQueue((current) => {
      if (current.some((item) => item.code === stock.code)) {
        return current.filter((item) => item.code !== stock.code);
      }

      return [
        ...current,
        {
          code: stock.code,
          name: stock.name,
          boardName
        }
      ];
    });
  }

  function addDecisionQueueStocks(stocks: LimitUpStock[], boardName: string | null) {
    setDecisionQueue((current) => {
      const existingCodes = new Set(current.map((item) => item.code));
      const nextItems = stocks
        .filter((stock) => !existingCodes.has(stock.code))
        .map((stock) => ({
          code: stock.code,
          name: stock.name,
          boardName
        }));

      return [...current, ...nextItems];
    });
  }

  function openDecisionQueue() {
    const firstStock = decisionQueue[0];

    if (!firstStock) {
      return;
    }

    navigateStockDetail(firstStock.code, firstStock.boardName);
  }

  async function handleDecisionSearch() {
    const trimmedInput = decisionInput.trim();

    if (!trimmedInput) {
      setStockDetailError("请先输入股票代码或名称。");
      return;
    }

    try {
      const match = await fetchStockSearchMatch(trimmedInput);
      setDecisionInput("");
      setStockDetailError("");
      navigateStockDetail(match.code);
    } catch (error) {
      setStockDetailError(error instanceof Error ? error.message : "未找到匹配的股票代码或名称。");
    }
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
      ? "今日催化"
      : activeNav === "policy" && selectedStockCode
        ? stockDetail?.name ?? selectedStockCode ?? "个股详情"
      : activeNav === "policy"
        ? "个股决策台"
      : activeNav === "home" && activeHomeSubpage === "boards"
        ? selectedLimitUpBoardData?.name ?? "主线板块"
        : currentNav.label;
  const topbarDescription =
    activeNav === "home" && activeHomeSubpage === "events"
      ? "当天热点、快讯与主线催化列表"
      : activeNav === "policy" && selectedStockCode
        ? "实时行情、涨停原因、板块位置与同题材比较"
      : activeNav === "policy"
        ? "先定位股票，再判断逻辑、位置、替代标的和风险"
      : activeNav === "home" && activeHomeSubpage === "boards"
        ? selectedLimitUpBoardData
          ? "板块内涨停股票与梯队分布"
          : "按板块查看当日主线方向"
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
                    <p className="section-kicker">Catalysts</p>
                    <h2>今日催化与快讯</h2>
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
                  <p className="section-kicker">Main Theme</p>
                  <h1>今日主线看板</h1>
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

            <section className="dashboard-grid">
              <article className="card full-span intraday-decision-card">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Decision Layer</p>
                    <h2>盘中交易决策</h2>
                  </div>
                  <span className={`decision-status ${intradayDecision.tradeStatus}`}>
                    {intradayDecision.tradeStatus}
                  </span>
                </div>
                <p className="decision-summary">{intradayDecision.summary}</p>
                <div className="decision-grid">
                  <div className="decision-tile">
                    <span>仓位建议</span>
                    <strong>{intradayDecision.positionAdvice}</strong>
                  </div>
                  <div className="decision-tile">
                    <span>最强主线</span>
                    <strong>{intradayDecision.strongestTheme}</strong>
                  </div>
                  <div className="decision-tile">
                    <span>龙头状态</span>
                    <strong>{intradayDecision.leaderStatus}</strong>
                  </div>
                  <div className="decision-tile">
                    <span>风险提醒</span>
                    <strong>{intradayDecision.riskText}</strong>
                  </div>
                </div>
                <div className="simple-question-panel">
                  <div className="simple-question-head">
                    <div>
                      <p className="section-kicker">Simple Question</p>
                      <h3>今天有没有简单题</h3>
                    </div>
                    <strong>{marketSimpleQuestionInsight.verdict}</strong>
                  </div>
                  <p>{marketSimpleQuestionInsight.summary}</p>
                  <div className="simple-signal-grid">
                    {marketSimpleQuestionInsight.signals.map((signal) => (
                      <div key={signal.name} className={`simple-signal ${signal.status}`}>
                        <span>{signal.name}</span>
                        <strong>
                          {signal.status === "passed"
                            ? "已验证"
                            : signal.status === "failed"
                              ? "有风险"
                              : "待确认"}
                        </strong>
                        <p>{signal.text}</p>
                      </div>
                    ))}
                  </div>
                  <p><strong>执行：</strong>{marketSimpleQuestionInsight.action}</p>
                </div>
              </article>
            </section>

            <section className="dashboard-grid">
              <article className="card full-span">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">AI Board Picks</p>
                    <h2>今日最具投资属性的 3 个板块</h2>
                    <p className="market-strip-meta">
                      按涨停家数、连板高度、封单合计、开板压力和前排质量综合排序。
                    </p>
                  </div>
                </div>
                <div className="investable-board-grid">
                  {investableBoardInsights.map((item, index) => (
                    <button
                      key={item.name}
                      type="button"
                      className="investable-board-card"
                      onClick={() => navigateHomeSubpage("boards", item.name)}
                    >
                      <div className="investable-board-head">
                        <span>#{index + 1}</span>
                        <strong>{item.name}</strong>
                        <small>{item.stance}</small>
                      </div>
                      <div className="investable-score">
                        <strong>{item.score}</strong>
                        <span>投资属性分</span>
                      </div>
                      <p>{item.reason}</p>
                      <p><strong>风险：</strong>{item.risk}</p>
                    </button>
                  ))}
                  {!limitUpLoading && investableBoardInsights.length === 0 && (
                    <div className="placeholder-card">
                      <strong>暂无可评分板块</strong>
                      <p>当前还没有足够的涨停池数据来判断板块投资属性。</p>
                    </div>
                  )}
                </div>
              </article>
            </section>

            <section className="dashboard-grid">
              <article className="card full-span">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Trade First</p>
                    <h2>今日最强主线、龙头、备选</h2>
                  </div>
                </div>
                <div className="generated-grid">
                  <div className="placeholder-card">
                    <span className="structure-role">最强主线</span>
                    <strong>{strongestThemeBoard?.name ?? "待识别"}</strong>
                    <p>
                      {strongestThemeBoard
                        ? `当前板块内 ${strongestThemeBoard.stocks.length} 家涨停，连板 ${strongestThemeBoard.consecutiveBoardCount} 家，首板 ${strongestThemeBoard.firstBoardCount} 家，高度 ${strongestThemeBoard.maxBoardHeight} 板。`
                        : "当前还没有可用的板块强度数据。"}
                    </p>
                  </div>
                  <div className="placeholder-card">
                    <span className="structure-role">当前龙头</span>
                    <strong>{leadStock ? `${leadStock.name} ${leadStock.code}` : "待识别"}</strong>
                    <p>
                      {leadStock
                        ? `${leadStock.reason}。${leadStock.ladderType}，封单 ${leadStock.sealAmount}，开板 ${leadStock.openBoardCount} 次，适合优先点进个股决策台判断。`
                        : "当前没有可直接跟踪的前排龙头。"}
                    </p>
                  </div>
                  <div className="placeholder-card">
                    <span className="structure-role">备选方向</span>
                    <strong>{backupStock ? `${backupStock.name} ${backupStock.code}` : "待识别"}</strong>
                    <p>
                      {backupStock
                        ? `${backupStock.industry}方向，${backupStock.reason}。如果龙头位置过高或不适合追，优先拿它做同题材替代观察。`
                        : "当前还没有第二层备选标的。"}
                    </p>
                  </div>
                </div>
              </article>
            </section>

            <section className="dashboard-grid">
              <article className="card full-span">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Strongest Board</p>
                    <h2>
                      {strongestThemeBoard
                        ? `${strongestThemeBoard.name} · 前 10 个股`
                        : "最强板块前 10"}
                    </h2>
                    <p className="market-strip-meta">
                      {strongestThemeBoard
                        ? `板块涨停 ${strongestThemeBoard.stocks.length} 家，连板 ${strongestThemeBoard.consecutiveBoardCount} 家，首板 ${strongestThemeBoard.firstBoardCount} 家，高度 ${strongestThemeBoard.maxBoardHeight} 板。`
                        : "等待最强板块数据。"}
                    </p>
                  </div>
                  {strongestThemeBoard && (
                    <div className="card-actions">
                      <button
                        type="button"
                        className="secondary action-link"
                        onClick={() => addDecisionQueueStocks(frontRunnerStocks, strongestThemeBoard.name)}
                      >
                        加入前 10
                      </button>
                      <button
                        type="button"
                        className="secondary action-link"
                        onClick={() => navigateHomeSubpage("boards", strongestThemeBoard.name)}
                      >
                        查看板块
                      </button>
                    </div>
                  )}
                </div>
                {strongestThemeBoard && (
                  <div className="limitup-summary-grid strongest-board-summary">
                    <div className="limitup-summary-card">
                      <span>涨停家数</span>
                      <strong>{strongestThemeBoard.stocks.length} 家</strong>
                    </div>
                    <div className="limitup-summary-card">
                      <span>连板家数</span>
                      <strong>{strongestThemeBoard.consecutiveBoardCount} 家</strong>
                    </div>
                    <div className="limitup-summary-card">
                      <span>开板次数</span>
                      <strong>{strongestThemeBoard.openBoardCount} 次</strong>
                    </div>
                    <div className="limitup-summary-card">
                      <span>板块高度</span>
                      <strong>{strongestThemeBoard.maxBoardHeight} 板</strong>
                    </div>
                  </div>
                )}
                {strongestThemeBoard && (
                  <div className="decision-queue-bar">
                    <span>已选 {decisionQueue.length} 只进入个股决策队列</span>
                    <div className="decision-queue-actions">
                      <button
                        type="button"
                        className="secondary action-link"
                        disabled={decisionQueue.length === 0}
                        onClick={openDecisionQueue}
                      >
                        一键进入决策
                      </button>
                      <button
                        type="button"
                        className="secondary action-link"
                        disabled={decisionQueue.length === 0}
                        onClick={() => setDecisionQueue([])}
                      >
                        清空
                      </button>
                    </div>
                  </div>
                )}
                <div className="strongest-stock-list">
                  {frontRunnerStocks.map((stock, index) => (
                    <div
                      key={stock.code}
                      className="strongest-stock-row"
                    >
                      <label className="stock-select-control" aria-label={`选择 ${stock.name}`}>
                        <input
                          type="checkbox"
                          checked={selectedDecisionQueueCodes.has(stock.code)}
                          onChange={() =>
                            toggleDecisionQueueStock(stock, strongestThemeBoard?.name ?? stock.industry)
                          }
                        />
                      </label>
                      <span className="strongest-stock-rank">{index + 1}</span>
                      <span className="strongest-stock-name">
                        <strong>{stock.name}</strong>
                        <small>{stock.code}</small>
                      </span>
                      <span>{stock.ladderType}</span>
                      <span>{stock.consecutiveBoardCount} 板</span>
                      <span>封单 {stock.sealAmount}</span>
                      <span>开板 {stock.openBoardCount} 次</span>
                      <span>{stock.firstLimitUpTime}</span>
                      <button
                        type="button"
                        className="secondary stock-row-action"
                        onClick={() => navigateStockDetail(stock.code, strongestThemeBoard?.name ?? stock.industry)}
                      >
                        分析
                      </button>
                    </div>
                  ))}
                  {!limitUpLoading && frontRunnerStocks.length === 0 && (
                    <div className="placeholder-card">
                      <strong>暂无最强板块前排股</strong>
                      <p>当前没有可展示的最强板块前 10 个股。</p>
                    </div>
                  )}
                </div>
              </article>
            </section>

            <section className="overview-grid">
              <article className="card wide metric-card market-tabs-card">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Execution Map</p>
                    <h2>主线强度与情绪温度</h2>
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
                    <p className="section-kicker">Theme Ladders</p>
                    <h2>主线板块与涨停梯队</h2>
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
              <article className="card source-card">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Data</p>
                    <h2>决策参考数据源</h2>
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
                  <h2>
                    {selectedLimitUpBoardData
                      ? `${selectedLimitUpBoardData.name} · 前 20 个股`
                      : "全部板块"}
                  </h2>
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
                    数据来源：东方财富涨停池 · {limitUpUpdatedAt} 更新 · 当前按所选字段展示前 20
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
                  <div className="decision-queue-bar">
                    <span>已选 {decisionQueue.length} 只进入个股决策队列</span>
                    <div className="decision-queue-actions">
                      <button
                        type="button"
                        className="secondary action-link"
                        onClick={() =>
                          addDecisionQueueStocks(visibleSelectedBoardStocks, selectedLimitUpBoardData.name)
                        }
                      >
                        加入前 20
                      </button>
                      <button
                        type="button"
                        className="secondary action-link"
                        disabled={decisionQueue.length === 0}
                        onClick={openDecisionQueue}
                      >
                        一键进入决策
                      </button>
                      <button
                        type="button"
                        className="secondary action-link"
                        disabled={decisionQueue.length === 0}
                        onClick={() => setDecisionQueue([])}
                      >
                        清空
                      </button>
                    </div>
                  </div>
                  <div className="table-scroll">
                    <div className="limitup-head">
                      <span className="select-column-label">选择</span>
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
                    {visibleSelectedBoardStocks.map((stock) => (
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
                        <label
                          className="stock-select-control"
                          aria-label={`选择 ${stock.name}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedDecisionQueueCodes.has(stock.code)}
                            onChange={() =>
                              toggleDecisionQueueStock(stock, selectedLimitUpBoardData.name)
                            }
                          />
                        </label>
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

        {activeNav === "policy" && (
          <section className="home-top-feed">
            <article className="card wide stock-detail-card">
              <div className="card-head">
                <div>
                  <p className="section-kicker">{selectedStockCode ? "Decision Desk" : "Decision Setup"}</p>
                  <h2>{stockDetail?.name ?? selectedStockCode ?? "个股决策台"}</h2>
                </div>
                {selectedStockCode && (
                  <button
                    type="button"
                    className="secondary action-link"
                    onClick={() => {
                      setSelectedStockCode(null);
                      setSelectedStockBoardName(null);
                      setStockDetail(null);
                      setStockTrendPoints([]);
                      setStockDetailError("");
                      updateHash("policy", "overview", null);
                    }}
                  >
                    返回决策台
                  </button>
                )}
              </div>

              {!selectedStockCode ? (
                <div className="generated-grid">
                  <div className="placeholder-card analysis-summary-card">
                    <strong>先定位你要判断的股票</strong>
                    <p>从主线看板点进强势股，或直接输入股票代码 / 名称，进入这只股票的实时决策页。</p>
                    <div className="analysis-manual-row">
                      <input
                        className="real-input"
                        value={decisionInput}
                        onChange={(event) => setDecisionInput(event.target.value)}
                        placeholder="输入股票代码或名称，例如 600519 或 胜宏科技"
                      />
                      <button
                        type="button"
                        className="action-btn"
                        onClick={() => {
                          void handleDecisionSearch();
                        }}
                      >
                        打开个股决策
                      </button>
                    </div>
                    {stockDetailError && <p className="topbar-note">{stockDetailError}</p>}
                  </div>
                  <div className="placeholder-card">
                    <strong>这页要回答什么</strong>
                    <p>这里只回答这只股票为什么涨、现在能不能进、同题材还有谁更值得看。</p>
                  </div>
                  <div className="placeholder-card">
                    <strong>更合理的使用顺序</strong>
                    <p>先在主线看板确认今日最强方向，再进入前排个股，最后结合 AI 材料解读补齐逻辑和风险。</p>
                  </div>
                  <div className="placeholder-card">
                    <strong>辅助参考</strong>
                    <p>政策、基金风格、港股映射和美股风险偏好现在都只是辅助证据，不再和主工作区并列。</p>
                  </div>
                </div>
              ) : (
                <>
              <p className="market-strip-meta">
                {stockDetailError
                  ? `数据源异常：${stockDetailError}`
                  : stockDetailLoading
                    ? "正在获取个股实时详情..."
                    : `数据来源：东方财富实时个股行情 · ${stockDetailUpdatedAt} 更新`}
              </p>

              {decisionQueue.length > 0 && (
                <div className="decision-queue-panel">
                  <div>
                    <span className="section-kicker">Decision Queue</span>
                    <strong>
                      {activeQueueIndex >= 0
                        ? `第 ${activeQueueIndex + 1} / ${decisionQueue.length} 只`
                        : `队列 ${decisionQueue.length} 只`}
                    </strong>
                  </div>
                  <div className="decision-queue-chips">
                    {decisionQueue.map((stock) => (
                      <button
                        key={stock.code}
                        type="button"
                        className={`decision-queue-chip ${stock.code === selectedStockCode ? "active" : ""}`}
                        onClick={() => navigateStockDetail(stock.code, stock.boardName)}
                      >
                        {stock.name}
                        <span>{stock.code}</span>
                      </button>
                    ))}
                  </div>
                  <div className="decision-queue-actions">
                    <button
                      type="button"
                      className="secondary action-link"
                      disabled={activeQueueIndex <= 0}
                      onClick={() => {
                        const previousStock = decisionQueue[activeQueueIndex - 1];
                        if (previousStock) {
                          navigateStockDetail(previousStock.code, previousStock.boardName);
                        }
                      }}
                    >
                      上一只
                    </button>
                    <button
                      type="button"
                      className="secondary action-link"
                      disabled={activeQueueIndex < 0 || activeQueueIndex >= decisionQueue.length - 1}
                      onClick={() => {
                        const nextStock = decisionQueue[activeQueueIndex + 1];
                        if (nextStock) {
                          navigateStockDetail(nextStock.code, nextStock.boardName);
                        }
                      }}
                    >
                      下一只
                    </button>
                    <button
                      type="button"
                      className="secondary action-link"
                      onClick={() => setDecisionQueue([])}
                    >
                      清空队列
                    </button>
                  </div>
                </div>
              )}

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

                    <section className="stock-background-panel">
                      <div className="stock-background-head">
                        <div>
                          <span className="section-kicker">Background</span>
                          <h3>公司背景与题材</h3>
                        </div>
                        <strong>{stockBackgroundInsight.subtitle}</strong>
                      </div>
                      <div className="stock-theme-tags">
                        {stockBackgroundInsight.themeTags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                      <div className="stock-background-grid">
                        <div>
                          <span>公司定位</span>
                          <p>{stockBackgroundInsight.companyContext}</p>
                        </div>
                        <div>
                          <span>题材催化</span>
                          <p>{stockBackgroundInsight.catalyst}</p>
                        </div>
                        <div>
                          <span>板块强度</span>
                          <p>{stockBackgroundInsight.themeContext}</p>
                        </div>
                        <div>
                          <span>板块位置</span>
                          <p>{stockBackgroundInsight.boardPosition}</p>
                        </div>
                      </div>
                      <p><strong>同题材比较：</strong>{stockBackgroundInsight.compare}</p>
                      <p><strong>数据边界：</strong>{stockBackgroundInsight.dataGap}</p>
                    </section>

                    <section className="simple-question-panel stock-simple-panel">
                      <div className="simple-question-head">
                        <div>
                          <span className="section-kicker">Simple Question</span>
                          <h3>这只票是不是简单题</h3>
                        </div>
                        <strong>{stockSimpleQuestionInsight.verdict}</strong>
                      </div>
                      <p>{stockSimpleQuestionInsight.summary}</p>
                      <div className="simple-signal-grid">
                        {stockSimpleQuestionInsight.signals.map((signal) => (
                          <div key={signal.name} className={`simple-signal ${signal.status}`}>
                            <span>{signal.name}</span>
                            <strong>
                              {signal.status === "passed"
                                ? "已验证"
                                : signal.status === "failed"
                                  ? "有风险"
                                  : "待确认"}
                            </strong>
                            <p>{signal.text}</p>
                          </div>
                        ))}
                      </div>
                      <p><strong>执行：</strong>{stockSimpleQuestionInsight.action}</p>
                    </section>

                    <section className="stock-decision-panel">
                      <div className="stock-decision-head">
                        <div>
                          <span className="section-kicker">AI Decision</span>
                          <h3>个股决策分析</h3>
                        </div>
                        <strong>{stockDecisionInsight.verdict}</strong>
                      </div>
                      <div className="stock-decision-grid">
                        <div>
                          <span>建议动作</span>
                          <strong>{stockDecisionInsight.action}</strong>
                        </div>
                        <div>
                          <span>仓位态度</span>
                          <strong>{stockDecisionInsight.position}</strong>
                        </div>
                      </div>
                      <p>{stockDecisionInsight.reason}</p>
                      <p><strong>风险：</strong>{stockDecisionInsight.risk}</p>
                      <p><strong>下一步：</strong>{stockDecisionInsight.nextStep}</p>
                    </section>

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
                        {selectedLimitUpStock?.reason ?? "当前未命中涨停池原因描述。"}
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
                </>
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
              <article className="card full-span holding-theme-card">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Theme Match</p>
                    <h2>我的持仓与今日主线</h2>
                    <p className="market-strip-meta">{holdingThemeSummary}</p>
                  </div>
                </div>
                <div className="holding-theme-list">
                  {holdingThemeMatches.slice(0, 5).map((item) => (
                    <article className="holding-theme-item" key={item.holding.code}>
                      <div>
                        <strong>{item.holding.name}</strong>
                        <small>{item.holding.code} · {item.matchedBoard}</small>
                      </div>
                      <span className={`holding-theme-badge ${item.relation}`}>{item.relation}</span>
                      <p>{item.reason}</p>
                      <p><strong>动作：</strong>{item.action}</p>
                    </article>
                  ))}
                  {holdingThemeMatches.length === 0 && (
                    <div className="placeholder-card">
                      <strong>还没有持仓数据</strong>
                      <p>先录入持仓，交易台会判断你的组合是否贴近今日主线。</p>
                    </div>
                  )}
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
                  <button
                    type="button"
                    className={`subnav-btn ${activePortfolioTab === "review" ? "active" : ""}`}
                    onClick={() => setActivePortfolioTab("review")}
                  >
                    交易复盘
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
                  <div className="portfolio-manager">
                    <div className="portfolio-toolbar">
                      <div className="portfolio-toolbar-copy">
                        <strong>交易流水</strong>
                        <span>记录每次买卖及其交易模式，后续复盘会基于这些样本统计。</span>
                      </div>
                      {isEditablePortfolio && (
                        <button
                          type="button"
                          className="action-btn"
                          onClick={() => setIsTradeEditorOpen((current) => !current)}
                        >
                          {isTradeEditorOpen ? "收起录入" : "记录交易"}
                        </button>
                      )}
                    </div>

                    {isEditablePortfolio && isTradeEditorOpen && (
                      <form className="holding-editor" onSubmit={handleTradeSubmit}>
                        <div className="holding-form-grid">
                          <label className="holding-form-field">
                            <span>交易日期</span>
                            <input className="real-input" type="date" name="date" value={tradeForm.date} onChange={handleTradeFormChange} />
                          </label>
                          <label className="holding-form-field">
                            <span>方向</span>
                            <select className="real-input" name="action" value={tradeForm.action} onChange={handleTradeFormChange}>
                              <option value="buy">买入</option>
                              <option value="sell">卖出</option>
                            </select>
                          </label>
                          <label className="holding-form-field">
                            <span>股票代码</span>
                            <input className="real-input" name="code" value={tradeForm.code} onChange={handleTradeFormChange} placeholder="如 600519" />
                          </label>
                          <label className="holding-form-field">
                            <span>股票名称</span>
                            <input className="real-input" name="name" value={tradeForm.name} onChange={handleTradeFormChange} placeholder="如 贵州茅台" />
                          </label>
                          <label className="holding-form-field">
                            <span>成交价</span>
                            <input className="real-input" type="number" min="0" step="0.001" name="price" value={tradeForm.price} onChange={handleTradeFormChange} />
                          </label>
                          <label className="holding-form-field">
                            <span>成交股数</span>
                            <input className="real-input" type="number" min="1" step="1" name="shares" value={tradeForm.shares} onChange={handleTradeFormChange} />
                          </label>
                          <label className="holding-form-field">
                            <span>交易模式</span>
                            <input className="real-input" name="setup" value={tradeForm.setup} onChange={handleTradeFormChange} placeholder="如 主线龙头回踩" />
                          </label>
                          <label className="holding-form-field">
                            <span>备注</span>
                            <input className="real-input" name="note" value={tradeForm.note} onChange={handleTradeFormChange} placeholder="入场依据或临盘情况" />
                          </label>
                        </div>
                        <div className="holding-editor-actions">
                          {tradeFormError && <p className="form-error">{tradeFormError}</p>}
                          <button type="submit" className="action-btn">保存交易</button>
                        </div>
                      </form>
                    )}

                    <div className="trade-list">
                      {activeTradeRecords.map((trade) => (
                        <div className="trade-item" key={trade.id}>
                          <div>
                            <strong>
                              {trade.action === "buy" ? "买入" : "卖出"} {trade.name}
                            </strong>
                            <p>{trade.date} · {trade.code} · {trade.setup || "未标记模式"}</p>
                          </div>
                          <div className="trade-side">
                            <span className={trade.action === "buy" ? "up" : "down"}>
                              {trade.action === "buy" ? "+" : "-"}{trade.shares} 股
                            </span>
                            <p>成交价 {currency(trade.price)} · {trade.note}</p>
                            {isEditablePortfolio && (
                              <button type="button" className="inline-action-btn" onClick={() => openTradeReview(trade)}>
                                {trade.review ? "查看复盘" : "开始复盘"}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activePortfolioTab === "review" && (
                  <div className="portfolio-manager">
                    <div className="portfolio-metric-grid">
                      <div className="portfolio-metric-tile"><span>已复盘</span><strong>{reviewStats.reviewedCount}</strong><small>共 {activeTradeRecords.length} 笔交易</small></div>
                      <div className="portfolio-metric-tile"><span>计划执行率</span><strong>{reviewStats.adherenceRate}%</strong><small>是否按原计划操作</small></div>
                      <div className="portfolio-metric-tile"><span>正收益样本</span><strong>{reviewStats.positiveRate}%</strong><small>仅统计已复盘交易</small></div>
                      <div className="portfolio-metric-tile"><span>常用模式</span><strong>{reviewStats.topSetup}</strong><small>平均执行评分 {reviewStats.averageRating.toFixed(1)}</small></div>
                    </div>
                    <div className="portfolio-toolbar-copy">
                      <strong>当前规律判断</strong>
                      <span>{reviewPatternSummary}</span>
                    </div>

                    <section className="discipline-panel">
                      <div className="portfolio-toolbar-copy">
                        <strong>交易纪律如何形成</strong>
                        <span>每笔交易先标记模式，盘后复盘实际执行；同一模式至少 3 笔样本后，再沉淀成固定纪律。</span>
                      </div>
                      <div className="discipline-steps">
                        <div><strong>1</strong><span>交易前写模式和计划</span></div>
                        <div><strong>2</strong><span>交易后复盘偏差</span></div>
                        <div><strong>3</strong><span>统计胜率与执行率</span></div>
                        <div><strong>4</strong><span>沉淀入场、退出、仓位和禁做项</span></div>
                      </div>

                      <form className="discipline-form" onSubmit={handleDisciplineSubmit}>
                        <div className="holding-form-grid">
                          <label className="holding-form-field">
                            <span>模式名称</span>
                            <input className="real-input" name="name" value={disciplineForm.name} onChange={handleDisciplineFormChange} placeholder="如 主线龙头回踩" />
                          </label>
                          <label className="holding-form-field holding-form-field-wide">
                            <span>入场条件</span>
                            <textarea className="real-textarea compact-textarea" name="entryRule" value={disciplineForm.entryRule} onChange={handleDisciplineFormChange} placeholder="什么情况下允许买入" />
                          </label>
                          <label className="holding-form-field holding-form-field-wide">
                            <span>退出条件</span>
                            <textarea className="real-textarea compact-textarea" name="exitRule" value={disciplineForm.exitRule} onChange={handleDisciplineFormChange} placeholder="什么情况下必须卖出或减仓" />
                          </label>
                          <label className="holding-form-field">
                            <span>仓位规则</span>
                            <input className="real-input" name="positionRule" value={disciplineForm.positionRule} onChange={handleDisciplineFormChange} placeholder="如 单票不超过2成" />
                          </label>
                          <label className="holding-form-field">
                            <span>禁做项</span>
                            <input className="real-input" name="forbiddenRule" value={disciplineForm.forbiddenRule} onChange={handleDisciplineFormChange} placeholder="如 不追后排二次冲高" />
                          </label>
                        </div>
                        <div className="holding-editor-actions">
                          {disciplineFormError && <p className="form-error">{disciplineFormError}</p>}
                          <button type="submit" className="action-btn">保存纪律</button>
                        </div>
                      </form>

                      <div className="discipline-rule-list">
                        {disciplineRules.map((rule) => (
                          <article className="discipline-rule" key={rule.id}>
                            <div>
                              <strong>{rule.name}</strong>
                              <p><span>入场：</span>{rule.entryRule}</p>
                              <p><span>退出：</span>{rule.exitRule}</p>
                              <p><span>仓位：</span>{rule.positionRule}</p>
                              <p><span>禁做：</span>{rule.forbiddenRule}</p>
                            </div>
                            <button type="button" className="inline-action-btn danger" onClick={() => handleDeleteDisciplineRule(rule.id)}>
                              删除
                            </button>
                          </article>
                        ))}
                        {disciplineRules.length === 0 && (
                          <div className="discipline-empty">还没有固定纪律。先从一条最常犯错或最常盈利的模式开始记录。</div>
                        )}
                      </div>
                    </section>

                    {!selectedReviewTrade ? (
                      <div className="trade-list">
                        {activeTradeRecords.map((trade) => (
                          <button type="button" className="trade-item" key={trade.id} onClick={() => openTradeReview(trade)}>
                            <div>
                              <strong>{trade.name} · {trade.setup || "未标记模式"}</strong>
                              <p>{trade.date} · {trade.action === "buy" ? "买入" : "卖出"} · {trade.review ? "已复盘" : "待复盘"}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <form className="holding-editor" onSubmit={handleReviewSubmit}>
                        <div className="holding-editor-head">
                          <div>
                            <strong>{selectedReviewTrade.name} · {selectedReviewTrade.setup || "未标记模式"}</strong>
                            <span>{selectedReviewTrade.date} · 成交价 {currency(selectedReviewTrade.price)}</span>
                          </div>
                          <button type="button" className="ghost-btn" onClick={() => setSelectedReviewTradeId(null)}>返回列表</button>
                        </div>
                        <div className="holding-form-grid">
                          <label className="holding-form-field holding-form-field-wide"><span>当时市场环境</span><textarea className="real-textarea compact-textarea" name="marketContext" value={reviewForm.marketContext} onChange={handleReviewFormChange} /></label>
                          <label className="holding-form-field holding-form-field-wide"><span>原交易计划</span><textarea className="real-textarea compact-textarea" name="plan" value={reviewForm.plan} onChange={handleReviewFormChange} /></label>
                          <label className="holding-form-field holding-form-field-wide"><span>实际执行</span><textarea className="real-textarea compact-textarea" name="execution" value={reviewForm.execution} onChange={handleReviewFormChange} /></label>
                          <label className="holding-form-field"><span>交易情绪</span><select className="real-input" name="emotion" value={reviewForm.emotion} onChange={handleReviewFormChange}>{["冷静", "犹豫", "冲动", "恐惧", "贪婪"].map((emotion) => <option key={emotion}>{emotion}</option>)}</select></label>
                          <label className="holding-form-field"><span>结果收益率 %</span><input className="real-input" type="number" step="0.01" name="outcomePercent" value={reviewForm.outcomePercent} onChange={handleReviewFormChange} /></label>
                          <label className="holding-form-field"><span>执行评分 1-5</span><input className="real-input" type="number" min="1" max="5" name="rating" value={reviewForm.rating} onChange={handleReviewFormChange} /></label>
                          <label className="holding-form-field"><span>按计划执行</span><input type="checkbox" name="followedPlan" checked={reviewForm.followedPlan} onChange={handleReviewFormChange} /></label>
                          <label className="holding-form-field holding-form-field-wide"><span>主要错误</span><textarea className="real-textarea compact-textarea" name="mistake" value={reviewForm.mistake} onChange={handleReviewFormChange} /></label>
                          <label className="holding-form-field holding-form-field-wide"><span>可复用经验</span><textarea className="real-textarea compact-textarea" name="lesson" value={reviewForm.lesson} onChange={handleReviewFormChange} /></label>
                        </div>
                        <div className="holding-editor-actions">
                          {reviewFormError && <p className="form-error">{reviewFormError}</p>}
                          <button type="submit" className="action-btn">保存复盘</button>
                        </div>
                      </form>
                    )}
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
                          <div className="holding-discipline-grid">
                            <div>
                              <span>持仓状态</span>
                              <strong>{item.holdingState}</strong>
                            </div>
                            <div>
                              <span>主线关系</span>
                              <strong>{item.themeRelation}</strong>
                            </div>
                            <div>
                              <span>纪律动作</span>
                              <strong>{item.disciplineAction}</strong>
                            </div>
                            <div>
                              <span>风险位置</span>
                              <strong>{item.riskPosition}</strong>
                            </div>
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
                          <p>
                            <strong>复盘验证：</strong>
                            {item.reviewCheck}
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
