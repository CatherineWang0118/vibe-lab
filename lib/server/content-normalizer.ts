import type { ContentVersion, Recommendation, Shot } from "@/lib/content";
import { ServiceError } from "@/lib/server/coze";

type Dictionary = Record<string, unknown>;

const object = (value: unknown): Dictionary | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Dictionary) : null;

function parseString(value: string): unknown {
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  if (!trimmed) return "";
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function unwrap(value: unknown, depth = 0): unknown {
  if (depth > 8) return value;
  if (typeof value === "string") {
    const next = parseString(value);
    return next === value ? value : unwrap(next, depth + 1);
  }
  // Coze can return an output list whose individual cards are wrapped again
  // as `{ output: ... }`. Unwrap each card as well, rather than treating the
  // wrapper as a publish package with empty channels.
  if (Array.isArray(value)) return value.map((item) => unwrap(item, depth + 1));
  const record = object(value);
  if (!record) return value;
  // Coze can preserve the End node's variable name. Support both camelCase
  // and snake_case forms so an End node such as `output_list` becomes the
  // application's version list rather than an unrecognised wrapper object.
  for (const key of ["outputList", "output_list", "OutputList", "output", "Output", "result", "data"]) {
    if (record[key] !== undefined && record[key] !== value) return unwrap(record[key], depth + 1);
  }
  return value;
}

function pick(record: Dictionary | null, keys: string[]): unknown {
  if (!record) return undefined;
  for (const key of keys) if (record[key] !== undefined) return record[key];
  return undefined;
}

function text(value: unknown, fallback = ""): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  return fallback;
}

function strings(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => text(entry)).filter(Boolean);
  const one = text(value);
  if (!one) return [];
  return one.split(/[\n,，、]/).map((entry) => entry.trim()).filter(Boolean);
}

function recommendation(record: Dictionary | null): Recommendation {
  const value = pick(record, ["recommended", "recommend", "推荐", "推荐状态", "status"]);
  const reason = text(pick(record, ["reason", "unrecommendedReason", "不推荐原因", "原因"]));
  const normalized = text(value).toLowerCase();
  const recommended = value === false || normalized.includes("不推荐") || normalized === "false" ? false : true;
  return { recommended, reason: !recommended ? reason || "该渠道不适合当前主题，请人工评估后再投放。" : undefined };
}

function section(card: Dictionary, keys: string[]) {
  const value = pick(card, keys);
  return object(value) || card;
}

function shots(value: unknown): Shot[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const record = object(item);
    if (!record) return { range: `镜头 ${index + 1}`, visual: text(item), voiceover: "", subtitle: "" };
    return {
      range: text(pick(record, ["range", "timeRange", "time", "时间范围", "时间", "时长"]), `镜头 ${index + 1}`),
      visual: text(pick(record, ["visual", "scene", "画面", "镜头"])),
      voiceover: text(pick(record, ["voiceover", "voice", "口播", "旁白"])),
      subtitle: text(pick(record, ["subtitle", "字幕", "caption"])),
    };
  });
}

function escapePattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function markedSection(source: string, label: string, following: string[]) {
  const marker = new RegExp(`-{3,}\\s*${escapePattern(label)}\\s*-{3,}`, "g");
  const start = marker.exec(source);
  if (!start || start.index === undefined) return "";
  const contentStart = start.index + start[0].length;
  let end = source.length;
  for (const nextLabel of following) {
    const nextMarker = new RegExp(`-{3,}\\s*${escapePattern(nextLabel)}\\s*-{3,}`, "g");
    nextMarker.lastIndex = contentStart;
    const next = nextMarker.exec(source);
    if (next?.index !== undefined) end = Math.min(end, next.index);
  }
  return source.slice(contentStart, end).trim();
}

function labelledValue(source: string, label: string, following: string[]) {
  const startPattern = new RegExp(`(?:^|\\n)\\s*${escapePattern(label)}\\s*[：:]\\s*`, "g");
  const start = startPattern.exec(source);
  if (!start || start.index === undefined) return "";
  const contentStart = start.index + start[0].length;
  let end = source.length;
  for (const nextLabel of following) {
    const nextPattern = new RegExp(`\\n\\s*${escapePattern(nextLabel)}\\s*[：:]`, "g");
    nextPattern.lastIndex = contentStart;
    const next = nextPattern.exec(source);
    if (next?.index !== undefined) end = Math.min(end, next.index);
  }
  return source.slice(contentStart, end).trim();
}

function numberedLines(value: string) {
  return value.split("\n")
    .map((line) => line.trim().replace(/^\d+\s*[.、．]\s*/, ""))
    .filter(Boolean);
}

