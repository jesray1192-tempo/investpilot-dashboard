import {
  DataSource,
  FundFlowBoard,
  Holding,
  LimitUpStock,
  MarketBreadth,
  MarketEvent,
  MarketIndex,
  SectorBoard,
  Signal
} from "../types";

export const marketIndices: MarketIndex[] = [
  { name: "上证指数", value: 3112.48, change: 0.38 },
  { name: "深证成指", value: 9574.22, change: -0.21 },
  { name: "创业板指", value: 1842.17, change: -0.46 },
  { name: "沪深300", value: 3611.53, change: 0.14 },
  { name: "中证500", value: 5291.86, change: 0.62 }
];

export const marketBreadth: MarketBreadth = {
  heat: 48,
  turnover: "8742亿",
  turnoverDelta: "+516亿",
  limitUp: 79,
  openBoard: 14,
  sealRate: 85,
  yesterdayLimitUpReturn: 2.81,
  highOpenRate: 81,
  profitRate: 61
};

export const sectorBoards: SectorBoard[] = [
  {
    name: "低空经济",
    change: 4.82,
    leader: "万丰奥威",
    note: "政策预期强化，核心票维持强趋势。"
  },
  {
    name: "机器人",
    change: 3.94,
    leader: "鸣志电器",
    note: "早盘资金回流，减速器与执行器方向最强。"
  },
  {
    name: "铜缆高速连接",
    change: 2.76,
    leader: "沃尔核材",
    note: "算力链分支活跃，容量票承接较好。"
  },
  {
    name: "创新药",
    change: -1.24,
    leader: "百利天恒",
    note: "高位震荡，板块内部开始分化。"
  }
];

export const fundFlowBoards: FundFlowBoard[] = [
  {
    name: "证券",
    inflow: "+18.6亿",
    strength: "strong",
    note: "指数稳盘方向，权重资金明显回流。"
  },
  {
    name: "汽车零部件",
    inflow: "+12.3亿",
    strength: "strong",
    note: "趋势加速，机构与游资共振。"
  },
  {
    name: "光伏设备",
    inflow: "-6.8亿",
    strength: "weak",
    note: "高开低走，短线兑现压力偏大。"
  },
  {
    name: "消费电子",
    inflow: "+4.1亿",
    strength: "watch",
    note: "修复中继，持续性仍需观察。"
  }
];

export const limitUpStocks: LimitUpStock[] = [
  {
    code: "002085",
    name: "万丰奥威",
    price: 17.62,
    limitUpCount: 2,
    openBoardCount: 1,
    sealAmount: "3.8亿",
    ladderType: "连板",
    reason: "低空经济与飞行汽车概念持续发酵",
    industry: "汽车零部件"
  },
  {
    code: "603728",
    name: "鸣志电器",
    price: 58.41,
    limitUpCount: 1,
    openBoardCount: 0,
    sealAmount: "1.6亿",
    ladderType: "首板",
    reason: "机器人执行器方向资金回流",
    industry: "自动化设备"
  },
  {
    code: "002130",
    name: "沃尔核材",
    price: 22.36,
    limitUpCount: 1,
    openBoardCount: 2,
    sealAmount: "2.1亿",
    ladderType: "首板",
    reason: "铜缆高速连接题材活跃",
    industry: "通信设备"
  },
  {
    code: "601127",
    name: "赛力斯",
    price: 97.15,
    limitUpCount: 3,
    openBoardCount: 0,
    sealAmount: "5.2亿",
    ladderType: "连板",
    reason: "智能汽车主线强化，龙头情绪溢价明显",
    industry: "乘用车"
  }
];

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
    tags: ["消费", "高股息", "核心仓位"],
    targetPrice: 1850,
    stopLoss: 1600,
    weight: 36
  },
  {
    code: "300750",
    name: "宁德时代",
    shares: 400,
    cost: 198.4,
    price: 186.2,
    dailyChange: -2.84,
    thesis: "新能源链核心资产，但波动高，需要跟踪产能利用率和海外订单。",
    tags: ["新能源", "成长", "高波动"],
    targetPrice: 220,
    stopLoss: 176,
    weight: 22
  },
  {
    code: "601899",
    name: "紫金矿业",
    shares: 1800,
    cost: 15.2,
    price: 17.08,
    dailyChange: 0.76,
    thesis: "铜金周期共振，受商品价格和海外项目进度驱动。",
    tags: ["资源", "周期", "卫星仓位"],
    targetPrice: 18.6,
    stopLoss: 14.2,
    weight: 18
  }
];

export const tradeRecords = [
  {
    id: "tr-001",
    date: "2026-04-28",
    action: "buy",
    code: "601899",
    name: "紫金矿业",
    price: 16.38,
    shares: 800,
    note: "加仓商品主线，博弈铜价趋势延续。"
  },
  {
    id: "tr-002",
    date: "2026-04-25",
    action: "buy",
    code: "600519",
    name: "贵州茅台",
    price: 1692,
    shares: 40,
    note: "年报后估值回落，补核心仓。"
  },
  {
    id: "tr-003",
    date: "2026-04-19",
    action: "sell",
    code: "300750",
    name: "宁德时代",
    price: 201.5,
    shares: 100,
    note: "减仓控制波动敞口。"
  }
];

export const thesisRecords = [
  {
    code: "600519",
    title: "防御核心仓",
    reason: "消费龙头现金流稳定，适合作为组合净值稳定器。",
    trigger: "白酒板块估值回落且北向资金重新流入时继续关注。",
    exitRule: "若高端消费数据连续走弱或跌破 1600，降低仓位。"
  },
  {
    code: "300750",
    title: "成长弹性仓",
    reason: "新能源链核心资产，适合用来承接赛道反弹和机构回流。",
    trigger: "关注海外订单、储能出货和产能利用率改善。",
    exitRule: "若跌破 176 或基本面预期继续下修，进一步减仓。"
  },
  {
    code: "601899",
    title: "资源顺周期仓",
    reason: "铜金价格共振，兼具资源防御和弹性。",
    trigger: "铜价维持强势、海外项目推进顺利时保持持有。",
    exitRule: "若商品价格转弱并失守 14.2，切回观察仓位。"
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
