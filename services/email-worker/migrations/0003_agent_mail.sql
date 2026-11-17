-- Per-agent mail access (/v1/agent/*): who handled a message, how, and whether the operator must act.
ALTER TABLE mail ADD COLUMN handled_at TEXT;
ALTER TABLE mail ADD COLUMN handled_by TEXT;
ALTER TABLE mail ADD COLUMN handled_note TEXT;
ALTER TABLE mail ADD COLUMN operator_flag TEXT;
ALTER TABLE outbound ADD COLUMN agent TEXT;
ALTER TABLE outbound ADD COLUMN mail_id TEXT;
CREATE INDEX IF NOT EXISTS mail_envelope_to ON mail (envelope_to, received_at DESC);
