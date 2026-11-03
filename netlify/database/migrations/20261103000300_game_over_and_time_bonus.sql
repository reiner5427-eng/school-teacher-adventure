ALTER TABLE leaderboard DROP CONSTRAINT leaderboard_course_score;
ALTER TABLE leaderboard ADD CONSTRAINT leaderboard_course_score CHECK (
  score % 20 = 0 AND (
    (course = 1 AND score BETWEEN 900 AND 7000) OR
    (course = 2 AND score BETWEEN 0 AND 33000)
  )
);
