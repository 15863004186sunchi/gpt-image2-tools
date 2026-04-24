# GPT Image 2 Prompt Studio MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable Cloudflare-native MVP for a GPT Image 2 prompt workbench with prompt enhancement, generation history scaffolding, and deploy-ready Worker bindings.

**Architecture:** Use a Vite React SPA served by Cloudflare Workers Static Assets, with `/api/*` handled by a TypeScript Worker. D1 owns relational metadata, R2 owns generated image blobs, and OpenAI calls stay server-side behind typed service modules.

**Tech Stack:** Vite, React, TypeScript, Vitest, Cloudflare Workers, Wrangler, D1, R2, OpenAI HTTP API.

---

## File Structure

- Create `package.json`: scripts and dependencies for Vite, Vitest, TypeScript, Wrangler, React, and lucide icons.
- Create `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`: TypeScript and test/build configuration.
- Create `wrangler.jsonc`: Worker entry, Workers Static Assets, compatibility date, local D1/R2 binding placeholders, observability.
- Create `src/worker/index.ts`: Worker fetch entrypoint and route dispatch.
- Create `src/worker/env.ts`: environment and binding types.
- Create `src/worker/http.ts`: JSON responses, errors, request parsing.
- Create `src/worker/auth.ts`: MVP dev-session auth helper with a future OAuth boundary.
- Create `src/worker/db/schema.sql`: D1 migration source.
- Create `src/worker/db/repositories.ts`: typed D1 repository functions.
- Create `src/worker/openai.ts`: prompt enhancement and image generation service boundaries.
- Create `src/worker/r2.ts`: generated image storage helpers.
- Create `src/shared/types.ts`: shared request/response schemas.
- Create `src/shared/prompt.ts`: prompt controls and deterministic fallback prompt builder.
- Create `src/app/App.tsx`: main workbench application.
- Create `src/app/main.tsx`: React entry.
- Create `src/app/styles.css`: workbench visual system adapted from the mockup.
- Create `src/app/api.ts`: browser API client.
- Create `src/app/data.ts`: initial local examples for the right rail.
- Create `src/**/*.test.ts`: focused unit tests for prompt building, routes, and API response contracts.
- Create `public/`: static assets placeholder.
- Modify `docs/superpowers/specs/2026-04-24-gpt-image2-prompt-studio-design.md`: add note pointing to the implementation plan after scaffolding.

## Task 1: Project Tooling And Cloudflare Config

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `wrangler.jsonc`
- Create: `src/worker/env.ts`
- Create: `src/app/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/styles.css`
- Create: `index.html`

- [ ] **Step 1: Add minimal project files**

Create a Vite React TypeScript project manually so we control Cloudflare layout from the start.

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: dependencies install and `package-lock.json` is created.

- [ ] **Step 3: Verify TypeScript baseline**

Run: `npm run typecheck`

Expected: TypeScript exits 0.

- [ ] **Step 4: Verify frontend build baseline**

Run: `npm run build`

Expected: Vite writes `dist/`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts vitest.config.ts wrangler.jsonc index.html src
git commit -m "chore: scaffold cloudflare react app"
```

## Task 2: Shared Prompt Model With TDD

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/prompt.ts`
- Test: `src/shared/prompt.test.ts`

- [ ] **Step 1: Write failing test for quick-mode prompt package**

Test that a Chinese one-line idea returns a structured prompt package with title, English master prompt, Chinese explanation, negative prompt, settings, and a numeric score.

Run: `npm test -- src/shared/prompt.test.ts`

Expected: FAIL because `buildFallbackPromptPackage` does not exist.

- [ ] **Step 2: Implement minimal fallback prompt builder**

Implement `buildFallbackPromptPackage(input)` with deterministic output, default model `gpt-image-2`, quality `medium`, size `1024x1536`, output format `jpeg`, and sensible negative guardrails.

- [ ] **Step 3: Verify test passes**

Run: `npm test -- src/shared/prompt.test.ts`

Expected: PASS.

- [ ] **Step 4: Add professional-control merge test**

Test that lens, lighting, category, and quality controls appear in the generated prompt/settings without overwriting the user's original idea.

Run: `npm test -- src/shared/prompt.test.ts`

Expected: FAIL until controls are supported.

- [ ] **Step 5: Implement controls support**

Add typed `PromptControls` and merge them into prompt language and settings.

- [ ] **Step 6: Verify tests and typecheck**

Run: `npm test -- src/shared/prompt.test.ts`

