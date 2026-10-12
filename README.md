# vibe-lab · 发布编辑室

“发布编辑室”是一个面向微博、小红书、短视频的 AI 内容工作台。它把 Coze 工作流、可编辑发布包、审核提醒和经用户确认后才会触发的 MiniMax 图片/视频生成放在一起。

## 配置

复制 `.env.example` 为 `.env.local`，只在该文件或部署平台的服务端环境变量中填写真实值：

```ini
COZE_WORKFLOW_ID=你的已发布工作流 ID
COZE_API_TOKEN=你的 Coze PAT（需具备 run 权限）
MINIMAX_API_KEY=你的 MiniMax API Key
```

`.env.local` 已被 `.gitignore` 忽略，且所有第三方请求都只会从 `app/api/**` 路由发起。不要将真实密钥写入浏览器代码、HTML、Git 或日志。

Coze 工作流默认接收 `{ "topic": "咖啡豆" }`。若工作流使用不同输入字段，可额外设置 `COZE_TOPIC_PARAMETER`（例如 `BOT_USER_INPUT`）。若工作流属于扣子应用，还须设置 `COZE_APP_ID`；需要关联智能体资源的工作流设置 `COZE_BOT_ID`，两者不能同时设置。项目通过 Coze 流式工作流接口在服务端读取最终输出，避免普通非流式接口约 90 秒无响应即断开的限制；默认最多等待 10 分钟，可使用 `COZE_TIMEOUT_MS` 设置 5,000–600,000 毫秒之间的等待时长。工作流应输出 JSON（对象、数组或 `output` / `outputList` / `output_list` 包装均可）；对象可使用 `weibo`、`xiaohongshu` / `xhs`、`video` 三个分组。项目会容错解析常见的 `data/result/output` 包装。建议各渠道字段使用页面中的中文字段名或对应英文名。

## SaaS 与 Coze 工作流的数据契约

现在的 SaaS 页面是工作台，不再把内置热点伪装成真实业务数据。真实模式下，第 1 步的“调用 Coze 抓取新闻”会由浏览器请求本项目的服务端路由，再由服务端携带 `COZE_API_TOKEN` 调用 Coze 工作流。浏览器只会收到已经处理后的新闻、RAG 商品候选和发布包，绝不会收到 PAT。

```text
SaaS 页面 → POST /api/campaign/run → Coze 工作流（新闻插件 / 知识库 RAG）
         ← 安全的结构化结果       ← 工作流结束节点输出
```

请让工作流的结束节点至少输出新闻。下列两种写法都可以：

```json
{
  "news": [{
    "title": "新闻标题",
    "summary": "新闻摘要",
    "url": "https://example.com/news",
    "source": "来源",
    "tag": "分类",
    "time": "发布时间",
    "heat": "热度"
  }],
  "products": [{
    "name": "RAG 检索到的商品名称",
    "brand": "品牌",
    "reason": "与热点的匹配理由",
    "points": ["卖点 1", "卖点 2"]
  }],
  "output_list": ["微博 / 小红书 / 短视频发布包"]
}
```

也兼容文本返回，只要包含 `新闻标题：`、`新闻链接：`、`新闻摘要：` 等字段。`products` 应来自你工作流的知识库检索节点；未返回价格或匹配度时，页面会显示“待人工核实”或“RAG 召回”，而不会编造数字。工作流没有返回商品或发布包时，页面会保留已获取的真实新闻，并明确提示缺少的输出，不会静默回退到演示数据。

MiniMax 默认调用 `https://api.minimax.chat/v1/image_generation` 与 `https://api.minimax.chat/v1/video_generation`，并支持任务轮询。若你的账号使用不同兼容域名或模型，可设置 `.env.example` 中的可选变量覆盖。请在接入生产账号前，按 MiniMax 当前文档确认你的 API 权限与模型名。

## 本地运行

需要 Node.js 22+ 与 pnpm：

```bash
pnpm install
pnpm dev
```

打开终端显示的本地地址。生产构建：

```bash
pnpm build
```

## 使用方式

- **演示模式**：无需密钥，使用内置完整示例数据；界面始终标明“演示数据”。
- **真实接口**：填写 Coze 变量，选择“真实接口”并点击“生成内容”。失败时保留当前内容，并显示“重试真实接口”与“使用演示数据”。
- **媒体生成**：填写 `MINIMAX_API_KEY` 后，点击单张或批量生成；每次都会先显示费用确认。单个图片/镜头失败只影响该任务。

## 部署

该项目使用 Vinext/Cloudflare Workers 兼容的服务端路由。在部署平台的**服务端运行时环境变量**中设置上述三个值，然后执行生产构建与部署。若使用本项目关联的 Sites 发布流程，在 Site 的运行时环境变量中将三项标为 secret，再发布新的版本。

### Railway / Render（推荐的 Node 部署方式）

项目的默认启动命令已配置为 `vinext start`，可直接用于 Railway 或 Render 等 Node Web Service。原来的 Cloudflare 本地预览命令保留为 `npm run start:cloudflare`。

1. 在 Railway 或 Render 新建 **Web Service**，连接仓库：`https://github.com/CatherineWang0118/vibe-lab`。
2. 使用 Node 22；构建命令填写 `npm ci && npm run build`，启动命令填写 `npm run start`。平台会自动提供 `PORT`，无需自行固定端口。
3. 在平台的 Variables / Environment 中添加 `COZE_WORKFLOW_ID`、`COZE_API_TOKEN` 和 `MINIMAX_API_KEY`。这些值必须标记为 secret，不能写入 GitHub 或前端配置。
4. 首次部署完成后，打开平台提供的 HTTPS 地址。没有配置变量时应用仍可在“演示模式”下完整体验；真实接口与媒体生成会显示未配置提示。

> Railway 与 Render 的免费方案及可用区域会随账号和时间变化。发布前请在各自控制台确认配额、休眠策略和所在区域。真实 MiniMax 媒体生成仍仅在用户主动确认后触发，可能产生第三方费用。

## 验证范围

- 已实现：演示流程、多版本、编辑、复制、移动端布局、Coze 同步工作流代理、常见结果包装解析、MiniMax 图片/视频提交与视频任务轮询、付费调用确认、单任务故障隔离。
- 未在本仓库执行：真实 Coze 调用和真实 MiniMax 生成（避免使用未知账号密钥和可能产生费用）。填写有效环境变量后需要由部署者验证工作流输入字段、MiniMax 模型权限以及实际返回结构。
