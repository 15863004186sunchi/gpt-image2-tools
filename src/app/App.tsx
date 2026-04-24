import { Copy, History, ImageIcon, Sparkles, Wand2 } from "lucide-react";

const recentItems = [
  {
    title: "雨夜霓虹电影人像",
    meta: "照片 / 电影剧照 · medium · 刚刚",
  },
  {
    title: "超现实锦鲤星云海报",
    meta: "高质量海报 · high · 2 分钟前",
  },
  {
    title: "玻璃拟态 UI 设计系统",
    meta: "UI mockup · medium · 昨天",
  },
];

export function App() {
  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Navigation">
        <div className="brand">Image 2<br />Prompt Studio</div>
        <nav>
          <a className="nav-item active" href="#new">新建生成</a>
          <a className="nav-item" href="#history">我的历史</a>
          <a className="nav-item" href="#cases">提示词案例</a>
          <a className="nav-item" href="#account">账户设置</a>
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
              <button className="selected" type="button">普通模式</button>
              <button type="button">专业模式</button>
            </div>
            <div className="account-pill">已登录</div>
          </div>
        </header>

        <section className="tool-panel" aria-labelledby="input-title">
          <div className="panel-heading">
            <h2 id="input-title">创作输入</h2>
            <span>草稿质量 82</span>
          </div>
          <label className="field">
            <span>画面想法</span>
            <textarea defaultValue="一个雨夜的上海街头，穿风衣的女性站在霓虹灯下，像电影剧照一样真实。" />
          </label>
          <div className="field-grid">
            <label className="field">
              <span>图像类型</span>
              <select defaultValue="photo">
                <option value="photo">照片 / 电影剧照</option>
                <option value="poster">电影海报</option>
                <option value="product">产品商业图</option>
              </select>
            </label>
            <label className="field">
              <span>比例与尺寸</span>
              <select defaultValue="1024x1536">
                <option value="1024x1536">1024x1536 竖图</option>
                <option value="1536x1024">1536x1024 横图</option>
                <option value="1024x1024">1024x1024 方图</option>
              </select>
            </label>
          </div>
          <div className="chips" aria-label="Quick styles">
            <button className="chip active" type="button">35mm 胶片</button>
            <button className="chip" type="button">霓虹夜景</button>
            <button className="chip" type="button">自然肤质</button>
            <button className="chip" type="button">低饱和</button>
          </div>
          <div className="action-row">
            <button className="secondary" type="button"><Wand2 size={18} />增强提示词</button>
            <button className="primary" type="button"><Sparkles size={18} />生成图片</button>
          </div>
        </section>

        <section className="output-panel" aria-labelledby="output-title">
          <div className="panel-heading">
            <h2 id="output-title">输出预览</h2>
            <span>gpt-image-2</span>
          </div>
          <div className="output-body">
            <div className="image-placeholder">
              <ImageIcon size={48} />
              <span>生成图会显示在这里</span>
            </div>
            <div className="prompt-stack">
              <article>
                <h3>Master Prompt</h3>
                <p>Ultra-realistic cinematic 35mm film still, rainy Shanghai street at night, neon reflections on wet asphalt, elegant woman in trench coat, natural skin texture, subtle film grain.</p>
              </article>
              <article>
                <h3>Negative Guardrails</h3>
                <p>No plastic skin, no watermark, no distorted hands, no extra limbs, no fake CGI look, no unreadable text.</p>
              </article>
              <button className="copy-button" type="button"><Copy size={16} />复制 prompt</button>
            </div>
          </div>
        </section>
      </section>

      <aside className="history-rail" aria-labelledby="recent-title">
        <div className="panel-heading">
          <h2 id="recent-title"><History size={18} />最近生成</h2>
          <button type="button">查看全部</button>
        </div>
        <div className="history-list">
          {recentItems.map((item) => (
            <article className="history-card" key={item.title}>
              <div className="thumb" />
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
