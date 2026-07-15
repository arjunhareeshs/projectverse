from typing import Literal

from pydantic import BaseModel, Field

MemoryFileType = Literal['semantic', 'episodic', 'procedural']
FactType = Literal['preference', 'strength', 'weakness', 'project', 'episodic', 'commitment']


class FrontMatter(BaseModel):
    type: MemoryFileType
    tags: list[str] = Field(default_factory=list)
    links: list[str] = Field(default_factory=list)
    last_updated: str
    decay: float = 1.0
    confidence: float = 1.0


class VaultFile(BaseModel):
    filename: str
    frontmatter: FrontMatter
    body: str


class ExtractedFact(BaseModel):
    type: FactType
    text: str
    confidence: Literal['high', 'medium', 'low'] = 'medium'


class ConversationTurn(BaseModel):
    user_message: str
    assistant_message: str | None = None


class WriteRequest(BaseModel):
    user_id: str
    facts: list[ExtractedFact]
