export type ParsedProtocolLine =
  | { type: 'point'; x: number; y: number }
  | { type: 'action'; action: Record<string, unknown> | null }
  | { type: 'done'; value: boolean }
  | { type: 'say'; text: string };

export class MimicStreamParser {
  private buffer = '';

  push(chunk: string): ParsedProtocolLine[] {
    this.buffer += chunk;
    const events: ParsedProtocolLine[] = [];
    while (true) {
      const newline = this.buffer.indexOf('\n');
      if (newline < 0) break;
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      const event = parseProtocolLine(line);
      if (event) events.push(event);
    }
    return events;
  }

  flush(): ParsedProtocolLine[] {
    const line = this.buffer.trim();
    this.buffer = '';
    const event = line ? parseProtocolLine(line) : null;
    return event ? [event] : [];
  }
}

export function parseProtocolLine(line: string): ParsedProtocolLine | null {
  if (line.startsWith('POINT:')) {
    const value = line.slice(6).trim();
    if (value === 'NONE') return null;
    const match = value.match(/^(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)$/);
    if (!match) return null;
    return { type: 'point', x: Number(match[1]), y: Number(match[2]) };
  }
  if (line.startsWith('ACTION:')) {
    const value = line.slice(7).trim();
    if (value === 'NONE') return { type: 'action', action: null };
    try {
      const action = JSON.parse(value);
      return action && typeof action === 'object' && !Array.isArray(action) ? { type: 'action', action } : null;
    } catch { return null; }
  }
  if (line.startsWith('DONE:')) {
    const value = line.slice(5).trim().toUpperCase();
    if (value !== 'YES' && value !== 'NO') return null;
    return { type: 'done', value: value === 'YES' };
  }
  if (line.startsWith('SAY:')) {
    return { type: 'say', text: line.slice(4).trim() };
  }
  return null;
}
