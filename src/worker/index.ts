import type { Env } from "./env";
import { buildFallbackPromptPackage } from "../shared/prompt";
import type { PromptBuildInput } from "../shared/types";
import { getDemoUser } from "./auth";
import { HttpError, jsonError, jsonOk, readJson } from "./http";

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
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

        return jsonOk({
          promptPackage: buildFallbackPromptPackage(input),
        });
      }

      if (url.pathname.startsWith("/api/")) {
        throw new HttpError(404, "Not found");
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      if (error instanceof HttpError) {
        return jsonError(error);
      }

      return jsonError(new HttpError(500, "Internal server error"));
    }
  },
} satisfies ExportedHandler<Env>;
