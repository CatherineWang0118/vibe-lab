import { runCozeWorkflow, ServiceError } from "@/lib/server/coze";
import { extractRagProductMatches } from "@/lib/server/product-matcher";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  if (error instanceof ServiceError) return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  return Response.json({ error: { code: "PRODUCT_MATCH_ERROR", message: "商品匹配暂时不可用，请稍后重试或切换演示商品库。" } }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { news?: unknown };
    const news = typeof body.news === "string" ? body.news.trim() : "";
    if (!news) return Response.json({ error: { code: "EMPTY_NEWS", message: "请先选择一个热点再匹配商品。" } }, { status: 400 });
    if (news.length > 500) return Response.json({ error: { code: "NEWS_TOO_LONG", message: "热点内容过长，请缩短后重试。" } }, { status: 400 });

    const prompt = `当前电商热点：${news}\n\n请使用工作流已接入的 RAG 商品库，筛选最匹配的 1 至 3 个商品。不要编造库存、价格、功效或商品信息。优先在结束节点返回 JSON：{ "products": [{ "name": "商品名", "brand": "品牌", "price": "价格或待核实", "reason": "匹配理由", "points": ["卖点"], "match": 0-100 }] }。若只能输出文本，请明确使用“推荐商品：商品名”。`;
    const raw = await runCozeWorkflow(prompt);
    const products = extractRagProductMatches(raw);
    return Response.json({ source: "coze-rag", products });
  } catch (error) {
    return errorResponse(error);
  }
}
