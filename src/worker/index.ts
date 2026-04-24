import type { Env } from "./env";
import { buildFallbackPromptPackage } from "../shared/prompt";
import type { PromptBuildInput, PromptPackage } from "../shared/types";
import { getDemoUser } from "./auth";
import {
  createGeneratedImage,
  createGeneration,
  createPromptEnhancement,
  markGenerationComplete,
  recordUsageEvent,
  upsertUser,
} from "./db/repositories";
import { HttpError, jsonError, jsonOk, readJson } from "./http";
import { generateImageWithOpenAI, OpenAiServiceError } from "./openai";
import { storeGeneratedImage } from "./r2";

export type WorkerFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface WorkerServices {
  fetcher?: WorkerFetch;
  idFactory?: (prefix: string) => string;
  now?: () => Date;
}

interface ImageGenerationRequest {
  enhancementId?: string;
  promptPackage?: Pick<PromptPackage, "masterPrompt" | "negativePrompt" | "settings">;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;

export async function handleRequest(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
  services: WorkerServices = {},
): Promise<Response> {
  const url = new URL(request.url);

  try {
    if (url.pathname === "/api/health") {
      return jsonOk({
        ok: true,
        service: "gpt-image2-tools",
        environment: env.ENVIRONMENT,
      });
    }

    if (url.pathname === "/api/me") {
      return jsonOk({ user: getDemoUser() });
    }

    if (url.pathname === "/api/prompts/enhance" && request.method === "POST") {
      const input = await readJson<PromptBuildInput>(request);
      if (!input.idea?.trim()) {
        throw new HttpError(422, "Idea is required");
      }

      const promptPackage = buildFallbackPromptPackage(input);

      if (env.DB) {
        const user = getDemoUser();
        const createdAt = nowIso(services);

        await upsertUser(env.DB, {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          plan: user.plan,
          createdAt,
          updatedAt: createdAt,
        });
        await createPromptEnhancement(env.DB, {
          id: makeId("enh", services),
          userId: user.id,
          inputText: input.idea,
          mode: input.mode,
          category: input.category ?? null,
          outputJson: JSON.stringify(promptPackage),
          promptScore: promptPackage.promptScore,
          createdAt,
        });
      }

      return jsonOk({
        promptPackage,
      });
    }

    if (url.pathname === "/api/images/generate" && request.method === "POST") {
      return await handleImageGeneration(request, env, services);
    }

    if (url.pathname.startsWith("/api/")) {
      throw new HttpError(404, "Not found");
    }

    return env.ASSETS.fetch(request);
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonError(error);
    }

    if (error instanceof OpenAiServiceError) {
      return jsonError(new HttpError(error.status, error.message));
    }

    return jsonError(new HttpError(500, "Internal server error"));
  }
}

async function handleImageGeneration(
  request: Request,
  env: Env,
  services: WorkerServices,
): Promise<Response> {
  const input = await readJson<ImageGenerationRequest>(request);
  const promptPackage = input.promptPackage;

  if (!promptPackage?.masterPrompt?.trim()) {
    throw new HttpError(422, "Prompt package is required");
  }

  if (!promptPackage.settings) {
    throw new HttpError(422, "Prompt settings are required");
  }

  if (!env.DB) {
    throw new HttpError(503, "D1 database binding is not configured");
  }

  if (!env.IMAGES) {
    throw new HttpError(503, "R2 image bucket binding is not configured");
  }

  const user = getDemoUser();
  const createdAt = nowIso(services);
  const generationId = makeId("gen", services);

  await upsertUser(env.DB, {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    plan: user.plan,
    createdAt,
    updatedAt: createdAt,
  });
  await createGeneration(env.DB, {
    id: generationId,
    userId: user.id,
    enhancementId: input.enhancementId ?? null,
    status: "generating",
    model: promptPackage.settings.model,
    quality: promptPackage.settings.quality,
    size: promptPackage.settings.size,
    outputFormat: promptPackage.settings.outputFormat,
    promptText: promptPackage.masterPrompt,
    negativePrompt: promptPackage.negativePrompt,
    createdAt,
  });

  const openAiResult = await generateImageWithOpenAI(
    {
      apiKey: env.OPENAI_API_KEY,
      baseUrl: env.OPENAI_BASE_URL,
      imageModel: promptPackage.settings.model || env.OPENAI_IMAGE_MODEL,
      fetcher: services.fetcher,
      clientRequestId: generationId,
    },
    {
      prompt: promptPackage.masterPrompt,
      quality: promptPackage.settings.quality,
      size: promptPackage.settings.size,
      outputFormat: promptPackage.settings.outputFormat,
      moderation: "auto",
    },
  );
  const image = await storeGeneratedImage(
    env.IMAGES,
    {
      generationId,
      userId: user.id,
      b64Json: openAiResult.b64Json,
      outputFormat: promptPackage.settings.outputFormat,
    },
    {
      idFactory: () => makeId("img", services),
      now: services.now,
    },
  );

  await createGeneratedImage(env.DB, {
    id: image.id,
    generationId,
    userId: user.id,
    r2Key: image.key,
    contentType: image.contentType,
    createdAt: image.createdAt,
  });
  await markGenerationComplete(env.DB, {
    id: generationId,
    usageJson: JSON.stringify(openAiResult.usage ?? {}),
    completedAt: nowIso(services),
  });
  await recordUsageEvent(env.DB, {
    id: makeId("use", services),
    userId: user.id,
    eventType: "image_generation",
    model: promptPackage.settings.model,
    generationId,
    usageJson: JSON.stringify(openAiResult.usage ?? {}),
    createdAt: nowIso(services),
  });

  return jsonOk({
    generation: {
      id: generationId,
      status: "complete",
      usage: openAiResult.usage,
    },
    image,
    revisedPrompt: openAiResult.revisedPrompt,
  });
}

function makeId(prefix: string, services: WorkerServices): string {
  return services.idFactory?.(prefix) ?? `${prefix}_${crypto.randomUUID()}`;
}

function nowIso(services: WorkerServices): string {
  return (services.now?.() ?? new Date()).toISOString();
}
