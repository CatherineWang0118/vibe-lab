export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 502,
  ) {
    super(message);
  }
}

// The non-streaming endpoint can disconnect before a long workflow has a
// chance to respond.  This workflow uses a news plug-in, a loop and RAG, so
// read Coze's SSE endpoint server-side and return only the final payload to
// the browser.  The PAT never leaves this module.
const COZE_STREAM_URL = "https://api.coze.cn/v1/workflow/stream_run";
const DEFAULT_TIMEOUT_MS = 600_000;
const MAX_TIMEOUT_MS = 600_000;

function cozeTimeoutMs() {
  const configured = Number(process.env.COZE_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return DEFAULT_TIMEOUT_MS;
  return Math.max(5_000, Math.min(Math.round(configured), MAX_TIMEOUT_MS));
}

function messageForStatus(status: number) {
  if (status === 401 || status === 403) return "Coze 访问被拒绝，请检查 PAT 权限和工作流发布状态。";
  if (status === 429) return "Coze 当前请求过于频繁，请稍后重试。";
  if (status >= 500) return "Coze 服务暂时不可用，请稍后重试或使用演示数据。";
  return "Coze 工作流暂时无法完成请求，请检查工作流配置后重试。";
}

export function hasCozeConfiguration() {
  return Boolean(process.env.COZE_WORKFLOW_ID && process.env.COZE_API_TOKEN);
}

function valueFromEnvironment(name: "COZE_APP_ID" | "COZE_BOT_ID") {
  return process.env[name]?.trim() || undefined;
}

function workflowFailure(payload: Record<string, unknown>) {
  const remoteCode = Number(payload.code);
  const remoteMessage = typeof payload.msg === "string" ? payload.msg.toLowerCase() : "";

  // Coze's detailed `msg` can include implementation details. Use it only to
  // select a clear local remedy; never return the remote message verbatim.
  if (remoteCode === 4200 || /publish|unpublished|not.*release|未发布|线上版本/.test(remoteMessage)) {
    return { code: "COZE_WORKFLOW_NOT_PUBLISHED", message: "Coze 工作流尚未发布为 API 服务。请发布后再重试。" };
  }
  if (/parameter|input|start node|required|参数|输入|字段/.test(remoteMessage)) {
    return { code: "COZE_INPUT_MISMATCH", message: "Coze 拒绝了工作流输入。请在本地连接的“高级 Coze 设置”中填写开始节点实际使用的参数名。" };
  }
  if (/app_id|application|project|应用/.test(remoteMessage)) {
    return { code: "COZE_APP_ID_REQUIRED", message: "该工作流属于 Coze 应用，需要在“高级 Coze 设置”中填写 COZE_APP_ID。" };
  }
  if (/bot_id|agent|智能体/.test(remoteMessage)) {
    return { code: "COZE_BOT_ID_REQUIRED", message: "该工作流需要关联智能体。请在“高级 Coze 设置”中填写 COZE_BOT_ID。" };
  }
  if (/permission|scope|token|auth|权限|鉴权/.test(remoteMessage)) {
    return { code: "COZE_PERMISSION_DENIED", message: "Coze PAT 没有运行该工作流的权限。请确认 PAT 已开通 run 权限，并可访问该工作流所在空间。" };
  }
  if (/not found|not exist|不存在|invalid.*workflow/.test(remoteMessage)) {
    return { code: "COZE_WORKFLOW_NOT_FOUND", message: "未找到该 Coze 工作流。请确认填写的是工作流 ID，而不是应用 ID 或空间 ID。" };
  }
  return { code: "COZE_WORKFLOW_FAILED", message: "Coze 工作流未能生成结果。请确认工作流已发布、PAT 具备 run 权限，并检查开始节点的输入字段。" };
}

type CozeStreamMessage = {
  content: string;
  nodeTitle: string;
  nodeFinished: boolean;
};

function safeStreamFailure(errorMessage: string) {
  const normalized = errorMessage.toLowerCase();
  if (/parameter|input|start node|required|参数|输入|字段/.test(normalized)) {
    return new ServiceError("COZE_INPUT_MISMATCH", "Coze 拒绝了工作流输入。请检查开始节点的参数名。", 502);
  }
  if (/permission|scope|token|auth|权限|鉴权/.test(normalized)) {
    return new ServiceError("COZE_PERMISSION_DENIED", "Coze PAT 没有运行该工作流的权限。请确认 PAT 已开通 run 权限。", 502);
  }
  if (/publish|unpublished|未发布|线上版本/.test(normalized)) {
    return new ServiceError("COZE_WORKFLOW_NOT_PUBLISHED", "Coze 工作流尚未发布为 API 服务。请发布后再重试。", 502);
  }
  return new ServiceError("COZE_WORKFLOW_FAILED", "Coze 工作流执行失败。请在 Coze 执行详情中检查新闻插件、循环和知识库节点。", 502);
}

function parseSseEvent(block: string) {
  const event = block.match(/^event:\s*(.+)$/m)?.[1]?.trim() || "";
  const dataText = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!event || !dataText) return { event, data: null as unknown };
  try { return { event, data: JSON.parse(dataText) as unknown }; } catch { return { event, data: null as unknown }; }
}

