export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; source: { type: 'base64'; media_type: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; data: string } }
  >;
}

type AnthropicRequest = { model: string; max_tokens: number; system?: string; messages: AnthropicMessage[] };

function normalizeAnthropicStream(upstream: Response) {
  const reader = upstream.body!.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) { controller.close(); return; }
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? '';
        for (const event of events) {
          const data = event.split(/\r?\n/).find((line) => line.startsWith('data:'))?.slice(5).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data) as { type?: string; delta?: { type?: string; text?: string } };
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta' && parsed.delta.text) {
              controller.enqueue(encoder.encode(parsed.delta.text));
            }
          } catch { /* never expose upstream provider payloads */ }
        }
        return;
      }
    },
    cancel() { void reader.cancel(); }
  });
}

export async function streamAnthropic(request: AnthropicRequest): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: 'provider_not_configured' }), { status: 503, headers: { 'content-type': 'application/json' } });
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ ...request, stream: true }),
    cache: 'no-store'
  });
  if (!upstream.ok || !upstream.body) return new Response(JSON.stringify({ error: 'provider_error', status: upstream.status }), { status: 502, headers: { 'content-type': 'application/json' } });
  return new Response(normalizeAnthropicStream(upstream), { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache, no-transform', 'x-accel-buffering': 'no' } });
}