function numberedItems(value: string) {
  const matched = [...value.matchAll(/(?:^|[；;\n])\s*\d+\s*[.、．]\s*([\s\S]*?)(?=(?:[；;\n]\s*\d+\s*[.、．])|$)/g)]
    .map((entry) => entry[1].trim())
    .filter(Boolean);
  return matched.length ? matched : value.split(/[；;\n]+/).map((entry) => entry.trim()).filter(Boolean);
}

function textRecommendation(source: string) {
  const decision = labelledValue(source, "推荐决策", ["推荐商品", "商品依据", "经营指标", "微博文案", "笔记标题", "视频标题", "人工审核提醒"]);
  const recommended = !/(?:不推荐|不建议|暂不)/.test(decision);
  const reason = decision.match(/(?:原因|reason)\s*[：:]\s*(.+)/i)?.[1]?.trim();
  return { recommended, reason: !recommended ? reason || decision || "该渠道不适合当前主题，请人工评估后再投放。" : undefined };
}

function textShots(value: string): Shot[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).flatMap((line) => {
    const parts = line.replace(/^\d+\s*[.、．]\s*/, "").split(/[｜|]/).map((part) => part.trim());
    if (parts.length < 2) return [];
    return [{ range: parts[0], visual: parts[1], voiceover: parts[2] || "", subtitle: parts[3] || "" }];
  });
}

function parseMultiChannelText(value: string, topic: string, index: number): ContentVersion | null {
  if (!/(?:微博发布包|小红书发布包|短视频发布包)/.test(value)) return null;

  const weiboSection = markedSection(value, "微博发布包", ["小红书发布包", "短视频发布包", "统一审核清单"]);
  const xiaohongshuSection = markedSection(value, "小红书发布包", ["短视频发布包", "统一审核清单"]);
  const videoSection = markedSection(value, "短视频发布包", ["统一审核清单"]);
  if (!weiboSection && !xiaohongshuSection && !videoSection) return null;

  const xhsBody = labelledValue(xiaohongshuSection, "正文", ["配图建议", "话题标签", "评论区引导", "事实依据", "人工审核提醒"]);
  const videoScript = labelledValue(videoSection, "完整口播稿", ["封面文案", "发布文案", "话题标签", "音乐与节奏建议", "事实依据", "人工审核提醒"]);
  const combinedAudit = markedSection(value, "统一审核清单", []);

  return {
    id: `coze-${Date.now()}-${index}`,
    label: `版本 ${index + 1}`,
    auditReminder: combinedAudit ? `统一审核清单：\n${combinedAudit}` : "生成内容仅作为初稿，发布前需人工审核事实、版权和平台规范。",
    weibo: {
      ...textRecommendation(weiboSection),
      body: labelledValue(weiboSection, "微博文案", ["人工审核提醒"]),
      tags: [`#${topic.replace(/^#/, "")}`],
      auditNote: labelledValue(weiboSection, "人工审核提醒", []) || "生成内容仅作为初稿，发布前需人工审核。",
    },
    xiaohongshu: {
      ...textRecommendation(xiaohongshuSection),
      titles: numberedLines(labelledValue(xiaohongshuSection, "笔记标题", ["封面文案"])),
      coverText: labelledValue(xiaohongshuSection, "封面文案", ["正文"]),
      body: xhsBody,
      imageSuggestions: numberedItems(labelledValue(xiaohongshuSection, "配图建议", ["话题标签", "评论区引导", "事实依据", "人工审核提醒"])),
      tags: strings(labelledValue(xiaohongshuSection, "话题标签", ["评论区引导", "事实依据", "人工审核提醒"])),
      auditNote: labelledValue(xiaohongshuSection, "人工审核提醒", []) || "生成内容仅作为初稿，发布前需人工审核。",
    },
    video: {
      ...textRecommendation(videoSection),
      titles: numberedLines(labelledValue(videoSection, "视频标题", ["开场钩子"])),
      hook: labelledValue(videoSection, "开场钩子", ["分镜脚本"]),
      script: videoScript,
      shots: textShots(labelledValue(videoSection, "分镜脚本", ["完整口播稿"])),
      publishCopy: labelledValue(videoSection, "发布文案", ["话题标签", "音乐与节奏建议", "事实依据", "人工审核提醒"]),
      tags: strings(labelledValue(videoSection, "话题标签", ["音乐与节奏建议", "事实依据", "人工审核提醒"])),
      auditNote: labelledValue(videoSection, "人工审核提醒", []) || "生成内容仅作为初稿，发布前需人工审核。",
    },
  };
}

