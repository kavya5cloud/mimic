import { sql } from 'drizzle-orm';
import { db } from './index';

const QUESTION_LIMIT = 30;
const RUN_LIMIT = 10;
const RPM_LIMIT = 20;

type UsageKind = 'question' | 'run';

export async function consumeUsage(userId: string, kind: UsageKind) {
  const result = await db.execute(sql`
    WITH ensured AS (
      INSERT INTO sessions_usage (
        user_id,
        month_start
      )
      VALUES (
        ${userId},
        date_trunc('month', now())::date
      )
      ON CONFLICT (user_id, month_start) DO NOTHING
      RETURNING id
    ),
    current_row AS (
      SELECT
        s.id,
        s.questions_used,
        s.runs_used,
        s.window_started_at,
        s.requests_in_window
      FROM sessions_usage s
      WHERE s.user_id = ${userId}
        AND s.month_start = date_trunc('month', now())::date
      FOR UPDATE
    ),
    updated AS (
      UPDATE sessions_usage s
      SET
        questions_used = CASE
          WHEN ${kind} = 'question' THEN s.questions_used + 1
          ELSE s.questions_used
        END,
        runs_used = CASE
          WHEN ${kind} = 'run' THEN s.runs_used + 1
          ELSE s.runs_used
        END,
        requests_in_window = CASE
          WHEN now() - s.window_started_at >= interval '1 minute'
            THEN 1
          ELSE s.requests_in_window + 1
        END,
        window_started_at = CASE
          WHEN now() - s.window_started_at >= interval '1 minute'
            THEN now()
          ELSE s.window_started_at
        END,
        updated_at = now()
      FROM current_row c
      WHERE s.id = c.id
        AND (
          CASE
            WHEN now() - c.window_started_at >= interval '1 minute'
              THEN 0
            ELSE c.requests_in_window
          END
        ) < ${RPM_LIMIT}
        AND (
          ${kind} = 'question'
          AND c.questions_used < ${QUESTION_LIMIT}
          OR
          ${kind} = 'run'
          AND c.runs_used < ${RUN_LIMIT}
        )
      RETURNING
        s.questions_used,
        s.runs_used,
        s.requests_in_window
    )
    SELECT
      EXISTS (SELECT 1 FROM updated) AS allowed,
      COALESCE(
        (SELECT questions_used FROM updated),
        (SELECT questions_used FROM current_row)
      ) AS questions_used,
      COALESCE(
        (SELECT runs_used FROM updated),
        (SELECT runs_used FROM current_row)
      ) AS runs_used,
      COALESCE(
        (SELECT requests_in_window FROM updated),
        (SELECT requests_in_window FROM current_row)
      ) AS requests_in_window
  `);

  const row = result.rows[0] as {
    allowed: boolean;
    questions_used: number;
    runs_used: number;
    requests_in_window: number;
  } | undefined;

  if (!row) {
    throw new Error('usage_unavailable');
  }

  return row;
}
