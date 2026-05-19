import { LimitUpStock, MultimodalOutput, StockDetail } from "../types";
import { fetchLiveStockDetail, fetchStockSearchMatch } from "./stockDetail";

type StockIdentity = {
  code: string;
  name: string;
};

const ignoredNameTokens = new Set([
  "涨停",
  "买入",
  "卖出",
  "分时",
  "盘口",
  "资金",
  "市场",
  "个股",
  "股票",
  "分析",
  "交易",
  "题材",
  "板块",
  "今日",
  "昨日",
  "连续",
  "涨幅",
  "跌幅"
]);

function normalizeOcrText(text: string) {
  return text.replace(/[|]/g, "I").replace(/[（）]/g, (char) => (char === "（" ? "(" : ")"));
}

function extractCodeCandidates(text: string) {
  return Array.from(new Set(text.match(/\b[036]\d{5}\b/g) ?? []));
}

function extractNameCandidates(text: string) {
  const lineCandidates = text
    .split(/[\n\r\s]+/)
    .map((line) => line.replace(/[^\u4e00-\u9fa5]/g, ""))
    .filter((line) => line.length >= 2 && line.length <= 8);

  const inlineCandidates = Array.from(
    new Set(text.match(/[\u4e00-\u9fa5]{2,8}/g) ?? [])
  ).filter((item) => !ignoredNameTokens.has(item));

  return Array.from(new Set([...lineCandidates, ...inlineCandidates])).slice(0, 12);
}

async function recognizeImageText(imageUrl: string) {
  const { recognize } = await import("tesseract.js");
  const result = await recognize(imageUrl, "chi_sim+eng", {
    logger: () => {}
  });

  return normalizeOcrText(result.data.text || "");
}

async function resolveStockIdentity(text: string) {
  const codeCandidates = extractCodeCandidates(text);

  for (const code of codeCandidates) {
    try {
      return await fetchStockSearchMatch(code);
    } catch {
      continue;
    }
  }

  const nameCandidates = extractNameCandidates(text);

  for (const name of nameCandidates) {
    try {
      const match = await fetchStockSearchMatch(name);

      if (match.name.includes(name) || name.includes(match.name)) {
        return match;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2
  }).format(value);
}

function normalizeThemeText(text: string) {
  return text
    .replace(/方向/g, "")
    .replace(/首板发酵/g, "")
    .replace(/连板晋级/g, "")
    .replace(/概念/g, "")
    .trim();
}

function extractThemeKeywords(reason?: string, industry?: string) {
  const candidates = [reason, industry]
    .filter(Boolean)
    .map((item) => normalizeThemeText(item as string))
    .flatMap((item) => item.split(/[、/\s]+/))
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);

  return Array.from(new Set(candidates));
}

function buildPeerIdeas(
  pool: LimitUpStock[],
  stockCode: string,
  industry: string,
  limitUpMatch: LimitUpStock | null
) {
  const themeKeywords = extractThemeKeywords(limitUpMatch?.reason, industry);
  const peers = pool
    .filter((item) => {
      if (item.code === stockCode) {
        return false;
      }

      const normalizedReason = normalizeThemeText(item.reason);
      const sameTheme = themeKeywords.some(
        (keyword) => normalizedReason.includes(keyword) || item.industry.includes(keyword)
      );

      return sameTheme || item.industry === industry;
    })
    .sort((left, right) => {
      const leftReason = normalizeThemeText(left.reason);
      const rightReason = normalizeThemeText(right.reason);
      const leftThemeScore = themeKeywords.some(
        (keyword) => leftReason.includes(keyword) || left.industry.includes(keyword)
      )
        ? 1
        : 0;
      const rightThemeScore = themeKeywords.some(
        (keyword) => rightReason.includes(keyword) || right.industry.includes(keyword)
      )
        ? 1
        : 0;

      if (rightThemeScore !== leftThemeScore) {
        return rightThemeScore - leftThemeScore;
      }

      if (right.consecutiveBoardCount !== left.consecutiveBoardCount) {
        return right.consecutiveBoardCount - left.consecutiveBoardCount;
      }

      if (right.limitUpCount !== left.limitUpCount) {
        return right.limitUpCount - left.limitUpCount;
      }

      return right.price - left.price;
    })
    .slice(0, 3);

  if (peers.length === 0) {
    return "当前没有从实时涨停池里筛出明确的同题材可对比标的。更合理的做法是补一层按行业/概念聚合的强势股列表，再从龙头、中军、低位补涨三个层级挑备选。";
  }

  return `同题材下当前更值得一起观察的是：${peers
    .map(
      (item) =>
        `${item.name}（${item.code}，${item.ladderType}，${item.reason}，封单${item.sealAmount}）`
    )
    .join("；")}。优先比较谁是前排龙头，谁是位置更低但逻辑一致的补涨。`;
}

