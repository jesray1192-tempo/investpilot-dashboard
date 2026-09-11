// Funnel contract (PR #5 acceptance):
// - landing_view: first paint of the public app
// - dashboard_ready: only after home overview has rendered live index quotes (not skeleton/empty)
// - stock_open: visitor opened a stock (does NOT mean the decision is done)
// - decision_complete: visitor finished the stock decision path AND a conclusion is on screen
// - api_error / time_to_dashboard: secondary, no PII
export type FunnelEvent =
  | "landing_view"
  | "dashboard_ready"
  | "stock_open"
  | "decision_complete"
  | "api_error"
  | "time_to_dashboard";

export type AnalyticsValue = string | number | boolean | null | undefined;
export type AnalyticsPayload = Record<string, AnalyticsValue>;

const identityKeys = new Set([
  "email",
  "phone",
  "name",
  "username",
  "user",
  "userId",
  "userid",
  "uid",
  "identity",
  "account"
]);

const bufferStorageKey = "investpilot-analytics-buffer";
const firedOnce = new Set<string>();
const pageStartedAt =
  typeof performance !== "undefined" ? performance.now() : Date.now();

function sanitizePayload(payload: AnalyticsPayload): AnalyticsPayload {
  return Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => {
      if (identityKeys.has(key)) {
        return false;
      }
      return value !== undefined;
    })
  );
}

export function pageElapsedMs() {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  return Math.round(now - pageStartedAt);
}

export function track(event: FunnelEvent, payload: AnalyticsPayload = {}) {
  if (typeof window === "undefined") {
    return;
  }

  const record = {
    event,
    ...sanitizePayload(payload),
    ts: Date.now()
  };

  window.dispatchEvent(new CustomEvent("investpilot:analytics", { detail: record }));

  const dataLayer = (window as Window & { dataLayer?: AnalyticsPayload[] }).dataLayer;
  if (Array.isArray(dataLayer)) {
    dataLayer.push(record);
  }

  console.info("[investpilot]", record);

  try {
    const raw = window.localStorage.getItem(bufferStorageKey);
    const previous = raw ? (JSON.parse(raw) as AnalyticsPayload[]) : [];
    const next = Array.isArray(previous) ? [...previous, record].slice(-50) : [record];
    window.localStorage.setItem(bufferStorageKey, JSON.stringify(next));
  } catch {
    // Local analytics buffer is best-effort only.
  }
}

export function trackOnce(key: string, event: FunnelEvent, payload: AnalyticsPayload = {}) {
  if (firedOnce.has(key)) {
    return;
  }

  firedOnce.add(key);
  track(event, payload);
}

export function analyticsPath(url: string) {
  try {
    return new URL(url, "https://local.invalid").pathname;
  } catch {
    return "/api";
  }
}
