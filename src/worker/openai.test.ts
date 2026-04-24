import { describe, expect, it } from "vitest";
import { generateImageWithOpenAI, OpenAiServiceError } from "./openai";

describe("OpenAI image service", () => {
  it("builds a GPT Image 2 generation request from prompt settings", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return Response.json({
        data: [
          {
            b64_json: "aGVsbG8=",
            revised_prompt: "cinematic cat",
          },
        ],
        usage: {
          output_tokens: 196,
        },
      });
    };

    const result = await generateImageWithOpenAI(
      {
        apiKey: "test-key",
        baseUrl: "https://api.openai.com/",
        imageModel: "gpt-image-2",
        fetcher,
        clientRequestId: "req_123",
      },
      {
        prompt: "cinematic cat",
        quality: "high",
        size: "1024x1536",
        outputFormat: "jpeg",
        moderation: "auto",
      },
    );

    expect(calls[0].url).toBe("https://api.openai.com/v1/images/generations");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers).toMatchObject({
      Authorization: "Bearer test-key",
      "Content-Type": "application/json",
      "X-Client-Request-Id": "req_123",
    });
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      model: "gpt-image-2",
      prompt: "cinematic cat",
      quality: "high",
      size: "1024x1536",
      output_format: "jpeg",
      moderation: "auto",
      n: 1,
    });
    expect(result).toMatchObject({
      b64Json: "aGVsbG8=",
      revisedPrompt: "cinematic cat",
      usage: {
        output_tokens: 196,
      },
    });
  });

  it("does not duplicate /v1 when using an OpenAI-compatible base URL", async () => {
    const calls: string[] = [];
    const fetcher = async (url: string | URL | Request) => {
      calls.push(String(url));
      return Response.json({
        data: [
          {
            url: "https://example.com/image.png",
          },
        ],
      });
    };

    const result = await generateImageWithOpenAI(
      {
        apiKey: "test-key",
        baseUrl: "http://34.169.107.98:8088/v1",
        imageModel: "gpt-image-2",
        fetcher,
      },
      {
        prompt: "cinematic cat",
        quality: "medium",
        size: "1024x1024",
        outputFormat: "png",
      },
    );

    expect(calls[0]).toBe("http://34.169.107.98:8088/v1/images/generations");
    expect(result.url).toBe("https://example.com/image.png");
  });

  it("returns typed errors for missing credentials and upstream failures", async () => {
    await expect(
      generateImageWithOpenAI(
        {
          baseUrl: "https://api.openai.com",
          imageModel: "gpt-image-2",
          fetcher: async () => Response.json({}),
        },
        {
          prompt: "cat",
          quality: "low",
          size: "1024x1024",
          outputFormat: "png",
        },
      ),
    ).rejects.toMatchObject({
      code: "missing_api_key",
    });

    await expect(
      generateImageWithOpenAI(
        {
          apiKey: "test-key",
          baseUrl: "https://api.openai.com",
          imageModel: "gpt-image-2",
          fetcher: async () =>
            Response.json({ error: { message: "rate limited" } }, { status: 429 }),
        },
        {
          prompt: "cat",
          quality: "low",
          size: "1024x1024",
          outputFormat: "png",
        },
      ),
    ).rejects.toBeInstanceOf(OpenAiServiceError);
  });
});
