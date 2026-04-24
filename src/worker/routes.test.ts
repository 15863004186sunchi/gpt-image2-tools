import { describe, expect, it } from "vitest";
import worker from "./index";
import type { Env } from "./env";

function makeEnv(): Env {
  return {
    ASSETS: {
      fetch: () => Promise.resolve(new Response("asset")),
    } as unknown as Fetcher,
    DB: undefined as unknown as D1Database,
    IMAGES: undefined as unknown as R2Bucket,
    ENVIRONMENT: "test",
    OPENAI_BASE_URL: "https://api.openai.com",
    OPENAI_IMAGE_MODEL: "gpt-image-2",
    OPENAI_TEXT_MODEL: "gpt-5.4-mini",
  };
}

async function fetchApi(path: string, init?: RequestInit) {
  return worker.fetch(new Request(`https://studio.test${path}`, init), makeEnv(), {
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
    props: {},
  });
}

describe("worker routes", () => {
  it("returns health status", async () => {
    const response = await fetchApi("/api/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      service: "gpt-image2-tools",
      environment: "test",
    });
  });

  it("returns a demo authenticated user", async () => {
    const response = await fetchApi("/api/me");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      user: {
        id: "demo-user",
        plan: "free",
      },
    });
  });

  it("enhances prompts with the fallback prompt builder", async () => {
    const response = await fetchApi("/api/prompts/enhance", {
      method: "POST",
      body: JSON.stringify({
        idea: "雨夜上海街头，一个穿风衣的人像电影剧照",
        mode: "quick",
        category: "portrait_photography",
      }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      promptPackage: {
        masterPrompt: string;
        settings: {
          model: string;
        };
      };
    };
    expect(body.promptPackage.masterPrompt).toContain("cinematic");
    expect(body.promptPackage.settings.model).toBe("gpt-image-2");
  });

  it("returns JSON 404 for unknown API routes", async () => {
    const response = await fetchApi("/api/unknown");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        status: 404,
      },
    });
  });
});
