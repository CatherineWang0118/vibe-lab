import { runCozeWorkflow, ServiceError } from "@/lib/server/coze";
import { parseCampaignResponse } from "@/lib/server/campaign-response";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  if (error instanceof ServiceError) return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  return Response.json({ error: { code: "CAMPAIGN_RUN_ERROR", message: "Coze 热点工作流暂时不可用，请稍后重试或使用演示数据。" } }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { query?: unknown };
    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query) return Response.json({ error: { code: "EMPTY_QUERY", message: "请输入新闻检索关键词后再调用 Coze。" } }, { status: 400 });
    if (query.length > 120) return Response.json({ error: { code: "QUERY_TOO_LONG", message: "检索关键词请控制在 120 个字符内。" } }, { status: 400 });
    const raw = await runCozeWorkflow(query);
    return Response.json({ source: "coze", ...parseCampaignResponse(raw, query) });
  } catch (error) {
    return errorResponse(error);
  }
}
