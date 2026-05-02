import { useMemo, useState } from "react";
import {
  dataSources,
  fundFlowBoards,
  holdings,
  marketBreadth,
  marketEvents,
  marketIndices,
  riskSignals,
  sectorBoards,
  thesisRecords,
  tradeRecords
} from "./data/mock";
import { Holding } from "./types";

type NavKey =
  | "home"
  | "portfolio"
  | "ai"
  | "policy"
  | "funds"
  | "hk"
  | "us";

type AiTabKey = "multimodal" | "strategy";
type MarketTabKey = "heat" | "turnover" | "seal" | "winners";
type InsightTabKey = "sectors" | "funds" | "ai";

interface NavItem {
  key: NavKey;
  label: string;
  icon: string;
  description: string;
}

const navItems: NavItem[] = [
  { key: "home", label: "首页", icon: "◎", description: "指数、板块与市场行情" },
  { key: "portfolio", label: "我的持仓", icon: "▣", description: "股票仓位与盈亏跟踪" },
  { key: "ai", label: "AI分析", icon: "✦", description: "策略诊断与风控建议" },
  { key: "policy", label: "政策分析", icon: "◫", description: "政策、行业与主题催化" },
  { key: "funds", label: "基金", icon: "◉", description: "基金池、回撤与风格暴露" },
  { key: "hk", label: "港股", icon: "△", description: "港股通、恒指与主题股" },
  { key: "us", label: "美股", icon: "◇", description: "纳指、标普与中概跟踪" }
];

function currency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2
  }).format(value);
}

function percent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function totalMarketValue(items: Holding[]) {
  return items.reduce((sum, item) => sum + item.shares * item.price, 0);
}

function totalCostValue(items: Holding[]) {
  return items.reduce((sum, item) => sum + item.shares * item.cost, 0);
}

