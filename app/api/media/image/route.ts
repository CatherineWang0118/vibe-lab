import { createImage } from "@/lib/server/minimax";
import { ServiceError } from "@/lib/server/coze";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { prompt?: unknown };
    const result = await createImage(typeof body.prompt === "string" ? body.prompt : "");
    return Response.json(result);
  } catch (error) {
    const response = error instanceof ServiceError
      ? { error: { code: error.code, message: error.message }, status: error.status }
      : { error: { code: "UNEXPECTED_ERROR", message: "图片生成暂时不可用，请稍后重试。" }, status: 500 };
    return Response.json({ error: response.error }, { status: response.status });
  }
}
