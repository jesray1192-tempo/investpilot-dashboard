# InvestPilot

公开、免登录的 A 股投资工具台。默认落地是主线看板，访客可以不登录就看真实行情，并完成一次个股决策。

这不是作品集，也不是「我的持仓」产品。登录后的「我的看板 / 账号」不在本轮范围。

## 当前能力

- 公网 `/api` 代理东方财富行情：指数、涨停池、个股详情、分时、搜索
- 访客路径：打开站点 → 看板加载真实行情 → 打开一只股票 → 完成本地决策
- 持仓页默认空仓，不再预填茅台 / 宁德时代等示例仓位
- 规则推演会标明「非模型结论」；占位快讯和静态热度也会标明非正式数据
- 漏斗事件：`landing_view`、`dashboard_ready`、`stock_open`、`decision_complete`，以及 `api_error`、`time_to_dashboard`

## 本地启动

```bash
npm install
npm run dev
```

默认地址：`http://localhost:5173`

`npm run dev` 会同时拉起 Vite 和本地行情服务 `http://127.0.0.1:8787`，前端通过 Vite proxy 访问 `/api/*`。

只跑行情服务：

```bash
npm run data:server
```

## 公网 API（Vercel）

线上之前是静态 SPA，`/api/*` 会 404。本轮把同一套行情逻辑接到 Vercel Serverless：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/market/indices` | 主要指数 |
| GET | `/api/market/limit-up-pool` | 涨停池 |
| GET | `/api/stock/detail?secid=1.600519` | 个股详情 |
| GET | `/api/stock/trends?secid=1.600519&days=1` | 分时 / 五日 |
| GET | `/api/stock/search?input=600519` | 代码或名称搜索 |

成功时返回：

```json
{ "ok": true, "status": "live", "updatedAt": "...", "data": {} }
```

不需要付费行情 key。默认使用东方财富公开网页 token；如果 token 轮换，再在 Vercel 里设置：

- `EASTMONEY_QUOTE_TOKEN`
- `EASTMONEY_LIMIT_UP_TOKEN`
- `EASTMONEY_SEARCH_TOKEN`
- `EASTMONEY_QUOTE_HOSTS`（可选；默认先 `push2.eastmoney.com`，失败再走 `push2delay.eastmoney.com`。海外 / Vercel 上 `push2` 常 502，有 fallback 才能出数）

完整变量见 [`.env.example`](.env.example)。Jessica 不设置也能先跑；只有上游 token 失效时才需要改。

## 访客怎么走通

1. 打开首页（主线看板）。指数和涨停池应显示「东方财富实时行情」，而不是 404。
2. 从涨停池或「个股决策」输入代码 / 名称，打开一只股票。
3. 查看规则决策后，点「完成本次决策（仅本机）」。结果只写 `localStorage`，不上传身份。

浏览器控制台会看到 `[investpilot]` 事件；若页面存在 `window.dataLayer`，事件也会推进去。

## 数据源策略

- 东方财富公开行情：本轮看板和个股决策的实际数据源
- 同花顺：仍作为后续正式商业接口候选
- 财联社：资讯层仍是占位，页面会标明非正式数据

## 下一步（不在本轮）

1. 登录后的「我的看板 / 账号」和决策云端同步
2. 真实大模型分析，替换规则 / 模板推演
3. 正式资讯与资金流接口
