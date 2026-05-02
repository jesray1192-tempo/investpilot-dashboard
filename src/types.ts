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