function aiSummary(items: Holding[]) {
  const gainers = items.filter((item) => item.dailyChange > 0).length;
  const losers = items.length - gainers;
  const dominantTheme = items
    .flatMap((item) => item.tags)
    .reduce<Record<string, number>>((acc, tag) => {
      acc[tag] = (acc[tag] ?? 0) + 1;
      return acc;
    }, {});

  const topTheme = Object.entries(dominantTheme).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "均衡";

  if (losers > gainers) {
    return `AI 判断当前组合处于压力区，主要拖累来自高波动板块。当前最显著的组合标签是“${topTheme}”，建议配合仓位纪律处理回撤。`;
  }

  return `AI 判断当前组合仍有韧性，优势来自核心资产和周期配置并存。当前最显著的组合标签是“${topTheme}”，可以继续做结构优化而不是频繁换仓。`;
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

export default function App() {
  const [activeNav, setActiveNav] = useState<NavKey>("home");
  const [activeAiTab, setActiveAiTab] = useState<AiTabKey>("multimodal");
  const [activeMarketTab, setActiveMarketTab] = useState<MarketTabKey>("heat");
  const [activeInsightTab, setActiveInsightTab] = useState<InsightTabKey>("sectors");
  const [portfolio] = useState(holdings);
  const marketValue = useMemo(() => totalMarketValue(portfolio), [portfolio]);
  const costValue = useMemo(() => totalCostValue(portfolio), [portfolio]);
  const pnl = marketValue - costValue;
  const pnlPercent = (pnl / costValue) * 100;

  const bestHolding = useMemo(() => {
    return [...portfolio].sort((a, b) => b.dailyChange - a.dailyChange)[0];
  }, [portfolio]);

  const riskScore = useMemo(() => {
    return Math.round(
      (portfolio.reduce((sum, item) => sum + Math.abs(item.dailyChange), 0) /
        portfolio.length) *
        20
    );
  }, [portfolio]);

  const currentNav = navItems.find((item) => item.key === activeNav) ?? navItems[0];
  const investedRatio = Math.round((marketValue / (marketValue + 185000)) * 100);
  const dailyPnl = portfolio.reduce(
    (sum, item) => sum + item.shares * item.price * (item.dailyChange / 100),
    0
  );

  return (
    <main className="app-shell app-layout">
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
              onClick={() => setActiveNav(item.key)}
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
          <div>
            <p className="section-kicker">Workspace</p>
            <h2>{currentNav.label}</h2>
          </div>
          <div className="topbar-note">{currentNav.description}</div>
        </header>

        {activeNav === "home" && (
          <>
            <section className="home-top-feed">
              <article className="card wide">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Feeds</p>
                    <h2>事件与快讯</h2>
                  </div>
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

            <section className="market-strip card">
              <div className="market-strip-head">
                <p className="section-kicker">Market Pulse</p>
                <h1>今日市场总览</h1>
              </div>
              <div className="index-row">
                {marketIndices.map((index) => (
                  <div className="index-item" key={index.name}>
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
                  <button
                    type="button"
                    className={`subnav-btn ${activeMarketTab === "seal" ? "active" : ""}`}
                    onClick={() => setActiveMarketTab("seal")}
                  >
                    封板率
                  </button>
                  <button
                    type="button"
                    className={`subnav-btn ${activeMarketTab === "winners" ? "active" : ""}`}
                    onClick={() => setActiveMarketTab("winners")}
                  >
                    昨涨停今表现
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

                {activeMarketTab === "seal" && (
                  <>
                    <div className="big-metric up">{marketBreadth.sealRate.toFixed(2)}%</div>
                    <div className="dual-metrics">
                      <div>
                        <span>封板</span>
                        <strong>{marketBreadth.limitUp}</strong>
                      </div>
                      <div>
                        <span>触及开板</span>
                        <strong>{marketBreadth.openBoard}</strong>
                      </div>
                    </div>
                  </>
                )}

                {activeMarketTab === "winners" && (
                  <>
                    <div className="big-metric up">
                      {marketBreadth.yesterdayLimitUpReturn.toFixed(2)}%
                    </div>
                    <div className="dual-metrics">
                      <div>
                        <span>高开率</span>
                        <strong>{marketBreadth.highOpenRate}%</strong>
                      </div>
                      <div>
                        <span>获利率</span>
                        <strong>{marketBreadth.profitRate}%</strong>
                      </div>
                    </div>
                  </>
                )}
              </article>
            </section>

            <section className="dashboard-grid">
              <article className="card wide market-tabs-card">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Insight Deck</p>
                    <h2>板块与 AI 结论</h2>
                  </div>
                </div>
                <div className="subnav-row market-subnav">
                  <button
                    type="button"
                    className={`subnav-btn ${activeInsightTab === "sectors" ? "active" : ""}`}
                    onClick={() => setActiveInsightTab("sectors")}
                  >
                    当日板块
                  </button>
                  <button
                    type="button"
                    className={`subnav-btn ${activeInsightTab === "funds" ? "active" : ""}`}
                    onClick={() => setActiveInsightTab("funds")}
                  >
                    资金板块
                  </button>
                  <button
                    type="button"
                    className={`subnav-btn ${activeInsightTab === "ai" ? "active" : ""}`}
                    onClick={() => setActiveInsightTab("ai")}
                  >
                    AI盘面结论
                  </button>
                </div>

                {activeInsightTab === "sectors" && (
                  <div className="board-list">
                    {sectorBoards.map((board) => (
                      <div className="board-item" key={board.name}>
                        <div>
                          <strong>{board.name}</strong>
                          <p>龙头：{board.leader}</p>
                        </div>
                        <div className="board-side">
                          <span className={board.change >= 0 ? "up" : "down"}>
                            {percent(board.change)}
                          </span>
                          <p>{board.note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeInsightTab === "funds" && (
                  <div className="board-list">
                    {fundFlowBoards.map((board) => (
                      <div className="board-item" key={board.name}>
                        <div>
                          <strong>{board.name}</strong>
                          <p>{board.note}</p>
                        </div>
                        <div className="board-side">
                          <span className={board.strength}>{board.inflow}</span>
                          <p>
                            {board.strength === "strong"
                              ? "主力净流入"
                              : board.strength === "weak"
                                ? "主力净流出"
                                : "观察中"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeInsightTab === "ai" && (
                  <div className="ai-brief">
                    <p>{aiSummary(portfolio)}</p>
                    <div className="hero-grid compact-grid">
                      <div>
                        <strong>{currency(marketValue)}</strong>
                        <span>持仓市值</span>
                      </div>
                      <div>
                        <strong>{percent(pnlPercent)}</strong>
                        <span>累计收益</span>
                      </div>
                      <div>
                        <strong>{bestHolding.name}</strong>
                        <span>今日相对强势</span>
                      </div>
                      <div>
                        <strong>{dataSources.length}</strong>
                        <span>数据源预留</span>
                      </div>
                    </div>
                  </div>
                )}
              </article>

              <article className="card wide">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Connectors</p>
                    <h2>数据接入与后续建设</h2>
                  </div>
                </div>
                <div className="source-list">
                  {dataSources.map((source) => (
                    <div className="source-item" key={source.id}>
                      <div>
                        <strong>{source.name}</strong>
                        <p>{source.channel}</p>
                      </div>
                      <div className="source-meta">
                        <span className={`status ${source.status}`}>{source.status}</span>
                        <span>{source.coverage}</span>
                        <span>{source.notes}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

            </section>
          </>
        )}

        {activeNav === "portfolio" && (
          <section className="portfolio-view">
            <section className="overview-grid">
              <article className="card metric-card">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Portfolio Value</p>
                    <h2>持仓总市值</h2>
                  </div>
                </div>
                <div className="big-metric">{currency(marketValue)}</div>
                <div className="dual-metrics">
                  <div>
                    <span>累计盈亏</span>
                    <strong className={pnl >= 0 ? "up" : "down"}>{currency(pnl)}</strong>
                  </div>
                  <div>
                    <span>累计收益率</span>
                    <strong className={pnlPercent >= 0 ? "up" : "down"}>
                      {percent(pnlPercent)}
                    </strong>
                  </div>
                </div>
              </article>

              <article className="card metric-card">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Daily</p>
                    <h2>当日盈亏</h2>
                  </div>
                </div>
                <div className={`big-metric ${dailyPnl >= 0 ? "up" : "down"}`}>
                  {currency(dailyPnl)}
                </div>
                <div className="dual-metrics">
                  <div>
                    <span>强势个股</span>
                    <strong>{bestHolding.name}</strong>
                  </div>
                  <div>
                    <span>波动风险</span>
                    <strong>{riskScore}/100</strong>
                  </div>
                </div>
              </article>

              <article className="card metric-card">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Allocation</p>
                    <h2>仓位使用率</h2>
                  </div>
                </div>
                <div className="big-metric">{investedRatio}%</div>
                <div className="dual-metrics">
                  <div>
                    <span>现金估算</span>
                    <strong>{currency(185000)}</strong>
                  </div>
                  <div>
                    <span>核心仓占比</span>
                    <strong>58%</strong>
                  </div>
                </div>
              </article>

              <article className="card metric-card">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Discipline</p>
                    <h2>纪律执行</h2>
                  </div>
                </div>
                <div className="big-metric up">3 / 4</div>
                <div className="dual-metrics">
                  <div>
                    <span>目标价覆盖</span>
                    <strong>100%</strong>
                  </div>
                  <div>
                    <span>止损线覆盖</span>
                    <strong>100%</strong>
                  </div>
                </div>
              </article>
            </section>

            <section className="dashboard-grid">
              <article className="card wide">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Holdings</p>
                    <h2>持仓列表</h2>
                  </div>
                </div>
                <div className="position-table">
                  <div className="table-head">
                    <span>股票</span>
                    <span>持仓股数</span>
                    <span>成本价</span>
                    <span>现价</span>
                    <span>总盈亏</span>
                    <span>收益率</span>
                    <span>纪律</span>
                  </div>
                  {portfolio.map((item) => {
                    const currentValue = item.shares * item.price;
                    const currentCost = item.shares * item.cost;
                    const totalPnl = currentValue - currentCost;
                    const returnRate = (totalPnl / currentCost) * 100;

                    return (
                      <div className="table-row" key={item.code}>
                        <span>
                          <strong>{item.name}</strong>
                          <small>{item.code}</small>
                        </span>
                        <span>{item.shares}</span>
                        <span>{currency(item.cost)}</span>
                        <span>{currency(item.price)}</span>
                        <span className={totalPnl >= 0 ? "up" : "down"}>
                          {currency(totalPnl)}
                        </span>
                        <span className={returnRate >= 0 ? "up" : "down"}>
                          {percent(returnRate)}
                        </span>
                        <span>
                          目标 {item.targetPrice} / 止损 {item.stopLoss}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </article>

              <article className="card">
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

              <article className="card wide">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Trades</p>
                    <h2>交易记录</h2>
                  </div>
                </div>
                <div className="trade-list">
                  {tradeRecords.map((trade) => (
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
              </article>

              <article className="card wide">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Thesis</p>
                    <h2>投资逻辑</h2>
                  </div>
                </div>
                <div className="thesis-list">
                  {thesisRecords.map((record) => (
                    <div className="thesis-item" key={record.code}>
                      <div className="thesis-title">
                        <strong>{record.title}</strong>
                        <span>{record.code}</span>
                      </div>
                      <p>
                        <strong>为什么买：</strong>
                        {record.reason}
                      </p>
                      <p>
                        <strong>继续观察：</strong>
                        {record.trigger}
                      </p>
                      <p>
                        <strong>什么情况下卖：</strong>
                        {record.exitRule}
                      </p>
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
                  <p className="section-kicker">AI Analysis</p>
                  <h1>AI分析</h1>
                </div>
              </div>

              <div className="subnav-row">
                <button
                  type="button"
                  className={`subnav-btn ${activeAiTab === "multimodal" ? "active" : ""}`}
                  onClick={() => setActiveAiTab("multimodal")}
                >
                  多模态分析
                </button>
                <button
                  type="button"
                  className={`subnav-btn ${activeAiTab === "strategy" ? "active" : ""}`}
                  onClick={() => setActiveAiTab("strategy")}
                >
                  策略诊断
                </button>
              </div>

              {activeAiTab === "multimodal" && (
                <>
                  <p className="placeholder-summary">
                    这个子页面用于上传视频、图片、研报、会议纪要、公告和截图，让 AI
                    自动识别关键信息，提炼内容特点，并输出可执行的投资策略。
                  </p>
                  <div className="placeholder-grid">
                    <div className="placeholder-card">
                      <strong>上传视频 / 图片 / 文件</strong>
                      <p>支持路演视频、新闻截图、研报 PDF、政策文件和财报材料。</p>
                    </div>
                    <div className="placeholder-card">
                      <strong>自动总结特点</strong>
                      <p>提炼核心观点、产业信号、情绪倾向、估值锚点和市场关注点。</p>
                    </div>
                    <div className="placeholder-card">
                      <strong>输出投资策略</strong>
                      <p>给出受益方向、利空方向、适合关注的标的和仓位建议。</p>
                    </div>
                    <div className="placeholder-card">
                      <strong>风险与偏差提醒</strong>
                      <p>识别资料中的宣传倾向、证据不足点和可能误导的表述。</p>
                    </div>
                  </div>
                </>
              )}

              {activeAiTab === "strategy" && (
                <>
                  <p className="placeholder-summary">
                    这个子页面用于盘前计划、盘中跟踪、仓位诊断、个股打分和盘后复盘。
                  </p>
                  <div className="placeholder-grid">
                    <div className="placeholder-card">
                      <strong>盘前策略</strong>
                      <p>根据指数、板块和资金风格生成当日应对计划。</p>
                    </div>
                    <div className="placeholder-card">
                      <strong>盘中解读</strong>
                      <p>解释异动原因，区分趋势延续、情绪脉冲和资金试盘。</p>
                    </div>
                    <div className="placeholder-card">
                      <strong>个股评分</strong>
                      <p>从基本面、催化、资金、筹码和风险五维打分。</p>
                    </div>
                    <div className="placeholder-card">
                      <strong>复盘结论</strong>
                      <p>沉淀当天得失、验证逻辑，并形成下个交易日观察清单。</p>
                    </div>
                  </div>
                </>
              )}
            </article>
          </section>
        )}

        {activeNav === "policy" && (
          <PlaceholderSection
            title="政策分析"
            summary="这里会追踪宏观政策、行业监管、产业扶持和对市场热点的影响传导。"
            bullets={["宏观政策", "产业扶持", "监管动态", "受益方向"]}
          />
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
    </main>
  );
}
