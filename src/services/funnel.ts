import type { MarketIndex, StockDetail } from "../types";

const incompleteVerdicts = new Set(["等待数据", "基础分析"]);

export function dashboardQuotesAreReady(input: {
  activeNav: string;
  activeHomeSubpage: string;
  marketIndicesLoading: boolean;
  limitUpLoading: boolean;
  marketIndicesError: string;
  limitUpError: string;
  marketIndices: MarketIndex[];
  limitUpCount: number;
}) {
  return (
    input.activeNav === "home" &&
    input.activeHomeSubpage === "overview" &&
    !input.marketIndicesLoading &&
    !input.limitUpLoading &&
    !input.marketIndicesError &&
    !input.limitUpError &&
    input.marketIndices.length > 0 &&
    input.limitUpCount > 0 &&
    input.marketIndices.every((index) => Number.isFinite(index.value) && index.value > 0)
  );
}

export function renderedIndexQuotesMatch(indices: MarketIndex[], root: ParentNode = document) {
  const items = Array.from(root.querySelectorAll<HTMLElement>("[data-funnel-index]"));
  if (items.length === 0 || items.length < indices.length) {
    return false;
  }

  return indices.every((index) =>
    items.some((item) => {
      const name = item.querySelector("[data-funnel-index-name]")?.textContent?.trim();
      const value = Number.parseFloat(
        item.querySelector("[data-funnel-index-value]")?.textContent ?? ""
      );
      return name === index.name && Number.isFinite(value) && value > 0;
    })
  );
}

export function hasShownDecisionConclusion(
  detail: StockDetail | null,
  insight: { verdict: string; action: string },
  root: ParentNode = document
) {
  if (!detail || detail.price <= 0) {
    return false;
  }

  if (!insight.verdict || incompleteVerdicts.has(insight.verdict) || !insight.action) {
    return false;
  }

  const panel = root.querySelector("[data-funnel-decision-panel]");
  const verdict = panel?.querySelector("[data-funnel-decision-verdict]")?.textContent?.trim();
  return Boolean(panel && verdict === insight.verdict);
}
