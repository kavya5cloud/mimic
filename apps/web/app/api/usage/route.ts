import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '../../../lib/db';
import { usageSessions } from '../../../lib/db/schema';
import { getCurrentUser } from '../../../lib/auth/session';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  const monthStartValue = monthStart.toISOString().slice(0, 10);

  const rows = await db
    .select({
      questionsUsed: usageSessions.questionsUsed,
      runsUsed: usageSessions.runsUsed,
    })
    .from(usageSessions)
    .where(
      and(
        eq(usageSessions.userId, user.id),
        eq(usageSessions.monthStart, monthStartValue),
      ),
    )
    .limit(1);

  const data = rows[0];

  return NextResponse.json({
    plan: 'free',
    questionsUsed: data?.questionsUsed ?? 0,
    questionsLimit: 30,
    runsUsed: data?.runsUsed ?? 0,
    runsLimit: 10,
  });
}
