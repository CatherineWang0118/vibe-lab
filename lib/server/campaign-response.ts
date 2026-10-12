import type { ContentVersion } from "@/lib/content";
import { ServiceError } from "@/lib/server/coze";
import { normalizeWorkflowOutput } from "@/lib/server/content-normalizer";
import { extractRagProductMatches, type RagProductMatch } from "@/lib/server/product-matcher";

type Dictionary = Record<string, unknown>;

export type CampaignNews = {
  id: string;
  tag: string;
  title: string;
  summary: string;
  source: string;
  time: string;
  heat: string;
  url?: string;
};

export type CampaignResponse = {
  news: CampaignNews[];
  products: RagProductMatch[];
  versions: ContentVersion[];
  warnings: string[];
};

const object = (value: unknown): Dictionary | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Dictionary : null;

const text = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

function newsUrl(value: string) {
  const matched = value.match(/https?:\/\/[^\s<>"'）】]+/i)?.[0] || "";
  const candidate = matched.replace(/-+$/, "");
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? candidate : "";
  } catch {
    return "";
  }
}

function parseString(value: string): unknown {
  const source = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  if (!source) return "";
  try { return JSON.parse(source); } catch { return value; }
}

function pick(record: Dictionary | null, keys: string[]) {
  if (!record) return undefined;
  for (const key of keys) if (record[key] !== undefined) return record[key];
  return undefined;
}

function makeId(value: string, index: number) {
  return `coze-news-${value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 52) || index + 1}`;
}

function newsFromRecord(value: unknown, index: number): CampaignNews | null {
  const record = object(value);
  if (!record) return null;
  const title = text(pick(record, ["title", "headline", "newsTitle", "新闻标题", "标题"]));
  if (!title || title.length > 180 || /^(?:微博|小红书|短视频|视频标题|推荐商品)/.test(title)) return null;
  const summary = text(pick(record, ["summary", "description", "snippet", "content", "新闻摘要", "摘要", "正文"]));
  const url = newsUrl(text(pick(record, ["url", "link", "newsUrl", "新闻链接", "链接"])));
  if (!summary && !url) return null;
  return {
    id: text(pick(record, ["id", "newsId"])) || makeId(title, index),
    tag: text(pick(record, ["tag", "category", "分类", "标签"])) || "Coze 检索结果",
    title,
    summary: summary || "新闻正文待人工打开原链接核实。",
    source: text(pick(record, ["source", "site", "来源"])) || "Coze 新闻插件",
    time: text(pick(record, ["time", "publishedAt", "发布时间"])) || "刚刚返回",
    heat: text(pick(record, ["heat", "hot", "热度"])) || "待人工核实",
    ...(url ? { url } : {}),
  };
}

function labelled(source: string, label: string, next: string[]) {
  // Existing editorial workflows commonly prefix their final text with a
  // banner such as "===== 多平台内容卡片 ===== 新闻标题：...".  The label is
  // therefore not guaranteed to begin on a new line.
  const start = new RegExp(`(?:^|[\\s])${label}\\s*[：:]\\s*`, "g").exec(source);
  if (!start || start.index === undefined) return "";
  const from = start.index + start[0].length;
  let to = source.length;
  for (const candidate of next) {
    const found = new RegExp(`(?:^|[\\s]|-{2,}|={2,})${candidate}\\s*(?:[：:]|-{2,}|$)`, "g");
    found.lastIndex = from;
    const match = found.exec(source);
    if (match?.index !== undefined) to = Math.min(to, match.index);
  }
  return source.slice(from, to).trim();
}

function newsFromText(value: string, index: number): CampaignNews[] {
  const parsed = parseString(value);
  if (parsed !== value) return collectNews(parsed, index);
  const title = labelled(value, "新闻标题", ["新闻链接", "新闻摘要", "新闻来源", "推荐商品", "微博发布包"]);
  if (!title) return [];
  const url = newsUrl(labelled(value, "新闻链接", ["新闻摘要", "新闻来源", "推荐商品", "微博发布包", "小红书发布包", "短视频发布包"]));
  const summary = labelled(value, "新闻摘要", ["新闻来源", "推荐商品", "微博发布包", "小红书发布包", "短视频发布包"]) || "新闻正文待人工打开原链接核实。";
  return [{ id: makeId(title, index), tag: "Coze 检索结果", title, summary, source: labelled(value, "新闻来源", ["推荐商品", "微博发布包"]) || "Coze 新闻插件", time: "刚刚返回", heat: "待人工核实", ...(url ? { url } : {}) }];
}

function collectNews(value: unknown, index = 0, depth = 0): CampaignNews[] {
  if (depth > 8 || value === null || value === undefined) return [];
  if (typeof value === "string") return newsFromText(value, index);
  if (Array.isArray(value)) return value.flatMap((item, itemIndex) => collectNews(item, index + itemIndex, depth + 1));
  const direct = newsFromRecord(value, index);
  if (direct) return [direct];
  const record = object(value);
  if (!record) return [];
  const keys = ["news", "newsList", "articles", "items", "output", "output_list", "outputList", "data", "result", "content"];
  return keys.flatMap((key) => record[key] === undefined ? [] : collectNews(record[key], index, depth + 1));
}

export function parseCampaignResponse(raw: unknown, topic: string): CampaignResponse {
  const news = [...new Map(collectNews(raw).map((item) => [item.title, item])).values()].slice(0, 12);
  if (!news.length) {
    throw new ServiceError("NEWS_PARSE_FAILED", "Coze 工作流未返回可识别的新闻标题。请在结束节点输出 news / articles，或至少输出“新闻标题：”字段。", 422);
  }

  const warnings: string[] = [];
  let products: RagProductMatch[] = [];
  let versions: ContentVersion[] = [];
  try { products = extractRagProductMatches(raw); } catch { warnings.push("工作流未返回可识别的 RAG 商品；请检查知识库检索分支的结束节点输出。"); }
  try { versions = normalizeWorkflowOutput(raw, topic); } catch { warnings.push("工作流暂未返回可展示的三渠道发布包；可在创作文案中重新调用。 "); }
  return { news, products, versions, warnings };
}