function buildFallbackOutput(assetName: string, runCount: number, recognizedText: string): MultimodalOutput {
  const textPreview = recognizedText
    .replace(/\s+/g, " ")
    .slice(0, 120);

  return {
    identifiedStock: null,
    entryVerdict: {
      label: "待识别后再判断",
      tone: "neutral"
    },
    summary: `已完成第 ${runCount} 轮解读。当前识别到的是图片材料 ${assetName}，但还没有稳定提取出股票名称或代码。`,
    segmentSummaries: [
      {
        label: "OCR",
        title: "截图文字识别结果",
        body: textPreview
          ? `当前从截图里识别到的文字片段为：“${textPreview}”。下一步应继续从中抽取股票名称、代码、所属题材和盘面关键信息。`
          : "这张截图目前还没有识别出足够清晰的文字，可能是截图区域过小、字体模糊，或盘面元素过于密集。"
      },
      {
        label: "Need",
        title: "还缺哪些关键信息",
        body: "要做成真实可用的股票分析，至少还需要识别出股票名称/代码、涨停原因提示、题材标签、涨停时间结构，以及是否有公告或龙虎榜支撑。"
      }
    ],
    finalAnalysis: "当前可以判断这是一张股票相关截图，但还不能准确定位到具体标的，因此无法给出精确的基本面、涨停原因和同题材对比。后续应优先提升截图识别准确率，再进入个股级分析。",
    entryDecision: "在未识别出具体股票前，不建议给出是否值得进入的结论。因为缺少标的身份，交易判断容易从一开始就建立在错误对象上。",
    peers: "同题材可选标的需要先识别出这只股票属于什么行业或概念，才能继续筛同板块强势股。",
    risk: "当前最大的风险不是判断错节奏，而是连标的身份都没有确认。识别错误会直接把后续分析带偏。"
  };
}

