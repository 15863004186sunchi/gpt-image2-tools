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

## One-Click Cloudflare Deploy

This repository includes a PowerShell deployment script that creates or reuses the D1 database and R2 bucket, writes the D1 ID back to `wrangler.jsonc`, applies remote migrations, sets Worker secrets, builds assets, deploys a Worker Route for `397858.xyz/*`, and verifies `https://397858.xyz/api/health`.

If R2 is not enabled for the Cloudflare account yet, the script deploys without the R2 binding so the workbench and prompt enhancement flow can go live. Image generation will return an R2 configuration error until R2 is enabled and the script is run again.

The root domain must have at least one proxied Cloudflare DNS record so the Worker Route can receive traffic.

Set these environment variables first:

```powershell
$env:CLOUDFLARE_API_TOKEN = "<cloudflare-api-token>"
$env:CLOUDFLARE_ACCOUNT_ID = "<cloudflare-account-id>"
$env:CLOUDFLARE_ZONE_ID = "<cloudflare-zone-id>"
$env:OPENAI_API_KEY = "<openai-api-key>"
```

Then deploy:

```powershell
npm run deploy:cf
```

If `OPENAI_API_KEY` is not set, the site still deploys, but image generation will return a missing OpenAI key error until the secret is added.

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
