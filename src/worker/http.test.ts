import { describe, expect, it } from "vitest";
import { HttpError, jsonError, jsonOk, readJson } from "./http";

describe("worker HTTP helpers", () => {
  it("returns typed JSON success responses", async () => {
    const response = jsonOk({ ok: true });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns typed JSON error responses", async () => {
    const response = jsonError(new HttpError(422, "Invalid idea"));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: {
        message: "Invalid idea",
        status: 422,
      },
    });
  });

  it("rejects invalid JSON request bodies", async () => {
    const request = new Request("https://example.com/api", {
      method: "POST",
      body: "{bad json",
    });

    await expect(readJson(request)).rejects.toMatchObject({
      status: 400,
      message: "Invalid JSON body",
    });
  });
});
