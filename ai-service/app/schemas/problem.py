from pydantic import BaseModel, Field, AliasChoices

class ShortlistRequest(BaseModel):
    team_id: str = Field(validation_alias=AliasChoices('teamId', 'team_id'))

class ShortlistChatRequest(BaseModel):
    session_id: str = Field(validation_alias=AliasChoices('sessionId', 'session_id'))
    team_id: str = Field(validation_alias=AliasChoices('teamId', 'team_id'))
    message: str = Field(min_length=1)

class CandidateModel(BaseModel):
    id: str
    code: str
    title: str
    description: str
    domain: str
    core: str
    sector: str
    type: str
    difficulty: str | None = None
    requiredSkills: list[str] = Field(default=[], validation_alias=AliasChoices('requiredSkills', 'required_skills'))
    sourceOrg: str | None = Field(default=None, validation_alias=AliasChoices('sourceOrg', 'source_org'))
    status: str = "available"
    claimedByTeamId: str | None = Field(default=None, validation_alias=AliasChoices('claimedByTeamId', 'claimed_by_team_id'))
    claimedAt: str | None = Field(default=None, validation_alias=AliasChoices('claimedAt', 'claimed_at'))
    lockExpiresAt: str | None = Field(default=None, validation_alias=AliasChoices('lockExpiresAt', 'lock_expires_at'))
    uniquenessNotes: str | None = Field(default=None, validation_alias=AliasChoices('uniquenessNotes', 'uniqueness_notes'))
    fit_reasoning: str | None = None
    rank: int | None = None

    class Config:
        populate_by_name = True

class ShortlistResponse(BaseModel):
    candidates: list[CandidateModel]

class UniquenessThesis(BaseModel):
    approach: str
    method: str
    value: str
    differentiation: str

class FinalizeRequest(BaseModel):
    team_id: str = Field(validation_alias=AliasChoices('teamId', 'team_id'))
    problem_id: str = Field(validation_alias=AliasChoices('problemId', 'problem_id'))
    thesis: UniquenessThesis

class FinalizeResponse(BaseModel):
    ok: bool
    projectId: str | None = Field(default=None, validation_alias=AliasChoices('projectId', 'project_id'))
    conflict: bool = False
    reshortlist: list[CandidateModel] | None = None

    class Config:
        populate_by_name = True
