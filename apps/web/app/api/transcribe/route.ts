import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../lib/auth/session';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'provider_not_configured' }, { status: 503 });
  const input = await request.arrayBuffer();
  if (input.byteLength > 12_000_000) return NextResponse.json({ error: 'audio_too_large' }, { status: 413 });
  const form = new FormData();
  form.append('file', new Blob([input], { type: request.headers.get('content-type') ?? 'audio/webm' }), 'mimic.webm');
  form.append('model', process.env.MIMIC_DEFAULT_STT_MODEL ?? 'gpt-4o-mini-transcribe');
  const upstream = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form, cache: 'no-store' });
  if (!upstream.ok) return NextResponse.json({ error: 'provider_error' }, { status: 502 });
  const body = await upstream.json() as { text?: string };
  return NextResponse.json({ text: body.text ?? '' });
}
