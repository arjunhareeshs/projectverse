export function normalize(s: string): string {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function wordOverlapRatio(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const wordsA = new Set(na.split(' ').filter((w) => w.length > 3));
  const wordsB = new Set(nb.split(' ').filter((w) => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  wordsA.forEach((w) => {
    if (wordsB.has(w)) overlap++;
  });
  return overlap / Math.min(wordsA.size, wordsB.size);
}

export function isTooSimilar(a: string, b: string): boolean {
  return wordOverlapRatio(a, b) > 0.7;
}
