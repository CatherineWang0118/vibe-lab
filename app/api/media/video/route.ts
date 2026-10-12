import { createVideo, queryVideo } from "@/lib/server/minimax";
import { ServiceError } from "@/lib/server/coze";

export const runtime = "nodejs";

function toError(error: unknown) {
  if (error instanceof ServiceError) return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  return Response.json({ error: { code: "UNEXPECTED_ERROR", message: "视频生成暂时不可用，请稍后重试。" } }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { prompt?: unknown };
    return Response.json(await createVideo(typeof body.prompt === "string" ? body.prompt : ""));
  } catch (error) {
    return toError(error);
  }
}

export async function GET(request: Request) {
  try {
    const taskId = new URL(request.url).searchParams.get("taskId") || "";
    return Response.json(await queryVideo(taskId));
  } catch (error) {
    return toError(error);
  }
}
