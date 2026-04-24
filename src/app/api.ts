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
    contentType: string;
    sizeBytes?: number;
    etag?: string | null;
    createdAt?: string;
  };
  revisedPrompt: string | null;
}

interface ApiErrorBody {
  error?: {
    message?: string;
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
    throw new Error(body.error?.message ?? `Request failed with status ${response.status}`);
  }

  return body;
}