Run: `npm run typecheck`

Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shared
git commit -m "feat: add prompt package builder"
```

## Task 3: Worker API Foundation With TDD

**Files:**
- Create: `src/worker/http.ts`
- Create: `src/worker/auth.ts`
- Create: `src/worker/index.ts`
- Test: `src/worker/http.test.ts`
- Test: `src/worker/routes.test.ts`

- [ ] **Step 1: Write failing tests for JSON helpers**

Test `jsonOk`, `jsonError`, and safe JSON parsing behavior.

Run: `npm test -- src/worker/http.test.ts`

Expected: FAIL because helpers do not exist.

- [ ] **Step 2: Implement HTTP helpers**

Add small helpers for JSON responses, typed errors, CORS-safe same-origin defaults, and request body parsing.

- [ ] **Step 3: Verify helper tests pass**

Run: `npm test -- src/worker/http.test.ts`

Expected: PASS.

- [ ] **Step 4: Write failing route tests**

Test these routes:

```text
GET /api/health -> { ok: true }
GET /api/me -> demo authenticated user for local MVP
POST /api/prompts/enhance -> prompt package
GET unknown /api route -> 404 JSON
```

Run: `npm test -- src/worker/routes.test.ts`

Expected: FAIL because Worker routes are not implemented.

- [ ] **Step 5: Implement Worker router**

Implement `fetch(request, env, ctx)` and route dispatch. Keep route handlers small and pure enough to test directly.

- [ ] **Step 6: Verify route tests and typecheck**

Run: `npm test -- src/worker/http.test.ts src/worker/routes.test.ts`

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/worker src/shared
git commit -m "feat: add worker api foundation"
```

## Task 4: D1 Schema And Repositories

**Files:**
- Create: `src/worker/db/schema.sql`
- Create: `src/worker/db/repositories.ts`
- Test: `src/worker/db/repositories.test.ts`
- Modify: `wrangler.jsonc`
- Create: `migrations/0001_initial.sql`

- [ ] **Step 1: Add D1 schema migration**

Create tables for users, auth_sessions, prompt_cases, prompt_enhancements, generations, generated_images, and usage_events from the design spec.

- [ ] **Step 2: Write failing repository tests with a fake D1 binding**

Test SQL string construction and repository behavior for creating prompt enhancements and listing recent generations using a small fake `prepare().bind().run()` binding.

Run: `npm test -- src/worker/db/repositories.test.ts`

Expected: FAIL because repositories do not exist.

- [ ] **Step 3: Implement repositories**

Add focused functions:

```text
createPromptEnhancement
getPromptEnhancement
createGeneration
markGenerationComplete
listRecentGenerations
recordUsageEvent
```

- [ ] **Step 4: Verify repository tests**

Run: `npm test -- src/worker/db/repositories.test.ts`

Expected: PASS.

- [ ] **Step 5: Verify Wrangler config shape**

Run: `npm run typecheck`

Expected: PASS. If dependencies are installed, run `npx wrangler types --dry-run` or `npx wrangler types` and commit generated binding types if useful.

- [ ] **Step 6: Commit**

```bash
git add wrangler.jsonc migrations src/worker/db
git commit -m "feat: add d1 schema and repositories"
```

## Task 5: OpenAI And R2 Service Boundaries

**Files:**
- Create: `src/worker/openai.ts`
- Create: `src/worker/r2.ts`
- Test: `src/worker/openai.test.ts`
- Test: `src/worker/r2.test.ts`
- Modify: `src/worker/index.ts`

- [ ] **Step 1: Write failing OpenAI payload tests**

Test that image generation builds a `POST /v1/images/generations` payload with configurable model, prompt, quality, size, output format, and moderation.

Run: `npm test -- src/worker/openai.test.ts`

Expected: FAIL because service does not exist.

- [ ] **Step 2: Implement OpenAI service**

Use `fetch` directly instead of a Node-only SDK to keep Worker runtime simple. Read `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_IMAGE_MODEL`, and `OPENAI_TEXT_MODEL` from env. Return typed errors for missing API key and upstream failures.

- [ ] **Step 3: Verify OpenAI tests**

Run: `npm test -- src/worker/openai.test.ts`

Expected: PASS.

- [ ] **Step 4: Write failing R2 storage tests**

Test base64 decoding, content type selection, R2 key naming, and returned metadata.

Run: `npm test -- src/worker/r2.test.ts`

Expected: FAIL because storage helpers do not exist.

- [ ] **Step 5: Implement R2 helpers**

