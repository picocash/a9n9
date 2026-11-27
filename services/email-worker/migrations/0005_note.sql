-- First-contact mail now has two buckets with separate caps: NULL = pitch (press, organisations), 'note' = a note to a writer we quoted.
ALTER TABLE outbound ADD COLUMN kind TEXT;
