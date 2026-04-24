import { describe, expect, it } from "vitest";
import { buildFallbackPromptPackage } from "./prompt";

describe("buildFallbackPromptPackage", () => {
  it("turns a one-line idea into a structured prompt package", () => {
    const result = buildFallbackPromptPackage({
      idea: "雨夜上海街头，一个穿风衣的人像电影剧照",
      mode: "quick",
      category: "portrait_photography",
    });

    expect(result.title).toContain("Prompt");
    expect(result.masterPrompt).toContain("雨夜上海街头");
    expect(result.masterPrompt).toContain("cinematic");
    expect(result.negativePrompt).toContain("no watermark");
    expect(result.cnExplanation).toContain("主体");
    expect(result.settings).toEqual({
      model: "gpt-image-2",
      quality: "medium",
      size: "1024x1536",
      outputFormat: "jpeg",
    });
    expect(result.promptScore).toBeGreaterThanOrEqual(60);
    expect(result.riskFlags).toEqual([]);
  });

  it("merges professional controls without overwriting the user's idea", () => {
    const result = buildFallbackPromptPackage({
      idea: "一张咖啡杯产品广告图，清晨窗边",
      mode: "professional",
      category: "product_ad",
      controls: {
        lens: "85mm product lens",
        lighting: "soft sunrise side light",
        quality: "high",
        size: "1536x1024",
        outputFormat: "webp",
      },
    });

    expect(result.masterPrompt).toContain("一张咖啡杯产品广告图");
    expect(result.masterPrompt).toContain("85mm product lens");
    expect(result.masterPrompt).toContain("soft sunrise side light");
    expect(result.masterPrompt).toContain("premium product advertising image");
    expect(result.settings.quality).toBe("high");
    expect(result.settings.size).toBe("1536x1024");
    expect(result.settings.outputFormat).toBe("webp");
  });
});
