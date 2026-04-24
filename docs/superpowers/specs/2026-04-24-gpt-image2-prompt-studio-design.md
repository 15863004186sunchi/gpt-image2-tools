# GPT Image 2 Prompt Studio Design

Date: 2026-04-24

## Summary

Build a Cloudflare-native web app that helps users turn a rough Chinese or English image idea into a professional GPT Image prompt, then generate images with `gpt-image-2`. The MVP targets two user groups:

- Ordinary users who want to type one sentence and get a strong image.
- Advanced creators who want control over camera, lens, lighting, aspect ratio, style, quality, and negative constraints.

The first release includes login and generation history. It does not include paid plans, but it records usage events and model cost metadata so payments can be added later without reworking the core data model.

## Product Shape

The app opens directly into a workbench, not a marketing landing page.

Primary workflow:

1. User logs in with OAuth or a magic-link flow.
2. User enters a rough idea, such as "雨夜上海街头，一个穿风衣的人像电影剧照".
3. User chooses quick mode or professional mode.
4. App enhances the brief into a structured prompt package.
5. User reviews the prompt, negative constraints, suggested settings, and example references.
6. User generates an image with `gpt-image-2`.
7. Worker stores the image in R2 and generation metadata in D1.
8. User can revisit, duplicate, refine, or rerun a previous generation.

Main screens:

- Workbench: prompt input, style controls, enhanced prompt, generation preview.
- History: saved generations, prompt versions, output images, usage metadata.
- Case Library: curated local examples from `awesome-gpt-image-2-prompts`.
- Account: profile, usage, future plan status.

The local visual mockup is at `docs/mockups/gpt-image2-tool-mvp.html`.

Implementation is tracked in `docs/superpowers/plans/2026-04-24-gpt-image2-prompt-studio-mvp.md`.

## MVP Features

- Quick mode: one text box, style category, aspect ratio, quality, and one-click enhance/generate.
- Professional mode: camera, lens, shot type, lighting, color palette, material/texture, mood, composition, realism level, output size, output format, and negative prompt controls.
- Prompt enhancement: outputs English master prompt, Chinese explanation, negative prompt, model settings, risk flags, and missing-field suggestions.
- Image generation: calls OpenAI Image API with `model: "gpt-image-2"` by default.
- History: stores every enhanced prompt, generation task, output image, status, model, size, quality, usage tokens or cost estimates when available.
- Case library: imports local prompt examples, classifies them by scene type, and links local sample images.
- Abuse controls: login required for generation, per-user daily limits in the free MVP, Turnstile on sensitive flows, and IP/user rate limits.

## Non-Goals For MVP

- Public paid checkout.
- Team workspaces.
- Batch generation.
- Full multi-turn image editing workspace.
- Marketplace for user-shared prompts.
- Training or fine-tuning.

## Architecture

Recommended stack:

- Frontend: Vite + React + TypeScript.
- UI: custom workbench UI with lucide icons, no heavy component framework required for MVP.
- API: Cloudflare Worker.
- Static hosting: Cloudflare Workers Static Assets.
- Database: Cloudflare D1.
- Object storage: Cloudflare R2.
- Optional cache/rate limit storage: Cloudflare KV.
- Optional AI observability: Cloudflare AI Gateway for OpenAI proxying, if image endpoints are confirmed during implementation.

Request flow:

1. Browser loads static React app from Workers Static Assets.
2. Browser calls Worker API under `/api/*`.
3. Worker validates session cookie and request payload.
4. Prompt enhancement endpoint calls a configurable OpenAI text model with structured output.
5. Image generation endpoint calls OpenAI Image API `v1/images/generations` with `gpt-image-2`.
6. Worker receives base64 image data, writes binary output to R2, writes metadata to D1, then returns an app image URL.
7. Image URLs are served by Worker through signed or permission-checked R2 reads.

## OpenAI Integration

Environment variables:

- `OPENAI_API_KEY`
- `OPENAI_IMAGE_MODEL`, default `gpt-image-2`
- `OPENAI_TEXT_MODEL`, configurable for prompt enhancement
- `OPENAI_BASE_URL`, optional for AI Gateway or direct OpenAI API

