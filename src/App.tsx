import { useMemo, useState } from "react";
import { dataSources, holdings, marketEvents, riskSignals } from "./data/mock";
import { Holding } from "./types";

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

export default function App() {
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
      portfolio.reduce((sum, item) => sum + Math.abs(item.dailyChange), 0) /
        portfolio.length *
        20
    );
  }, [portfolio]);

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">InvestPilot / Personal Equity OS</p>
          <h1>把你的持仓、资讯和 AI 判断放进一个投资工作台</h1>
          <p className="hero-text">
            这个首版网站面向个人投资者，核心是统一查看持仓、估值变化、事件流和 AI
            结论，并为财联社、东方财富、同花顺预留正式数据接入层。
          </p>
          <div className="hero-actions">
            <button type="button">接入真实数据</button>
            <button type="button" className="secondary">
              新建策略看板
            </button>
          </div>
        </div>
        <div className="hero-panel">
          <span className="panel-label">AI 今日结论</span>
          <p>{aiSummary(portfolio)}</p>
          <div className="hero-grid">
            <div>
              <strong>{currency(marketValue)}</strong>
              <span>当前总市值</span>
            </div>
            <div>
              <strong>{percent(pnlPercent)}</strong>
              <span>累计收益率</span>
            </div>
            <div>
              <strong>{riskScore}/100</strong>
              <span>波动风险分</span>
            </div>
            <div>
              <strong>{bestHolding.name}</strong>
              <span>今日相对强势</span>
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="card wide">
          <div className="card-head">
            <div>
              <p className="section-kicker">Portfolio</p>
              <h2>个人持仓</h2>
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
              <h2>数据接入层</h2>
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

        <article className="card wide">
          <div className="card-head">
            <div>
              <p className="section-kicker">Roadmap</p>
              <h2>下一步建设</h2>
            </div>
          </div>
          <div className="roadmap">
            <div>
              <strong>1. 账户与持仓层</strong>
              <p>支持录入股票、成交记录、目标价、止损线和投资逻辑。</p>
            </div>
            <div>
              <strong>2. 实时数据层</strong>
              <p>通过正式授权接口同步行情、公告、财务、资金流和新闻快讯。</p>
            </div>
            <div>
              <strong>3. AI 分析层</strong>
              <p>生成仓位诊断、事件归因、策略建议和盘后复盘摘要。</p>
            </div>
            <div>
              <strong>4. 自动化层</strong>
              <p>支持每日早报、风险预警、回撤提醒和个股观察清单。</p>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