Add `storeGeneratedImage(env.IMAGES, generationId, base64, outputFormat)` using `crypto.randomUUID()` and `bucket.put`.

- [ ] **Step 6: Verify service tests and typecheck**

Run: `npm test -- src/worker/openai.test.ts src/worker/r2.test.ts`

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/worker/openai.ts src/worker/r2.ts src/worker/*.test.ts src/worker/index.ts
git commit -m "feat: add openai and r2 service boundaries"
```

## Task 6: Prompt And Image API Routes

**Files:**
- Modify: `src/worker/index.ts`
- Modify: `src/worker/db/repositories.ts`
- Test: `src/worker/routes.test.ts`

- [ ] **Step 1: Write failing prompt enhancement persistence test**

Test `POST /api/prompts/enhance` saves an enhancement when `DB` is available and still returns a fallback package when running without DB in tests.

Run: `npm test -- src/worker/routes.test.ts`

Expected: FAIL until route persistence is implemented.

- [ ] **Step 2: Implement enhancement persistence**

Call prompt builder first, then repository. Keep OpenAI text-model enhancement behind a feature flag or env check so the MVP works locally without secrets.

- [ ] **Step 3: Write failing image-generation route test**

Test `POST /api/images/generate` validates prompt input, creates a generation record, calls OpenAI service, stores returned image to R2, marks generation complete, and returns image metadata.

Run: `npm test -- src/worker/routes.test.ts`

Expected: FAIL until route orchestration exists.

- [ ] **Step 4: Implement image-generation route orchestration**

Keep the first version synchronous. Return structured JSON errors for missing DB/R2/OpenAI config in local mode.

- [ ] **Step 5: Verify Worker tests**

Run: `npm test -- src/worker`

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/worker
git commit -m "feat: add prompt and image api routes"
```

## Task 7: React Workbench UI

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/styles.css`
- Create: `src/app/api.ts`
- Create: `src/app/data.ts`
- Test: `src/app/App.test.tsx`

- [ ] **Step 1: Write failing UI smoke test**

Test that the workbench renders idea input, quick/pro mode control, enhance button, generate button, output preview, and recent generation rail.

Run: `npm test -- src/app/App.test.tsx`

Expected: FAIL until UI is implemented.

- [ ] **Step 2: Implement workbench shell**

Adapt the approved mockup into React components. Keep it as the first screen, not a marketing page.

- [ ] **Step 3: Verify UI smoke test**

Run: `npm test -- src/app/App.test.tsx`

Expected: PASS.

- [ ] **Step 4: Add API client and local loading states**

Wire `Enhance Prompt` to `/api/prompts/enhance`; keep `Generate Image` disabled until a prompt package exists unless the user confirms fallback generation.

- [ ] **Step 5: Verify full frontend build**

Run: `npm run build`

Expected: PASS and `dist/` generated.

- [ ] **Step 6: Commit**

```bash
git add src/app index.html
git commit -m "feat: build prompt studio workbench"
```

## Task 8: Local Dev, Docs, And Deployment Readiness

**Files:**
- Create: `.gitignore`
- Create: `.dev.vars.example`
- Create: `README.md`
- Modify: `docs/superpowers/specs/2026-04-24-gpt-image2-prompt-studio-design.md`

- [ ] **Step 1: Add local development docs**

Document install, test, build, local Wrangler dev, D1 migration, R2 bucket creation, secrets, and deploy commands.

- [ ] **Step 2: Add safe environment examples**

Create `.dev.vars.example` with placeholder values only. Do not commit real secrets.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm test
npm run typecheck
npm run build
npx wrangler deploy --dry-run
```

Expected: all commands exit 0. If `wrangler deploy --dry-run` requires account auth or real resource IDs, record the exact blocker and keep the rest green.

- [ ] **Step 4: Commit**

```bash
git add .gitignore .dev.vars.example README.md docs
git commit -m "docs: add mvp development guide"
```

## References Used

- Cloudflare Workers Static Assets: https://developers.cloudflare.com/workers/static-assets/
- Cloudflare Wrangler configuration: https://developers.cloudflare.com/workers/wrangler/configuration/
- Cloudflare D1 Worker Binding API: https://developers.cloudflare.com/d1/worker-api/
- Cloudflare R2 Workers API: https://developers.cloudflare.com/r2/get-started/workers-api/
- OpenAI GPT Image 2 model: https://developers.openai.com/api/docs/models/gpt-image-2
- OpenAI image generation API reference: https://platform.openai.com/docs/api-reference/images/createimage_api_params
