-- Agent first-contact pitches (/v1/agent/pitch): people who asked not to hear from us again.
CREATE TABLE IF NOT EXISTS pitch_suppress (addr TEXT PRIMARY KEY, at TEXT NOT NULL, agent TEXT, note TEXT);
CREATE INDEX IF NOT EXISTS outbound_agent_to ON outbound (agent, to_addr, sent_at);
