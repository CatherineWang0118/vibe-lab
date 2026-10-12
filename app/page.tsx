"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { channelText, type ContentVersion, type Shot } from "@/lib/content";

type Step = 1 | 2 | 3 | 4 | 5;

type NewsItem = {
  id: string;
  tag: string;
  title: string;
  summary: string;
  source: string;
  time: string;
  heat: string;
};

type Product = {
  id: string;
  name: string;
  brand: string;
  price: string;
  originalPrice: string;
  match: number | null;
  reason: string;
  points: string[];
  tone: "sun" | "outdoor" | "coffee";
};

type EditorialMode = "demo" | "real";
type EditorialStatus = "idle" | "demo" | "generating" | "success" | "error";
type CampaignMode = "demo" | "real";
type CampaignStatus = "idle" | "running" | "success" | "error";
type ProductMatchMode = "demo" | "real";
type ProductMatchStatus = "idle" | "matching" | "success" | "error";
type MediaKind = "image" | "video";
type ReviewChannel = "weibo" | "xiaohongshu" | "video";
type ChannelReviewState = { reviewed: boolean; sent: boolean };
type ReviewStates = Record<ReviewChannel, ChannelReviewState>;
type MediaTask = {
  status: "idle" | "loading" | "pending" | "succeeded" | "failed";
  url?: string;
  error?: string;
  taskId?: string;
};
type LocalConfigStatus = {
  cozeWorkflowId: boolean;
  cozeApiToken: boolean;
  minimaxApiKey: boolean;
  cozeTopicParameter: boolean;
  cozeAppId: boolean;
  cozeBotId: boolean;
};
type LocalConfigDraft = {
  cozeWorkflowId: string;
  cozeApiToken: string;
  minimaxApiKey: string;
  cozeTopicParameter: string;
  cozeAppId: string;
  cozeBotId: string;
};
type RagProductResponse = {
  id?: string;
  name?: string;
  brand?: string;
  price?: string;
  reason?: string;
  points?: string[];
  match?: number | null;
};

const emptyConfigDraft: LocalConfigDraft = { cozeWorkflowId: "", cozeApiToken: "", minimaxApiKey: "", cozeTopicParameter: "", cozeAppId: "", cozeBotId: "" };
const emptyReviewStates = (): ReviewStates => ({ weibo: { reviewed: false, sent: false }, xiaohongshu: { reviewed: false, sent: false }, video: { reviewed: false, sent: false } });

const steps: Array<{ id: Step; label: string; hint: string }> = [
  { id: 1, label: "新闻抓取", hint: "选择爆款热点" },
  { id: 2, label: "建议匹配商品", hint: "查看智能推荐" },
  { id: 3, label: "匹配商品", hint: "筛选并绑定商品" },
  { id: 4, label: "创作文案", hint: "生成三平台内容" },
  { id: 5, label: "审核并发送", hint: "多渠道模拟发布" },
];

const newsItems: NewsItem[] = [
  {
    id: "spring-outdoor",
    tag: "生活消费",
    title: "多地气温回升，轻户外消费热度持续上行",
    summary: "周末近郊游、城市公园与露营相关讨论量增长，轻量装备成为高频搜索词。",
    source: "消费趋势观察",
    time: "10 分钟前",
    heat: "128.6 万",
  },
  {
    id: "spring-skin",
    tag: "春日趋势",
    title: "紫外线指数走高，通勤防晒进入集中补货期",
    summary: "社交平台中“通勤防晒”和“轻薄防晒”讨论升温，用户更关注便携与补涂体验。",
    source: "城市生活周刊",
    time: "28 分钟前",
    heat: "86.4 万",
  },
  {
    id: "gift-season",
    tag: "节日营销",
    title: "春日礼赠场景扩容，香氛个护搜索热度攀升",
    summary: "从朋友见面到办公室心意礼，消费者开始提前收藏具备仪式感的轻量礼盒。",
    source: "零售新风向",
    time: "47 分钟前",
    heat: "62.1 万",
  },
  {
    id: "coffee-break",
    tag: "职场方式",
    title: "办公室“15 分钟咖啡休息”成社交平台新话题",
    summary: "年轻职场人分享工位冲煮与短暂放空时刻，便携咖啡器具受到关注。",
    source: "新职场研究所",
    time: "1 小时前",
    heat: "48.8 万",
  },
  {
    id: "smart-home",
    tag: "智能科技",
    title: "AI 轻量化工具进入家庭场景，效率型消费讨论升温",
    summary: "用户开始关注智能设备是否真的节省时间，轻量、易上手成为新的讨论关键词。",
    source: "科技消费观察",
    time: "1 小时前",
    heat: "39.2 万",
  },
  {
    id: "digital-wellness",
    tag: "数码生活",
    title: "通勤耳机的降噪与续航体验成为数码话题焦点",
    summary: "围绕地铁通勤、开放办公和专注时段的使用体验讨论正在增长。",
    source: "数码日报",
    time: "2 小时前",
    heat: "27.6 万",
  },
];

const products: Product[] = [
  {
    id: "mat",
    name: "轻量折叠野餐垫",
    brand: "MORROW LAB",
    price: "¥159",
    originalPrice: "¥199",
    match: 96,
    reason: "与近郊游、城市公园和轻量装备讨论高度相关。",
    points: ["防泼水面料", "一秒收纳", "4 色可选"],
    tone: "outdoor",
  },
  {
    id: "sunscreen",
    name: "云感高倍防晒喷雾",
    brand: "DAYBLOOM",
    price: "¥89",
    originalPrice: "¥109",
    match: 93,
    reason: "承接紫外线、通勤补涂和春游防晒的高频需求。",
    points: ["SPF50+", "轻薄成膜", "可倒喷"],
    tone: "sun",
  },
  {
    id: "cup",
    name: "随行保温咖啡杯",
    brand: "SIP STUDIO",
    price: "¥129",
    originalPrice: "¥159",
    match: 88,
    reason: "契合办公室咖啡休息与通勤携带场景。",
    points: ["316L 内胆", "360° 防漏", "260ml 容量"],
    tone: "coffee",
  },
];

function ragTone(product: RagProductResponse): Product["tone"] {
  const source = `${product.name || ""} ${product.reason || ""} ${(product.points || []).join(" ")}`;
  if (/(咖啡|杯|保温|饮)/.test(source)) return "coffee";
  if (/(防晒|阳光|伞|护肤)/.test(source)) return "sun";
  return "outdoor";
}

function campaignProductFromRag(product: RagProductResponse, index: number): Product {
  const name = product.name?.trim() || `RAG 商品 ${index + 1}`;
  return {
    id: product.id?.trim() || `coze-rag-${index + 1}`,
    name,
    brand: product.brand?.trim() || "Coze RAG 商品库",
    price: product.price?.trim() || "价格待人工核实",
    originalPrice: "",
    match: typeof product.match === "number" ? product.match : null,
    reason: product.reason?.trim() || "由 Coze 工作流 RAG 商品库召回，请人工核实库存、价格与适用范围。",
    points: product.points?.filter(Boolean).slice(0, 4).length ? product.points.filter(Boolean).slice(0, 4) : ["RAG 召回", "待人工核实"],
    tone: ragTone(product),
  };
}

