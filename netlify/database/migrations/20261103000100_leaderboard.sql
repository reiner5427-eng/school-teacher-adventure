CREATE TABLE leaderboard (
  run_id UUID PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 16),
  score INTEGER NOT NULL CHECK (score BETWEEN 900 AND 7000 AND score % 20 = 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX leaderboard_order ON leaderboard (score DESC, created_at, run_id);
