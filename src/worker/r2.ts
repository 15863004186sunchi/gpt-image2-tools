import type { PromptSettings } from "../shared/types";

interface ImageBucket {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView,
    options?: {
      httpMetadata?: {
        contentType?: string;
      };
      customMetadata?: Record<string, string>;
    },
  ): Promise<{ etag: string } | null>;
}

export interface StoreGeneratedImageInput {
  generationId: string;
  userId?: string;
  b64Json: string;
  outputFormat: PromptSettings["outputFormat"];
}

export interface StoreGeneratedImageOptions {
  idFactory?: () => string;
  now?: () => Date;
}

export interface StoredGeneratedImage {
  id: string;
  key: string;
  contentType: string;
  sizeBytes: number;
  etag: string | null;
  createdAt: string;
}

export async function storeGeneratedImage(
  bucket: ImageBucket,
  input: StoreGeneratedImageInput,
  options: StoreGeneratedImageOptions = {},
): Promise<StoredGeneratedImage> {
  const id = options.idFactory?.() ?? crypto.randomUUID();
  const createdAt = (options.now?.() ?? new Date()).toISOString();
  const contentType = contentTypeForOutputFormat(input.outputFormat);
  const bytes = decodeBase64Image(input.b64Json);
  const key = [
    "generated",
    sanitizeKeySegment(input.generationId),
    `${sanitizeKeySegment(id)}.${input.outputFormat}`,
  ].join("/");
  const object = await bucket.put(key, bytes, {
    httpMetadata: {
      contentType,
    },
    customMetadata: {
      generationId: input.generationId,
      ...(input.userId ? { userId: input.userId } : {}),
    },
  });

  return {
    id,
    key,
    contentType,
    sizeBytes: bytes.byteLength,
    etag: object?.etag ?? null,
    createdAt,
  };
}

export function contentTypeForOutputFormat(format: PromptSettings["outputFormat"]): string {
  if (format === "jpeg") {
    return "image/jpeg";
  }

  return `image/${format}`;
}

export function dataUrlForBase64Image(
  b64Json: string,
  outputFormat: PromptSettings["outputFormat"],
): string {
  return `data:${contentTypeForOutputFormat(outputFormat)};base64,${b64Json}`;
}

export function sizeBytesForBase64Image(b64Json: string): number {
  return decodeBase64Image(b64Json).byteLength;
}

function decodeBase64Image(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function sanitizeKeySegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}