function makeCampaignDemoVersions(news: NewsItem, product: Product): ContentVersion[] {
  const subject = product.name;
  const makeVersion = (variant: number): ContentVersion => {
    const scene = variant === 1 ? "春日轻户外" : "城市通勤与周末出发";
    return {
      id: `campaign-demo-${variant}-${product.id}-${news.id}`,
      label: `版本 ${variant} · ${variant === 1 ? "场景种草" : "互动引导"}`,
      auditReminder: "生成内容仅作为初稿，发布前需人工审核事实、价格、版权和平台规范；涉及功效、数据或来源的内容请待人工核实。",
      weibo: {
        recommended: true,
        body: variant === 1
          ? `🌿 ${news.title}\n\n春天适合把脚步放慢一点，也适合随时出发。${product.brand} ${subject}，${product.points.slice(0, 2).join("、")}；把轻松出门的小心思，装进今天的计划里。\n\n这个周末，你最想去哪里晒晒太阳？评论区聊聊👇`
          : `不必等一场很远的旅行，附近的公园、街角和午后的风都值得认真感受。带上 ${subject}，让每一次临时起意都更从容。\n\n说说你最近收藏的春日目的地吧！`,
        tags: ["#春日轻户外", "#城市生活", `#${subject.replace(/[\s]/g, "")}`],
        auditNote: "请核对商品价格、库存、适用场景和可能涉及的功效描述，确认后再发布。",
      },
      xiaohongshu: {
        recommended: true,
        titles: [`春天出门的轻盈感，被它拿捏了`, `把${scene}装进一件小装备里`, `${subject}：周末说走就走的小仪式`],
        coverText: `${scene}\n轻松出发清单`,
        body: `最近被“轻一点出门”的生活方式治愈了。\n\n${product.brand} ${subject}，${product.points.join("、")}。不需要复杂准备，也能让一段散步、一场公园野餐，变得更有仪式感。\n\n把周末留给风和阳光，也留给更自在的自己。`,
        imageSuggestions: [
          `竖版封面：${subject}置于春日公园草地，留白标题区，明亮自然光，生活方式摄影。`,
          `细节特写：展示${product.points[0]}的材质或功能，无品牌无文字，干净背景。`,
          `场景图：城市公园休息区搭配${subject}，人物不露脸，轻松周末氛围。`,
        ],
        tags: ["#春日出行", "#轻户外", `#${subject.replace(/[\s]/g, "")}`],
        auditNote: "配图不得出现未经授权的商标、人物肖像或第三方素材；价格与卖点请待人工核实。",
      },
      video: {
        recommended: true,
        titles: [`周末出门，带上这件轻量小装备`, `${subject}让春日出行更从容`, `3 秒解锁春天的轻松打开方式`],
        hook: `周末想出门，又不想大包小包？这件小装备刚好解决了。`,
        script: `天气一好，就想去公园走走。${subject}，${product.points.slice(0, 2).join("、")}。不需要复杂计划，带上它，给自己一点随时出发的自由。`,
        shots: [
          { range: "00:00–00:03", visual: `${subject}放在浅色桌面，手部拿起产品，晨光自然照入。`, voiceover: "周末想出门，又不想大包小包？", subtitle: "轻松出发，从少带一点开始" },
          { range: "00:03–00:08", visual: `展示${product.points[0]}细节，镜头轻推，干净生活方式画面。`, voiceover: `${subject}，${product.points[0]}。`, subtitle: product.points[0] },
          { range: "00:08–00:15", visual: "城市公园散步或野餐场景，人物不露脸，轻快自然光。", voiceover: "不需要复杂计划，带上它就能随时出发。", subtitle: "把周末还给自己" },
        ],
        publishCopy: `春日出门，不用带太多。${subject}，把轻松留给每一次随时出发。`,
        tags: ["#春日轻户外", "#周末去哪儿", `#${subject.replace(/[\s]/g, "")}`],
        auditNote: "视频中避免展示未授权场地、人物或品牌；商品性能与价格信息需要人工复核。",
      },
    };
  };
  return [makeVersion(1), makeVersion(2)];
}

function copyText(value: string, onDone: () => void) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(value).then(onDone).catch(() => fallbackCopy(value, onDone));
    return;
  }
  fallbackCopy(value, onDone);
}

function fallbackCopy(value: string, onDone: () => void) {
  const node = document.createElement("textarea");
  node.value = value;
  node.style.position = "fixed";
  node.style.opacity = "0";
  document.body.appendChild(node);
  node.select();
  document.execCommand("copy");
  document.body.removeChild(node);
  onDone();
}

