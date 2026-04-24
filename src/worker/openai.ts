import type { PromptSettings } from "../shared/types";

type FetcherLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type OpenAiModeration = "auto" | "low";

export interface OpenAiImageConfig {
  apiKey?: string;
  baseUrl: string;
  imageModel: string;
  fetcher?: FetcherLike;
  clientRequestId?: string;
}

export interface OpenAiImageInput {
  prompt: string;
  quality: PromptSettings["quality"];
  size: PromptSettings["size"];
  outputFormat: PromptSettings["outputFormat"];
  moderation?: OpenAiModeration;
  model?: string;
  n?: number;
}

export interface OpenAiImageResult {
  b64Json: string;
  revisedPrompt: string | null;
  usage: Record<string, unknown> | null;
}

interface OpenAiImageResponse {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
  }>;
  usage?: Record<string, unknown>;
}

export class OpenAiServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 500,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "OpenAiServiceError";
  }
}

export async function generateImageWithOpenAI(
  config: OpenAiImageConfig,
  input: OpenAiImageInput,
): Promise<OpenAiImageResult> {
  const apiKey = config.apiKey?.trim();

  if (!apiKey) {
    throw new OpenAiServiceError(
      "missing_api_key",
      "OpenAI API key is not configured",
      500,
    );
  }

  const payload = {
    model: input.model ?? config.imageModel,
    prompt: input.prompt,
    quality: input.quality,
    size: input.size,
    output_format: input.outputFormat,
    moderation: input.moderation ?? "auto",
    n: input.n ?? 1,
  };
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (config.clientRequestId) {
    headers["X-Client-Request-Id"] = config.clientRequestId;
  }

  const fetcher = config.fetcher ?? fetch;
  const response = await fetcher(`${trimTrailingSlash(config.baseUrl)}/v1/images/generations`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await buildOpenAiError(response);
  }

  const body = (await response.json()) as OpenAiImageResponse;
  const image = body.data?.[0];

  if (!image?.b64_json) {
    throw new OpenAiServiceError(
      "empty_image_response",
      "OpenAI did not return image data",
      502,
      body,
    );
  }

  return {
    b64Json: image.b64_json,
    revisedPrompt: image.revised_prompt ?? null,
    usage: body.usage ?? null,
  };
}

async function buildOpenAiError(response: Response): Promise<OpenAiServiceError> {
  const fallbackMessage = `OpenAI request failed with status ${response.status}`;

  try {
    const body = (await response.json()) as {
      error?: {
        message?: string;
        code?: string;
      };
    };
    return new OpenAiServiceError(
      body.error?.code ?? "openai_upstream_error",
      body.error?.message ?? fallbackMessage,
      response.status,
      body,
    );
  } catch {
    return new OpenAiServiceError("openai_upstream_error", fallbackMessage, response.status);
  }
}

function trimTrailingSlash(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}
