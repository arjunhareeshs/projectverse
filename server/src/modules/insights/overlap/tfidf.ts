export type SparseVector = Map<string, number>;

export interface TfIdfModel {
  docCount: number;
  idfMap: Map<string, number>;
  vectors: Map<string, SparseVector>; // projectId -> L2-normalized sparse vector
}

export function buildTfIdfModel(docTokensMap: Map<string, string[]>): TfIdfModel {
  const docCount = docTokensMap.size;
  const dfMap = new Map<string, number>();

  // 1. Calculate Document Frequency (DF)
  for (const [, tokens] of docTokensMap.entries()) {
    const uniqueTokens = new Set(tokens);
    for (const token of uniqueTokens) {
      dfMap.set(token, (dfMap.get(token) || 0) + 1);
    }
  }

  // 2. Calculate Inverse Document Frequency (IDF) with smoothing: log((N + 1) / (df + 1)) + 1
  const idfMap = new Map<string, number>();
  for (const [token, df] of dfMap.entries()) {
    const idf = Math.log((docCount + 1) / (df + 1)) + 1.0;
    idfMap.set(token, idf);
  }

  // 3. Calculate TF-IDF vectors and L2 normalize
  const vectors = new Map<string, SparseVector>();

  for (const [docId, tokens] of docTokensMap.entries()) {
    if (tokens.length === 0) {
      vectors.set(docId, new Map());
      continue;
    }

    // Term Frequency (TF)
    const tfMap = new Map<string, number>();
    for (const token of tokens) {
      tfMap.set(token, (tfMap.get(token) || 0) + 1);
    }

    const rawVector: SparseVector = new Map();
    let normSq = 0.0;

    for (const [token, tf] of tfMap.entries()) {
      const idf = idfMap.get(token) || 1.0;
      // Augmented TF: 0.5 + 0.5 * (tf / maxTf) or log(1 + tf)
      const tfVal = Math.log(1 + tf);
      const tfidf = tfVal * idf;
      rawVector.set(token, tfidf);
      normSq += tfidf * tfidf;
    }

    const norm = Math.sqrt(normSq);
    const normalizedVector: SparseVector = new Map();

    if (norm > 0) {
      for (const [token, val] of rawVector.entries()) {
        normalizedVector.set(token, val / norm);
      }
    }

    vectors.set(docId, normalizedVector);
  }

  return { docCount, idfMap, vectors };
}

export function cosineSimilarity(v1: SparseVector, v2: SparseVector): number {
  if (!v1 || !v2 || v1.size === 0 || v2.size === 0) return 0.0;

  // Iterate over smaller vector for speed
  const [smaller, larger] = v1.size < v2.size ? [v1, v2] : [v2, v1];

  let dotProduct = 0.0;
  for (const [token, val1] of smaller.entries()) {
    const val2 = larger.get(token);
    if (val2 !== undefined) {
      dotProduct += val1 * val2;
    }
  }

  return Math.min(1.0, Math.max(0.0, dotProduct));
}
