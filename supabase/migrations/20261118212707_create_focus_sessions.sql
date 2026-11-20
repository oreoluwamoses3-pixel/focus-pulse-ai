/*
# Create focus_sessions table (single-tenant, no auth)

1. New Tables
- `focus_sessions`
  - `id` (uuid, primary key) — unique session identifier
  - `intent` (text, not null) — what the user intended to focus on
  - `tags` (text[], not null, default '{}') — parsed hashtag tags
  - `planned_duration_ms` (bigint, not null) — planned session duration in milliseconds
  - `actual_duration_ms` (bigint, not null, default 0) — actual elapsed time in milliseconds
  - `started_at` (bigint, not null) — epoch milliseconds when session started
  - `ended_at` (bigint, nullable) — epoch milliseconds when session ended (null if running)
  - `status` (text, not null, default 'completed') — one of: idle, running, paused, completed, cancelled
  - `interruption_count` (integer, not null, default 0) — number of interruptions during the session
  - `created_at` (timestamptz, default now()) — row creation timestamp

2. Security
- Enable RLS on `focus_sessions`.
- Grant CRUD to `anon` + `authenticated` so the anon-key frontend can reach the table.
- Single-tenant app with no sign-in: all data is intentionally shared/public, so policies use `USING (true)` / `WITH CHECK (true)`.

3. Indexes
- Index on `started_at` (descending) for efficient history queries.
*/

CREATE TABLE IF NOT EXISTS focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  planned_duration_ms bigint NOT NULL,
  actual_duration_ms bigint NOT NULL DEFAULT 0,
  started_at bigint NOT NULL,
  ended_at bigint,
  status text NOT NULL DEFAULT 'completed',
  interruption_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON focus_sessions TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_focus_sessions" ON focus_sessions;
CREATE POLICY "anon_select_focus_sessions"
ON focus_sessions FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_focus_sessions" ON focus_sessions;
CREATE POLICY "anon_insert_focus_sessions"
ON focus_sessions FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_focus_sessions" ON focus_sessions;
CREATE POLICY "anon_update_focus_sessions"
ON focus_sessions FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_focus_sessions" ON focus_sessions;
CREATE POLICY "anon_delete_focus_sessions"
ON focus_sessions FOR DELETE
TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_started_at ON focus_sessions (started_at DESC);
