-- 003_notifications_dedup_index.sql
-- Plano 02 (Onda 02.1): Limpeza de duplicatas ativas em user_notifications e índice único parcial por fonte.

UPDATE user_notifications
SET is_dismissed = 1, is_unread = 0
WHERE is_dismissed = 0
  AND source_id <> ''
  AND id NOT IN (
    SELECT latest_id FROM (
      SELECT id AS latest_id
      FROM user_notifications u1
      WHERE u1.is_dismissed = 0
        AND u1.source_id <> ''
        AND u1.rowid = (
          SELECT MAX(u2.rowid)
          FROM user_notifications u2
          WHERE u2.user_id = u1.user_id
            AND u2.source_domain = u1.source_domain
            AND u2.source_id = u1.source_id
            AND u2.is_dismissed = 0
        )
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_notifications_source_unique
    ON user_notifications(user_id, source_domain, source_id)
    WHERE is_dismissed = 0 AND source_id <> '';
