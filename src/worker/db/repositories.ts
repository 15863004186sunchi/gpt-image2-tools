type D1Like = Pick<D1Database, "prepare">;

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
