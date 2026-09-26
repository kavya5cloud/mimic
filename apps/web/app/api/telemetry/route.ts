import { getCurrentUser } from '../../../lib/auth/session';
import { z } from 'zod';

export const runtime = 'nodejs';
const telemetrySchema = z.object({
  runId: z.string().min(1).max(128),
  stage: z.enum(['capture','stt','first_token','point_parsed','first_tts_byte','audio_start']),
  durationMs: z.number().int().nonnegative().max(120_000),
  appVersion: z.string().max(64).optional(),
  platform: z.enum(['macos','windows']).optional(),
  model: z.string().max(128).optional()
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const parsed = telemetrySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid_telemetry' }, { status: 400 });
  return new Response(null, { status: 204 });
}
