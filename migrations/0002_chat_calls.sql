-- Chat messages, call log, message reports.

CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  room_id     TEXT NOT NULL,
  member_id   TEXT NOT NULL,
  text        TEXT NOT NULL,
  reply_to    TEXT,
  status      TEXT NOT NULL DEFAULT 'ok',   -- 'ok' | 'deleted'
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_room ON messages(room_id, created_at);
CREATE INDEX IF NOT EXISTS messages_created ON messages(created_at);

CREATE TABLE IF NOT EXISTS calls (
  id          TEXT PRIMARY KEY,
  room_id     TEXT NOT NULL,
  started_by  TEXT,
  video       INTEGER NOT NULL DEFAULT 0,
  peak        INTEGER NOT NULL DEFAULT 1,
  started_at  INTEGER NOT NULL,
  ended_at    INTEGER
);
CREATE INDEX IF NOT EXISTS calls_room ON calls(room_id);

ALTER TABLE reports ADD COLUMN message_id TEXT;
