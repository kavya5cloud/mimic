export function splitSentences(text: string): string[] {
  return text.match(/[^.!?]+[.!?]+(?=\s|$)|.+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
}

export class SentenceTTSQueue {
  private queue: string[] = [];
  private running = false;
  private cancelled = false;

  constructor(private readonly speak: (sentence: string, signal: AbortSignal) => Promise<void>) {}

  enqueue(text: string) {
    this.cancelled = false;
    this.queue.push(...splitSentences(text));
    void this.drain();
  }

  async drain() {
    if (this.running) return;
    this.running = true;
    while (this.queue.length && !this.cancelled) {
      const next = this.queue.shift()!;
      const controller = new AbortController();
      try { await this.speak(next, controller.signal); } catch (error) {
        if (!this.cancelled) console.error('[mimic] tts playback failed', error instanceof Error ? error.message : 'unknown');
      }
    }
    this.running = false;
  }

  stop() {
    this.cancelled = true;
    this.queue = [];
  }
}
