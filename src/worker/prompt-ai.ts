import type { PromptBuildInput, PromptPackage } from "../shared/types";

type FetcherLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface PromptAiConfig {
  apiKey?: string;
  baseUrl: string;
  textModel: string;
  fetcher?: FetcherLike;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export async function enhancePromptWithOpenAICompatibleModel(
  config: PromptAiConfig,
  input: PromptBuildInput,
  fallback: PromptPackage,
): Promise<PromptPackage> {
  const apiKey = config.apiKey?.trim();
  if (!apiKey) {
    return fallback;
  }

  const fetcher = config.fetcher ?? fetch;
  const response = await fetcher(`${buildOpenAiV1BaseUrl(config.baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.textModel,
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content:
            "You are a world-class image prompt director. Return only strict JSON, no markdown.",
        },
        {
          role: "user",
          content: buildPromptEnhancementInstruction(input, fallback),
        },
      ],
    }),
  });

  if (!response.ok) {
    return fallback;
  }

  const body = (await response.json()) as ChatCompletionResponse;
  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    return fallback;
  }

  return normalizePromptPackage(content, fallback);
}

function buildPromptEnhancementInstruction(input: PromptBuildInput, fallback: PromptPackage): string {
  return JSON.stringify({
    task: "Transform the user's idea into a precise, production-ready image generation prompt package.",
    requirements: {
      title: "Short Chinese title, 8-18 characters when possible.",
      masterPrompt:
        "English image prompt with subject, scene, camera, lens, lighting, composition, material, mood, and fidelity details.",
      negativePrompt: "English guardrails for image defects and unwanted artifacts.",
      cnExplanation: "Chinese explanation of how the prompt was strengthened.",
      references: "Array of short reference tags, can be empty.",
      missingFields: "Array of missing user details, can be empty.",
      riskFlags: "Array of risk notes, can be empty.",
      promptScore: "Integer from 0 to 100.",
    },
    outputShape: {
      title: fallback.title,
      masterPrompt: fallback.masterPrompt,
      negativePrompt: fallback.negativePrompt,
      cnExplanation: fallback.cnExplanation,
      references: [],
      missingFields: [],
      riskFlags: [],
      promptScore: fallback.promptScore,
    },
    userInput: input,
  });
}

function normalizePromptPackage(content: string, fallback: PromptPackage): PromptPackage {
  try {
    const parsed = JSON.parse(extractJsonObject(content)) as Partial<PromptPackage>;
    return {
      ...fallback,
      title: asNonEmptyString(parsed.title, fallback.title),
      masterPrompt: asNonEmptyString(parsed.masterPrompt, fallback.masterPrompt),
      negativePrompt: asNonEmptyString(parsed.negativePrompt, fallback.negativePrompt),
      cnExplanation: asNonEmptyString(parsed.cnExplanation, fallback.cnExplanation),
      references: asStringArray(parsed.references, fallback.references),
      missingFields: asStringArray(parsed.missingFields, fallback.missingFields),
      riskFlags: asStringArray(parsed.riskFlags, fallback.riskFlags),
      promptScore: asScore(parsed.promptScore, fallback.promptScore),
    };
  } catch {
    return {
      ...fallback,
      masterPrompt: content.trim() || fallback.masterPrompt,
      cnExplanation: "模型已返回增强内容，但格式不是严格 JSON；系统已保留可用文本并补齐默认结构。",
    };
  }
}

function extractJsonObject(content: string): string {
  const trimmed = content.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found");
  }

  return trimmed.slice(start, end + 1);
}

function asNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asStringArray(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : fallback;
}

function asScore(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : fallback;
}

function buildOpenAiV1BaseUrl(baseUrl: string): string {
  const trimmedBaseUrl = baseUrl.replace(/\/+$/, "");

  return trimmedBaseUrl.endsWith("/v1") ? trimmedBaseUrl : `${trimmedBaseUrl}/v1`;
}
