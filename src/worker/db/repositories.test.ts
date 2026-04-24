import { describe, expect, it } from "vitest";
import {
  createGeneration,
  createPromptEnhancement,
  listRecentGenerations,
  markGenerationComplete,
  recordUsageEvent,
} from "./repositories";

interface RecordedStatement {
  sql: string;
  params: unknown[];
}

class FakeStatement {
  private params: unknown[] = [];

  constructor(
    private readonly sql: string,
    private readonly records: RecordedStatement[],
    private readonly rows: Record<string, unknown>[],
  ) {}

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }

  async run<T = unknown>(): Promise<D1Result<T>> {
    this.records.push({ sql: this.sql, params: this.params });
    return {
      results: [] as T[],
      success: true as const,
      meta: {
        duration: 0,
        size_after: 0,
        rows_read: 0,
        rows_written: 1,
        last_row_id: 1,
        changed_db: true,
        changes: 1,
      },
    };
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    this.records.push({ sql: this.sql, params: this.params });
    return {
      results: this.rows as T[],
      success: true as const,
      meta: {
        duration: 0,
        size_after: 0,
        rows_read: this.rows.length,
        rows_written: 0,
        last_row_id: 0,
        changed_db: false,
        changes: 0,
      },
    };
  }

  async first<T = unknown>(colName: string): Promise<T | null>;
  async first<T = Record<string, unknown>>(): Promise<T | null>;
  async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
    this.records.push({ sql: this.sql, params: this.params });
    const firstRow = this.rows[0];

    if (!firstRow) {
      return null;
    }

    if (colName) {
      return (firstRow[colName] as T | undefined) ?? null;
    }

    return firstRow as T;
  }

  async raw<T = unknown[]>(options: { columnNames: true }): Promise<[string[], ...T[]]>;
  async raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>;
  async raw<T = unknown[]>(
    options?: { columnNames?: boolean },
  ): Promise<[string[], ...T[]] | T[]> {
    this.records.push({ sql: this.sql, params: this.params });
    const values = this.rows.map((row) => Object.values(row)) as T[];

    if (options?.columnNames) {
      return [Object.keys(this.rows[0] ?? {}), ...values];
    }

    return values;
  }
}

class FakeD1 {
  readonly records: RecordedStatement[] = [];

  constructor(private readonly rows: Record<string, unknown>[] = []) {}

  prepare(sql: string) {
    return new FakeStatement(sql, this.records, this.rows);
  }
}

describe("D1 repositories", () => {
  it("creates prompt enhancements with stable metadata", async () => {
    const db = new FakeD1();

    await createPromptEnhancement(db, {
      id: "enh_1",
      userId: "user_1",
      inputText: "rainy Shanghai street",
      mode: "quick",
      category: "portrait_photography",
      outputJson: JSON.stringify({ title: "Prompt" }),
      promptScore: 82,
      createdAt: "2026-04-24T00:00:00.000Z",
    });

    expect(db.records[0].sql).toContain("INSERT INTO prompt_enhancements");
    expect(db.records[0].params).toEqual([
      "enh_1",
      "user_1",
      "rainy Shanghai street",
      "quick",
      "portrait_photography",
      JSON.stringify({ title: "Prompt" }),
      82,
      "2026-04-24T00:00:00.000Z",
    ]);
  });

  it("creates and completes generations", async () => {
    const db = new FakeD1();

    await createGeneration(db, {
      id: "gen_1",
      userId: "user_1",
      enhancementId: "enh_1",
      status: "generating",
      model: "gpt-image-2",
      quality: "medium",
      size: "1024x1536",
      outputFormat: "jpeg",
      promptText: "master prompt",
      negativePrompt: "no watermark",
      createdAt: "2026-04-24T00:00:00.000Z",
    });

    await markGenerationComplete(db, {
      id: "gen_1",
      usageJson: JSON.stringify({ images: 1 }),
      completedAt: "2026-04-24T00:01:00.000Z",
    });

    expect(db.records[0].sql).toContain("INSERT INTO generations");
    expect(db.records[1].sql).toContain("UPDATE generations");
    expect(db.records[1].params).toEqual([
      "complete",
      JSON.stringify({ images: 1 }),
      "2026-04-24T00:01:00.000Z",
      "gen_1",
    ]);
  });

  it("lists recent generations for a user", async () => {
    const db = new FakeD1([
      {
        id: "gen_1",
        user_id: "user_1",
        status: "complete",
        model: "gpt-image-2",
        prompt_text: "prompt",
        created_at: "2026-04-24T00:00:00.000Z",
      },
    ]);

    const generations = await listRecentGenerations(db, "user_1", 5);

    expect(db.records[0].sql).toContain("WHERE user_id = ?");
    expect(db.records[0].params).toEqual(["user_1", 5]);
    expect(generations[0]).toMatchObject({
      id: "gen_1",
      userId: "user_1",
      status: "complete",
    });
  });

  it("records usage events", async () => {
    const db = new FakeD1();

    await recordUsageEvent(db, {
      id: "usage_1",
      userId: "user_1",
      eventType: "image_generation",
      model: "gpt-image-2",
      generationId: "gen_1",
      estimatedCostUsd: 0.08,
      usageJson: "{}",
      createdAt: "2026-04-24T00:00:00.000Z",
    });

    expect(db.records[0].sql).toContain("INSERT INTO usage_events");
    expect(db.records[0].params).toContain(0.08);
  });
});
