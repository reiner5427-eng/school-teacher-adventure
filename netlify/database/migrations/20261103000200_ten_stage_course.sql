ALTER TABLE leaderboard ADD COLUMN course INTEGER NOT NULL DEFAULT 1;
ALTER TABLE leaderboard DROP CONSTRAINT leaderboard_score_check;
ALTER TABLE leaderboard ADD CONSTRAINT leaderboard_course_score CHECK (
  score % 20 = 0 AND (
    (course = 1 AND score BETWEEN 900 AND 7000) OR
    (course = 2 AND score BETWEEN 3000 AND 30000)
  )
);
CREATE INDEX leaderboard_course_order ON leaderboard (course, score DESC, created_at, run_id);
