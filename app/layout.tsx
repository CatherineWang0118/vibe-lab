import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HOTMIND · 电商热点营销工作台",
  description: "从热点新闻到商品匹配、微博文案生成与审核发布的电商营销工作台 Demo。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
