-- Inbound mail index. The raw MIME lives in R2 under r2_key; this table is what
-- the agent and the operator list and search.
CREATE TABLE IF NOT EXISTS mail (
  id TEXT PRIMARY KEY,
  message_id TEXT,
  in_reply_to TEXT,
  envelope_from TEXT NOT NULL,
  envelope_to TEXT NOT NULL,
  from_addr TEXT,
  from_name TEXT,
  subject TEXT,
  received_at TEXT NOT NULL,
  size INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  dkim TEXT,
  spf TEXT,
  dmarc TEXT,
  webhook_status INTEGER,
  forwarded INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS mail_received_at ON mail (received_at DESC);
CREATE INDEX IF NOT EXISTS mail_from_addr ON mail (from_addr);
CREATE INDEX IF NOT EXISTS mail_message_id ON mail (message_id);

-- Outbound log: what agents sent through POST /v1/send.
CREATE TABLE IF NOT EXISTS outbound (
  id TEXT PRIMARY KEY,
  sent_at TEXT NOT NULL,
  from_addr TEXT NOT NULL,
  to_addr TEXT NOT NULL,
  subject TEXT,
  in_reply_to TEXT,
  provider_message_id TEXT,
  status TEXT NOT NULL,
  error TEXT
);
CREATE INDEX IF NOT EXISTS outbound_sent_at ON outbound (sent_at DESC);
