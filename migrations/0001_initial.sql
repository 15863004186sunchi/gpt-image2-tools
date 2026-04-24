PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS prompt_cases (
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

CREATE TABLE IF NOT EXISTS prompt_enhancements (
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

CREATE TABLE IF NOT EXISTS generations (
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

CREATE TABLE IF NOT EXISTS generated_images (
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

CREATE TABLE IF NOT EXISTS usage_events (
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

CREATE INDEX IF NOT EXISTS idx_prompt_enhancements_user_created
  ON prompt_enhancements (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generations_user_created
  ON generations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_images_generation
  ON generated_images (generation_id);

CREATE INDEX IF NOT EXISTS idx_usage_events_user_created
  ON usage_events (user_id, created_at DESC);
