from typing import Any


class RetrievalService:
    def search(self, query: str) -> list[Any]:
        # Phase 1 boundary: FAISS indexing and retrieval pipeline is implemented in later phases.
        _ = query
        return []


retrieval_service = RetrievalService()
