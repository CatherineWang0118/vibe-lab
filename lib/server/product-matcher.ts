import { ServiceError } from "@/lib/server/coze";

type Dictionary = Record<string, unknown>;

export type RagProductMatch = {
  id: string;
  name: string;
  brand: string;
  price: string;
  reason: string;
  points: string[];
  match: number | null;
};

const object = (value: unknown): Dictionary | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as Dictionary : null;

const text = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

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

function values(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  const source = text(value);
  return source ? source.split(/[、,，；;\n]/).map((item) => item.trim()).filter(Boolean) : [];
}

function score(value: unknown): number | null {
  const parsed = Number(String(value ?? "").replace(/[%％]/g, "").trim());
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? Math.round(parsed) : null;
}

function slug(value: string, index: number) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return `coze-rag-${normalized || "product"}-${index + 1}`;
}

function fromRecord(value: unknown, index: number): RagProductMatch | null {
  const record = object(value);
  if (!record) return null;
  const name = text(pick(record, ["name", "productName", "title", "商品名称", "商品名", "推荐商品"]));
  if (!name || name.length > 120) return null;
  return {
    id: text(pick(record, ["id", "sku", "productId", "商品ID"])) || slug(name, index),
    name,
    brand: text(pick(record, ["brand", "品牌", "店铺", "merchant"])) || "Coze RAG 商品库",
    price: text(pick(record, ["price", "售价", "价格"])) || "价格待人工核实",
    reason: text(pick(record, ["reason", "matchReason", "推荐理由", "匹配理由", "商品依据"])) || "由 Coze 工作流的 RAG 商品库召回，请人工核实库存、价格与适用范围。",
    points: values(pick(record, ["points", "sellingPoints", "卖点", "标签", "tags"])).slice(0, 4),
    match: score(pick(record, ["match", "score", "matchScore", "匹配度"])),
  };
}

function textMatches(value: string): RagProductMatch[] {
  const plain = value.trim();
  if (!plain) return [];
  const json = parseString(plain);
  if (json !== plain) return collect(json);

  const productLabel = /(?:^|\n)\s*(?:推荐商品|商品名称|商品名)\s*[：:]\s*([^\n]+)/g;
  const matched = [...plain.matchAll(productLabel)].map((entry) => entry[1].trim()).filter(Boolean);
  const names = matched.length ? matched : [...plain.matchAll(/(?:^|\n)\s*\d+\s*[.、．]\s*([^\n｜|：:]{2,80})/g)]
    .map((entry) => entry[1].trim())
    .filter((item) => !/^(?:微博|小红书|短视频|配图|分镜|标题|口播)/.test(item));

  return names.slice(0, 3).map((name, index) => ({
    id: slug(name, index),
    name,
    brand: "Coze RAG 商品库",
    price: "价格待人工核实",
    reason: "由 Coze 工作流的 RAG 商品库召回，请人工核实库存、价格与适用范围。",
    points: ["RAG 召回", "待人工核实"],
    match: null,
  }));
}

function collect(value: unknown, depth = 0): RagProductMatch[] {
  if (depth > 8 || value === null || value === undefined) return [];
  if (typeof value === "string") return textMatches(value);
  if (Array.isArray(value)) return value.flatMap((item) => collect(item, depth + 1));

  const record = object(value);
  if (!record) return [];
  const direct = fromRecord(record, 0);
  if (direct) return [direct];

  const collectionKeys = ["products", "productList", "product_list", "candidates", "items", "推荐商品", "商品推荐", "商品列表"];
  const nested = collectionKeys.flatMap((key) => record[key] === undefined ? [] : collect(record[key], depth + 1));
  if (nested.length) return nested;

  const wrapperKeys = ["output", "outputList", "output_list", "data", "result", "content", "text", "answer", "message"];
  return wrapperKeys.flatMap((key) => record[key] === undefined ? [] : collect(record[key], depth + 1));
}

export function extractRagProductMatches(raw: unknown): RagProductMatch[] {
  const deduped = new Map<string, RagProductMatch>();
  for (const product of collect(raw)) {
    const key = product.name.toLocaleLowerCase();
    if (!deduped.has(key)) deduped.set(key, product);
    if (deduped.size === 3) break;
  }
  const products = [...deduped.values()];
  if (!products.length) {
    throw new ServiceError("PRODUCT_MATCH_PARSE_FAILED", "Coze 已返回结果，但未识别到 RAG 商品。请让工作流结束节点输出 products 或“推荐商品”字段。", 422);
  }
  return products;
}
