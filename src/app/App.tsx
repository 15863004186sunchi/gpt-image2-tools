import { Copy, History, ImageIcon, Loader2, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  PromptCategory,
  PromptMode,
  PromptPackage,
  PromptSettings,
} from "../shared/types";
import { enhancePrompt, generateImage, type GeneratedImageResult } from "./api";
import { initialRecentItems, quickStyleChips, type RecentItem } from "./data";

const defaultIdea = "一个雨夜的上海街头，穿风衣的女性站在霓虹灯下，像电影剧照一样真实。";

const navItems = [
  { href: "#new", label: "新建生成" },
  { href: "#history", label: "我的历史" },
  { href: "#cases", label: "提示词案例" },
  { href: "#account", label: "账户设置" },
] as const;

type WorkbenchStatus = "idle" | "enhancing" | "generating";

export function App() {
  const [idea, setIdea] = useState(defaultIdea);
  const [mode, setMode] = useState<PromptMode>("quick");
  const [category, setCategory] = useState<PromptCategory>("portrait_photography");
  const [size, setSize] = useState<PromptSettings["size"]>("1024x1536");
  const [quality, setQuality] = useState<PromptSettings["quality"]>("medium");
  const [selectedStyle, setSelectedStyle] = useState(quickStyleChips[0]);
  const [promptPackage, setPromptPackage] = useState<PromptPackage | null>(null);
  const [generatedImage, setGeneratedImage] = useState<GeneratedImageResult | null>(null);
  const [recentItems, setRecentItems] = useState<RecentItem[]>(initialRecentItems);
  const [status, setStatus] = useState<WorkbenchStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState(() => getCurrentHash());
  const isBusy = status !== "idle";
  const score = promptPackage?.promptScore ?? 82;

  useEffect(() => {
    function handleHashChange() {
      setActiveNav(getCurrentHash());
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  async function handleEnhance() {
    if (!idea.trim()) {
      setError("请先写下一句画面想法。");
      return;
    }

    setStatus("enhancing");
    setError(null);
    setNotice(null);

    try {
      const nextPackage = await enhancePrompt({
        idea,
        mode,
        category,
        controls: {
          size,
          quality,
          outputFormat: "jpeg",
          lens: "35mm film still",
          mood: "moody cinematic atmosphere",
        },
      });
      setPromptPackage(nextPackage);
      setGeneratedImage(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "增强提示词失败，请稍后再试。");
    } finally {
      setStatus("idle");
    }
  }

  async function handleGenerate() {
    if (!promptPackage) {
      setError("请先增强提示词，再生成图片。");
      return;
    }

    setStatus("generating");
    setError(null);
    setNotice(null);

    try {
      const result = await generateImage(promptPackage);
      const nextRecentItem: RecentItem = {
        title: promptPackage.title,
        meta: `${result.image.contentType} · ${promptPackage.settings.quality} · 刚刚`,
        accent: "generated",
      };

      setGeneratedImage(result);
      setNotice(
        result.image.storage === "inline"
          ? "图片已生成。当前未绑定 R2，先以内联预览展示。"
          : "图片已生成并保存。",
      );
      setRecentItems((items) => [nextRecentItem, ...items].slice(0, 4));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "生成图片失败，请检查服务配置。");
    } finally {
      setStatus("idle");
    }
  }

  function handleStyleChipClick(chip: string) {
    setSelectedStyle(chip);
    setError(null);
    setNotice(`已选择风格：${chip}。再次增强提示词时会带入这个方向。`);
  }

  async function handleCopyPrompt() {
    if (!promptPackage) {
      setError("请先增强提示词，再复制 prompt。");
      return;
    }

    const text = [
      "Master Prompt:",
      promptPackage.masterPrompt,
      "",
      "Negative Guardrails:",
      promptPackage.negativePrompt,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setError(null);
      setNotice("Prompt 已复制到剪贴板。");
    } catch {
      setError("浏览器暂时不允许写入剪贴板，请手动选中文本复制。");
    }
  }

  function handleShowAllHistory() {
    setError(null);
    setNotice("完整历史记录会在登录与付费能力接入后开放，当前先展示最近 4 条。露个小尾巴，但不装作已经有后台。");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Navigation">
        <div className="brand">
          Image 2
          <br />
          Prompt Studio
        </div>
        <nav>
          {navItems.map((item) => {
            const isActive = activeNav === item.href;

            return (
              <a
                className={`nav-item ${isActive ? "active" : ""}`}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                key={item.href}
                onClick={() => setActiveNav(item.href)}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>把一句想法变成可出片的专业提示词</h1>
            <p>先增强 prompt，再调用 gpt-image-2 出图；登录后自动保存每一次尝试。</p>
          </div>
          <div className="top-actions">
            <div className="mode-switch" aria-label="Mode">
              <button
                className={mode === "quick" ? "selected" : ""}
                type="button"
                aria-pressed={mode === "quick"}
                onClick={() => setMode("quick")}
              >
                普通模式
              </button>
              <button
                className={mode === "professional" ? "selected" : ""}
                type="button"
                aria-pressed={mode === "professional"}
                onClick={() => setMode("professional")}
              >
                专业模式
              </button>
            </div>
            <div className="account-pill">Demo Free</div>
          </div>
        </header>

        <section className="tool-panel" aria-labelledby="input-title">
          <div className="panel-heading">
            <h2 id="input-title">创作输入</h2>
            <span>草稿质量 {score}</span>
          </div>
          <label className="field">
            <span>画面想法</span>
            <textarea value={idea} onChange={(event) => setIdea(event.target.value)} />
          </label>
          <div className="field-grid">
            <label className="field">
              <span>图像类型</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as PromptCategory)}
              >
                <option value="portrait_photography">照片 / 电影剧照</option>
                <option value="poster_illustration">电影海报</option>
                <option value="character_design">角色设定</option>
                <option value="ui_social_mockup">UI / 社媒 mockup</option>
                <option value="product_ad">产品商业图</option>
              </select>
            </label>
            <label className="field">
              <span>比例与尺寸</span>
              <select
                value={size}
                onChange={(event) => setSize(event.target.value as PromptSettings["size"])}
              >
                <option value="1024x1536">1024x1536 竖图</option>
                <option value="1536x1024">1536x1024 横图</option>
                <option value="1024x1024">1024x1024 方图</option>
              </select>
            </label>
          </div>
          <label className="field compact-field">
            <span>质量</span>
            <select
              value={quality}
              onChange={(event) => setQuality(event.target.value as PromptSettings["quality"])}
            >
              <option value="low">low 快速草图</option>
              <option value="medium">medium 先迭代</option>
              <option value="high">high 精修出图</option>
            </select>
          </label>
          <div className="chips" aria-label="Quick styles">
            {quickStyleChips.map((chip) => (
              <button
                className={`chip ${selectedStyle === chip ? "active" : ""}`}
                type="button"
                aria-pressed={selectedStyle === chip}
                key={chip}
                onClick={() => handleStyleChipClick(chip)}
              >
                {chip}
              </button>
            ))}
          </div>
          <div className="action-row">
            <button
              className="secondary"
              type="button"
              disabled={isBusy || !idea.trim()}
              onClick={handleEnhance}
            >
              {status === "enhancing" ? <Loader2 className="spin" size={18} /> : <Wand2 size={18} />}
              {status === "enhancing" ? "增强中..." : "增强提示词"}
            </button>
            <button
              className="primary"
              type="button"
              disabled={isBusy || !promptPackage}
              onClick={handleGenerate}
            >
              {status === "generating" ? (
                <Loader2 className="spin" size={18} />
              ) : (
                <Sparkles size={18} />
              )}
              {status === "generating" ? "生成中..." : "生成图片"}
            </button>
          </div>
          {error ? <p className="status-message error">{error}</p> : null}
          {notice ? <p className="status-message success">{notice}</p> : null}
        </section>

        <section className="output-panel" aria-labelledby="output-title">
          <div className="panel-heading">
            <h2 id="output-title">输出预览</h2>
            <span>{promptPackage?.settings.model ?? "gpt-image-2"}</span>
          </div>
          <div className="output-body">
            <div className={`image-placeholder ${generatedImage ? "has-image" : ""}`}>
              {generatedImage ? (
                <>
                  {generatedImage.image.url ? (
                    <img src={generatedImage.image.url} alt={promptPackage?.title ?? "生成图片"} />
                  ) : (
                    <ImageIcon size={48} />
                  )}
                  <strong>
                    {generatedImage.image.storage === "inline" ? "图片已生成" : "图片已保存到 R2"}
                  </strong>
                  <span>{generatedImage.image.storage === "inline" ? "临时预览，刷新后不会保留" : generatedImage.image.key}</span>
                </>
              ) : (
                <>
                  <ImageIcon size={48} />
                  <span>生成图会显示在这里</span>
                </>
              )}
            </div>
            <div className="prompt-stack">
              <article>
                <h3>Master Prompt</h3>
                <p>
                  {promptPackage?.masterPrompt ??
                    "Ultra-realistic cinematic 35mm film still, rainy Shanghai street at night, neon reflections on wet asphalt, elegant woman in trench coat, natural skin texture, subtle film grain."}
                </p>
              </article>
              <article>
                <h3>Negative Guardrails</h3>
                <p>
                  {promptPackage?.negativePrompt ??
                    "No plastic skin, no watermark, no distorted hands, no extra limbs, no fake CGI look, no unreadable text."}
                </p>
              </article>
              <article>
                <h3>中文解释</h3>
                <p>
                  {promptPackage?.cnExplanation ??
                    "系统会把用户的一句话拆成主体、场景、镜头、光线、材质、构图、质量和排除项，再补足摄影语言。"}
                </p>
              </article>
              {generatedImage?.revisedPrompt ? (
                <article>
                  <h3>Revised Prompt</h3>
                  <p>{generatedImage.revisedPrompt}</p>
                </article>
              ) : null}
              <button
                className="copy-button"
                type="button"
                disabled={!promptPackage}
                onClick={handleCopyPrompt}
              >
                <Copy size={16} />
                复制 prompt
              </button>
            </div>
          </div>
        </section>
      </section>

      <aside className="history-rail" aria-labelledby="recent-title">
        <div className="panel-heading">
          <h2 id="recent-title">
            <History size={18} />
            最近生成
          </h2>
          <button type="button" onClick={handleShowAllHistory}>查看全部</button>
        </div>
        <div className="history-list">
          {recentItems.map((item) => (
            <article className="history-card" key={`${item.title}-${item.meta}`}>
              <div className={`thumb ${item.accent}`} />
              <div>
                <h3>{item.title}</h3>
                <p>{item.meta}</p>
              </div>
            </article>
          ))}
        </div>
      </aside>
    </main>
  );
}

function getCurrentHash(): string {
  if (typeof window === "undefined") {
    return "#new";
  }

  const currentHash = window.location.hash;
  return navItems.some((item) => item.href === currentHash) ? currentHash : "#new";
}