export default function Home() {
  const [step, setStep] = useState<Step>(1);
  const [selectedNewsId, setSelectedNewsId] = useState(newsItems[0].id);
  const [campaignProducts, setCampaignProducts] = useState<Product[]>(products);
  const [selectedProductId, setSelectedProductId] = useState(products[0].id);
  const [campaignMode, setCampaignMode] = useState<CampaignMode>("real");
  const [campaignStatus, setCampaignStatus] = useState<CampaignStatus>("idle");
  const [campaignQuery, setCampaignQuery] = useState("");
  const [campaignNews, setCampaignNews] = useState<NewsItem[]>([]);
  const [campaignError, setCampaignError] = useState("");
  const [campaignWarnings, setCampaignWarnings] = useState<string[]>([]);
  const [productMatchMode, setProductMatchMode] = useState<ProductMatchMode>("demo");
  const [productMatchStatus, setProductMatchStatus] = useState<ProductMatchStatus>("idle");
  const [productMatchError, setProductMatchError] = useState("");
  const [isRefreshingNews, setIsRefreshingNews] = useState(false);
  const [newsRefreshCount, setNewsRefreshCount] = useState(0);
  const [newsRefreshedAt, setNewsRefreshedAt] = useState("10:32");
  const [suggestionAdopted, setSuggestionAdopted] = useState(false);
  const [productBound, setProductBound] = useState(false);
  const [generatedCopy, setGeneratedCopy] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [reviewStates, setReviewStates] = useState<ReviewStates>(emptyReviewStates);
  const [reviewChannel, setReviewChannel] = useState<ReviewChannel>("weibo");
  const [newsFilter, setNewsFilter] = useState<"综合" | "消费" | "生活" | "科技">("综合");
  const [toast, setToast] = useState("");
  const [editorialMode, setEditorialMode] = useState<EditorialMode>("demo");
  const [editorialStatus, setEditorialStatus] = useState<EditorialStatus>("idle");
  const [editorialVersions, setEditorialVersions] = useState<ContentVersion[]>([]);
  const [editorialIndex, setEditorialIndex] = useState(0);
  const [editorialError, setEditorialError] = useState("");
  const [editorialMedia, setEditorialMedia] = useState<Record<string, MediaTask>>({});
  const [showConfig, setShowConfig] = useState(false);
  const [localConfig, setLocalConfig] = useState<LocalConfigStatus | null>(null);
  const [configDraft, setConfigDraft] = useState<LocalConfigDraft>(emptyConfigDraft);
  const [configMessage, setConfigMessage] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  const visibleNews = useMemo(() => {
    const offset = newsRefreshCount % newsItems.length;
    return [...newsItems.slice(offset), ...newsItems.slice(0, offset)].map((item, index) => newsRefreshCount && index === 0 ? { ...item, time: "刚刚" } : item);
  }, [newsRefreshCount]);
  const activeNewsItems = campaignMode === "demo" ? visibleNews : campaignNews;
  const campaignReady = campaignMode === "demo" || campaignNews.length > 0;
  const selectedNews = useMemo(() => activeNewsItems.find((item) => item.id === selectedNewsId) || activeNewsItems[0] || newsItems[0], [activeNewsItems, selectedNewsId]);
  const selectedProduct = useMemo(() => campaignProducts.find((item) => item.id === selectedProductId) || campaignProducts[0] || products[0], [campaignProducts, selectedProductId]);
  const stepMeta = steps.find((item) => item.id === step) || steps[0];
  const activeEditorial = editorialVersions[editorialIndex];

  useEffect(() => {
    let active = true;
    void fetch("/api/local-config")
      .then(async (response) => response.ok ? response.json() as Promise<{ config?: LocalConfigStatus }> : null)
      .then((payload) => { if (active && payload?.config) setLocalConfig(payload.config); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const useDemoCampaign = () => {
    setCampaignMode("demo");
    setCampaignStatus("success");
    setCampaignError("");
    setCampaignWarnings([]);
    setSelectedNewsId(visibleNews[0].id);
    setCampaignProducts(products);
    setSelectedProductId(products[0].id);
    setProductMatchMode("demo");
    setProductMatchStatus("idle");
    setEditorialMode("demo");
    setEditorialStatus("idle");
    setEditorialVersions([]);
    showToast("已切换到演示数据；不会调用 Coze 工作流");
  };

  const runCampaign = async () => {
    const query = campaignQuery.trim();
    if (!query) {
      setCampaignError("请输入新闻检索关键词后再调用 Coze 工作流。");
      setCampaignStatus("error");
      return;
    }
    setCampaignMode("real");
    setCampaignStatus("running");
    setCampaignError("");
    setCampaignWarnings([]);
    try {
      const response = await fetch("/api/campaign/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
      const payload = await response.json() as { news?: NewsItem[]; products?: RagProductResponse[]; versions?: ContentVersion[]; warnings?: string[]; error?: { message?: string } };
      if (!response.ok || !payload.news?.length) throw new Error(payload.error?.message || "Coze 未返回可展示的新闻。");
      const matchedProducts = (payload.products || []).map(campaignProductFromRag);
      setCampaignNews(payload.news);
      const now = new Date();
      setNewsRefreshedAt(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
      setSelectedNewsId(payload.news[0].id);
      setCampaignProducts(matchedProducts);
      setSelectedProductId(matchedProducts[0]?.id || "");
      setProductMatchMode("real");
      setProductMatchStatus(matchedProducts.length ? "success" : "idle");
      setProductMatchError(matchedProducts.length ? "" : "Coze 工作流没有返回可识别的 RAG 商品。");
      setSuggestionAdopted(false);
      setProductBound(false);
      setGeneratedCopy("");
      setEditorialMedia({});
      setCampaignWarnings(payload.warnings || []);
      if (payload.versions?.length) {
        setEditorialVersions(payload.versions);
        setEditorialIndex(0);
        setEditorialMode("real");
        setEditorialStatus("success");
        setGeneratedCopy(payload.versions[0].weibo.body);
      } else {
        setEditorialVersions([]);
        setEditorialIndex(0);
        setEditorialMode("real");
        setEditorialStatus("idle");
      }
      setCampaignStatus("success");
      showToast("Coze 已返回热点数据；请继续确认 RAG 商品和发布包");
    } catch (caught) {
      setCampaignStatus("error");
      setCampaignError(caught instanceof Error ? caught.message : "Coze 热点工作流暂时不可用。");
    }
  };

  const updateEditorial = (transform: (version: ContentVersion) => ContentVersion) => {
    setEditorialVersions((current) => current.map((version, index) => index === editorialIndex ? transform(version) : version));
  };

  const editorialTopic = `${selectedNews.title}｜关联商品：${selectedProduct.brand} ${selectedProduct.name}｜卖点：${selectedProduct.points.join("、")}`;

  const generateEditorial = async (nextMode = editorialMode) => {
    setEditorialMode(nextMode);
    setEditorialError("");
    if (nextMode === "demo") {
      const versions = makeCampaignDemoVersions(selectedNews, selectedProduct);
      setEditorialVersions(versions);
      setEditorialIndex(0);
      setEditorialMedia({});
      setEditorialStatus("demo");
      setGeneratedCopy(versions[0].weibo.body);
      showToast("已生成演示发布编辑室内容");
      return;
    }
    setEditorialStatus("generating");
    try {
      const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: editorialTopic }) });
      const payload = await response.json() as { versions?: ContentVersion[]; error?: { message?: string } };
      if (!response.ok || !payload.versions?.length) throw new Error(payload.error?.message || "工作流没有返回可编辑内容。");
      setEditorialVersions(payload.versions);
      setEditorialIndex(0);
      setEditorialMedia({});
      setEditorialStatus("success");
      setGeneratedCopy(payload.versions[0].weibo.body);
      showToast("Coze 已返回多渠道发布包");
    } catch (caught) {
      setEditorialStatus("error");
      setEditorialError(caught instanceof Error ? caught.message : "真实接口暂时不可用，请稍后重试或切换演示模式。");
    }
  };

  const mediaKey = (kind: MediaKind, index: number) => activeEditorial ? `${activeEditorial.id}:${kind}:${index}` : `${kind}:${index}`;
  const mediaAt = (kind: MediaKind, index: number) => editorialMedia[mediaKey(kind, index)] || { status: "idle" as const };
  const setMediaTask = (kind: MediaKind, index: number, task: MediaTask) => setEditorialMedia((current) => ({ ...current, [mediaKey(kind, index)]: task }));

  const pollEditorialVideo = async (index: number, taskId: string, tries = 40): Promise<void> => {
    for (let attempt = 0; attempt < tries; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 3_000));
      try {
        const response = await fetch(`/api/media/video?taskId=${encodeURIComponent(taskId)}`);
        const payload = await response.json() as { status?: string; url?: string; error?: { message?: string } };
        if (!response.ok) throw new Error(payload.error?.message || "视频任务查询失败。");
        if (payload.status === "succeeded" && payload.url) {
          setMediaTask("video", index, { status: "succeeded", taskId, url: payload.url });
          return;
        }
        setMediaTask("video", index, { status: "pending", taskId });
      } catch (caught) {
        setMediaTask("video", index, { status: "failed", taskId, error: caught instanceof Error ? caught.message : "视频任务查询失败。" });
        return;
      }
    }
    setMediaTask("video", index, { status: "pending", taskId });
  };

  const checkEditorialVideo = async (index: number, taskId: string) => {
    setMediaTask("video", index, { status: "loading", taskId });
    try {
      const response = await fetch(`/api/media/video?taskId=${encodeURIComponent(taskId)}`);
      const payload = await response.json() as { status?: string; url?: string; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "视频任务查询失败。");
      setMediaTask("video", index, payload.status === "succeeded" && payload.url ? { status: "succeeded", taskId, url: payload.url } : { status: "pending", taskId });
    } catch (caught) {
      setMediaTask("video", index, { status: "failed", taskId, error: caught instanceof Error ? caught.message : "视频任务查询失败。" });
    }
  };

  const generateEditorialMedia = async (kind: MediaKind, index: number, prompt: string, confirmed = false) => {
    if (!confirmed && !window.confirm(`将提交 1 次 MiniMax ${kind === "image" ? "图片" : "视频"}生成请求，可能产生费用。确认继续吗？`)) return;
    setMediaTask(kind, index, { status: "loading" });
    try {
      const response = await fetch(`/api/media/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
      const payload = await response.json() as { status?: "pending" | "succeeded"; url?: string; taskId?: string; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || `${kind === "image" ? "图片" : "视频"}生成失败。`);
      if (payload.status === "succeeded" && payload.url) {
        setMediaTask(kind, index, { status: "succeeded", url: payload.url });
      } else if (kind === "video" && payload.taskId) {
        setMediaTask("video", index, { status: "pending", taskId: payload.taskId });
        void pollEditorialVideo(index, payload.taskId);
      } else {
        throw new Error("服务未返回可用媒体结果。");
      }
    } catch (caught) {
      setMediaTask(kind, index, { status: "failed", error: caught instanceof Error ? caught.message : "媒体生成失败。" });
    }
  };

  const saveConfig = async () => {
    if (!Object.values(configDraft).some(Boolean)) { setConfigMessage("请至少填写一项配置后再保存。"); return; }
    setSavingConfig(true);
    setConfigMessage("");
    try {
      const response = await fetch("/api/local-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(configDraft) });
      const payload = await response.json() as { config?: LocalConfigStatus; persisted?: boolean; error?: { message?: string } };
      if (!response.ok || !payload.config) throw new Error(payload.error?.message || "本地配置未能保存。");
      setLocalConfig(payload.config);
      setConfigDraft(emptyConfigDraft);
      setConfigMessage(payload.persisted === false ? "已仅应用到当前本地服务端会话；受预览写入限制，重启后请重新保存。密钥不会回显到页面。" : "已保存到服务端本地环境；密钥不会回显到页面。");
    } catch (caught) {
      setConfigMessage(caught instanceof Error ? caught.message : "本地配置未能保存，请重试。");
    } finally { setSavingConfig(false); }
  };

  const chooseNews = (id: string) => {
    setSelectedNewsId(id);
    if (campaignMode === "demo") {
      setCampaignProducts(products);
      setSelectedProductId(products[0].id);
      setProductMatchMode("demo");
      setProductMatchStatus("idle");
      setProductMatchError("");
    }
    setSuggestionAdopted(false);
    setProductBound(false);
    setGeneratedCopy("");
    setReviewStates(emptyReviewStates());
    setReviewChannel("weibo");
    showToast(campaignMode === "real" ? "已选中 Coze 新闻；请确认本次工作流返回的 RAG 商品" : "热点已选中；如需真实商品，请调用 Coze 工作流");
  };

  const refreshNews = () => {
    if (campaignMode !== "demo") return;
    if (isRefreshingNews) return;
    setIsRefreshingNews(true);
    window.setTimeout(() => {
      const now = new Date();
      setNewsRefreshCount((current) => current + 1);
      setNewsRefreshedAt(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
      setIsRefreshingNews(false);
      showToast("演示热点已刷新；真实新闻源接入后会在此更新实时数据");
    }, 500);
  };

  const useDemoProducts = () => {
    setCampaignProducts(products);
    setSelectedProductId(products[0].id);
    setProductMatchMode("demo");
    setProductMatchStatus("idle");
    setProductMatchError("");
    setSuggestionAdopted(false);
  };

  const matchProductsFromRag = async () => {
    setProductMatchMode("real");
    setProductMatchStatus("matching");
    setProductMatchError("");
    try {
      const response = await fetch("/api/products/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ news: `${selectedNews.title}｜${selectedNews.summary}` }),
      });
      const payload = await response.json() as { products?: RagProductResponse[]; error?: { message?: string } };
      if (!response.ok || !payload.products?.length) throw new Error(payload.error?.message || "Coze RAG 未返回可用商品。");
      const matched = payload.products.map(campaignProductFromRag);
      setCampaignProducts(matched);
      setSelectedProductId(matched[0].id);
      setSuggestionAdopted(false);
      setProductBound(false);
      setGeneratedCopy("");
      setProductMatchStatus("success");
      showToast("已根据 Coze RAG 商品库更新推荐");
    } catch (caught) {
      setProductMatchStatus("error");
      setProductMatchError(caught instanceof Error ? caught.message : "Coze RAG 商品匹配暂时不可用。");
    }
  };

  const chooseSuggestedProduct = (id: string) => {
    setSelectedProductId(id);
    setSuggestionAdopted(true);
    setProductBound(false);
    setGeneratedCopy("");
    setReviewStates(emptyReviewStates());
    setReviewChannel("weibo");
    showToast("已采用智能推荐，可继续进行深度匹配");
  };

  const chooseProduct = (id: string) => {
    setSelectedProductId(id);
    setProductBound(true);
    setGeneratedCopy("");
    setReviewStates(emptyReviewStates());
    setReviewChannel("weibo");
    showToast("商品已绑定到当前营销任务");
  };

  const createCopy = () => {
    setIsGenerating(true);
    setGeneratedCopy("");
    window.setTimeout(() => {
      setGeneratedCopy(`🌿 ${selectedNews.title}\n\n春天的好状态，不只在目的地，也在每一个轻松出发的瞬间。\n\n${selectedProduct.brand} ${selectedProduct.name}，${selectedProduct.points.slice(0, 2).join("、")}，把「说走就走」变成更从容的日常。\n\n今天你最想去哪个城市角落放放风？评论区聊聊👇\n\n#春日轻户外 #城市公园 #${selectedProduct.name.replace(/[¥\s]/g, "")} #发现生活的美好`);
      setIsGenerating(false);
      showToast("已生成 1 条微博营销文案");
    }, 1500);
  };

  const reviewCopy = (channel: ReviewChannel) => {
    setReviewStates((current) => ({ ...current, [channel]: { ...current[channel], reviewed: true } }));
    showToast("合规检查完成：内容可进入发布队列");
  };

  const sendCopy = (channel: ReviewChannel) => {
    setReviewStates((current) => ({ ...current, [channel]: { ...current[channel], sent: true } }));
    showToast("模拟发送成功，已进入发布队列");
  };

  return (
    <main className="saas-shell">
      <header className="top-header">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">H</div>
          <div><strong>HOTMIND</strong><span>电商热点营销工作台</span></div>
        </div>
        <div className="header-actions">
          <button type="button" className="header-config" onClick={() => setShowConfig(true)}>接口设置</button>
          <span className="environment-pill"><i /> {campaignMode === "real" ? "Coze 后端" : "演示环境"}</span>
          <button className="icon-control" type="button" aria-label="查看通知">⌁<b>3</b></button>
          <div className="user-profile"><div className="avatar">林</div><div><strong>林知夏</strong><span>运营工作台 · 已登录</span></div><button type="button" aria-label="打开个人菜单">⌄</button></div>
        </div>
      </header>

      {showConfig && <ConfigDrawer config={localConfig} draft={configDraft} message={configMessage} saving={savingConfig} onChange={setConfigDraft} onSave={() => void saveConfig()} onClose={() => setShowConfig(false)} />}

      <div className="workbench">
        <aside className="pipeline-sidebar" aria-label="热点营销流程">
          <div className="pipeline-caption"><span>营销流程</span><small>CAMPAIGN PIPELINE</small></div>
          <nav className="step-nav">
            {steps.map((item) => {
              const complete = (item.id === 1 && Boolean(selectedNewsId)) || (item.id === 2 && suggestionAdopted) || (item.id === 3 && productBound) || (item.id === 4 && Boolean(generatedCopy)) || (item.id === 5 && Object.values(reviewStates).some((state) => state.sent));
              return <button key={item.id} type="button" onClick={() => { if (item.id > 1 && !campaignReady) { setStep(1); showToast("请先在第 1 步输入关键词并调用 Coze 工作流。"); return; } setStep(item.id); }} className={`step-link ${step === item.id ? "is-active" : ""}`}>
                <span className={`step-number ${complete ? "is-complete" : ""}`}>{`0${item.id}`}</span><span><strong>{item.label}</strong><small>{item.hint}</small></span>{step === item.id && <i aria-hidden="true">›</i>}
              </button>;
            })}
          </nav>
          <div className="sidebar-status"><span className="pulse" />{campaignMode === "real" ? campaignStatus === "running" ? "Coze 工作流运行中" : campaignReady ? "Coze 热点已同步" : "等待 Coze 新闻抓取" : isRefreshingNews ? "演示热点刷新中" : "演示热点已就绪"}<small>{campaignMode === "real" && !campaignReady ? "输入关键词开始检索" : `上次更新于 ${newsRefreshedAt}`}</small></div>
          <div className="sidebar-card"><span>今日任务</span><strong>08 <small>/ 12</small></strong><div><i style={{ width: "66%" }} /></div><small>还有 4 个热点待处理</small></div>
        </aside>

        <section className="workspace">
          <div className="workspace-topline"><div><span>热点营销 / {stepMeta.label}</span><h1>{stepMeta.label}</h1></div><div className="context-chip"><span>当前热点</span>{campaignReady ? <><strong>{selectedNews.tag}</strong><i>·</i><b>{selectedNews.title}</b></> : <b>等待 Coze 工作流返回新闻</b>}</div></div>
          {step === 1 && <NewsWorkspace news={selectedNews} newsItems={activeNewsItems} selectedId={selectedNewsId} filter={newsFilter} mode={campaignMode} status={campaignStatus} query={campaignQuery} error={campaignError} warnings={campaignWarnings} refreshing={isRefreshingNews} onQueryChange={setCampaignQuery} onRun={() => void runCampaign()} onUseDemo={useDemoCampaign} onRefresh={refreshNews} onFilterChange={setNewsFilter} onChoose={chooseNews} onNext={() => setStep(2)} />}
          {step === 2 && <SuggestedWorkspace news={selectedNews} products={campaignProducts} productId={selectedProductId} adopted={suggestionAdopted} mode={productMatchMode} status={productMatchStatus} error={productMatchError} onUseDemo={useDemoProducts} onMatchRag={() => void matchProductsFromRag()} onChoose={chooseSuggestedProduct} onNext={() => setStep(3)} />}
          {step === 3 && <ProductWorkspace news={selectedNews} products={campaignProducts} productId={selectedProductId} source={productMatchMode} onChoose={chooseProduct} onNext={() => { setProductBound(true); setStep(4); }} />}
          {step === 4 && <>
            <EditorialStudio
              news={selectedNews}
              product={selectedProduct}
              mode={editorialMode}
              status={editorialStatus}
              error={editorialError}
              versions={editorialVersions}
              activeIndex={editorialIndex}
              mediaAt={mediaAt}
              onModeChange={setEditorialMode}
              onGenerate={() => void generateEditorial()}
              onRetryReal={() => void generateEditorial("real")}
              onDemo={() => void generateEditorial("demo")}
              onVersionChange={setEditorialIndex}
              onUpdate={updateEditorial}
              onCopy={(value, label) => copyText(value, () => showToast(label))}
              onGenerateImage={(index, prompt) => void generateEditorialMedia("image", index, prompt)}
              onGenerateAllImages={() => {
                if (!activeEditorial?.xiaohongshu.recommended || !window.confirm(`将提交 ${activeEditorial.xiaohongshu.imageSuggestions.length} 次 MiniMax 图片生成请求，可能产生费用。确认继续吗？`)) return;
                activeEditorial.xiaohongshu.imageSuggestions.forEach((prompt, index) => { void generateEditorialMedia("image", index, prompt, true); });
              }}
              onGenerateVideo={(index, prompt) => void generateEditorialMedia("video", index, prompt)}
              onGenerateAllVideos={() => {
                if (!activeEditorial?.video.recommended || !window.confirm(`将提交 ${activeEditorial.video.shots.length} 次 MiniMax 视频生成请求，可能产生费用。确认继续吗？`)) return;
                activeEditorial.video.shots.forEach((shot, index) => { void generateEditorialMedia("video", index, `${shot.range}。画面：${shot.visual}。口播：${shot.voiceover}。字幕：${shot.subtitle}`, true); });
              }}
              onCheckVideo={(index, taskId) => void checkEditorialVideo(index, taskId)}
              onOpenConfig={() => setShowConfig(true)}
              onGoReview={(channel) => { setReviewChannel(channel); setStep(5); showToast(`已将当前版本的${channel === "weibo" ? "微博" : channel === "xiaohongshu" ? "小红书" : "抖音"}内容带入审核发布台`); }}
            />
          </>}
          {step === 5 && <ReviewWorkspace news={selectedNews} product={selectedProduct} version={activeEditorial} channel={reviewChannel} onChannelChange={setReviewChannel} reviewStates={reviewStates} onReview={reviewCopy} onSend={sendCopy} onBack={() => setStep(4)} />}
        </section>
      </div>
      {toast && <div className="toast" role="status">✓&nbsp; {toast}</div>}
    </main>
  );
}

