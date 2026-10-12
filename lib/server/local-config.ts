import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

type ConfigKey =
  | "COZE_WORKFLOW_ID"
  | "COZE_API_TOKEN"
  | "MINIMAX_API_KEY"
  | "COZE_TOPIC_PARAMETER"
  | "COZE_APP_ID"
  | "COZE_BOT_ID";

type LocalConfigInputKey =
  | "cozeWorkflowId"
  | "cozeApiToken"
  | "minimaxApiKey"
  | "cozeTopicParameter"
  | "cozeAppId"
  | "cozeBotId";

export type LocalConfigStatus = {
  cozeWorkflowId: boolean;
  cozeApiToken: boolean;
  minimaxApiKey: boolean;
  cozeTopicParameter: boolean;
  cozeAppId: boolean;
  cozeBotId: boolean;
};

export type LocalConfigSaveResult = {
  config: LocalConfigStatus;
  persisted: boolean;
};

export class LocalConfigError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

const INPUT_TO_ENV: Array<[LocalConfigInputKey, ConfigKey, number]> = [
  ["cozeWorkflowId", "COZE_WORKFLOW_ID", 300],
  ["cozeApiToken", "COZE_API_TOKEN", 2_000],
  ["minimaxApiKey", "MINIMAX_API_KEY", 2_000],
  ["cozeTopicParameter", "COZE_TOPIC_PARAMETER", 100],
  ["cozeAppId", "COZE_APP_ID", 300],
  ["cozeBotId", "COZE_BOT_ID", 300],
];

function localHost(url: string) {
  const hostname = new URL(url).hostname;
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

export function assertLocalConfigAccess(request: Request) {
  if (process.env.NODE_ENV !== "development" || !localHost(request.url)) {
    throw new LocalConfigError("该配置入口仅限 Codex 本地预览使用。", 404);
  }
}

export function getLocalConfigStatus(): LocalConfigStatus {
  return {
    cozeWorkflowId: Boolean(process.env.COZE_WORKFLOW_ID),
    cozeApiToken: Boolean(process.env.COZE_API_TOKEN),
    minimaxApiKey: Boolean(process.env.MINIMAX_API_KEY),
    cozeTopicParameter: Boolean(process.env.COZE_TOPIC_PARAMETER),
    cozeAppId: Boolean(process.env.COZE_APP_ID),
    cozeBotId: Boolean(process.env.COZE_BOT_ID),
  };
}

function sanitize(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLength || /[\r\n\0]/.test(trimmed)) {
    throw new LocalConfigError(`${label} 格式无效，请重新输入。`);
  }
  return trimmed;
}

function mergeEnvironment(existing: string, updates: Partial<Record<ConfigKey, string>>) {
  const lines = existing.replace(/\r\n/g, "\n").split("\n");
  for (const [key, value] of Object.entries(updates) as Array<[ConfigKey, string]>) {
    const pattern = new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=.*$`);
    const next = `${key}=${JSON.stringify(value)}`;
    const index = lines.findIndex((line) => pattern.test(line));
    if (index >= 0) lines[index] = next;
    else lines.push(next);
  }
  return `${lines.filter((line, index, all) => index < all.length - 1 || line !== "").join("\n").replace(/\n*$/, "")}\n`;
}

export async function saveLocalConfig(input: Record<string, unknown>): Promise<LocalConfigSaveResult> {
  const updates: Partial<Record<ConfigKey, string>> = {};
  for (const [inputKey, environmentKey, maxLength] of INPUT_TO_ENV) {
    const value = sanitize(input[inputKey], environmentKey, maxLength);
    if (value) updates[environmentKey] = value;
  }
  if (!Object.keys(updates).length) {
    throw new LocalConfigError("请至少填写一项配置后再保存。");
  }
  const appId = updates.COZE_APP_ID ?? process.env.COZE_APP_ID?.trim();
  const botId = updates.COZE_BOT_ID ?? process.env.COZE_BOT_ID?.trim();
  if (appId && botId) {
    throw new LocalConfigError("COZE_APP_ID 与 COZE_BOT_ID 不能同时配置。请只填写工作流实际需要的一项。");
  }

  const filePath = join(process.cwd(), ".env.local");
  let existing = "";
  let persisted = true;
  try {
    existing = await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new LocalConfigError("无法读取本地环境配置文件，请检查文件权限。", 500);
    }
  }

  try {
    // Windows cannot rename a temporary file over an existing .env.local.
    // Writing the local-only file in place avoids a false permission error.
    await writeFile(filePath, mergeEnvironment(existing, updates), { encoding: "utf8", mode: 0o600 });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error && typeof (error as { code?: unknown }).code === "string"
      ? `（${(error as { code: string }).code}）`
      : "";
    // Codex preview can run with a read-only project mount on Windows. Keep
    // values in this server process so real API calls work, but never claim
    // they survived a restart or send them back to the browser.
    if (code === "（EPERM）" || code === "（EACCES）") persisted = false;
    else throw new LocalConfigError(`本地配置未能保存${code}，请检查工作区写入权限。`, 500);
  }

  for (const [key, value] of Object.entries(updates) as Array<[ConfigKey, string]>) {
    process.env[key] = value;
  }
  return { config: getLocalConfigStatus(), persisted };
}
