type D1Like = Pick<D1Database, "prepare">;

export interface UserUpsert {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  plan: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromptEnhancementCreate {
  id: string;
  userId: string;
  inputText: string;
  mode: string;
  category?: string | null;
  outputJson: string;
  promptScore?: number | null;
  createdAt: string;
}

export interface GenerationCreate {
  id: string;
  userId: string;
  enhancementId?: string | null;
  status: string;
  model: string;
  quality?: string | null;
  size?: string | null;
  outputFormat?: string | null;
  promptText: string;
  negativePrompt?: string | null;
  createdAt: string;
}

export interface GenerationComplete {
  id: string;
  usageJson?: string | null;
  completedAt: string;
}

export interface GenerationRecord {
  id: string;
  userId: string;
  enhancementId: string | null;
  status: string;
  model: string;
  quality: string | null;
  size: string | null;
  outputFormat: string | null;
  promptText: string;
  negativePrompt: string | null;
  errorMessage: string | null;
  usageJson: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface UsageEventCreate {
  id: string;
  userId: string;
  eventType: string;
  model?: string | null;
  generationId?: string | null;
  estimatedCostUsd?: number | null;
  usageJson?: string | null;
  createdAt: string;
}

export interface GeneratedImageCreate {
  id: string;
  generationId: string;
  userId: string;
  r2Key: string;
  width?: number | null;
  height?: number | null;
  contentType: string;
  createdAt: string;
}

interface GenerationRow {
  id: string;
  user_id: string;
  enhancement_id?: string | null;
  status: string;
  model: string;
  quality?: string | null;
  size?: string | null;
  output_format?: string | null;
  prompt_text: string;
  negative_prompt?: string | null;
  error_message?: string | null;
  usage_json?: string | null;
  created_at: string;
  completed_at?: string | null;
}

export async function upsertUser(db: D1Like, input: UserUpsert): Promise<void> {
  await db
    .prepare(
      `INSERT INTO users (
        id, email, display_name, avatar_url, plan, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        plan = excluded.plan,
        updated_at = excluded.updated_at`,
    )
    .bind(
      input.id,
      input.email,
      input.displayName,
      input.avatarUrl ?? null,
      input.plan,
      input.createdAt,
      input.updatedAt,
    )
    .run();
}

export async function createPromptEnhancement(
  db: D1Like,
  input: PromptEnhancementCreate,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO prompt_enhancements (
        id, user_id, input_text, mode, category, output_json, prompt_score, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.id,
      input.userId,
      input.inputText,
      input.mode,
      input.category ?? null,
      input.outputJson,
      input.promptScore ?? null,
      input.createdAt,
    )
    .run();
}

export async function createGeneration(db: D1Like, input: GenerationCreate): Promise<void> {
  await db
    .prepare(
      `INSERT INTO generations (
        id, user_id, enhancement_id, status, model, quality, size, output_format,
        prompt_text, negative_prompt, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.id,
      input.userId,
      input.enhancementId ?? null,
      input.status,
      input.model,
      input.quality ?? null,
      input.size ?? null,
      input.outputFormat ?? null,
      input.promptText,
      input.negativePrompt ?? null,
      input.createdAt,
    )
    .run();
}

export async function markGenerationComplete(
  db: D1Like,
  input: GenerationComplete,
): Promise<void> {
  await db
    .prepare(
      `UPDATE generations
        SET status = ?, usage_json = ?, completed_at = ?
        WHERE id = ?`,
    )
    .bind("complete", input.usageJson ?? null, input.completedAt, input.id)
    .run();
}

export async function listRecentGenerations(
  db: D1Like,
  userId: string,
  limit = 20,
): Promise<GenerationRecord[]> {
  const result = await db
    .prepare(
      `SELECT
        id, user_id, enhancement_id, status, model, quality, size, output_format,
        prompt_text, negative_prompt, error_message, usage_json, created_at, completed_at
      FROM generations
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?`,
    )
    .bind(userId, limit)
    .all<GenerationRow>();

  return (result.results ?? []).map(mapGenerationRow);
}

export async function recordUsageEvent(db: D1Like, input: UsageEventCreate): Promise<void> {
  await db
    .prepare(
      `INSERT INTO usage_events (
        id, user_id, event_type, model, generation_id, estimated_cost_usd, usage_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.id,
      input.userId,
      input.eventType,
      input.model ?? null,
      input.generationId ?? null,
      input.estimatedCostUsd ?? null,
      input.usageJson ?? null,
      input.createdAt,
    )
    .run();
}

export async function createGeneratedImage(
  db: D1Like,
  input: GeneratedImageCreate,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO generated_images (
        id, generation_id, user_id, r2_key, width, height, content_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.id,
      input.generationId,
      input.userId,
      input.r2Key,
      input.width ?? null,
      input.height ?? null,
      input.contentType,
      input.createdAt,
    )
    .run();
}

function mapGenerationRow(row: GenerationRow): GenerationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    enhancementId: row.enhancement_id ?? null,
    status: row.status,
    model: row.model,
    quality: row.quality ?? null,
    size: row.size ?? null,
    outputFormat: row.output_format ?? null,
    promptText: row.prompt_text,
    negativePrompt: row.negative_prompt ?? null,
    errorMessage: row.error_message ?? null,
    usageJson: row.usage_json ?? null,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? null,
  };
}
