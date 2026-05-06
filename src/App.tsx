import { ChangeEvent, DragEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  dataSources,
  fundFlowBoards,
  holdings,
  marketBreadth,
  marketEvents,
  riskSignals,
  sectorBoards,
  thesisRecords,
  tradeRecords
} from "./data/mock";
import { fetchLiveLimitUpPool } from "./services/limitUpPool";
import { fetchLiveMarketIndices } from "./services/marketIndices";
import { Holding, LimitUpStock, MarketIndex } from "./types";

type NavKey =
  | "home"
  | "portfolio"
  | "ai"
  | "policy"
  | "funds"
  | "hk"
  | "us";

type AiTabKey = "multimodal" | "strategy";
type MarketTabKey = "limitup" | "heat" | "turnover" | "boards";
type InsightTabKey = "sectors" | "funds" | "ai";
type PortfolioTabKey = "holdings" | "trades";
type HomeSubpageKey = "overview" | "events";
type PolicyMaterial = {
  name: string;
  kind: string;
};

type UploadAsset = {
  name: string;
  kind: string;
  source: "file" | "link";
};

function FieldValue({
  label,
  value,
  className = ""
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <span className={`field-pair ${className}`.trim()}>
      <small className="field-label">{label}</small>
      <span className="field-value">{value}</span>
    </span>
  );
}

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

function percent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatCompactDate(value: number) {
  const text = `${value}`;

  if (text.length !== 8) {
    return text;
  }

  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
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
  linkValue: string,
  noteValue: string,
  runCount: number
) {
  const focus = noteValue.trim() || "市场主线与潜在催化";
  const sourceText =
    assets.length > 0
      ? `已导入 ${assets.length} 份材料，重点围绕 ${assets.map((asset) => asset.kind).join("、")}`
      : "当前以链接与文字补充为主";
  const linkText = linkValue.trim() || "未填写外部链接";
  const stageText = runCount > 0 ? "已完成一轮初步解读" : "等待开始分析";

  return {
    traits: `${stageText}。${sourceText}，AI 当前识别的核心关注点是“${focus}”，并把材料聚焦到政策信号、产业景气和情绪驱动三个层面。`,
    analysis: `从内容结构看，链接来源为 ${linkText}。若材料来自视频或截图，AI 会更偏重识别表述语气、重复关键词和可能被市场放大的片段，再结合你的补充说明做二次归因。`,
    strategy: `策略上建议先把材料拆成“直接受益”“间接受益”“情绪映射”三类，再优先跟踪最容易形成资金共识的行业龙头与弹性标的。对于尚未证实的结论，宜放入观察清单而不是直接重仓。`,
    risk: `风险主要在信息截取不完整、视频观点带宣传色彩、文章立场先行以及截图缺少上下文。若单一材料无法和官方数据、公告或行业事实交叉验证，应降低置信度。`
  };
}