function SectionHeader({ badge, title, description, children }: { badge: string; title: string; description: string; children?: React.ReactNode }) {
  return <div className="section-header"><div><span className="section-badge">{badge}</span><h2>{title}</h2><p>{description}</p></div>{children}</div>;
}

function NewsWorkspace({ news, newsItems: items, selectedId, filter, mode, status, query, error, warnings, refreshing, onQueryChange, onRun, onUseDemo, onRefresh, onFilterChange, onChoose, onNext }: { news: NewsItem; newsItems: NewsItem[]; selectedId: string; filter: "综合" | "消费" | "生活" | "科技"; mode: CampaignMode; status: CampaignStatus; query: string; error: string; warnings: string[]; refreshing: boolean; onQueryChange: (value: string) => void; onRun: () => void; onUseDemo: () => void; onRefresh: () => void; onFilterChange: (filter: "综合" | "消费" | "生活" | "科技") => void; onChoose: (id: string) => void; onNext: () => void }) {
  const filteredNews = items.filter((item) => filter === "综合" || (filter === "消费" && ["生活消费", "节日营销"].includes(item.tag)) || (filter === "生活" && ["春日趋势", "职场方式"].includes(item.tag)) || (filter === "科技" && ["智能科技", "数码生活"].includes(item.tag)));
  return <div className="workspace-content">
    <SectionHeader badge="STEP 01" title="通过 Coze 工作流抓取新闻" description={mode === "real" ? "输入关键词后，服务端会调用 Coze 工作流；工作流内的新闻插件与 RAG 负责检索，页面不直接连接第三方。" : "当前是明确标识的演示数据；不会调用 Coze 或新闻插件。"}><button type="button" className="ghost-button" onClick={onRefresh} disabled={mode !== "demo" || refreshing}>{refreshing ? "刷新中…" : mode === "demo" ? "↻ 刷新演示热点" : "真实数据由 Coze 刷新"}</button></SectionHeader>
    <div className="campaign-runbar"><div className="editorial-mode"><button type="button" className={mode === "real" ? "is-active" : ""} onClick={onRun}>真实 Coze 工作流</button><button type="button" className={mode === "demo" ? "is-active" : ""} onClick={onUseDemo}>演示数据</button></div><label><span>检索关键词</span><input value={query} placeholder="例如：咖啡豆、轻户外、通勤防晒" onChange={(event) => onQueryChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onRun(); }} disabled={status === "running"} /></label><button type="button" className="primary-button" onClick={onRun} disabled={status === "running"}>{status === "running" ? "Coze 检索中…" : "调用 Coze 抓取新闻"}</button></div>
    {mode === "real" && <p className="campaign-note">Coze API Key 与工作流 ID 仅保存在服务端；真实结果会标注来源，无法核实的热度、价格和功效不会被当作事实展示。</p>}
    {status === "error" && <div className="match-error campaign-error"><strong>Coze 新闻抓取未完成</strong><span>{error}</span><button type="button" className="ghost-button small" onClick={onRun}>重试</button></div>}
    {warnings.length > 0 && <div className="campaign-warnings">{warnings.map((warning) => <p key={warning}>提示：{warning}</p>)}</div>}
    {filteredNews.length ? <div className="news-layout"><section className="panel news-panel"><div className="panel-toolbar"><strong>{mode === "real" ? "Coze 返回新闻" : "演示热点"} <span>{filteredNews.length}</span></strong><div className="filter-tabs">{(["综合", "消费", "生活", "科技"] as const).map((item) => <button key={item} type="button" className={filter === item ? "is-filtered" : ""} onClick={() => onFilterChange(item)}>{item}</button>)}</div></div><div className="news-list">{filteredNews.map((item, index) => <button type="button" key={item.id} className={`news-row ${selectedId === item.id ? "is-selected" : ""}`} onClick={() => onChoose(item.id)}><span className="news-rank">{String(index + 1).padStart(2, "0")}</span><div><div><em>{item.tag}</em><small>{item.source} · {item.time}</small></div><strong>{item.title}</strong><p>{item.summary}</p><span className="heat">↗ 热度 {item.heat}</span></div>{selectedId === item.id && <i>✓</i>}</button>)}</div></section>
      <aside className="panel selected-news"><span className="side-kicker">已选热点</span><em>{news.tag}</em><h3>{news.title}</h3><p>{news.summary}</p><div className="news-stats"><span><b>{news.heat}</b>热度 / 待核实</span><span><b>{mode === "real" ? "Coze" : "Demo"}</b>数据来源</span></div><div className="signal-box"><span>下一步</span><p>{mode === "real" ? "工作流返回的 RAG 商品会进入下一步；请人工核实商品信息后绑定。" : "演示商品会在下一步展示；切换真实模式可改用 Coze RAG 商品库。"}</p></div>{news.url && <a className="news-source-link" href={news.url} target="_blank" rel="noreferrer">查看原始新闻 ↗</a>}<button type="button" className="primary-button button-full" onClick={onNext}>查看建议商品 <b>→</b></button></aside>
    </div> : <div className="campaign-empty"><span>⌁</span><strong>{status === "running" ? "正在等待 Coze 工作流返回新闻…" : "输入关键词，开始抓取新闻"}</strong><p>{status === "running" ? "新闻插件、RAG 检索和发布包生成均在 Coze 工作流内执行。" : "当前没有真实新闻数据。填写关键词并点击“调用 Coze 抓取新闻”，或主动切换到演示数据。"}</p></div>}
  </div>;
}

