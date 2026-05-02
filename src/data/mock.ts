import { DataSource, Holding, MarketEvent, Signal } from "../types";

export const dataSources: DataSource[] = [
  {
    id: "ths",
    name: "同花顺",
    channel: "量化接口 / 行情接入",
    status: "connected",
    coverage: "行情、财务、资金、公告",
    notes: "首版建议优先对接正式商业接口，避免依赖网页抓取。"
  },
  {
    id: "eastmoney",
    name: "东方财富",
    channel: "Choice / 数据终端",
    status: "planned",
    coverage: "深度财务、宏观、行业、机构数据",
    notes: "适合作为专业数据补充层，通常需要商业授权。"
  },
  {
    id: "cls",
    name: "财联社",
    channel: "资讯流 / 快讯",
    status: "restricted",
    coverage: "快讯、主题、情绪、热点追踪",
    notes: "首版预留资讯适配器，接入方式需基于官方授权或企业合作。"
  }
];

export const holdings: Holding[] = [
  {
    code: "600519",
    name: "贵州茅台",
    shares: 120,
    cost: 1688,
    price: 1726.5,
    dailyChange: 1.32,
    thesis: "高端白酒龙头，现金流稳定，适合作为组合压舱石。",
    tags: ["消费", "高股息", "核心仓位"]
  },
  {
    code: "300750",
    name: "宁德时代",
    shares: 400,
    cost: 198.4,
    price: 186.2,
    dailyChange: -2.84,
    thesis: "新能源链核心资产，但波动高，需要跟踪产能利用率和海外订单。",
    tags: ["新能源", "成长", "高波动"]
  },
  {
    code: "601899",
    name: "紫金矿业",
    shares: 1800,
    cost: 15.2,
    price: 17.08,
    dailyChange: 0.76,
    thesis: "铜金周期共振，受商品价格和海外项目进度驱动。",
    tags: ["资源", "周期", "卫星仓位"]
  }
];

export const marketEvents: MarketEvent[] = [
  {
    time: "08:57",
    source: "财联社预留接口",
    title: "机器人概念走强，产业链公司盘前热度上升",
    impact: "bullish"
  },
  {
    time: "09:14",
    source: "东方财富数据层",
    title: "北向资金近 3 日持续净流入消费龙头",
    impact: "bullish"
  },
  {
    time: "09:26",
    source: "同花顺实时行情",
    title: "新能源板块分歧扩大，龙头股开盘承压",
    impact: "bearish"
  },
  {
    time: "09:40",
    source: "AI 风险引擎",
    title: "组合 beta 偏高，建议控制成长股总仓位",
    impact: "neutral"
  }
];

export const riskSignals: Signal[] = [
  {
    title: "单一赛道暴露偏高",
    level: "high",
    detail: "新能源相关持仓波动相关性较强，建议增加低相关资产对冲。"
  },
  {
    title: "现金头寸不足",
    level: "medium",
    detail: "若下周出现系统性回撤，现有现金只能覆盖约 1 次常规加仓。"
  },
  {
    title: "防御因子稳定",
    level: "low",
    detail: "消费龙头与资源股对冲了一部分成长波动，组合韧性尚可。"
  }
];
