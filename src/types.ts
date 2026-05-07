export type SourceStatus = "connected" | "planned" | "restricted";

export interface DataSource {
  id: string;
  name: string;
  channel: string;
  status: SourceStatus;
  coverage: string;
  notes: string;
}

export interface Holding {
  code: string;
  name: string;
  shares: number;
  cost: number;
  price: number;
  dailyChange: number;
  thesis: string;
  tags: string[];
  targetPrice?: number;
  stopLoss?: number;
  weight?: number;
}

export interface Signal {
  title: string;
  level: "high" | "medium" | "low";
  detail: string;
}

export interface MarketEvent {
  time: string;
  source: string;
  title: string;
  impact: "bullish" | "neutral" | "bearish";
}

export interface MarketIndex {
  code?: string;
  name: string;
  value: number;
  change: number;
}

export interface MarketBreadth {
  heat: number;
  turnover: string;
  turnoverDelta: string;
  limitUp: number;
  openBoard: number;
  sealRate: number;
  yesterdayLimitUpReturn: number;
  highOpenRate: number;
  profitRate: number;
}

export interface SectorBoard {
  id: string;
  name: string;
  change: number;
  leader: string;
  note: string;
  stocks: {
    role: "龙头" | "龙一" | "龙二" | "龙三";
    name: string;
    code: string;
    otherIndustries: string[];
  }[];
}

export interface FundFlowBoard {
  name: string;
  inflow: string;
  strength: "strong" | "watch" | "weak";
  note: string;
}

export interface LimitUpStock {
  code: string;
  name: string;
  price: number;
  limitUpCount: number;
  consecutiveBoardCount: number;
  openBoardCount: number;
  sealAmount: string;
  firstLimitUpTime: string;
  sealStrength: string;
  ladderType: "首板" | "连板";
  reason: string;
  industry: string;
}

export interface StockTrendPoint {
  timestamp: string;
  price: number;
  averagePrice: number;
  volume: number;
  amount: number;
}

export interface StockDetail {
  code: string;
  name: string;
  market: "SH" | "SZ";
  industry: string;
  price: number;
  changeAmount: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  averagePrice: number;
  volume: number;
  amount: number;
  volumeRatio: number;
  turnoverRate: number;
  amplitude: number;
  upLimit: number;
  downLimit: number;
  totalShares: number;
  floatShares: number;
  totalMarketCap: number;
  floatMarketCap: number;
  peTtm: number | null;
  pb: number | null;
}

export interface TradeRecord {
  id: string;
  date: string;
  action: "buy" | "sell";
  code: string;
  name: string;
  price: number;
  shares: number;
  note: string;
}

export interface PortfolioProfile {
  id: string;
  label: string;
  description: string;
  cashEstimate: number;
  holdings: Holding[];
  trades: TradeRecord[];
}

export interface ThesisRecord {
  code: string;
  title: string;
  reason: string;
  trigger: string;
  exitRule: string;
}