function SuggestedWorkspace({ news, products, productId, adopted, mode, status, error, onUseDemo, onMatchRag, onChoose, onNext }: { news: NewsItem; products: Product[]; productId: string; adopted: boolean; mode: ProductMatchMode; status: ProductMatchStatus; error: string; onUseDemo: () => void; onMatchRag: () => void; onChoose: (id: string) => void; onNext: () => void }) {
  const selected = products.find((item) => item.id === productId) || products[0];
  return <div className="workspace-content">
    <SectionHeader badge="STEP 02" title="为热点找到最合适的商品" description={mode === "real" ? "真实模式：点击调用 Coze 工作流，由工作流中的 RAG 商品库返回候选商品。" : "演示模式：使用内置商品样例，不会调用第三方服务。"}><div className="match-score">匹配引擎 <b>{mode === "real" ? "COZE RAG" : "DEMO"}</b></div></SectionHeader>
    <div className="match-actions"><div className="editorial-mode"><button type="button" className={mode === "demo" ? "is-active" : ""} onClick={onUseDemo}>演示商品库</button><button type="button" className={mode === "real" ? "is-active" : ""} onClick={onMatchRag}>Coze RAG 商品库</button></div><button type="button" className="primary-button" onClick={onMatchRag} disabled={status === "matching"}>{status === "matching" ? "RAG 检索中…" : "调用 Coze RAG 匹配"}</button></div>
    {mode === "real" && <p className="match-notice">真实商品匹配仅通过服务端调用 Coze。价格、库存、功效与商品资料均需人工核实。</p>}
    {status === "error" && <div className="match-error"><strong>Coze RAG 商品匹配未完成</strong><span>{error}</span><button type="button" className="ghost-button small" onClick={onMatchRag}>重试</button></div>}
    <div className="recommend-intro"><div className="spark">✦</div><div><strong>{mode === "real" ? `RAG 返回 ${products.length} 个候选商品` : "发现 3 个高潜商品"}</strong><p>正在围绕「{news.tag}」与“{news.title.slice(0, 16)}…”进行商品关联。</p></div><span>{mode === "real" ? "来源：Coze 工作流 RAG" : "热点-商品匹配 · 演示数据"}</span></div>
    <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} selected={productId === product.id} adopted={adopted} onChoose={() => onChoose(product.id)} action="采用此推荐" />)}</div>
    <div className="workflow-footer"><span>已选择 <b>{selected?.name || "待选择"}</b></span><button type="button" className="primary-button" onClick={onNext} disabled={!selected}>进入商品深度匹配 <b>→</b></button></div>
  </div>;
}

function ProductWorkspace({ news, products, productId, source, onChoose, onNext }: { news: NewsItem; products: Product[]; productId: string; source: ProductMatchMode; onChoose: (id: string) => void; onNext: () => void }) {
  const product = products.find((item) => item.id === productId) || products[0];
  return <div className="workspace-content">
    <SectionHeader badge="STEP 03" title="确认最终营销商品" description={source === "real" ? "候选项来自 Coze 工作流 RAG 商品库；请在绑定前人工核实。" : "在推荐基础上做人工筛选，绑定到本次热点营销任务。"}><button type="button" className="ghost-button">⌕ 筛选商品库</button></SectionHeader>
    <div className="binding-layout"><section className="panel product-chooser"><div className="chooser-head"><strong>可用商品 <span>{products.length}</span></strong><label>⌕ <input placeholder="搜索商品名称 / SKU" /></label></div>{products.map((item) => <button type="button" key={item.id} className={`compact-product ${productId === item.id ? "is-chosen" : ""}`} onClick={() => onChoose(item.id)}><ProductArt tone={item.tone} /><div><small>{item.brand}</small><strong>{item.name}</strong><span>{item.price} <del>{item.originalPrice}</del></span></div><em>{item.match === null ? "RAG" : `${item.match}%`}</em>{productId === item.id && <i>✓</i>}</button>)}</section>
      <aside className="panel binding-summary"><span className="side-kicker">本次绑定</span><ProductArt tone={product.tone} large /><small>{product.brand}</small><h3>{product.name}</h3><strong className="price">{product.price} <del>{product.originalPrice}</del></strong><div className="tag-list">{product.points.map((point) => <span key={point}>{point}</span>)}</div><div className="fit-note"><span>适配理由</span><p>{product.reason}</p></div><div className="hot-news-link"><span>关联热点</span><strong>{news.title}</strong></div><button type="button" className="primary-button button-full" onClick={onNext}>用此商品创作文案 <b>→</b></button></aside>
    </div>
  </div>;
}

function CopyWorkspace({ news, product, copy, generating, onGenerate, onChange, onCopy, onNext }: { news: NewsItem; product: Product; copy: string; generating: boolean; onGenerate: () => void; onChange: (value: string) => void; onCopy: () => void; onNext: () => void }) {
  return <div className="workspace-content">
    <SectionHeader badge="STEP 04" title="创作热点微博文案" description="将热点语境与商品卖点组合为微博营销初稿；生成过程为本地模拟。"><div className="model-label"><span>✦</span> Marketing LLM · Demo</div></SectionHeader>
    <div className="copy-layout"><section className="panel brief-card"><span className="side-kicker">创作 Brief</span><div className="brief-block"><small>热点主题</small><strong>{news.title}</strong></div><div className="brief-block"><small>关联商品</small><strong>{product.name}</strong><p>{product.points.join(" · ")}</p></div><div className="brief-block"><small>平台与语气</small><div className="platform-tags"><span>微博</span><span>轻快自然</span><span>互动引导</span></div></div><div className="brief-note">文案会自动包含话题标签、Emoji 和互动引导；请在发布前人工校对事实与商品信息。</div></section>
      <section className="panel generation-card"><div className="generation-top"><div><span className="side-kicker">微博文案</span><strong>{copy ? "生成结果" : "等待生成"}</strong></div>{copy && <button type="button" className="ghost-button small" onClick={onCopy}>□ 复制文案</button>}</div>{generating ? <div className="loading-copy"><div className="loader"><i /><i /><i /></div><strong>正在捕捉热点语气与商品卖点…</strong><span>预计还需 1.5 秒</span></div> : copy ? <textarea className="copy-editor" value={copy} onChange={(event) => onChange(event.target.value)} rows={13} aria-label="微博文案" /> : <div className="copy-empty"><span>✦</span><strong>准备好生成你的热点营销文案</strong><p>结合当前热点与已选商品，生成一条可继续编辑的微博初稿。</p></div>}<div className="generation-actions"><button type="button" className="primary-button" onClick={onGenerate} disabled={generating}>{generating ? "正在生成…" : copy ? "↻ 再生成一版" : "✦ 生成微博文案"}</button>{copy && <button type="button" className="next-button" onClick={onNext}>进入审核发布 →</button>}</div></section>
    </div>
  </div>;
}