async function readCozeStream(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const messages: CozeStreamMessage[] = [];
  let sawDone = false;

  const accept = (block: string) => {
    const { event, data } = parseSseEvent(block);
    const record = isRecord(data) ? data : null;
    if (event === "Error") throw safeStreamFailure(typeof record?.error_message === "string" ? record.error_message : "");
    if (event === "Interrupt") throw new ServiceError("COZE_WORKFLOW_INTERRUPTED", "Coze 工作流等待额外输入，当前无法完成热点抓取。请检查工作流中的问答或插件授权节点。", 409);
    if (event === "Done") { sawDone = true; return; }
    if (event !== "Message" || !record) return;
    const content = typeof record.content === "string" ? record.content : "";
    if (!content) return;
    messages.push({
      content,
      nodeTitle: typeof record.node_title === "string" ? record.node_title : "",
      nodeFinished: record.node_is_finish === true,
    });
  };

  while (true) {
    const next = await reader.read();
    buffer += decoder.decode(next.value, { stream: !next.done });
    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() || "";
    for (const chunk of chunks) accept(chunk);
    if (next.done) break;
  }
  if (buffer.trim()) accept(buffer);
  if (!sawDone) throw new ServiceError("COZE_STREAM_INCOMPLETE", "Coze 流式响应未正常结束，请稍后重试并检查工作流执行详情。", 502);
  if (!messages.length) throw new ServiceError("COZE_EMPTY_RESULT", "Coze 工作流已结束，但未返回可读取的流式输出。请添加输出节点，或在结束节点开启流式输出并映射 output_list。", 422);

  // Coze appends an empty-title Message containing the final end-node object.
  // Prefer it; otherwise use the latest completed output node, then the
  // latest chunk so normal non-streaming workflows remain compatible.
  const final = [...messages].reverse().find((item) => item.nodeTitle === "" && item.nodeFinished)
    ?? [...messages].reverse().find((item) => item.nodeFinished)
    ?? messages[messages.length - 1];
  return final.content;
}

export async function runCozeWorkflow(topic: string): Promise<unknown> {
  const workflowId = process.env.COZE_WORKFLOW_ID;
  const token = process.env.COZE_API_TOKEN;
  if (!workflowId || !token) {
    throw new ServiceError("COZE_NOT_CONFIGURED", "尚未配置 Coze 工作流。请补充服务端环境变量后重试。", 503);
  }

  const parameterName = process.env.COZE_TOPIC_PARAMETER || "topic";
  const appId = valueFromEnvironment("COZE_APP_ID");
  const botId = valueFromEnvironment("COZE_BOT_ID");
  if (appId && botId) {
    throw new ServiceError("COZE_CONFIGURATION_INVALID", "COZE_APP_ID 与 COZE_BOT_ID 不能同时配置。请仅保留工作流实际需要的一项。", 400);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cozeTimeoutMs());
  try {
    const response = await fetch(COZE_STREAM_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workflow_id: workflowId,
        parameters: { [parameterName]: topic },
        ...(appId ? { app_id: appId } : {}),
        ...(botId ? { bot_id: botId } : {}),
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new ServiceError("COZE_REQUEST_FAILED", messageForStatus(response.status), response.status);
    if (!response.body) throw new ServiceError("COZE_EMPTY_RESPONSE", "Coze 未建立工作流响应流，请稍后重试。", 502);
    return await readCozeStream(response.body);
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ServiceError("COZE_TIMEOUT", "Coze 在等待期限内未返回结果。请稍后重试；若持续超时，请缩短工作流的循环或检索步骤。", 504);
    }
    throw new ServiceError("COZE_NETWORK_ERROR", "无法连接 Coze，请检查网络后重试或使用演示数据。", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
