import { dashboardQuotesAreReady, hasShownDecisionConclusion, renderedIndexQuotesMatch } from "../src/services/funnel.ts";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const liveIndices = [
  { name: "上证指数", value: 3862.73, change: -1.82 },
  { name: "深证成指", value: 13298.77, change: -2.34 }
];

assert(
  !dashboardQuotesAreReady({
    activeNav: "home",
    activeHomeSubpage: "overview",
    marketIndicesLoading: true,
    limitUpLoading: false,
    marketIndicesError: "",
    limitUpError: "",
    marketIndices: liveIndices,
    limitUpCount: 10
  }),
  "dashboard_ready must not pass while quotes are still loading"
);

assert(
  !dashboardQuotesAreReady({
    activeNav: "home",
    activeHomeSubpage: "overview",
    marketIndicesLoading: false,
    limitUpLoading: false,
    marketIndicesError: "",
    limitUpError: "",
    marketIndices: [],
    limitUpCount: 10
  }),
  "dashboard_ready must not pass on empty quote state"
);

assert(
  !dashboardQuotesAreReady({
    activeNav: "portfolio",
    activeHomeSubpage: "overview",
    marketIndicesLoading: false,
    limitUpLoading: false,
    marketIndicesError: "",
    limitUpError: "",
    marketIndices: liveIndices,
    limitUpCount: 10
  }),
  "dashboard_ready must not pass when the dashboard is not rendered"
);

assert(
  dashboardQuotesAreReady({
    activeNav: "home",
    activeHomeSubpage: "overview",
    marketIndicesLoading: false,
    limitUpLoading: false,
    marketIndicesError: "",
    limitUpError: "",
    marketIndices: liveIndices,
    limitUpCount: 10
  }),
  "dashboard_ready should pass when live quotes are ready on the dashboard"
);

const emptyRoot = {
  querySelectorAll() {
    return [];
  },
  querySelector() {
    return null;
  }
};

assert(!renderedIndexQuotesMatch(liveIndices, emptyRoot), "unrendered quotes must fail the DOM check");

const renderedRoot = {
  querySelectorAll() {
    return liveIndices.map((index) => ({
      querySelector(selector) {
        if (selector === "[data-funnel-index-name]") {
          return { textContent: index.name };
        }
        if (selector === "[data-funnel-index-value]") {
          return { textContent: index.value.toFixed(2) };
        }
        return null;
      }
    }));
  }
};

assert(renderedIndexQuotesMatch(liveIndices, renderedRoot), "rendered live quotes should pass the DOM check");

assert(
  !hasShownDecisionConclusion(null, { verdict: "等待数据", action: "先不决策" }, emptyRoot),
  "decision_complete must not pass before stock detail exists"
);

assert(
  !hasShownDecisionConclusion(
    { price: 1271.63, name: "贵州茅台", code: "600519" },
    { verdict: "暂无交易优势", action: "不主动买入" },
    emptyRoot
  ),
  "decision_complete must not pass when the conclusion panel is not shown"
);

const decisionRoot = {
  querySelector(selector) {
    if (selector === "[data-funnel-decision-panel]") {
      return {
        querySelector() {
          return { textContent: "暂无交易优势" };
        }
      };
    }
    return null;
  }
};

assert(
  hasShownDecisionConclusion(
    { price: 1271.63, name: "贵州茅台", code: "600519" },
    { verdict: "暂无交易优势", action: "不主动买入" },
    decisionRoot
  ),
  "decision_complete should pass only when a conclusion is on screen"
);

console.log(JSON.stringify({ ok: true, checks: 8 }, null, 2));
