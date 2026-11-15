-- beam: transfer history, kept for RETENTION_DAYS (30 by default)

CREATE TABLE IF NOT EXISTS rooms (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL,
  type        TEXT NOT NULL,              -- 'single' | 'team'
  mode        TEXT NOT NULL DEFAULT 'all',-- team: 'all' (everyone can send) | 'host'
  status      TEXT NOT NULL,              -- 'waiting' | 'active' | 'ended' | 'expired' | 'removed'
  place       TEXT,                       -- approximate location of the host, e.g. "London, GB"
  created_at  INTEGER NOT NULL,
  ended_at    INTEGER
);
CREATE INDEX IF NOT EXISTS rooms_created ON rooms(created_at);
CREATE INDEX IF NOT EXISTS rooms_status ON rooms(status);

CREATE TABLE IF NOT EXISTS members (
  id          TEXT PRIMARY KEY,
  room_id     TEXT NOT NULL,
  name        TEXT,
  device      TEXT,
  role        TEXT NOT NULL,              -- 'host' | 'member'
  can_send    INTEGER NOT NULL DEFAULT 0,
  ip_hash     TEXT,
  joined_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS members_room ON members(room_id);
CREATE INDEX IF NOT EXISTS members_ip ON members(ip_hash);

CREATE TABLE IF NOT EXISTS files (
  id          TEXT PRIMARY KEY,
  room_id     TEXT NOT NULL,
  sender_id   TEXT NOT NULL,
  name        TEXT NOT NULL,
  mime        TEXT,
  size        INTEGER NOT NULL,
  r2_key      TEXT NOT NULL,
  upload_id   TEXT,
  status      TEXT NOT NULL,              -- 'uploading' | 'ready' | 'failed' | 'deleted'
  reported    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  delete_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS files_room ON files(room_id);
CREATE INDEX IF NOT EXISTS files_created ON files(created_at);
CREATE INDEX IF NOT EXISTS files_delete ON files(delete_at);

CREATE TABLE IF NOT EXISTS downloads (
  file_id     TEXT NOT NULL,
  member_id   TEXT NOT NULL,
  at          INTEGER NOT NULL,
  PRIMARY KEY (file_id, member_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,              -- 'file' | 'lockout'
  file_id     TEXT,
  room_id     TEXT,
  ip_hash     TEXT,
  detail      TEXT,
  status      TEXT NOT NULL DEFAULT 'open',
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS reports_status ON reports(status);

CREATE TABLE IF NOT EXISTS blocks (
  ip_hash     TEXT PRIMARY KEY,
  reason      TEXT,
  created_at  INTEGER NOT NULL
);
