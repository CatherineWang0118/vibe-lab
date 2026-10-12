import { ServiceError } from "@/lib/server/coze";

const baseUrl = () => (process.env.MINIMAX_API_BASE_URL || "https://api.minimax.chat").replace(/\/$/, "");

function hasKey() {
  return Boolean(process.env.MINIMAX_API_KEY);
}

function cleanPrompt(prompt: string) {
  const value = prompt.trim();
  if (!value) throw new ServiceError("INVALID_PROMPT", "请先填写生成提示。", 400);
  if (value.length > 1_500) throw new ServiceError("INVALID_PROMPT", "生成提示过长，请控制在 1500 个字符内。", 400);
  return value;
}

async function request(path: string, init: RequestInit) {
  const key = process.env.MINIMAX_API_KEY;
  if (!key || !hasKey()) throw new ServiceError("MINIMAX_NOT_CONFIGURED", "尚未配置 MiniMax API Key，无法生成媒体。", 503);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  try {
    const response = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      signal: controller.signal,
    });
    let payload: unknown = null;
    try { payload = await response.json(); } catch { /* hide remote body */ }
    if (!response.ok) {
      const message = response.status === 401 || response.status === 403
        ? "MiniMax 访问被拒绝，请检查服务端 API Key 与权限。"
        : response.status === 429
          ? "MiniMax 当前请求过于频繁，请稍后重试。"
          : "MiniMax 暂时无法完成生成，请稍后重试。";
      throw new ServiceError("MINIMAX_REQUEST_FAILED", message, response.status);
    }
    return payload;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw new ServiceError("MINIMAX_TIMEOUT", "MiniMax 生成等待超时，请稍后查询或重试。", 504);
    throw new ServiceError("MINIMAX_NETWORK_ERROR", "无法连接 MiniMax，请检查网络后重试。", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function getAtPath(value: unknown, path: string[]): unknown {
  let cursor: unknown = value;
  for (const key of path) {
    if (!cursor || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}

function findUrl(value: unknown): string | undefined {
  const candidates = [
    ["data", "image_urls", "0"], ["data", "image_url"], ["data", "url"],
    ["image_url"], ["url"], ["data", "video_url"], ["video_url"],
    ["data", "file", "url"], ["file", "url"],
  ];
  for (const path of candidates) {
    let cursor: unknown = value;
    for (const key of path) {
      if (Array.isArray(cursor) && /^\d+$/.test(key)) cursor = cursor[Number(key)];
      else if (cursor && typeof cursor === "object") cursor = (cursor as Record<string, unknown>)[key];
      else { cursor = undefined; break; }
    }
    if (typeof cursor === "string" && /^(https?:|data:)/.test(cursor)) return cursor;
  }
  return undefined;
}

function findTaskId(value: unknown): string | undefined {
  for (const path of [["task_id"], ["data", "task_id"], ["data", "id"], ["task", "id"]]) {
    const result = getAtPath(value, path);
    if (typeof result === "string" || typeof result === "number") return String(result);
  }
  return undefined;
}

export async function createImage(prompt: string) {
  const payload = await request("/v1/image_generation", {
    method: "POST",
    body: JSON.stringify({
      model: process.env.MINIMAX_IMAGE_MODEL || "image-01",
      prompt: cleanPrompt(prompt),
      aspect_ratio: "3:4",
      response_format: "url",
    }),
  });
  const url = findUrl(payload);
  if (!url) throw new ServiceError("MINIMAX_EMPTY_RESULT", "MiniMax 未返回图片地址，请检查所选模型配置。", 502);
  return { status: "succeeded" as const, url };
}

export async function createVideo(prompt: string) {
  const payload = await request("/v1/video_generation", {
    method: "POST",
    body: JSON.stringify({
      model: process.env.MINIMAX_VIDEO_MODEL || "T2V-01-Director",
      prompt: cleanPrompt(prompt),
    }),
  });
  const url = findUrl(payload);
  if (url) return { status: "succeeded" as const, url };
  const taskId = findTaskId(payload);
  if (!taskId) throw new ServiceError("MINIMAX_EMPTY_RESULT", "MiniMax 未返回视频任务，请检查所选模型配置。", 502);
  return { status: "pending" as const, taskId };
}

export async function queryVideo(taskId: string) {
  if (!taskId || taskId.length > 200) throw new ServiceError("INVALID_TASK", "视频任务标识无效。", 400);
  const payload = await request(`/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`, { method: "GET" });
  const url = findUrl(payload);
  if (url) return { status: "succeeded" as const, url };
  const status = String(getAtPath(payload, ["data", "status"]) || getAtPath(payload, ["status"]) || "").toLowerCase();
  if (status.includes("fail") || status.includes("error")) throw new ServiceError("MINIMAX_VIDEO_FAILED", "MiniMax 视频生成失败，请调整提示后重试。", 502);
  return { status: "pending" as const, taskId };
}
