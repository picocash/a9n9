-- Off-box probe state: one row per target, so a failure is paged once, not every 5 minutes.
CREATE TABLE IF NOT EXISTS probe_state (
  target TEXT PRIMARY KEY,
  ok INTEGER NOT NULL,
  since TEXT NOT NULL,
  last_checked TEXT NOT NULL,
  last_error TEXT,
  paged_at TEXT
);
