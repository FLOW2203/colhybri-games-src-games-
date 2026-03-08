-- =========================================================================
-- COLHYBRI GAMES — Initial schema
-- =========================================================================

-- -------------------------------------------------------------------------
-- Tables
-- -------------------------------------------------------------------------

CREATE TABLE game_scores (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_fingerprint text       NOT NULL,
  game_id         integer     NOT NULL,
  score           integer     NOT NULL,
  locale          text,
  device_type     text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE convergence_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_at    timestamptz NOT NULL,
  game_id         integer,
  target_drops    integer     NOT NULL DEFAULT 1000,
  current_drops   integer     NOT NULL DEFAULT 0,
  participants    integer     NOT NULL DEFAULT 0,
  completed       boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE convergence_participants (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          uuid        NOT NULL REFERENCES convergence_events(id),
  user_fingerprint  text        NOT NULL,
  drops_contributed integer     NOT NULL,
  joined_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE game_analytics (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id          integer,
  event            text        NOT NULL,
  score            integer,
  duration_seconds integer,
  locale           text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------------------
-- Indexes
-- -------------------------------------------------------------------------

CREATE INDEX idx_game_scores_game_score
  ON game_scores (game_id, score DESC);

CREATE INDEX idx_game_analytics_game_created
  ON game_analytics (game_id, created_at);

CREATE INDEX idx_convergence_events_scheduled
  ON convergence_events (scheduled_at);

-- -------------------------------------------------------------------------
-- Row-Level Security
-- -------------------------------------------------------------------------

ALTER TABLE game_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE convergence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE convergence_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_analytics ENABLE ROW LEVEL SECURITY;

-- Anon users can insert and read all rows.

CREATE POLICY "anon_insert_game_scores"
  ON game_scores FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select_game_scores"
  ON game_scores FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_convergence_events"
  ON convergence_events FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select_convergence_events"
  ON convergence_events FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_convergence_participants"
  ON convergence_participants FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select_convergence_participants"
  ON convergence_participants FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert_game_analytics"
  ON game_analytics FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select_game_analytics"
  ON game_analytics FOR SELECT TO anon USING (true);

-- -------------------------------------------------------------------------
-- RPC: increment_convergence_drops
-- -------------------------------------------------------------------------
-- Atomically adds drops to an event and records the participant.
-- Marks the event as completed when current_drops reaches target_drops.
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION increment_convergence_drops(
  p_event_id    uuid,
  p_drops       integer,
  p_fingerprint text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target  integer;
  v_current integer;
BEGIN
  -- Atomically increment drops and participant count.
  UPDATE convergence_events
  SET current_drops = current_drops + p_drops,
      participants  = participants + 1
  WHERE id = p_event_id
    AND completed = false
  RETURNING target_drops, current_drops
  INTO v_target, v_current;

  -- If no row was updated the event doesn't exist or is already completed.
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Mark completed when target is reached.
  IF v_current >= v_target THEN
    UPDATE convergence_events
    SET completed = true
    WHERE id = p_event_id;
  END IF;

  -- Record the participant contribution.
  INSERT INTO convergence_participants (event_id, user_fingerprint, drops_contributed)
  VALUES (p_event_id, p_fingerprint, p_drops);
END;
$$;

-- Allow anon to call the RPC.
GRANT EXECUTE ON FUNCTION increment_convergence_drops(uuid, integer, text) TO anon;
