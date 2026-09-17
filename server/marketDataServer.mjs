import { createServer } from "node:http";
import { corsHeaders, handleMarketApiSafe } from "./marketDataCore.mjs";

const port = Number(process.env.MARKET_DATA_PORT ?? 8787);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, corsHeaders);
  response.end(JSON.stringify(payload));
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders);
    response.end();
    return;
  }

  if (!request.url) {
    sendJson(response, 404, { ok: false, error: "Not found" });
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host ?? "127.0.0.1"}`);
  const result = await handleMarketApiSafe(url.pathname, url.searchParams);
  sendJson(response, result.statusCode, result.payload);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Market data server port ${port} is already in use.`);
  } else {
    console.error("Market data server failed:", error);
  }
  process.exit(1);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Market data server listening on http://127.0.0.1:${port}`);
});
