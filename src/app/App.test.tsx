import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const promptPackage = {
  title: "Rainy Portrait Prompt",
  masterPrompt: "cinematic rainy portrait, 35mm film still",
  negativePrompt: "no watermark",
  cnExplanation: "系统已补全主体、场景、镜头和光线。",
  settings: {
    model: "gpt-image-2",
    quality: "medium",
    size: "1024x1536",
    outputFormat: "jpeg",
  },
  references: [],
  missingFields: [],
  riskFlags: [],
  promptScore: 86,
};

describe("App workbench", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  it("renders the prompt workbench shell", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "把一句想法变成可出片的专业提示词" })).toBeInTheDocument();
    expect(screen.getByLabelText("画面想法")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /增强提示词/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /生成图片/ })).toBeDisabled();
    expect(screen.getByRole("heading", { name: /最近生成/ })).toBeInTheDocument();
  });

  it("highlights the active navigation item from the current hash", () => {
    window.history.replaceState(null, "", "/#history");
    render(<App />);

    expect(screen.getByRole("link", { name: "我的历史" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "新建生成" })).not.toHaveAttribute("aria-current");
  });

  it("switches the active navigation item when a sidebar link is clicked", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("link", { name: "提示词案例" }));

    expect(screen.getByRole("link", { name: "提示词案例" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "新建生成" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("heading", { name: "可复用案例" })).toBeInTheDocument();
  });

  it("renders real content for history, cases, and account pages", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("link", { name: "我的历史" }));
    expect(screen.getByRole("heading", { name: "最近尝试" })).toBeInTheDocument();
    expect(screen.getByText(/当前是 Demo 本地展示/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "提示词案例" }));
    expect(screen.getByRole("heading", { name: "雨夜电影人像" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /载入到新建生成/ })).toHaveLength(3);

    fireEvent.click(screen.getByRole("link", { name: "账户设置" }));
    expect(screen.getByRole("heading", { name: "账户与配置" })).toBeInTheDocument();
    expect(screen.getByText("免登录 Demo")).toBeInTheDocument();
  });

  it("loads a prompt case back into the creation page", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("link", { name: "提示词案例" }));
    fireEvent.click(screen.getAllByRole("button", { name: /载入到新建生成/ })[0]);

    expect(screen.getByRole("link", { name: "新建生成" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("画面想法")).toHaveValue(
      "雨夜上海街头，穿风衣的人物站在霓虹灯下，湿润柏油路反光，电影剧照质感。",
    );
    expect(screen.getByText(/已载入案例：雨夜电影人像/)).toBeInTheDocument();
  });

  it("enhances a prompt and generates an image through the API client", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/api/prompts/enhance")) {
        return Response.json({ promptPackage });
      }

      if (url.endsWith("/api/images/generate")) {
        return Response.json({
          generation: {
            id: "gen_1",
            status: "complete",
          },
          image: {
            id: "img_1",
            key: "generated/gen_1/img_1.jpeg",
            url: "data:image/jpeg;base64,aGk=",
            contentType: "image/jpeg",
            sizeBytes: 5,
            etag: "etag_123",
            createdAt: "2026-04-24T00:00:00.000Z",
            storage: "inline",
          },
          revisedPrompt: "revised cinematic rainy portrait",
        });
      }

      return Response.json({ error: { message: "unexpected route" } }, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    fireEvent.click(screen.getByRole("link", { name: "新建生成" }));

    fireEvent.change(screen.getByLabelText("画面想法"), {
      target: { value: "雨夜上海街头电影人像" },
    });
    fireEvent.click(screen.getByRole("button", { name: /增强提示词/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/prompts/enhance", expect.any(Object)));
    expect(screen.getByRole("button", { name: /生成图片/ })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /生成图片/ }));

    expect(await screen.findByText("临时预览，刷新后不会保留")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Rainy Portrait Prompt/ })).toHaveAttribute(
      "src",
      "data:image/jpeg;base64,aGk=",
    );
    expect(screen.getByText("revised cinematic rainy portrait")).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("wires secondary buttons to visible feedback", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText,
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ promptPackage })),
    );
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "霓虹夜景" }));
    expect(screen.getByText(/已选择风格：霓虹夜景/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /增强提示词/ }));
    expect(await screen.findByText(/cinematic rainy portrait, 35mm film still/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /复制 prompt/ }));
    expect(await screen.findByText("Prompt 已复制到剪贴板。")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining(promptPackage.masterPrompt));

    fireEvent.click(screen.getByRole("button", { name: "查看全部" }));
    expect(screen.getByText(/完整历史记录会在登录与付费能力接入后开放/)).toBeInTheDocument();
  });
});
