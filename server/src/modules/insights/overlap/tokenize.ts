const ENGLISH_STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'can\'t', 'cannot',
  'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during', 'each',
  'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d',
  'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i',
  'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me',
  'more', 'most', 'mustn\'t', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other',
  'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s',
  'should', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them',
  'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this',
  'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll',
  'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which',
  'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d',
  'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
]);

const ACADEMIC_BOILERPLATE = new Set([
  'system', 'project', 'using', 'based', 'implementation', 'module', 'develop', 'application', 'design',
  'proposed', 'approach', 'solution', 'features', 'process', 'management', 'platform', 'tool', 'framework',
  'architecture', 'overview', 'version', 'work', 'done', 'log', 'daily', 'task', 'milestone', 'building'
]);

// Light suffix stemmer for English (strips common endings like -ing, -ed, -es, -s, -ment, -tion)
export function lightStem(word: string): string {
  if (word.length <= 3) return word;

  if (word.endsWith('ation') && word.length > 6) return word.slice(0, -5);
  if (word.endsWith('tion') && word.length > 5) return word.slice(0, -4);
  if (word.endsWith('ment') && word.length > 5) return word.slice(0, -4);
  if (word.endsWith('ing') && word.length > 4) return word.slice(0, -3);
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);

  return word;
}

export function tokenizeText(text: string): string[] {
  if (!text) return [];

  // Lowercase & replace non-alphanumeric with space
  const normalized = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!normalized) return [];

  const rawWords = normalized.split(/\s+/);
  const cleanUnigrams: string[] = [];

  for (const w of rawWords) {
    if (w.length < 2) continue;
    if (ENGLISH_STOPWORDS.has(w) || ACADEMIC_BOILERPLATE.has(w)) continue;
    const stemmed = lightStem(w);
    if (stemmed.length >= 2) {
      cleanUnigrams.push(stemmed);
    }
  }

  const tokens: string[] = [...cleanUnigrams];

  // Bigrams
  for (let i = 0; i < cleanUnigrams.length - 1; i++) {
    const bigram = `${cleanUnigrams[i]}_${cleanUnigrams[i + 1]}`;
    tokens.push(bigram);
  }

  return tokens;
}
