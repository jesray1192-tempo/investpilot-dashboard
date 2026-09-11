import { corsHeaders, handleMarketApiSafe } from "../../server/marketDataCore.mjs";

export function createMarketApiHandler(pathname) {
  return async function handler(request, response) {
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.setHeader(key, value);
    });

    if (request.method === "OPTIONS") {
      response.status(204).end();
      return;
    }

    if (request.method && request.method !== "GET") {
      response.status(405).json({ ok: false, error: "Method not allowed" });
      return;
    }

    const query = request.query ?? {};
    const searchParams = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        if (value[0]) {
          searchParams.set(key, String(value[0]));
        }
        return;
      }
      if (value != null) {
        searchParams.set(key, String(value));
      }
    });

    const result = await handleMarketApiSafe(pathname, searchParams);
    response.status(result.statusCode).json(result.payload);
  };
}
