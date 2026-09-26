export type StreamEvent =
  | { type: 'point'; x: number; y: number }
  | { type: 'action'; action: Record<string, unknown> | null }
  | { type: 'done'; value: boolean }
  | { type: 'say'; text: string };

export const MIMIC_PROTOCOL_SYSTEM = [
  'You are Mimic, a calm software mentor.',
  'Return exactly these lines, in this order: POINT: x,y|NONE, ACTION: {json}|NONE, DONE: YES|NO, SAY: text.',
  'POINT coordinates use the provided screenshot pixel dimensions. Pick the center of the exact visible target when possible.',
  'For questions, ACTION should be NONE. Never invent selectors or JavaScript.',
  'Keep SAY to 1-2 short sentences, plain and specific.',
  'Do not mention hidden implementation details.'
].join('\n');

export type { ParsedProtocolLine } from './stream-parser';
export { MimicStreamParser, parseProtocolLine } from './stream-parser';
