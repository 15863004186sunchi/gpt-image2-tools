import { describe, expect, it } from "vitest";
import worker, { handleRequest } from "./index";
import type { Env } from "./env";
import type { WorkerServices } from "./index";

interface RecordedStatement {
  sql: string;
  params: unknown[];
}

class FakeStatement {
  private params: unknown[] = [];

  constructor(
    private readonly sql: string,
    private readonly records: RecordedStatement[],
  ) {}

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }

  async run() {
    this.records.push({ sql: this.sql, params: this.params });
    return {
      success: true,
      results: [],
      meta: {},
    };
  }

  async all() {
    this.records.push({ sql: this.sql, params: this.params });
    return {
      success: true,
      results: [],
      meta: {},
    };
  }
}

class FakeD1 {
  readonly records: RecordedStatement[] = [];

  prepare(sql: string) {
    return new FakeStatement(sql, this.records);
  }
}

class FakeR2 {
  readonly puts: Array<{
    key: string;
    value: Uint8Array;
    options?: {
      httpMetadata?: {
        contentType?: string;
      };
      customMetadata?: Record<string, string>;
    };
  }> = [];

  async put(
    key: string,
    value: ArrayBuffer | ArrayBufferView,
    options?: {
      httpMetadata?: {
        contentType?: string;
      };
      customMetadata?: Record<string, string>;
    },
  ) {
    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer);
    this.puts.push({ key, value: bytes, options });
    return {
      key,
      etag: "etag_route",
    };
  }
}

function makeEnv(overrides: Partial<Env> = {}): Env {
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
    ...overrides,
  };
}

function makeExecutionContext(): ExecutionContext {
  return {
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
    props: {},
  };
}

async function fetchApi(
  path: string,
  init?: RequestInit,
  env = makeEnv(),
  services?: WorkerServices,
) {
  if (services) {
    return handleRequest(new Request(`https://studio.test${path}`, init), env, makeExecutionContext(), services);
  }

  return worker.fetch(new Request(`https://studio.test${path}`, init), env, {
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

  it("persists enhanced prompts when D1 is available", async () => {
    const db = new FakeD1();
    const response = await fetchApi(
      "/api/prompts/enhance",
      {
        method: "POST",
        body: JSON.stringify({
          idea: "rainy Shanghai portrait",
          mode: "quick",
          category: "portrait_photography",
        }),
      },
      makeEnv({
        DB: db as unknown as D1Database,
      }),
      {
        idFactory: (prefix) => `${prefix}_route`,
        now: () => new Date("2026-04-24T00:00:00.000Z"),
      },
    );

    expect(response.status).toBe(200);
    expect(db.records.map((record) => record.sql)).toEqual([
      expect.stringContaining("INSERT INTO users"),
      expect.stringContaining("INSERT INTO prompt_enhancements"),
    ]);
    expect(db.records[1].params).toContain("enh_route");
    expect(db.records[1].params).toContain("rainy Shanghai portrait");
  });

  it("generates an image through OpenAI, stores it in R2, and completes the D1 record", async () => {
    const db = new FakeD1();
    const images = new FakeR2();
    const fetcher: WorkerServices["fetcher"] = async () =>
      Response.json({
        data: [
          {
            b64_json: "aGVsbG8=",
            revised_prompt: "revised cinematic portrait",
          },
        ],
        usage: {
          output_tokens: 196,
        },
      });

    const response = await fetchApi(
      "/api/images/generate",
      {
        method: "POST",
        body: JSON.stringify({
          promptPackage: {
            masterPrompt: "cinematic portrait",
            negativePrompt: "no watermark",
            settings: {
              model: "gpt-image-2",
              quality: "medium",
              size: "1024x1536",
              outputFormat: "jpeg",
            },
          },
        }),
      },
      makeEnv({
        DB: db as unknown as D1Database,
        IMAGES: images as unknown as R2Bucket,
        OPENAI_API_KEY: "test-key",
      }),
      {
        fetcher,
        idFactory: (prefix) => `${prefix}_route`,
        now: () => new Date("2026-04-24T00:00:00.000Z"),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      generation: {
        id: "gen_route",
        status: "complete",
      },
      image: {
        key: "generated/gen_route/img_route.jpeg",
        contentType: "image/jpeg",
      },
      revisedPrompt: "revised cinematic portrait",
    });
    expect(images.puts[0].key).toBe("generated/gen_route/img_route.jpeg");
    expect(db.records.map((record) => record.sql)).toEqual([
      expect.stringContaining("INSERT INTO users"),
      expect.stringContaining("INSERT INTO generations"),
      expect.stringContaining("INSERT INTO generated_images"),
      expect.stringContaining("UPDATE generations"),
      expect.stringContaining("INSERT INTO usage_events"),
    ]);
  });

  it("generates an inline preview when R2 is unavailable", async () => {
    const db = new FakeD1();
    const fetcher: WorkerServices["fetcher"] = async () =>
      Response.json({
        data: [
          {
            b64_json: "aGk=",
            revised_prompt: "inline revised portrait",
          },
        ],
      });

    const response = await fetchApi(
      "/api/images/generate",
      {
        method: "POST",
        body: JSON.stringify({
          promptPackage: {
            masterPrompt: "cinematic portrait",
            negativePrompt: "no watermark",
            settings: {
              model: "gpt-image-2",
              quality: "medium",
              size: "1024x1536",
              outputFormat: "jpeg",
            },
          },
        }),
      },
      makeEnv({
        DB: db as unknown as D1Database,
        OPENAI_API_KEY: "test-key",
      }),
      {
        fetcher,
        idFactory: (prefix) => `${prefix}_inline`,
        now: () => new Date("2026-04-24T00:00:00.000Z"),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      image: {
        key: "inline/gen_inline/img_inline.jpeg",
        url: "data:image/jpeg;base64,aGk=",
        storage: "inline",
        sizeBytes: 2,
      },
      revisedPrompt: "inline revised portrait",
    });
    expect(db.records.map((record) => record.sql)).toEqual([
      expect.stringContaining("INSERT INTO users"),
      expect.stringContaining("INSERT INTO generations"),
      expect.stringContaining("UPDATE generations"),
      expect.stringContaining("INSERT INTO usage_events"),
    ]);
  });

  it("returns 422 when image generation input is incomplete", async () => {
    const response = await fetchApi(
      "/api/images/generate",
      {
        method: "POST",
        body: JSON.stringify({
          promptPackage: {
            masterPrompt: "cinematic portrait",
          },
        }),
      },
      makeEnv({
        DB: new FakeD1() as unknown as D1Database,
        IMAGES: new FakeR2() as unknown as R2Bucket,
        OPENAI_API_KEY: "test-key",
      }),
      {
        fetcher: async () => Response.json({}),
      },
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        message: "Prompt settings are required",
      },
    });
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
