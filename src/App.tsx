import { useMemo, useState } from "react";
import {
  dataSources,
  fundFlowBoards,
  holdings,
  marketBreadth,
  marketEvents,
  marketIndices,
  riskSignals,
  sectorBoards
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
              <article className="card metric-card heat-card">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Heat</p>
                    <h2>市场热度</h2>
                  </div>
                </div>
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
              </article>

              <article className="card metric-card">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Turnover</p>
                    <h2>成交额</h2>
                  </div>
                </div>
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
              </article>

              <article className="card metric-card">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Seal Rate</p>
                    <h2>封板率</h2>
                  </div>
                </div>
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
              </article>

              <article className="card metric-card">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Yesterday Winners</p>
                    <h2>昨涨停今表现</h2>
                  </div>
                </div>
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
              </article>
            </section>

            <section className="dashboard-grid">
              <article className="card wide">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Sectors</p>
                    <h2>当日板块</h2>
                  </div>
                </div>
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
              </article>

              <article className="card">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">AI</p>
                    <h2>盘面结论</h2>
                  </div>
                </div>
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
              </article>

              <article className="card wide">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Fund Flow</p>
                    <h2>资金板块</h2>
                  </div>
                </div>
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
              </article>

              <article className="card wide">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Portfolio</p>
                    <h2>我的持仓</h2>
                  </div>
                  <div className={`pill ${pnl >= 0 ? "positive" : "negative"}`}>
                    浮动盈亏 {currency(pnl)}
                  </div>
                </div>
                <div className="holdings-list">
                  {portfolio.map((item) => {
                    const value = item.shares * item.price;
                    const cost = item.shares * item.cost;
                    const itemPnl = value - cost;

                    return (
                      <div className="holding-row" key={item.code}>
                        <div>
                          <strong>
                            {item.name} <span>{item.code}</span>
                          </strong>
                          <p>{item.thesis}</p>
                          <div className="tag-row">
                            {item.tags.map((tag) => (
                              <span className="tag" key={tag}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="holding-metrics">
                          <span>仓位市值 {currency(value)}</span>
                          <span>持仓成本 {currency(cost)}</span>
                          <span>现价 {currency(item.price)}</span>
                          <span className={item.dailyChange >= 0 ? "up" : "down"}>
                            日内 {percent(item.dailyChange)}
                          </span>
                          <span className={itemPnl >= 0 ? "up" : "down"}>
                            总盈亏 {currency(itemPnl)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>

              <article className="card">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Signals</p>
                    <h2>AI 风险雷达</h2>
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

              <article className="card">
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
          <PlaceholderSection
            title="我的持仓"
            summary="这里会独立展示你的股票持仓、盈亏曲线、交易记录、关注理由和仓位变动。"
            bullets={["持仓总览", "交易记录", "仓位分析", "个股观察"]}
          />
        )}

        {activeNav === "ai" && (
          <PlaceholderSection
            title="AI分析"
            summary="这里会聚合盘前计划、盘中异动解释、仓位诊断、个股打分和复盘结论。"
            bullets={["盘前策略", "盘中解读", "个股评分", "盘后复盘"]}
          />
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