function makeVersion(cardInput: unknown, topic: string, index: number): ContentVersion {
  const nested = unwrap(cardInput);
  if (!Array.isArray(cardInput) && nested !== cardInput) return makeVersion(nested, topic, index);
  const card = object(cardInput);
  if (!card) {
    if (typeof cardInput !== "string" || !cardInput.trim()) throw new ServiceError("CONTENT_PARSE_FAILED", "工作流返回了空结果，无法生成内容卡片。", 422);
    const parsed = parseMultiChannelText(cardInput, topic, index);
    if (parsed) return parsed;
    return {
      id: `coze-${Date.now()}-${index}`,
      label: `版本 ${index + 1}`,
      auditReminder: "工作流返回的是纯文本。发布前请人工补齐渠道字段，并审核事实、版权和平台规范。",
      weibo: { recommended: true, body: cardInput, tags: [`#${topic}`], auditNote: "待人工核实。" },
      xiaohongshu: { recommended: false, reason: "工作流没有返回小红书结构化字段。", titles: [], coverText: "", body: "", imageSuggestions: [], tags: [], auditNote: "待人工补齐。" },
      video: { recommended: false, reason: "工作流没有返回短视频结构化字段。", titles: [], hook: "", script: "", shots: [], publishCopy: "", tags: [], auditNote: "待人工补齐。" },
    };
  }
  const weibo = section(card, ["weibo", "微博", "weiboPackage", "微博发布包"]);
  const xiaohongshu = section(card, ["xiaohongshu", "xhs", "小红书", "xiaohongshuPackage", "小红书发布包"]);
  const video = section(card, ["video", "shortVideo", "短视频", "videoPackage", "短视频发布包"]);
  const result: ContentVersion = {
    id: text(pick(card, ["id", "versionId"])) || `coze-${Date.now()}-${index}`,
    label: text(pick(card, ["label", "versionName", "版本名称"])) || `版本 ${index + 1}`,
    auditReminder: text(pick(card, ["auditReminder", "审核提醒", "reviewNote"]), "生成内容仅作为初稿，发布前需人工审核事实、版权和平台规范。"),
    weibo: {
      ...recommendation(weibo),
      body: text(pick(weibo, ["body", "content", "text", "正文", "微博正文"])),
      tags: strings(pick(weibo, ["tags", "hashtags", "话题标签", "标签"])),
      auditNote: text(pick(weibo, ["auditNote", "审核提醒", "reviewNote"]), "生成内容仅作为初稿，发布前需人工审核。"),
    },
    xiaohongshu: {
      ...recommendation(xiaohongshu),
      titles: strings(pick(xiaohongshu, ["titles", "titleOptions", "标题备选", "标题"])),
      coverText: text(pick(xiaohongshu, ["coverText", "cover", "封面文案"])),
      body: text(pick(xiaohongshu, ["body", "content", "正文"])),
      imageSuggestions: strings(pick(xiaohongshu, ["imageSuggestions", "images", "配图建议", "配图"])),
      tags: strings(pick(xiaohongshu, ["tags", "hashtags", "话题标签", "标签"])),
      auditNote: text(pick(xiaohongshu, ["auditNote", "审核提醒", "reviewNote"]), "生成内容仅作为初稿，发布前需人工审核。"),
    },
    video: {
      ...recommendation(video),
      titles: strings(pick(video, ["titles", "titleOptions", "标题备选", "标题"])),
      hook: text(pick(video, ["hook", "openingHook", "开场钩子"])),
      script: text(pick(video, ["script", "voiceover", "完整口播稿", "口播稿"])),
      shots: shots(pick(video, ["shots", "storyboard", "分镜", "完整分镜"])),
      publishCopy: text(pick(video, ["publishCopy", "caption", "发布文案"])),
      tags: strings(pick(video, ["tags", "hashtags", "话题标签", "标签"])),
      auditNote: text(pick(video, ["auditNote", "审核提醒", "reviewNote"]), "生成内容仅作为初稿，发布前需人工审核。"),
    },
  };
  const isEmpty = !result.weibo.body && !result.xiaohongshu.body && !result.video.script;
  if (isEmpty) throw new ServiceError("CONTENT_PARSE_FAILED", "工作流结果缺少可展示的文案字段，请检查输出格式。", 422);
  return result;
}

export function normalizeWorkflowOutput(raw: unknown, topic: string): ContentVersion[] {
  const unwrapped = unwrap(raw);
  const cards = Array.isArray(unwrapped) ? unwrapped : [unwrapped];
  const versions = cards.map((card, index) => makeVersion(card, topic, index));
  if (!versions.length) throw new ServiceError("CONTENT_PARSE_FAILED", "工作流返回了空结果。", 422);
  return versions;
}
