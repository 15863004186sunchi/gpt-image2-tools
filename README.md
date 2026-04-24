# GPT Image 2 Prompt Studio

Cloudflare-native MVP for turning a short visual idea into a structured `gpt-image-2` prompt package, then generating and saving images through a Worker API.

## What Is Built

- React workbench with prompt input, quick/pro mode, category, size, quality, enhanced prompt preview, image generation action, and recent generation rail.
- Cloudflare Worker API under `/api/*`.
- D1 schema and repository layer for users, prompt enhancements, generations, generated images, and usage events.
- R2 storage helper for generated image blobs.
- OpenAI image service boundary using `POST /v1/images/generations`.
- Vitest coverage for shared prompt building, Worker routes, D1 repositories, OpenAI/R2 services, and the React workbench.

## Local Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

For local Worker development:

```bash
copy .dev.vars.example .dev.vars
npm run build
npm run dev:worker
```

Put your real OpenAI key in `.dev.vars`. Do not commit `.dev.vars`.

## Cloudflare Resources

Create the D1 database and R2 bucket:

```bash
npx wrangler d1 create gpt-image2-tools-db
npx wrangler r2 bucket create gpt-image2-tools-images
```

After creating the D1 database, replace the placeholder `database_id` in `wrangler.jsonc` with the ID printed by Wrangler.

Apply D1 migrations:

```bash
npx wrangler d1 migrations apply gpt-image2-tools-db --local
npx wrangler d1 migrations apply gpt-image2-tools-db --remote
```

Set the OpenAI secret:

```bash
npx wrangler secret put OPENAI_API_KEY
```

## Deploy

```bash
npm run build
npx wrangler deploy --dry-run
npm run deploy
```

`wrangler deploy --dry-run` validates the Worker bundle without publishing. A real deploy requires a logged-in Cloudflare account plus a real D1 `database_id`.

## Important Files

- `src/app/App.tsx`: workbench UI.
- `src/app/api.ts`: browser API client.
- `src/worker/index.ts`: Worker routing and prompt/image orchestration.
- `src/worker/openai.ts`: OpenAI image generation boundary.
- `src/worker/r2.ts`: generated image storage helper.
- `src/worker/db/repositories.ts`: D1 access layer.
- `migrations/0001_initial.sql`: initial D1 schema.
- `docs/mockups/gpt-image2-tool-mvp.html`: original visual mockup.