function buildStockOutput(
  identity: StockIdentity,
  detail: StockDetail,
  limitUpMatch: LimitUpStock | null,
  limitUpStocks: LimitUpStock[],
  runCount: number,
  recognizedText: string
): MultimodalOutput {
  const reasonText = limitUpMatch
    ? `${identity.name} 今天更可能是沿着“${limitUpMatch.reason}”这条线被资金拉升，所属行业为 ${limitUpMatch.industry}。${limitUpMatch.ladderType === "连板" ? `当前是 ${limitUpMatch.consecutiveBoardCount} 连板，说明它已经进入板块辨识度阶段。` : "当前是首板，说明更多还是新发酵或第一次被资金集中确认。"}`
    : `${identity.name} 当前没有在已拉到的涨停池数据里直接命中，说明今天涨停原因还需要继续结合公告、异动新闻和所属板块走势确认。`;
  const positionText = limitUpMatch
    ? `从盘面位置看，这只股票的封单强度为 ${limitUpMatch.sealStrength}，封单金额约 ${limitUpMatch.sealAmount}，开板次数 ${limitUpMatch.openBoardCount} 次，首次涨停时间 ${limitUpMatch.firstLimitUpTime}。这些数据会直接决定它是强势前排还是情绪跟风。`
    : `从盘面位置看，当前还缺少直接的涨停池命中信息，因此更应先核对它是不是板块核心、有没有前排龙头带动，以及是否具备次日继续承接的条件。`;

  const ocrPreview = recognizedText.replace(/\s+/g, " ").slice(0, 120);
  const entryVerdict =
    limitUpMatch?.ladderType === "连板"
      ? {
          label: "高位接力偏谨慎",
          tone: "cautious" as const
        }
      : limitUpMatch && limitUpMatch.openBoardCount <= 1 && limitUpMatch.sealStrength !== "偏弱"
        ? {
            label: "可列入重点观察",
            tone: "positive" as const
          }
        : {
            label: "先观察承接再决定",
            tone: "neutral" as const
          };

  return {
    identifiedStock: {
      name: identity.name,
      code: identity.code,
      industry: detail.industry,
      limitUpReason: limitUpMatch?.reason ?? "未直接命中涨停池，需继续结合公告和异动信息确认",
      themeJudgement: limitUpMatch
        ? `${limitUpMatch.industry}方向，当前更偏${limitUpMatch.ladderType === "连板" ? "主线连板辨识度" : "首板发酵确认"}`
        : `${detail.industry}方向，当前更适合先确认它是不是板块核心或补涨`,
      ocrPreview: ocrPreview || "当前没有提取到足够清晰的原始文字。",
      keyStats: [
        {
          label: "最新价",
          value: `${detail.price.toFixed(2)}`
        },
        {
          label: "涨跌幅",
          value: `${detail.changePercent >= 0 ? "+" : ""}${detail.changePercent.toFixed(2)}%`
        },
        {
          label: "总市值",
          value: formatNumber(detail.totalMarketCap)
        },
        {
          label: "流通市值",
          value: formatNumber(detail.floatMarketCap)
        },
        {
          label: "封单强度",
          value: limitUpMatch?.sealStrength ?? "待确认"
        },
        {
          label: "首次涨停时间",
          value: limitUpMatch?.firstLimitUpTime ?? "待确认"
        }
      ]
    },
    entryVerdict,
    summary: `已完成第 ${runCount} 轮解读。当前已从截图里识别到股票为 ${identity.name}（${identity.code}），并结合个股详情与涨停池数据生成分析。`,
    segmentSummaries: [
      {
        label: "Basic",
        title: "基本面与公司画像",
        body: `${identity.name} 所属行业为 ${detail.industry}，最新价 ${detail.price.toFixed(2)}，涨跌幅 ${detail.changePercent.toFixed(2)}%，总市值约 ${formatNumber(detail.totalMarketCap)}，流通市值约 ${formatNumber(detail.floatMarketCap)}。若它是小市值+题材弹性票，情绪驱动会更强；若是中大市值中军，更要看成交承接和板块持续性。`
      },
      {
        label: "Reason",
        title: "今天涨停原因",
        body: reasonText
      },
      {
        label: "Theme",
        title: "题材与板块位置",
        body: `${identity.name} 当前应放回 ${detail.industry} 方向里评估。真正重要的不是“它有没有概念”，而是这个概念今天是不是市场主线、板块内有没有批量涨停、龙头是否持续封板，以及它自己属于龙头、跟风还是补涨。`
      },
      {
        label: "Position",
        title: "盘面位置和接力价值",
        body: positionText
      },
      {
        label: "Checklist",
        title: "AI 还应该继续补什么",
        body: "后续这页最好继续补四层数据：公告/F10 摘要、龙虎榜或异动原因、同题材涨停梯队、近几日板块热度变化。这样“值得不值得进”才会从经验判断升级成有数据支撑的结论。"
      }
    ],
    finalAnalysis: `${identity.name}（${identity.code}）这只票当前更适合按“题材强度 + 个股位置 + 次日承接”三件事来判断，而不是只看一张截图就做决定。如果它处在主线题材前排，且有明确催化和健康换手，观察价值会明显提高；如果只是后排跟风或高位一致性加速板，则次日追高风险更大。`,
    finalAnalysisTitle: "核心判断",
    entryDecision: `现在是否值得进入，核心看四点：第一，${identity.name} 是否属于当日最强题材前排；第二，涨停是否有硬逻辑而不是纯情绪；第三，封单、换手和炸板回封结构是否健康；第四，次日有没有比它位置更低、更容易承接的同题材票。若当前已经处在高位加速段，更适合等分歧而不是直接追。`,
    entryDecisionTitle: "现在是否值得进入",
    peers: buildPeerIdeas(limitUpStocks, identity.code, detail.industry, limitUpMatch),
    peersTitle: "同题材可选标的",
    risk: `当前分析已经能定位到 ${identity.name}，但仍然没有直接读取到公告全文、龙虎榜和截图里的全部盘口细节。所以这版可以用于缩小观察范围，不能替代最终交易确认。`
  };
}

export async function analyzeStockScreenshotAsset(
  asset: {
    name: string;
    objectUrl?: string;
  },
  limitUpStocks: LimitUpStock[],
  runCount: number
): Promise<MultimodalOutput> {
  if (!asset.objectUrl) {
    return buildFallbackOutput(asset.name, runCount, "");
  }

  const recognizedText = await recognizeImageText(asset.objectUrl);
  const identity = await resolveStockIdentity(recognizedText);

  if (!identity) {
    return buildFallbackOutput(asset.name, runCount, recognizedText);
  }

  const detail = await fetchLiveStockDetail(identity.code);
  const limitUpMatch = limitUpStocks.find((item) => item.code === identity.code) ?? null;

  return buildStockOutput(identity, detail, limitUpMatch, limitUpStocks, runCount, recognizedText);
}

export async function analyzeStockByManualInput(
  input: string,
  limitUpStocks: LimitUpStock[],
  runCount: number
): Promise<MultimodalOutput> {
  const identity = await fetchStockSearchMatch(input);
  const detail = await fetchLiveStockDetail(identity.code);
  const limitUpMatch = limitUpStocks.find((item) => item.code === identity.code) ?? null;

  return buildStockOutput(
    identity,
    detail,
    limitUpMatch,
    limitUpStocks,
    runCount,
    `手动确认股票：${identity.name} ${identity.code}`
  );
}
