import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '../../../lib/auth/session';
import { consumeUsage } from '../../../lib/db/usage';
import {
  streamAnthropic,
  type AnthropicMessage,
} from '../../../lib/providers/anthropic';

export const runtime = 'nodejs';

const imageSourceSchema = z.object({
  type: z.literal('base64'),
  media_type: z.enum([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
  ]),
  data: z.string().min(1).max(7_000_000),
});

const contentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    text: z.string().max(120_000),
  }),
  z.object({
    type: z.literal('image'),
    source: imageSourceSchema,
  }),
]);

const requestSchema = z.object({
  kind: z.enum(['question', 'run']),
  model: z.string().min(1).max(128).optional(),
  system: z.string().max(40_000).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.array(contentSchema).min(1),
      }),
    )
    .min(1)
    .max(20),
  maxTokens: z.number().int().min(1).max(16_000).default(2_000),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: 'unauthorized' },
      { status: 401 },
    );
  }

  const contentLength = Number(
    request.headers.get('content-length') ?? 0,
  );

  if (contentLength > 8_500_000) {
    return NextResponse.json(
      { error: 'request_too_large' },
      { status: 413 },
    );
  }

  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request' },
      { status: 400 },
    );
  }

  let consumed;

  try {
    consumed = await consumeUsage(user.id, parsed.data.kind);
  } catch {
    return NextResponse.json(
      { error: 'usage_unavailable' },
      { status: 500 },
    );
  }

  if (!consumed.allowed) {
    return NextResponse.json(
      { error: 'rate_or_plan_limit_reached' },
      { status: 429 },
    );
  }

  const providerRequest: {
    model: string;
    max_tokens: number;
    system?: string;
    messages: AnthropicMessage[];
  } = {
    model:
      parsed.data.model ??
      process.env.MIMIC_DEFAULT_ANTHROPIC_MODEL ??
      'claude-sonnet-5',
    max_tokens: parsed.data.maxTokens,
    messages: parsed.data.messages as AnthropicMessage[],
  };

  if (parsed.data.system) {
    providerRequest.system = parsed.data.system;
  }

  return streamAnthropic(providerRequest);
}
