import { describe, expect, it } from "vitest";
import { buildFallbackPromptPackage } from "../shared/prompt";
import type { PromptBuildInput } from "../shared/types";
import { enhancePromptWithOpenAICompatibleModel } from "./prompt-ai";

const input: PromptBuildInput = {
  idea: "雨夜上海街头电影人像",
  mode: "quick",
  category: "portrait_photography",
};

describe("prompt AI enhancement", () => {
  it("uses an OpenAI-compatible chat model without duplicating /v1", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const fallback = buildFallbackPromptPackage(input);
    const result = await enhancePromptWithOpenAICompatibleModel(
      {
        apiKey: "test-key",
        baseUrl: "http://34.169.107.98:8088/v1",
        textModel: "gpt-5.4-mini",
        fetcher: async (url, init) => {
          calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
          return Response.json({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: "雨夜电影人像",
                    masterPrompt: "cinematic rainy Shanghai portrait, precise lighting",
                    negativePrompt: "no watermark, no plastic skin",
                    cnExplanation: "已补足镜头、光线和构图。",
                    promptScore: 91,
                  }),
                },
              },
            ],
          });
        },
      },
      input,
      fallback,
    );

    expect(calls[0].url).toBe("http://34.169.107.98:8088/v1/chat/completions");
    expect(calls[0].body).toMatchObject({
      model: "gpt-5.4-mini",
    });
    expect(result).toMatchObject({
      title: "雨夜电影人像",
      masterPrompt: "cinematic rainy Shanghai portrait, precise lighting",
      promptScore: 91,
      settings: fallback.settings,
    });
  });

  it("falls back to the deterministic package when no API key is configured", async () => {
    const fallback = buildFallbackPromptPackage(input);

    await expect(
      enhancePromptWithOpenAICompatibleModel(
        {
          baseUrl: "http://34.169.107.98:8088/v1",
          textModel: "gpt-5.4-mini",
          fetcher: async () => Response.json({}),
        },
        input,
        fallback,
      ),
    ).resolves.toEqual(fallback);
  });
});
