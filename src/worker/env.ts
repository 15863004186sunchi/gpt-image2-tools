export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: R2Bucket;
  ENVIRONMENT: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL: string;
  OPENAI_IMAGE_MODEL: string;
  OPENAI_TEXT_MODEL: string;
}
