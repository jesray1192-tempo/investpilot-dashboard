import { handleMarketApiSafe } from "../server/marketDataCore.mjs";
import { createMarketApiHandler } from "../api/_lib/respond.mjs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function mockResponse() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    }
  };
}

async function invokeHandler(handler, query = {}) {
  const response = mockResponse();
  await handler({ method: "GET", query }, response);
  return response;
}

const indices = await handleMarketApiSafe("/api/market/indices");
assert(indices.statusCode === 200 && indices.payload.ok && indices.payload.data?.length > 0, "indices failed");

const pool = await handleMarketApiSafe("/api/market/limit-up-pool");
assert(pool.statusCode === 200 && pool.payload.ok && pool.payload.data?.pool?.length > 0, "limit-up-pool failed");

const detail = await handleMarketApiSafe("/api/stock/detail", new URLSearchParams({ secid: "1.600519" }));
assert(detail.statusCode === 200 && detail.payload.ok && detail.payload.data?.data?.f57, "stock detail failed");

const trends = await handleMarketApiSafe("/api/stock/trends", new URLSearchParams({ secid: "1.600519", days: "1" }));
assert(trends.statusCode === 200 && trends.payload.ok, "stock trends failed");

const search = await handleMarketApiSafe("/api/stock/search", new URLSearchParams({ input: "600519" }));
assert(search.statusCode === 200 && search.payload.ok, "stock search failed");

const missing = await handleMarketApiSafe("/api/stock/detail");
assert(missing.statusCode === 400, "missing secid should 400");

const unknown = await handleMarketApiSafe("/api/does-not-exist");
assert(unknown.statusCode === 404, "unknown path should 404");

const handler = createMarketApiHandler("/api/market/indices");
const vercelLike = await invokeHandler(handler);
assert(vercelLike.statusCode === 200 && vercelLike.body?.ok, "vercel handler failed");

console.log(
  JSON.stringify(
    {
      ok: true,
      indices: indices.payload.data.map((item) => item.name),
      limitUpCount: pool.payload.data.pool.length,
      sampleStock: detail.payload.data.data.f58,
      vercelHandler: vercelLike.statusCode
    },
    null,
    2
  )
);
