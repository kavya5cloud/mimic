export function splitSentences(text: string): string[] {
  return text.match(/[^.!?]+[.!?]+(?=\s|$)|.+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
}
