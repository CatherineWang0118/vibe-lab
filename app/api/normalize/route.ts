import { normalizeWorkflowOutput } from "@/lib/server/content-normalizer";
import { ServiceError } from "@/lib/server/coze";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { output?: unknown; topic?: unknown };
    const output = typeof body.output === "string" ? body.output.trim() : "";
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    if (!output || !topic) return Response.json({ error: { message: "缺少需要整理的工作流内容。" } }, { status: 400 });
    if (output.length > 250_000) return Response.json({ error: { message: "工作流内容过长，暂时无法整理。" } }, { status: 413 });
    return Response.json({ versions: normalizeWorkflowOutput(output, topic) });
  } catch (error) {
    const message = error instanceof ServiceError
      ? error.message
      : "真实接口结果暂时无法重新整理。";
    return Response.json({ error: { message } }, { status: 422 });
  }
}
