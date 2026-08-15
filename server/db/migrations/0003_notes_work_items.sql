-- 0003 — member notes and work items.
--
-- Two tables behind the last screens that were still keeping their state in
-- React: the notes tab (a note vanished on reload) and the three derived work
-- queues (resolving, snoozing or assigning a row survived nothing).
--
-- Additive only. Nothing here touches an existing table, so it is safe to run
-- against production while the current version is serving.
--
-- `member_notes` is seeded separately from `server/db/seed-notes.sql`, because
-- the notes the profile screen has always shown were generated on the client
-- and have to be moved into the database or they would disappear the moment
-- the screen started reading them from it.
--
-- `work_items` is deliberately NOT seeded: a row exists only once somebody has
-- acted on a queue item, and "nobody has touched this" is the correct starting
-- state for all three queues.

CREATE TABLE IF NOT EXISTS member_notes (
  id TEXT PRIMARY KEY NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id),
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  author_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS member_notes_member_idx ON member_notes (member_id);
CREATE INDEX IF NOT EXISTS member_notes_pinned_idx ON member_notes (pinned);

CREATE TABLE IF NOT EXISTS work_items (
  id TEXT PRIMARY KEY NOT NULL,
  queue TEXT NOT NULL,
  status TEXT NOT NULL,
  assignee_id TEXT REFERENCES staff(id),
  snoozed_until TEXT,
  resolution TEXT,
  note TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS work_items_queue_idx ON work_items (queue, status);

-- Class moves — see the table comment in server/db/schema.ts. A drag on the
-- schedule used to live in React state, so the timetable reverted on reload
-- while the toast said members had been notified.
CREATE TABLE IF NOT EXISTS class_moves (
  id TEXT PRIMARY KEY NOT NULL,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  from_iso TEXT NOT NULL,
  to_iso TEXT NOT NULL,
  to_start_time TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS class_moves_class_idx ON class_moves (class_id);
