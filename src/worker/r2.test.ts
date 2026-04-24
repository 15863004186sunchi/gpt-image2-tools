import { describe, expect, it } from "vitest";
import { dataUrlForBase64Image, sizeBytesForBase64Image, storeGeneratedImage } from "./r2";

interface PutCall {
  key: string;
  value: Uint8Array;
  options?: {
    httpMetadata?: {
      contentType?: string;
    };
    customMetadata?: Record<string, string>;
  };
}

class FakeImageBucket {
  readonly puts: PutCall[] = [];

  async put(key: string, value: ArrayBuffer | ArrayBufferView, options?: PutCall["options"]) {
    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer);
    this.puts.push({ key, value: bytes, options });
    return {
      key,
      etag: "etag_123",
    };
  }
}

describe("R2 image storage", () => {
  it("decodes base64 images and stores them with deterministic metadata", async () => {
    const bucket = new FakeImageBucket();

    const stored = await storeGeneratedImage(
      bucket,
      {
        generationId: "gen_1",
        userId: "user_1",
        b64Json: "aGVsbG8=",
        outputFormat: "jpeg",
      },
      {
        idFactory: () => "img_1",
        now: () => new Date("2026-04-24T00:00:00.000Z"),
      },
    );

    expect(bucket.puts[0].key).toBe("generated/gen_1/img_1.jpeg");
    expect(new TextDecoder().decode(bucket.puts[0].value)).toBe("hello");
    expect(bucket.puts[0].options).toMatchObject({
      httpMetadata: {
        contentType: "image/jpeg",
      },
      customMetadata: {
        generationId: "gen_1",
        userId: "user_1",
      },
    });
    expect(stored).toEqual({
      id: "img_1",
      key: "generated/gen_1/img_1.jpeg",
      contentType: "image/jpeg",
      sizeBytes: 5,
      etag: "etag_123",
      createdAt: "2026-04-24T00:00:00.000Z",
    });
  });

  it("selects content types by output format", async () => {
    const bucket = new FakeImageBucket();

    await storeGeneratedImage(
      bucket,
      {
        generationId: "gen_1",
        b64Json: "aGk=",
        outputFormat: "webp",
      },
      {
        idFactory: () => "img_2",
        now: () => new Date("2026-04-24T00:00:00.000Z"),
      },
    );

    expect(bucket.puts[0].options?.httpMetadata?.contentType).toBe("image/webp");
    expect(bucket.puts[0].key).toBe("generated/gen_1/img_2.webp");
  });

  it("builds inline image fallbacks when R2 is unavailable", () => {
    expect(dataUrlForBase64Image("aGk=", "png")).toBe("data:image/png;base64,aGk=");
    expect(sizeBytesForBase64Image("aGk=")).toBe(2);
  });
});