Image generation defaults:

- Model: `gpt-image-2`
- Quality: `medium` for MVP default, `low` for drafts, `high` for final assets.
- Size: default `1024x1536` for portrait/photo workflows, with professional mode allowing valid custom sizes.
- Output format: `jpeg` for fast photo previews, `png` for transparent or archival output, `webp` for compressed web output.
- Moderation: `auto` by default.

`gpt-image-2` should remain configurable because model aliases, pricing, and account access can change.

## Prompt Enhancement Engine

The prompt engine should be deterministic around structure and creative around visual detail.

Input:

- User idea.
- Mode: quick or professional.
- Selected category: portrait, product, poster, character, UI/social, comparison/experiment.
- Optional controls: lens, lighting, shot type, color, mood, realism, aspect ratio, quality.
- Optional reference case IDs.

Processing:

1. Normalize user intent into subject, scene, style, camera, lighting, composition, details, text-in-image needs, constraints, and exclusions.
2. Retrieve 3 to 8 relevant examples from the local case library using tags first; embeddings can be added later.
3. Compose a prompt package using a structured schema.
4. Score missing information and suggest small improvements.
5. Return the package without triggering image generation.

Output schema:

```json
{
  "title": "Rainy Shanghai Neon Film Still",
  "masterPrompt": "English production prompt...",
  "negativePrompt": "No watermark, no plastic skin...",
  "cnExplanation": "中文解释...",
  "settings": {
    "model": "gpt-image-2",
    "quality": "medium",
    "size": "1024x1536",
    "output_format": "jpeg"
  },
  "references": ["portrait_case1", "poster_case11"],
  "missingFields": ["specific subject age/style"],
  "riskFlags": [],
  "promptScore": 82
}
```

The enhancement prompt should ask the text model to preserve the user's intent, avoid unsafe or exploitative additions, avoid naming living artists unless the user supplied them, and prefer concrete photographic language over generic hype words.

## Case Library Ingestion

Source folder:

- `awesome-gpt-image-2-prompts/README.md`
- `awesome-gpt-image-2-prompts/images/**/output.jpg`
- `awesome-gpt-image-2-prompts/gpt_image2_prompts.json`

The JSON file currently appears to contain malformed or encoding-damaged entries, so ingestion should be tolerant:

- Prefer README sections as the first structured source.
- Parse local folder names as stable IDs.
- Extract title, category, author, source URL, prompt text, image path, language, and tags.
- Store raw text separately from normalized fields.
- Mark cases with parse or encoding issues for manual cleanup.

Initial categories:

- `portrait_photography`
- `poster_illustration`
- `character_design`
- `ui_social_mockup`
- `comparison_experiment`
- `product_ad`
- `infographic`

## Data Model

Suggested D1 tables:

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE prompt_cases (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  source_url TEXT,
  prompt_text TEXT NOT NULL,
  image_key TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  raw_source TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE prompt_enhancements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  input_text TEXT NOT NULL,
  mode TEXT NOT NULL,
  category TEXT,
  output_json TEXT NOT NULL,
  prompt_score INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE generations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  enhancement_id TEXT,
  status TEXT NOT NULL,
  model TEXT NOT NULL,
  quality TEXT,
  size TEXT,
  output_format TEXT,
  prompt_text TEXT NOT NULL,
  negative_prompt TEXT,
  error_message TEXT,
  usage_json TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (enhancement_id) REFERENCES prompt_enhancements(id)
);

