// Вёрстка учебного текста: очень длинный абзац («стена текста») печатается
// несколькими короткими — режем по границе предложения. Текст не меняется
// вообще; содержательные правки остаются делом методиста.

export const LONG_PARAGRAPH_CHARS = 480;

export function splitParagraphs(text: string, limit = LONG_PARAGRAPH_CHARS): string[] {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  const out: string[] = [];
  for (const p of paragraphs) {
    if (p.length <= limit) {
      out.push(p);
      continue;
    }
    const sentences = p.match(/[^.!?…]+[.!?…]+(\s|$)|[^.!?…]+$/g) ?? [p];
    let chunk = '';
    for (const s of sentences) {
      if (chunk.length > 0 && (chunk + s).length > limit) {
        out.push(chunk.trim());
        chunk = s;
      } else {
        chunk += s;
      }
    }
    if (chunk.trim().length > 0) out.push(chunk.trim());
  }
  return out;
}
