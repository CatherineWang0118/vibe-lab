export type Recommendation = {
  recommended: boolean;
  reason?: string;
};

export type WeiboPackage = Recommendation & {
  body: string;
  tags: string[];
  auditNote: string;
};

export type XiaohongshuPackage = Recommendation & {
  titles: string[];
  coverText: string;
  body: string;
  imageSuggestions: string[];
  tags: string[];
  auditNote: string;
};

export type Shot = {
  range: string;
  visual: string;
  voiceover: string;
  subtitle: string;
};

export type VideoPackage = Recommendation & {
  titles: string[];
  hook: string;
  script: string;
  shots: Shot[];
  publishCopy: string;
  tags: string[];
  auditNote: string;
};

export type ContentVersion = {
  id: string;
  label: string;
  weibo: WeiboPackage;
  xiaohongshu: XiaohongshuPackage;
  video: VideoPackage;
  auditReminder: string;
};

const demoAudit = "生成内容仅作为初稿，发布前需人工审核事实、版权和平台规范。涉及产地、风味和价格等信息，请待人工核实。";

function makeVersion(topic: string, number: number): ContentVersion {
  const variant = number === 1 ? "晨间风味笔记" : "产地与冲煮笔记";
  const firstTitle = number === 1 ? `一颗${topic}，把早晨叫醒` : `${topic}怎么选？先从这 3 个线索开始`;
  return {
    id: `demo-${number}-${topic}`,
    label: `版本 ${number} · ${variant}`,
    auditReminder: demoAudit,
    weibo: {
      recommended: true,
      body:
        number === 1
          ? `今天想聊聊${topic}。别急着追求“最贵”或“最浓”，先闻一闻它的香气、再留意入口后的回甘。给自己 3 分钟，认真喝完这一杯。`
          : `选${topic}不用被参数劝退：先选你喜欢的风味方向，再用小包装慢慢试。找到适合自己的那杯，才是好开始。`,
      tags: [`#${topic}`, "#今日份咖啡", "#生活方式"],
      auditNote: "如提及具体产地、品牌或价格，需补充可核实来源。",
    },
    xiaohongshu: {
      recommended: true,
      titles: [
        firstTitle,
        `${topic}新手也能看懂的挑选小抄`,
        "把一杯咖啡喝明白，从这一口开始",
      ],
      coverText: number === 1 ? `${topic}\n风味入门` : `${topic}\n挑选清单`,
      body:
        number === 1
          ? `把${topic}倒进磨豆机的那一刻，房间会先被香气填满。\n\n我更喜欢从三个小问题开始：\n1. 想喝果香、坚果还是可可感？\n2. 日常手冲还是奶咖？\n3. 先买小包装，给味蕾一点试错空间。\n\n不用急着记住所有术语。把今天这一杯的感受写下来，下次选豆就会更接近自己。`
          : `逛货架时看到${topic}的标签，不必一次读懂所有信息。\n\n先看烘焙度和风味描述，再想想你准备怎么喝：手冲更适合留住细节，做奶咖则可以偏向醇厚感。\n\n从 100g 小包装开始尝试，把喜欢和不喜欢都记下来，你的专属风味地图会慢慢出现。`,
      imageSuggestions: [
        `竖版封面：米白桌面上放一包无品牌${topic}与手冲壶，晨光侧照，留出标题区域，杂志静物摄影。`,
        `特写：透明玻璃杯中的咖啡与${topic}颗粒，深棕与暖灰色调，浅景深。`,
        `步骤图：秤、滤杯、分享壶组成的冲煮台面，从上方俯拍，干净留白。`,
        `氛围图：窗边阅读与一杯咖啡，人物不露脸，安静居家感。`,
      ],
      tags: [`#${topic}`, "#咖啡入门", "#手冲咖啡", "#生活记录"],
      auditNote: "配图不得含有未获授权的品牌标识、人物肖像或受版权保护的包装设计。",
    },
    video: {
      recommended: true,
      titles: [
        `别急着买贵的，${topic}先看这一点`,
        `${topic}入门：3 分钟建立自己的口味坐标`,
        "一杯咖啡的风味，从选豆开始",
      ],
      hook: `同样是${topic}，为什么有人觉得酸、有人觉得香？答案可能不在价格。`,
      script:
        number === 1
          ? `打开一包${topic}，先别急着冲。闻一闻：是更像水果、坚果还是可可？接着想想你要怎么喝——手冲还是奶咖。最后只买小包装，喝完再决定下一包。选豆不用一次到位，记住自己喜欢的味道就够了。`
          : `挑${topic}时，只做三个选择：喜欢明亮果香，还是醇厚坚果感？日常做手冲，还是加入牛奶？愿不愿意从小包装开始试？把这三件事想清楚，比背参数更有用。`,
      shots: [
        {
          range: "00:00–00:03",
          visual: `无品牌${topic}包装放到米白桌面，镜头缓慢推进。`,
          voiceover: `同样是${topic}，为什么有人觉得酸、有人觉得香？`,
          subtitle: "风味，不只看价格",
        },
        {
          range: "00:03–00:09",
          visual: "打开包装，咖啡豆倒入浅色陶盘，手指轻拨豆子。",
          voiceover: "先闻一闻：水果、坚果，还是可可？",
          subtitle: "先找到喜欢的风味方向",
        },
        {
          range: "00:09–00:16",
          visual: "手冲器具和一杯加奶咖啡并列，镜头从左向右移动。",
          voiceover: "再想想：你准备手冲，还是做奶咖？",
          subtitle: "喝法会影响选择",
        },
        {
          range: "00:16–00:24",
          visual: "小包装咖啡豆、手账与一杯成品咖啡，窗边自然光。",
          voiceover: "从小包装开始，把每次感受记下来。",
          subtitle: "用小包装建立口味坐标",
        },
      ],
      publishCopy: `从一颗${topic}开始，慢慢找到适合自己的风味。保存这条，下次选豆时拿出来看。`,
      tags: [`#${topic}`, "#咖啡知识", "#手冲", "#日常vlog"],
      auditNote: "避免使用无法核实的风味评分、健康功效或价格对比；画面素材需确认版权。",
    },
  };
}

export function makeDemoVersions(topic: string): ContentVersion[] {
  const cleanTopic = topic.trim() || "咖啡豆";
  return [makeVersion(cleanTopic, 1), makeVersion(cleanTopic, 2)];
}

export function channelText(version: ContentVersion, channel: "weibo" | "xiaohongshu" | "video") {
  if (channel === "weibo") {
    const pack = version.weibo;
    return [pack.body, pack.tags.join(" "), `审核：${pack.auditNote}`].join("\n\n");
  }
  if (channel === "xiaohongshu") {
    const pack = version.xiaohongshu;
    return [
      `标题：${pack.titles.join(" / ")}`,
      `封面：${pack.coverText}`,
      pack.body,
      `配图建议：\n${pack.imageSuggestions.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
      pack.tags.join(" "),
      `审核：${pack.auditNote}`,
    ].join("\n\n");
  }
  const pack = version.video;
  return [
    `标题：${pack.titles.join(" / ")}`,
    `开场：${pack.hook}`,
    pack.script,
    `分镜：\n${pack.shots.map((shot) => `${shot.range}｜${shot.visual}\n口播：${shot.voiceover}\n字幕：${shot.subtitle}`).join("\n\n")}`,
    `发布文案：${pack.publishCopy}`,
    pack.tags.join(" "),
    `审核：${pack.auditNote}`,
  ].join("\n\n");
}
