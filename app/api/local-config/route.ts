import {
  LocalConfigError,
  assertLocalConfigAccess,
  getLocalConfigStatus,
  saveLocalConfig,
} from "@/lib/server/local-config";

export const runtime = "nodejs";

function failure(error: unknown) {
  const message = error instanceof LocalConfigError
    ? error.message
    : "本地配置暂时不可用，请检查后重试。";
  const status = error instanceof LocalConfigError ? error.status : 500;
  return Response.json({ error: { message } }, { status });
}

export async function GET(request: Request) {
  try {
    assertLocalConfigAccess(request);
    return Response.json({ config: getLocalConfigStatus() });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    assertLocalConfigAccess(request);
    const body = await request.json();
    const result = await saveLocalConfig(typeof body === "object" && body ? body as Record<string, unknown> : {});
    return Response.json(result);
  } catch (error) {
    return failure(error);
  }
}