function ReviewWorkspace({ news, product, version, channel, onChannelChange, reviewStates, onReview, onSend, onBack }: { news: NewsItem; product: Product; version?: ContentVersion; channel: ReviewChannel; onChannelChange: (channel: ReviewChannel) => void; reviewStates: ReviewStates; onReview: (channel: ReviewChannel) => void; onSend: (channel: ReviewChannel) => void; onBack: () => void }) {
  const review = reviewStates[channel];
  const labels: Record<ReviewChannel, { name: string; account: string; icon: string; goal: string }> = { weibo: { name: "微博", account: "HOTMIND 电商观察", icon: "微", goal: "品牌官方微博" }, xiaohongshu: { name: "小红书", account: "HOTMIND 好物研究所", icon: "书", goal: "品牌小红书账号" }, video: { name: "抖音", account: "HOTMIND 热点短视频", icon: "抖", goal: "品牌抖音账号" } };
  const data = labels[channel];
  const fallback = `🌿 ${news.title}\n\n${product.name}，把轻松的好状态带在身边。\n\n#发现生活的美好`;
  const body = channel === "weibo" ? version?.weibo.body || fallback : channel === "xiaohongshu" ? version ? `${version.xiaohongshu.titles[0]}\n\n${version.xiaohongshu.body}\n\n${version.xiaohongshu.tags.join(" ")}` : fallback : version ? `${version.video.hook}\n\n${version.video.publishCopy}\n\n${version.video.tags.join(" ")}` : fallback;
  const audit = channel === "weibo" ? version?.weibo.auditNote : channel === "xiaohongshu" ? version?.xiaohongshu.auditNote : version?.video.auditNote;
  const allSent = Object.values(reviewStates).every((item) => item.sent);
  return <div className="workspace-content">
    <SectionHeader badge="STEP 05" title="审核并模拟发送" description="逐渠道检查微博、小红书与抖音的发布内容；通过审核后可分别进入模拟发布队列。"><span className={`review-status ${allSent ? "is-sent" : review.reviewed ? "is-approved" : ""}`}>{allSent ? "✓ 全部已入队" : review.reviewed ? "✓ 当前渠道已通过" : "● 待审核"}</span></SectionHeader>
    <div className="review-channel-tabs" role="tablist" aria-label="审核发布渠道">{(["weibo", "xiaohongshu", "video"] as ReviewChannel[]).map((item) => <button key={item} type="button" role="tab" aria-selected={channel === item} className={`review-channel-tab review-channel-tab--${item} ${channel === item ? "is-active" : ""}`} onClick={() => onChannelChange(item)}><span>{labels[item].icon}</span><div><b>{labels[item].name}</b><small>{reviewStates[item].sent ? "已模拟发送" : reviewStates[item].reviewed ? "审核已通过" : "待审核"}</small></div><i>{reviewStates[item].sent ? "✓" : "›"}</i></button>)}</div>
    <div className="review-layout review-layout--multichannel"><section className={`panel channel-preview channel-preview--${channel}`}><div className="channel-preview-head"><div className="channel-preview-avatar">{data.icon}</div><div><strong>{data.account}</strong><span>刚刚 · 来自热点营销工作台</span></div><b>•••</b></div>{channel === "xiaohongshu" && <div className="xhs-cover-preview"><span>{version?.xiaohongshu.coverText || "生活方式好物清单"}</span></div>}{channel === "video" && <div className="video-story-preview"><b>▶</b><span>{version?.video.shots.length || 3} 个镜头 · {version?.video.shots[0]?.range || "00:00–00:15"}</span></div>}<p className="channel-preview-copy">{body}</p><div className="weibo-product"><ProductArt tone={product.tone} /><div><small>推广商品</small><strong>{product.name}</strong><span>{product.price} · {product.points[0]}</span></div><b>›</b></div><div className="weibo-actions"><span>{channel === "video" ? "▷ 播放" : "◌ 转发"}</span><span>{channel === "xiaohongshu" ? "♡ 收藏" : "◌ 评论"}</span><span>♡ 点赞</span></div></section>
      <aside className="panel compliance-card"><span className="side-kicker">{data.name} 发布检查</span><h3>合规审核清单</h3><ul><li className="is-done">✓ 已保留事实、价格与版权人工核验提示</li><li className="is-done">✓ 商品信息作为营销草稿展示</li><li className={review.reviewed ? "is-done" : ""}>{review.reviewed ? "✓" : "○"} 已完成人工审核确认</li></ul><div className="publish-note"><span>发布目标</span><strong>{data.name} · {data.goal}</strong><small>{audit || "此为 Demo，不会向真实平台发送内容。"}</small></div>{!review.reviewed ? <button type="button" className="primary-button button-full" onClick={() => onReview(channel)}>通过 {data.name} 合规审核</button> : <button type="button" className="primary-button button-full" onClick={() => onSend(channel)} disabled={review.sent}>{review.sent ? "已模拟发送" : `一键模拟发送到${data.name}`}</button>}<button type="button" className="text-button" onClick={onBack}>← 返回修改 {data.name} 内容</button></aside>
    </div>
  </div>;
}

function ConfigDrawer({ config, draft, message, saving, onChange, onSave, onClose }: { config: LocalConfigStatus | null; draft: LocalConfigDraft; message: string; saving: boolean; onChange: (next: LocalConfigDraft) => void; onSave: () => void; onClose: () => void }) {
  const update = (key: keyof LocalConfigDraft, value: string) => onChange({ ...draft, [key]: value });
  return <div className="config-backdrop" role="dialog" aria-modal="true" aria-label="服务端接口设置"><section className="config-drawer"><div className="drawer-heading"><div><span>SERVER CONNECTIONS</span><h2>编辑室接口设置</h2><p>配置仅保存在本机服务端的 <code>.env.local</code>，不会回显、写入浏览器存储或上传。</p></div><button type="button" onClick={onClose} aria-label="关闭设置">×</button></div><div className="connection-status"><span>Coze 工作流 <b className={config?.cozeWorkflowId && config?.cozeApiToken ? "ready" : ""}>{config?.cozeWorkflowId && config?.cozeApiToken ? "已就绪" : "待配置"}</b></span><span>MiniMax <b className={config?.minimaxApiKey ? "ready" : ""}>{config?.minimaxApiKey ? "已就绪" : "待配置"}</b></span></div><div className="config-fields"><label>COZE_WORKFLOW_ID<input type="password" value={draft.cozeWorkflowId} placeholder="输入工作流 ID" onChange={(event) => update("cozeWorkflowId", event.target.value)} /></label><label>COZE_API_TOKEN<input type="password" value={draft.cozeApiToken} placeholder="输入 Coze PAT" onChange={(event) => update("cozeApiToken", event.target.value)} /></label><label>MINIMAX_API_KEY<input type="password" value={draft.minimaxApiKey} placeholder="输入 MiniMax API Key" onChange={(event) => update("minimaxApiKey", event.target.value)} /></label></div><details className="advanced-config"><summary>高级 Coze 设置</summary><p>开始节点字段默认使用 <code>topic</code>；仅在工作流字段不同或需要应用 / 智能体资源时填写。</p><div><label>COZE_TOPIC_PARAMETER<input value={draft.cozeTopicParameter} placeholder="默认：topic" onChange={(event) => update("cozeTopicParameter", event.target.value)} /></label><label>COZE_APP_ID<input value={draft.cozeAppId} placeholder="仅应用工作流填写" onChange={(event) => update("cozeAppId", event.target.value)} /></label><label>COZE_BOT_ID<input value={draft.cozeBotId} placeholder="仅需智能体资源时填写" onChange={(event) => update("cozeBotId", event.target.value)} /></label></div></details>{message && <p className="config-message">{message}</p>}<div className="drawer-actions"><button type="button" className="ghost-button" onClick={onClose}>取消</button><button type="button" className="primary-button" onClick={onSave} disabled={saving}>{saving ? "正在保存…" : "保存到本地服务端"}</button></div></section></div>;
}

