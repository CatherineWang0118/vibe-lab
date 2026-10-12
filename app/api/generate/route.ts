import { normalizeWorkflowOutput } from "@/lib/server/content-normalizer";
import { runCozeWorkflow, ServiceError } from "@/lib/server/coze";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  if (error instanceof ServiceError) return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  return Response.json({ error: { code: "UNEXPECTED_ERROR", message: "内容生成暂时不可用，请稍后重试或使用演示数据。" } }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { topic?: unknown };
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    if (!topic) return Response.json({ error: { code: "EMPTY_TOPIC", message: "请先输入一个主题或关键词。" } }, { status: 400 });
    if (topic.length > 120) return Response.json({ error: { code: "TOPIC_TOO_LONG", message: "主题请控制在 120 个字符内。" } }, { status: 400 });
    const raw = await runCozeWorkflow(topic);
    const versions = normalizeWorkflowOutput(raw, topic);
    return Response.json({ source: "real", versions });
  } catch (error) {
    return errorResponse(error);
  }
}
