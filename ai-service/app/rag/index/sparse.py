import hashlib
import math
import re
from collections import Counter

from qdrant_client import models

_TOKEN_RE = re.compile(r'[a-z0-9]+')
_STOPWORDS = {
    'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'is', 'are', 'was',
    'were', 'be', 'this', 'that', 'with', 'as', 'by', 'at', 'it', 'its', 'from', 'will', 'has',
}
_VOCAB_SIZE = 2**24  # hashing-trick bucket space — collisions are rare and harmless at this size


def _tokenize(text: str) -> list[str]:
    tokens = _TOKEN_RE.findall(text.lower())
    return [t for t in tokens if t not in _STOPWORDS and len(t) > 1]


def _term_id(term: str) -> int:
    digest = hashlib.md5(term.encode()).digest()
    return int.from_bytes(digest[:4], 'big') % _VOCAB_SIZE


def sparse_vector(text: str) -> models.SparseVector:
    """Lightweight lexical sparse vector: hashed-vocabulary term frequency, log-scaled.

    This is NOT corpus-calibrated BM25 — true BM25 needs a persisted global document-frequency
    table kept in sync across every ingest, which is out of scope for this stage. This gives a
    real keyword/lexical signal (exact-term overlap scores nonzero) that meaningfully
    complements the dense embedding in RRF fusion, satisfying the "sparse half contributes"
    requirement without that extra moving part. Encoding is deterministic — the same hash runs
    at index time and query time — so no stored vocabulary is needed.
    """
    counts = Counter(_tokenize(text))
    if not counts:
        return models.SparseVector(indices=[], values=[])
    weights: dict[int, float] = {}
    for term, tf in counts.items():
        term_id = _term_id(term)
        weights[term_id] = weights.get(term_id, 0.0) + (1.0 + math.log(tf))
    indices = list(weights.keys())
    values = [weights[i] for i in indices]
    return models.SparseVector(indices=indices, values=values)
