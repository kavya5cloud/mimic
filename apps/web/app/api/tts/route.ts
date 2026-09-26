import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../lib/auth/session';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'provider_not_configured' }, { status: 503 });
  const body = await request.json().catch(() => null) as { text?: string } | null;
  const text = body?.text?.trim();
  if (!text || text.length > 1000) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const upstream = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.MIMIC_DEFAULT_TTS_MODEL ?? 'gpt-4o-mini-tts', voice: process.env.MIMIC_TTS_VOICE ?? 'coral', input: text, response_format: 'wav' }), cache: 'no-store'
  });
  if (!upstream.ok || !upstream.body) return NextResponse.json({ error: 'provider_error' }, { status: 502 });
  return new Response(upstream.body, { status: 200, headers: { 'content-type': 'audio/wav', 'cache-control': 'no-store' } });
}
