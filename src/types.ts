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
  name: string;
  change: number;
  leader: string;
  note: string;
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
  reason: string;
  industry: string;
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

export interface ThesisRecord {
  code: string;
  title: string;
  reason: string;
  trigger: string;
  exitRule: string;
}