export default function App() {
  const [activeNav, setActiveNav] = useState<NavKey>("home");
  const [activeHomeSubpage, setActiveHomeSubpage] = useState<HomeSubpageKey>("overview");
  const [activeAiTab, setActiveAiTab] = useState<AiTabKey>("multimodal");
  const [activeMarketTab, setActiveMarketTab] = useState<MarketTabKey>("limitup");
  const [activeInsightTab, setActiveInsightTab] = useState<InsightTabKey>("sectors");
  const [activePortfolioTab, setActivePortfolioTab] = useState<PortfolioTabKey>("holdings");
  const [aiLinkInput, setAiLinkInput] = useState("");
  const [aiNoteInput, setAiNoteInput] = useState("重点判断材料里的产业催化是否能转化为真实投资主线。");
  const [uploadAssets, setUploadAssets] = useState<UploadAsset[]>([
    { name: "路演纪要截图.png", kind: "图片", source: "file" },
    { name: "政策解读视频链接", kind: "视频链接", source: "link" }
  ]);
  const [analysisRuns, setAnalysisRuns] = useState(1);
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
  const [selectedLimitUpBoard, setSelectedLimitUpBoard] = useState<string | null>(null);
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

  const visibleLimitUpStocks = selectedLimitUpBoardData?.stocks ?? limitUpStocks;

  const currentNav = navItems.find((item) => item.key === activeNav) ?? navItems[0];
  const homeHeadline = marketEvents[0];
  const investedRatio = Math.round((marketValue / (marketValue + 185000)) * 100);
  const dailyPnl = portfolio.reduce(
    (sum, item) => sum + item.shares * item.price * (item.dailyChange / 100),
    0
  );
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
  const multimodalOutput = useMemo(
    () => buildMultimodalOutput(uploadAssets, aiLinkInput, aiNoteInput, analysisRuns),
    [uploadAssets, aiLinkInput, aiNoteInput, analysisRuns]
  );

  useEffect(() => {
    if (!selectedLimitUpBoard) {
      return;
    }

    const boardExists = limitUpBoards.some((board) => board.name === selectedLimitUpBoard);
    if (!boardExists) {
      setSelectedLimitUpBoard(null);
    }
  }, [limitUpBoards, selectedLimitUpBoard]);

  function mergeAssets(nextAssets: UploadAsset[]) {
    setUploadAssets((current) => [...current, ...nextAssets]);
  }

  function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    mergeAssets(
      files.map((file) => ({
        name: file.name,
        kind: file.type.startsWith("image/")
          ? "图片"
          : file.type.startsWith("video/")
            ? "视频"
            : "文件",
        source: "file" as const
      }))
    );
    event.target.value = "";
  }

  function handleUploadDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length === 0) {
      return;
    }

    mergeAssets(
      files.map((file) => ({
        name: file.name,
        kind: file.type.startsWith("image/")
          ? "图片"
          : file.type.startsWith("video/")
            ? "视频"
            : "文件",
        source: "file" as const
      }))
    );
  }

  function handleAddLinkAsset() {
    const trimmedLink = aiLinkInput.trim();
    if (!trimmedLink) {
      return;
    }

    setUploadAssets((current) => [
      ...current,
      {
        name: trimmedLink,
        kind: trimmedLink.includes("video") || trimmedLink.includes("bilibili") ? "视频链接" : "文章链接",
        source: "link"
      }
    ]);
  }

  function handleAnalyze() {
    setAnalysisRuns((count) => count + 1);
  }

  function handleNavChange(nextNav: NavKey) {
    setActiveNav(nextNav);
    if (nextNav !== "home") {
      setActiveHomeSubpage("overview");
    }
  }

  const topbarTitle =
    activeNav === "home" && activeHomeSubpage === "events" ? "事件与快讯" : currentNav.label;
  const topbarDescription =
    activeNav === "home" && activeHomeSubpage === "events"
      ? "当天热点、快讯与情绪扰动列表"
      : currentNav.description;

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
                    onClick={() => setActiveHomeSubpage("events")}
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
                  <button
                    type="button"
                    className={`subnav-btn ${activeMarketTab === "boards" ? "active" : ""}`}
                    onClick={() => setActiveMarketTab("boards")}
                  >
                    板块
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
                    <div className="limitup-board-panel">
                      <div className="limitup-board-panel-head">
                        <div>
                          <span className="section-kicker">Board View</span>
                          <h3>{selectedLimitUpBoardData ? selectedLimitUpBoardData.name : "当日板块"}</h3>
                        </div>
                        {selectedLimitUpBoardData ? (
                          <button
                            type="button"
                            className="secondary limitup-back-btn"
                            onClick={() => setSelectedLimitUpBoard(null)}
                          >
                            返回全部板块
                          </button>
                        ) : (
                          <span className="topbar-note">
                            点击任意板块查看该方向的涨停股票列表
                          </span>
                        )}
                      </div>

                      {!selectedLimitUpBoardData && (
                        <div className="limitup-board-grid">
                          {limitUpBoards.map((board) => (
                            <button
                              key={board.name}
                              type="button"
                              className="limitup-board-card"
                              onClick={() => setSelectedLimitUpBoard(board.name)}
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
                      )}

                      {selectedLimitUpBoardData && (
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
                      )}
                    </div>
                    <div className="table-scroll">
                      <div className="limitup-head">
                        <span>股票</span>
                        <span>价格</span>
                        <span>涨停次数</span>
                        <span>首次涨停</span>
                        <span>开板次数</span>
                        <span>封单额</span>
                        <span>封单强度</span>
                        <span>分类</span>
                        <span>涨停原因</span>
                      </div>
                      {visibleLimitUpStocks.map((stock) => (
                        <div className="limitup-row" key={stock.code}>
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
                          <FieldValue
                            label="分类"
                            value={
                              <span className={stock.ladderType === "连板" ? "up" : "watch"}>
                                {stock.ladderType}
                              </span>
                            }
                          />
                          <FieldValue label="涨停原因" value={stock.reason} />
                        </div>
                      ))}
                      {!limitUpLoading && visibleLimitUpStocks.length === 0 && (
                        <div className="limitup-row">
                          <strong>{selectedLimitUpBoardData ? "该板块暂无涨停股" : "暂无涨停池数据"}</strong>
                          <span className="topbar-note">
                            {selectedLimitUpBoardData
                              ? "当前板块筛选下没有可展示的记录。"
                              : "当前没有可展示的真实涨停池记录，可能是非交易时段或数据源暂时不可用。"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeMarketTab === "boards" && (
                  <div className="embedded-insight">
                    <div className="subnav-row market-subnav insight-subnav">
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
                          <div className="board-item board-item-rich" key={board.id}>
                            <div className="board-main">
                              <div className="board-summary-row">
                                <div className="board-title-group">
                                  <div className="board-title-row">
                                    <strong>{board.name}</strong>
                                    <span
                                      className={
                                        board.change >= 0 ? "up board-change" : "down board-change"
                                      }
                                    >
                                      {percent(board.change)}
                                    </span>
                                  </div>
                                  <div className="board-leader-inline">
                                    <span>板块龙头</span>
                                    <strong>{board.leader}</strong>
                                  </div>
                                </div>
                              </div>
                              <div className="sector-stock-list">
                                {board.stocks.map((stock) => (
                                  <div
                                    className="sector-stock-card"
                                    key={`${board.id}-${stock.role}-${stock.code}`}
                                  >
                                    <div className="sector-stock-head">
                                      <span className="sector-stock-role">{stock.role}</span>
                                      <div>
                                        <strong>{stock.name}</strong>
                                        <small>{stock.code}</small>
                                      </div>
                                    </div>
                                    <div className="sector-stock-tags">
                                      {stock.otherIndustries.map((industry) => (
                                        <span className="tag" key={`${stock.code}-${industry}`}>
                                          {industry}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
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
                  </div>
                )}
              </article>
            </section>

            <section className="dashboard-grid">
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
                  onClick={() => setActiveHomeSubpage("overview")}
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

        {activeNav === "portfolio" && (
          <section className="portfolio-view">
            <section className="overview-grid">
              <article className="card full-span portfolio-overview-card">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Portfolio Overview</p>
                    <h2>持仓总览</h2>
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
                    <strong>{investedRatio}%</strong>
                    <small>现金估算 {currency(185000)}</small>
                  </div>
                  <div className="portfolio-metric-tile">
                    <span>纪律执行</span>
                    <strong className="up">3 / 4</strong>
                    <small>目标价与止损覆盖 100%</small>
                  </div>
                </div>
              </article>
            </section>

            <section className="dashboard-grid">
              <article className="card full-span">
                <div className="card-head">
                  <div>
                    <p className="section-kicker">Portfolio Book</p>
                    <h2>持仓与交易</h2>
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
                  <div className="table-scroll">
                    <div className="position-table">
                      <div className="table-head">
                        <span>股票</span>
                        <span>持仓股数</span>
                        <span>成本价</span>
                        <span>现价</span>
                        <span>总盈亏</span>
                        <span>收益率</span>
                        <span>纪律</span>
                        <span>买入逻辑</span>
                      </div>
                      {portfolio.map((item) => {
                        const currentValue = item.shares * item.price;
                        const currentCost = item.shares * item.cost;
                        const totalPnl = currentValue - currentCost;
                        const returnRate = (totalPnl / currentCost) * 100;
                        const thesis = thesisRecords.find((record) => record.code === item.code);

                        return (
                          <div className="table-row wide-table-row" key={item.code}>
                            <FieldValue
                              label="股票"
                              value={
                                <>
                              <strong>{item.name}</strong>
                              <small>{item.code}</small>
                                </>
                              }
                            />
                            <FieldValue label="持仓股数" value={item.shares} />
                            <FieldValue label="成本价" value={currency(item.cost)} />
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
                              value={`目标 ${item.targetPrice} / 止损 ${item.stopLoss}`}
                            />
                            <FieldValue
                              label="买入逻辑"
                              className="inline-thesis-cell"
                              value={thesis?.reason ?? item.thesis}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activePortfolioTab === "trades" && (
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
                )}
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
                  <section className="multimodal-layout">
                    <div className="upload-panel">
                      <div
                        className="upload-dropzone"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={handleUploadDrop}
                      >
                        <strong>上传视频 / 图片 / 文件</strong>
                        <p>支持视频、截图、研报 PDF、会议纪要、政策文件、财报和各类文档。</p>
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
                          <span className="upload-hint">也可以直接拖拽文件到这里</span>
                        </div>
                      </div>

                      <div className="upload-inline-grid">
                        <div className="upload-input-card">
                          <strong>视频地址 / 文章地址</strong>
                          <input
                            className="real-input"
                            value={aiLinkInput}
                            onChange={(event) => setAiLinkInput(event.target.value)}
                            placeholder="粘贴视频链接、文章链接、网页地址"
                          />
                        </div>
                        <div className="upload-input-card">
                          <strong>截图补充说明</strong>
                          <textarea
                            className="real-textarea compact-textarea"
                            value={aiNoteInput}
                            onChange={(event) => setAiNoteInput(event.target.value)}
                            placeholder="补充截图来源、时间、上下文和你的关注点"
                          />
                        </div>
                      </div>

                      <div className="upload-toolbar">
                        <button type="button" className="secondary action-btn" onClick={handleAddLinkAsset}>
                          添加链接到材料列表
                        </button>
                        <button type="button" className="action-btn" onClick={handleAnalyze}>
                          开始分析
                        </button>
                      </div>

                      <div className="material-list-card">
                        <div className="card-head compact-head">
                          <div>
                            <p className="section-kicker">Assets</p>
                            <h2>已导入文件列表</h2>
                          </div>
                        </div>
                        <div className="material-list">
                          {uploadAssets.map((asset, index) => (
                            <div className="material-item" key={`${asset.name}-${index}`}>
                              <strong>{asset.name}</strong>
                              <span>
                                {asset.kind} · {asset.source === "file" ? "本地文件" : "外部链接"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="generated-grid">
                      <div className="placeholder-card">
                        <strong>AI 识别特点</strong>
                        <p>{multimodalOutput.traits}</p>
                      </div>
                      <div className="placeholder-card">
                        <strong>AI 深度分析</strong>
                        <p>{multimodalOutput.analysis}</p>
                      </div>
                      <div className="placeholder-card">
                        <strong>投资策略</strong>
                        <p>{multimodalOutput.strategy}</p>
                      </div>
                      <div className="placeholder-card">
                        <strong>风险与偏差提醒</strong>
                        <p>{multimodalOutput.risk}</p>
                      </div>
                    </div>
                  </section>
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
    </main>
  );
}
