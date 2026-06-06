// Break a text blob into readable paragraphs.
// Respects existing \n\n breaks if present; otherwise chunks sentences into ~3-sentence groups.
export function formatParagraphs(text: string | null | undefined): string[] {
  if (!text) return [];
  const trimmed = text.trim();
  if (!trimmed) return [];
  const hasBreaks = /\n\s*\n/.test(trimmed);
  const initial = hasBreaks
    ? trimmed.split(/\n\s*\n+/).map(s => s.trim()).filter(Boolean)
    : [trimmed];

  const out: string[] = [];
  for (const para of initial) {
    const wc = para.split(/\s+/).length;
    if (wc <= 70) { out.push(para); continue; }
    const sentences = para.match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g) || [para];
    let buf = '';
    let bufWords = 0;
    for (const s of sentences) {
      const sWords = s.trim().split(/\s+/).length;
      if (bufWords + sWords > 70 && buf) {
        out.push(buf.trim());
        buf = s;
        bufWords = sWords;
      } else {
        buf = buf ? `${buf} ${s.trim()}` : s.trim();
        bufWords += sWords;
      }
    }
    if (buf.trim()) out.push(buf.trim());
  }
  return out;
}
