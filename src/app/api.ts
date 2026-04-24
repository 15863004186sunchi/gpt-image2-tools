import type { PromptBuildInput, PromptPackage } from "../shared/types";

export interface GeneratedImageResult {
  generation: {
    id: string;
    status: "complete" | "generating" | "failed";
    usage?: Record<string, unknown> | null;
  };
  image: {
    id?: string;
    key: string;
    url?: string;
    contentType: string;
    sizeBytes?: number;
    etag?: string | null;
    createdAt?: string;
    storage?: "r2" | "inline";
  };
  revisedPrompt: string | null;
}

interface ApiErrorBody {
  error?: {
    message?: string;
    status?: number;
  };
}

export async function enhancePrompt(input: PromptBuildInput): Promise<PromptPackage> {
  const body = await postJson<{ promptPackage: PromptPackage }>("/api/prompts/enhance", input);
  return body.promptPackage;
}

export async function generateImage(promptPackage: PromptPackage): Promise<GeneratedImageResult> {
  return postJson<GeneratedImageResult>("/api/images/generate", {
    promptPackage: {
      masterPrompt: promptPackage.masterPrompt,
      negativePrompt: promptPackage.negativePrompt,
      settings: promptPackage.settings,
    },
  });
}

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as T & ApiErrorBody;

  if (!response.ok) {
    throw new Error(formatApiError(body, response.status));
  }

  return body;
}

function formatApiError(body: ApiErrorBody, status: number): string {
  const message = body.error?.message ?? `Request failed with status ${status}`;

  if (status === 403 && message.includes("OpenAI request failed")) {
    return "当前兼容模型服务拒绝了图片生成请求。提示词增强已可用，但这个服务暂未开放 /v1/images/generations 出图能力。";
  }

  if (status === 404 && message.includes("OpenAI request failed")) {
    return "当前兼容模型服务没有图片生成接口。提示词增强已可用，出图需要接入支持 /v1/images/generations 的服务。";
  }

  return message;
}
