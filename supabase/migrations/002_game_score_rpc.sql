-- =========================================================================
-- COLHYBRI GAMES — Score submission RPC + anon-friendly RLS
-- Tables game_scores and game_progress already exist.
-- =========================================================================

-- -------------------------------------------------------------------------
-- Anon-friendly RLS policies
-- -------------------------------------------------------------------------

-- Allow anonymous users to insert scores (user_id must be NULL)
CREATE POLICY IF NOT EXISTS "anon_insert_game_scores"
  ON game_scores FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

-- Allow anonymous users to read all game progress (aggregate stats)
CREATE POLICY IF NOT EXISTS "anon_read_game_progress"
  ON game_progress FOR SELECT TO anon
  USING (true);

-- -------------------------------------------------------------------------
-- Leaderboard index
-- -------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_game_scores_leaderboard
  ON game_scores (game_slug, score DESC, created_at DESC);

-- -------------------------------------------------------------------------
-- RPC: submit_game_score
-- Atomically inserts a score row and upserts game_progress.
-- Returns rank, is_best, and score as JSON.
-- Works for both anon (user_id = NULL) and authenticated users.
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION submit_game_score(
  p_game_slug   text,
  p_score       integer,
  p_duration    integer DEFAULT NULL,
  p_metadata    jsonb   DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid     uuid;
  v_rank    bigint;
  v_is_best boolean := false;
  v_prev    integer;
BEGIN
  v_uid := auth.uid();

  -- Insert the score row
  INSERT INTO game_scores (user_id, game_slug, score, duration_seconds, metadata)
  VALUES (v_uid, p_game_slug, p_score, p_duration, p_metadata);

  -- If authenticated, update game_progress
  IF v_uid IS NOT NULL THEN
    INSERT INTO game_progress (user_id, total_games_played, total_score, last_played_at, updated_at)
    VALUES (v_uid, 1, p_score, now(), now())
    ON CONFLICT (user_id) DO UPDATE SET
      total_games_played = game_progress.total_games_played + 1,
      total_score        = game_progress.total_score + p_score,
      last_played_at     = now(),
      updated_at         = now();

    -- Check if this is a personal best
    SELECT MAX(score) INTO v_prev
    FROM game_scores
    WHERE user_id = v_uid AND game_slug = p_game_slug AND id != (
      SELECT id FROM game_scores
      WHERE user_id = v_uid AND game_slug = p_game_slug
      ORDER BY created_at DESC LIMIT 1
    );
    v_is_best := (v_prev IS NULL OR p_score > v_prev);
  END IF;

  -- Compute rank: how many distinct higher scores exist + 1
  SELECT COUNT(DISTINCT gs.score) + 1 INTO v_rank
  FROM game_scores gs
  WHERE gs.game_slug = p_game_slug AND gs.score > p_score;

  RETURN jsonb_build_object(
    'rank', v_rank,
    'is_best', v_is_best,
    'score', p_score
  );
END;
$$;

-- Allow both anon and authenticated to call the RPC
GRANT EXECUTE ON FUNCTION submit_game_score(text, integer, integer, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION submit_game_score(text, integer, integer, jsonb) TO authenticated;