function EditorialStudio({ news, product, mode, status, error, versions, activeIndex, mediaAt, onModeChange, onGenerate, onRetryReal, onDemo, onVersionChange, onUpdate, onCopy, onGenerateImage, onGenerateAllImages, onGenerateVideo, onGenerateAllVideos, onCheckVideo, onOpenConfig, onGoReview }: {
  news: NewsItem;
  product: Product;
  mode: EditorialMode;
  status: EditorialStatus;
  error: string;
  versions: ContentVersion[];
  activeIndex: number;
  mediaAt: (kind: MediaKind, index: number) => MediaTask;
  onModeChange: (mode: EditorialMode) => void;
  onGenerate: () => void;
  onRetryReal: () => void;
  onDemo: () => void;
  onVersionChange: (index: number) => void;
  onUpdate: (transform: (version: ContentVersion) => ContentVersion) => void;
  onCopy: (value: string, label: string) => void;
  onGenerateImage: (index: number, prompt: string) => void;
  onGenerateAllImages: () => void;
  onGenerateVideo: (index: number, prompt: string) => void;
  onGenerateAllVideos: () => void;
  onCheckVideo: (index: number, taskId: string) => void;
  onOpenConfig: () => void;
  onGoReview: (channel: ReviewChannel) => void;
}) {
  const [activeChannel, setActiveChannel] = useState<"weibo" | "xiaohongshu" | "video">("weibo");
  const channelContentRef = useRef<HTMLDivElement>(null);
  const active = versions[activeIndex];
  const statusLabel = status === "demo" ? "演示数据" : status === "success" ? "真实接口结果" : status === "generating" ? "正在生成" : status === "error" ? "接口待处理" : "待生成";
  const setTags = (channel: "weibo" | "xiaohongshu" | "video", value: string) => onUpdate((version) => ({ ...version, [channel]: { ...version[channel], tags: value.split(/[\s,，、]+/).map((item) => item.trim()).filter(Boolean) } }));
  const updateTitles = (channel: "xiaohongshu" | "video", index: number, value: string) => onUpdate((version) => ({ ...version, [channel]: { ...version[channel], titles: version[channel].titles.map((item, itemIndex) => itemIndex === index ? value : item) } }));
  const selectChannel = (next: "weibo" | "xiaohongshu" | "video") => {
    setActiveChannel(next);
    window.requestAnimationFrame(() => channelContentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  return <section className="editorial-studio">
    <div className="studio-top"><div><span className="section-badge">CAMPAIGN CONTENT STUDIO</span><h2>三平台发布编辑室</h2><p>围绕当前热点与已绑定商品完成创作、媒体生成和人工审核；三个渠道各自独立编辑。</p></div><button type="button" className="ghost-button" onClick={onOpenConfig}>⚙ 接口设置</button></div>
    <div className="studio-controlbar"><div className="editorial-mode"><button type="button" className={mode === "demo" ? "is-active" : ""} onClick={() => onModeChange("demo")}>演示模式</button><button type="button" className={mode === "real" ? "is-active" : ""} onClick={() => onModeChange("real")}>真实接口</button></div><div className="studio-generation-copy"><b>{mode === "real" ? "Coze 工作流" : "内置完整样例"}</b><span>{mode === "real" ? "由服务端生成三套渠道发布包" : "不调用第三方接口，可直接编辑体验"}</span></div><span className={`studio-status studio-status--${status}`}>{statusLabel}</span><button type="button" className="primary-button" onClick={onGenerate} disabled={status === "generating"}>{status === "generating" ? "正在生成…" : mode === "real" ? "调用 Coze 生成" : "生成演示发布包"}</button></div>
    {mode === "real" && <p className="studio-notice">真实模式仅由服务端调用 Coze；若接口不可用，当前编辑内容不会被清空。</p>}
    {status === "error" && <div className="studio-error"><div><strong>本次 Coze 未成功返回发布包</strong><p>{error}</p></div><div><button type="button" className="ghost-button" onClick={onRetryReal}>重试</button><button type="button" className="primary-button" onClick={onDemo}>切换演示数据</button></div></div>}
    {!active ? <div className="studio-empty editorial-empty-state"><span>✦</span><div><small>内容工作区</small><strong>先生成一套可编辑的发布包</strong><p>演示模式会立即加载微博、小红书、短视频的完整样例；真实接口会通过服务端的 Coze 工作流生成。</p><div className="empty-actions"><button type="button" className="primary-button" onClick={() => mode === "real" ? onRetryReal() : onDemo()}>{mode === "real" ? "重新调用 Coze" : "载入演示发布包"}</button><button type="button" className="ghost-button" onClick={() => onModeChange(mode === "real" ? "demo" : "real")}>切换至{mode === "real" ? "演示" : "真实接口"}</button></div></div></div> : <>
      <div className="editorial-brief-strip"><div><span>热点选题</span><strong>{news.title}</strong></div><div><span>绑定商品</span><strong>{product.name}</strong><small>{product.points.slice(0, 2).join(" · ")}</small></div><div><span>编辑状态</span><strong>{mode === "real" ? "真实工作流" : "演示工作流"}</strong><small>切换版本不会丢失你的修改</small></div></div>
      <div className="editorial-channel-tabs" role="tablist" aria-label="发布渠道">
        <button type="button" role="tab" aria-selected={activeChannel === "weibo"} className={`channel-tab channel-tab--weibo ${activeChannel === "weibo" ? "is-active" : ""}`} onClick={() => selectChannel("weibo")}><span className="channel-app-icon channel-app-icon--weibo" aria-label="微博图标">◉</span><div><b>微博</b><small>热点短文与互动</small></div><i>{active.weibo.recommended ? "已就绪" : "暂缓"}</i></button>
        <button type="button" role="tab" aria-selected={activeChannel === "xiaohongshu"} className={`channel-tab channel-tab--xhs ${activeChannel === "xiaohongshu" ? "is-active" : ""}`} onClick={() => selectChannel("xiaohongshu")}><span className="channel-app-icon channel-app-icon--xhs" aria-label="小红书图标">RED</span><div><b>小红书</b><small>种草图文与配图</small></div><i>{active.xiaohongshu.recommended ? "已就绪" : "暂缓"}</i></button>
        <button type="button" role="tab" aria-selected={activeChannel === "video"} className={`channel-tab channel-tab--video ${activeChannel === "video" ? "is-active" : ""}`} onClick={() => selectChannel("video")}><span className="channel-app-icon channel-app-icon--video" aria-label="抖音图标">♪</span><div><b>抖音</b><small>口播脚本与分镜</small></div><i>{active.video.recommended ? "已就绪" : "暂缓"}</i></button>
      </div>
      <div className="studio-version"><div><span>内容版本</span><strong>{active.label}</strong></div><div><button type="button" className="ghost-button small" onClick={() => onVersionChange(Math.max(0, activeIndex - 1))} disabled={activeIndex === 0}>← 上一版</button><span>{activeIndex + 1} / {versions.length}</span><button type="button" className="ghost-button small" onClick={() => onVersionChange(Math.min(versions.length - 1, activeIndex + 1))} disabled={activeIndex === versions.length - 1}>下一版 →</button></div></div>
      <div className="editorial-grid" data-active-channel={activeChannel} ref={channelContentRef}>
        <article className="editorial-card editorial-card--weibo"><StudioHeader index="01" title="微博发布包" onCopy={() => onCopy(channelText(active, "weibo"), "微博发布包已复制")} />{active.weibo.recommended ? <><StudioText label="微博正文" value={active.weibo.body} multiline onChange={(body) => onUpdate((version) => ({ ...version, weibo: { ...version.weibo, body } }))} /><StudioText label="话题标签" value={active.weibo.tags.join(" ")} onChange={(value) => setTags("weibo", value)} /><StudioText label="审核提醒" value={active.weibo.auditNote} multiline onChange={(auditNote) => onUpdate((version) => ({ ...version, weibo: { ...version.weibo, auditNote } }))} /><ReviewHandoff channel="weibo" onGo={onGoReview} /></> : <NotRecommended reason={active.weibo.reason} />}</article>
        <article className="editorial-card editorial-card--xhs"><StudioHeader index="02" title="小红书发布包" onCopy={() => onCopy(channelText(active, "xiaohongshu"), "小红书发布包已复制")} />{active.xiaohongshu.recommended ? <><StudioTitles titles={active.xiaohongshu.titles} onChange={(index, value) => updateTitles("xiaohongshu", index, value)} /><StudioText label="封面文案" value={active.xiaohongshu.coverText} onChange={(coverText) => onUpdate((version) => ({ ...version, xiaohongshu: { ...version.xiaohongshu, coverText } }))} /><StudioText label="正文" value={active.xiaohongshu.body} multiline onChange={(body) => onUpdate((version) => ({ ...version, xiaohongshu: { ...version.xiaohongshu, body } }))} /><MediaTaskList type="image" prompts={active.xiaohongshu.imageSuggestions} tasks={active.xiaohongshu.imageSuggestions.map((_, index) => mediaAt("image", index))} onChange={(index, value) => onUpdate((version) => ({ ...version, xiaohongshu: { ...version.xiaohongshu, imageSuggestions: version.xiaohongshu.imageSuggestions.map((item, itemIndex) => itemIndex === index ? value : item) } }))} onGenerate={onGenerateImage} onGenerateAll={onGenerateAllImages} /><StudioText label="话题标签" value={active.xiaohongshu.tags.join(" ")} onChange={(value) => setTags("xiaohongshu", value)} /><StudioText label="审核提醒" value={active.xiaohongshu.auditNote} multiline onChange={(auditNote) => onUpdate((version) => ({ ...version, xiaohongshu: { ...version.xiaohongshu, auditNote } }))} /><ReviewHandoff channel="xiaohongshu" onGo={onGoReview} /></> : <NotRecommended reason={active.xiaohongshu.reason} />}</article>
        <article className="editorial-card editorial-card--video"><StudioHeader index="03" title="短视频发布包" onCopy={() => onCopy(channelText(active, "video"), "短视频发布包已复制")} />{active.video.recommended ? <><StudioTitles titles={active.video.titles} onChange={(index, value) => updateTitles("video", index, value)} /><StudioText label="开场钩子" value={active.video.hook} onChange={(hook) => onUpdate((version) => ({ ...version, video: { ...version.video, hook } }))} /><StudioText label="完整口播稿" value={active.video.script} multiline onChange={(script) => onUpdate((version) => ({ ...version, video: { ...version.video, script } }))} /><StoryboardTasks shots={active.video.shots} tasks={active.video.shots.map((_, index) => mediaAt("video", index))} onChange={(index, shot) => onUpdate((version) => ({ ...version, video: { ...version.video, shots: version.video.shots.map((item, itemIndex) => itemIndex === index ? shot : item) } }))} onGenerate={onGenerateVideo} onGenerateAll={onGenerateAllVideos} onCheck={onCheckVideo} /><StudioText label="发布文案" value={active.video.publishCopy} multiline onChange={(publishCopy) => onUpdate((version) => ({ ...version, video: { ...version.video, publishCopy } }))} /><StudioText label="话题标签" value={active.video.tags.join(" ")} onChange={(value) => setTags("video", value)} /><StudioText label="审核提醒" value={active.video.auditNote} multiline onChange={(auditNote) => onUpdate((version) => ({ ...version, video: { ...version.video, auditNote } }))} /><ReviewHandoff channel="video" onGo={onGoReview} /></> : <NotRecommended reason={active.video.reason} />}</article>
      </div>
      <div className="studio-audit"><strong>统一审核提醒</strong><p>{active.auditReminder}</p></div>
    </>}
  </section>;
}

function StudioHeader({ index, title, onCopy }: { index: string; title: string; onCopy: () => void }) {
  return <div className="studio-card-head"><span>{index}</span><h3>{title}</h3><button type="button" onClick={onCopy}>□ 复制整包</button></div>;
}

function ReviewHandoff({ channel, onGo }: { channel: ReviewChannel; onGo: (channel: ReviewChannel) => void }) {
  const name = channel === "weibo" ? "微博" : channel === "xiaohongshu" ? "小红书" : "抖音";
  return <div className="channel-review-handoff"><div><span>当前版本已保存</span><strong>完成编辑后，带入{name}审核发布台</strong></div><button type="button" className="primary-button" onClick={() => onGo(channel)}>审核完毕，前往发布 →</button></div>;
}

function StudioText({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
  return <label className="studio-field"><span>{label}</span>{multiline ? <textarea value={value} rows={4} onChange={(event) => onChange(event.target.value)} /> : <input value={value} onChange={(event) => onChange(event.target.value)} />}</label>;
}

function StudioTitles({ titles, onChange }: { titles: string[]; onChange: (index: number, value: string) => void }) {
  return <div className="studio-titles"><span>标题备选</span>{[0, 1, 2].map((index) => <label key={index}><i>0{index + 1}</i><input value={titles[index] || ""} placeholder="填写标题" onChange={(event) => onChange(index, event.target.value)} /></label>)}</div>;
}

function MediaTaskList({ type, prompts, tasks, onChange, onGenerate, onGenerateAll }: { type: "image"; prompts: string[]; tasks: MediaTask[]; onChange: (index: number, value: string) => void; onGenerate: (index: number, prompt: string) => void; onGenerateAll: () => void }) {
  return <div className="studio-media"><div className="studio-media-head"><div><span>图片任务</span><strong>配图建议</strong></div><button type="button" className="ghost-button small" onClick={onGenerateAll}>一键生成全部</button></div><p>点击后才会调用 MiniMax，并会产生可能的费用；单张失败不会影响其他结果。</p>{prompts.map((prompt, index) => <div className="mini-media-task" key={index}><div><span>图 {index + 1}</span><TaskState task={tasks[index]} /></div><textarea value={prompt} rows={2} onChange={(event) => onChange(index, event.target.value)} /><button type="button" className="ghost-button small" onClick={() => onGenerate(index, prompt)} disabled={tasks[index]?.status === "loading"}>单独生成</button>{tasks[index]?.error && <small className="task-error">{tasks[index].error}</small>}{tasks[index]?.url && <img src={tasks[index].url} alt={`配图 ${index + 1} 生成结果`} />}</div>)}</div>;
}

function StoryboardTasks({ shots, tasks, onChange, onGenerate, onGenerateAll, onCheck }: { shots: Shot[]; tasks: MediaTask[]; onChange: (index: number, shot: Shot) => void; onGenerate: (index: number, prompt: string) => void; onGenerateAll: () => void; onCheck: (index: number, taskId: string) => void }) {
  const update = (index: number, key: keyof Shot, value: string) => onChange(index, { ...shots[index], [key]: value });
  return <div className="studio-media storyboard-media"><div className="studio-media-head"><div><span>视频任务</span><strong>完整分镜</strong></div><button type="button" className="ghost-button small" onClick={onGenerateAll}>一键生成全部镜头</button></div><p>每个镜头独立保存状态。排队中的视频可查询原任务，不会重复提交计费调用。</p>{shots.map((shot, index) => { const task = tasks[index] || { status: "idle" as const }; const pending = Boolean(task.taskId && (task.status === "pending" || task.error?.includes("视频仍在生成中"))); const prompt = `${shot.range}。画面：${shot.visual}。口播：${shot.voiceover}。字幕：${shot.subtitle}`; return <div className="story-task" key={index}><div className="story-task-top"><span>镜头 {String(index + 1).padStart(2, "0")}</span><TaskState task={task} /></div><StudioText label="时间范围" value={shot.range} onChange={(value) => update(index, "range", value)} /><StudioText label="画面" value={shot.visual} multiline onChange={(value) => update(index, "visual", value)} /><StudioText label="口播" value={shot.voiceover} multiline onChange={(value) => update(index, "voiceover", value)} /><StudioText label="字幕" value={shot.subtitle} onChange={(value) => update(index, "subtitle", value)} /><div className="story-actions">{pending ? <button type="button" className="ghost-button small" onClick={() => task.taskId && onCheck(index, task.taskId)}>查询任务状态</button> : <button type="button" className="ghost-button small" onClick={() => onGenerate(index, prompt)} disabled={task.status === "loading"}>生成此镜头</button>}{task.url && <a href={task.url} target="_blank" rel="noreferrer">打开视频 ↗</a>}</div>{pending && <small className="task-hint">视频仍在排队或生成中；查询不会创建新任务。</small>}{task.error && !pending && <small className="task-error">{task.error}</small>}{task.url && <video controls src={task.url} />}</div>; })}</div>;
}

function TaskState({ task }: { task?: MediaTask }) {
  if (!task || task.status === "idle") return <span className="media-state">未生成</span>;
  if (task.status === "loading" || task.status === "pending") return <span className="media-state is-running">生成中</span>;
  if (task.status === "succeeded") return <span className="media-state is-success">已完成</span>;
  return <span className="media-state is-error">失败</span>;
}

function NotRecommended({ reason }: { reason?: string }) {
  return <div className="not-recommended"><strong>当前渠道暂不推荐</strong><p>{reason || "系统未建议在当前热点中使用该渠道；请人工调整选题或文案后再试。"}</p></div>;
}

function ProductArt({ tone, large = false }: { tone: Product["tone"]; large?: boolean }) {
  const symbol = tone === "sun" ? "☀" : tone === "outdoor" ? "⌁" : "☕";
  return <div className={`product-art product-art--${tone} ${large ? "is-large" : ""}`} aria-label="商品示意图">{symbol}</div>;
}

function ProductCard({ product, selected, adopted, onChoose, action }: { product: Product; selected: boolean; adopted: boolean; onChoose: () => void; action: string }) {
  return <article className={`product-card ${selected ? "is-selected" : ""}`} role="button" tabIndex={0} onClick={onChoose} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onChoose(); } }}><div className="product-card-top"><ProductArt tone={product.tone} /><span className="match-badge">{product.match === null ? "RAG 召回" : <>匹配度 <b>{product.match}%</b></>}</span></div><small>{product.brand}</small><h3>{product.name}</h3><div className="tag-list">{product.points.slice(0, 2).map((point) => <span key={point}>{point}</span>)}</div><p>{product.reason}</p><div className="product-card-bottom"><strong>{product.price} {product.originalPrice && <del>{product.originalPrice}</del>}</strong><button type="button" onClick={(event) => { event.stopPropagation(); onChoose(); }}>{selected && adopted ? "已采用 ✓" : action}</button></div></article>;
}
