import { analyticsPath, track } from "./analytics";

export async function fetchJson<T>(url: string): Promise<T> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*"
      }
    });

    if (!response.ok) {
      track("api_error", {
        path: analyticsPath(url),
        status: response.status
      });
      throw new Error(`请求失败（${response.status}）。`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (!(error instanceof Error && /请求失败（\d+）/.test(error.message))) {
      track("api_error", {
        path: analyticsPath(url),
        status: 0
      });
    }
    throw error;
  }
}