CREATE TABLE generated_images (
  id TEXT PRIMARY KEY,
  generation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  content_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (generation_id) REFERENCES generations(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE usage_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  model TEXT,
  generation_id TEXT,
  estimated_cost_usd REAL,
  usage_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## API Design

Auth:

- `GET /api/me`
- `POST /api/auth/logout`
- `GET /api/auth/:provider/start`
- `GET /api/auth/:provider/callback`

Prompt:

- `GET /api/prompt-cases?category=&q=`
- `GET /api/prompt-cases/:id`
- `POST /api/prompts/enhance`
- `GET /api/prompts/enhancements/:id`

Images:

- `POST /api/images/generate`
- `GET /api/generations`
- `GET /api/generations/:id`
- `POST /api/generations/:id/duplicate`
- `GET /api/images/:id`

Admin/import:

- `POST /api/admin/import-cases`
- `GET /api/admin/import-status`

Generation should be implemented as a request that may take up to roughly two minutes. The first version can keep it synchronous with clear loading states. If timeouts become a problem, move generation into a queued job flow using Cloudflare Queues or Workflows.

## Frontend UX

The workbench should keep the main action visible:

- Left navigation: new generation, history, case library, account.
- Center input: idea, mode switch, quick chips, professional controls.
- Center result: enhanced prompt package and image preview.
- Right rail: recent generations and reference examples.

Important UX details:

- User can enhance prompt without generating an image.
- User can edit the enhanced prompt before generation.
- Professional controls should override or guide the prompt, not append awkward raw labels.
- Every generation card should expose duplicate, copy prompt, download, and refine actions.
- History should show status states: queued, generating, complete, failed.
- For cost awareness, show quality and size before generation.

## Safety And Abuse Controls

- Require login before image generation.
- Enforce per-user generation limits for free MVP.
- Add Turnstile to login and generation if abuse appears.
- Keep OpenAI API key server-side only.
- Use `moderation: "auto"` for image generation.
- Store user identifier in OpenAI `user` field when available.
- Reject obvious policy-violating prompts before calling OpenAI.
- Do not automatically intensify sexual, violent, celebrity, or identity-sensitive details during prompt enhancement.
- Avoid public, guessable R2 object URLs for private user outputs.

## Deployment

Cloudflare resources:

- Worker with Static Assets.
- D1 database binding, for example `DB`.
- R2 bucket binding, for example `IMAGES`.
- KV namespace binding if used for rate limits.
- Secrets: `OPENAI_API_KEY`, OAuth secrets, session signing secret.

Wrangler configuration should use Workers Static Assets with `assets.directory = "./dist"` and a Worker `main` entry for API routes.

## Implementation Phases

Phase 1: Scaffold

- Create Vite React app.
- Add Worker API entry.
- Configure Wrangler, D1 migrations, R2 binding types, and local dev.

Phase 2: Data and auth

- Add D1 migrations.
- Implement sessions and OAuth or magic link.
- Add `/api/me`.

Phase 3: Prompt library

- Build importer for README/image cases.
- Store prompt cases in D1.
- Show case library and reference rail.

Phase 4: Prompt enhancement

- Implement structured enhancement endpoint.
- Add quick and professional controls.
- Store enhancement history.

Phase 5: Image generation

- Implement `gpt-image-2` generation endpoint.
- Write outputs to R2.
- Save image and usage metadata.
- Add loading, failure, retry, and history views.

Phase 6: Hardening

- Rate limits.
- Turnstile hook.
- Error telemetry.
- Cost tracking.
- Deployment checklist.

## Open Questions

- Which login method should be first: Google/GitHub OAuth or email magic link?
- Should generated images be private by default or shareable by link?
- Should prompt cases stay bundled in the app or be imported into D1 during deploy?
- What daily free generation limit feels right before paid plans exist?

## References

- OpenAI GPT Image 2 model: https://developers.openai.com/api/docs/models/gpt-image-2
- OpenAI image generation guide: https://developers.openai.com/api/docs/guides/image-generation
- OpenAI GPT Image prompting guide: https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide
- Cloudflare Workers Static Assets: https://developers.cloudflare.com/workers/static-assets/
- Cloudflare Workers best practices: https://developers.cloudflare.com/workers/best-practices/workers-best-practices/
- Cloudflare D1 Worker Binding API: https://developers.cloudflare.com/d1/worker-api/
- Cloudflare R2 upload objects: https://developers.cloudflare.com/r2/objects/multipart-objects/
- Cloudflare AI Gateway OpenAI provider: https://developers.cloudflare.com/ai-gateway/providers/openai/
