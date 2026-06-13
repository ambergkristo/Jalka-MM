export function normalizeScorerName(value: string): string {
  let text = value
    .normalize('NFKC')
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/\u00a0/g, ' ')
    .trim();

  if (!text) return '';

  let previous: string | undefined;
  do {
    previous = text;
    text = stripTrailingScorerNoise(text);
  } while (text !== previous);

  return text.replace(/\s+/g, ' ').trim();
}

function stripTrailingScorerNoise(value: string): string {
  return value
    .replace(/\s*\(\s*(?:OG|own goal)\s*\)\s*$/iu, '')
    .replace(/\s*\b(?:OG|own goal)\b\.?\s*$/iu, '')
    .replace(/\s*\(?\d{1,3}(?:\+\d{1,3})?\)?\s*['’]?\+?\s*$/u, '')
    .replace(/\s*[\[(]\s*$/u, '')
    .trim();
}
