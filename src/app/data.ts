export interface RecentItem {
  title: string;
  meta: string;
  accent: "photo" | "poster" | "ui" | "generated";
}

export const initialRecentItems: RecentItem[] = [
  {
    title: "雨夜霓虹电影人像",
    meta: "照片 / 电影剧照 · medium · 刚刚",
    accent: "photo",
  },
  {
    title: "超现实锦鲤星云海报",
    meta: "高质量海报 · high · 2 分钟前",
    accent: "poster",
  },
  {
    title: "玻璃拟态 UI 设计系统",
    meta: "UI mockup · medium · 昨天",
    accent: "ui",
  },
];

export const quickStyleChips = ["35mm 胶片", "霓虹夜景", "自然肤质", "低饱和"];
