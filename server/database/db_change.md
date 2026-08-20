# Database Schema Change Log

## [2026-08-20] Full Normalization & GitHub Commit Attribution Schema

### Phase 1: GitHub Commit History & Attribution
- **Model `GithubCommit`**: Added `authorLogin`, `authorEmail`, `linkedUserId`, `isMerge`, `@@index([repositoryId, date])`, `@@index([linkedUserId, date])`. Added relation `linkedUser` -> `User`.
- **Model `User`**: Added relation `githubCommits` -> `GithubCommit[]`.

### Phase 2: Evaluation Scoring & Proposal Extraction Normalization
- **Model `EvaluationReport`**: Added typed columns `overallScore`, `plagiarismRisk`, `isFallback`, `statusNote`, `mentorFeedback`. Made `content` optional legacy fallback.
- **New Model `EvaluationCategoryScore`**: Normalized per-category evaluation scores.
- **New Model `EvaluationMemberScore`**: Normalized per-member evaluation scores.
- **New Model `EvaluationFinding`**: Normalized findings (`MISSING_WORK`, `SUSPICIOUS`, `RECOMMENDATION`).
- **New Model `EvaluationEvidence`**: Normalized evidence items.
- **New Models `ProposalScore` & `ProposalRubricScore`**: Normalized proposal scoring.
- **New Models `ProposalExtraction` & `ProposalExtractionItem`**: Normalized proposal extraction arrays.
- **New Model `EvidenceUrl`**: Shared normalized evidence URLs for work logs and submissions.
- **New Model `OpportunityRecommendationItem`**: Normalized opportunity items.

### Phase 3: GitHub & Catalog Normalization
- **New Models `GithubRepositoryLanguage`, `GithubRepositoryLabel`, `GithubRepositoryMilestone`, `GithubRepoStructure`**: Normalized repository metadata.
- **Model `GithubSnapshot`**: Added typed metric fields (`stars`, `forks`, `watchers`, `commitCount`, `contributorCount`, `openIssues`, `closedIssues`, `openPullRequests`, `closedPullRequests`, `mergedPullRequests`, `popularityScore`).
- **New Models `ProjectUseCase`, `ProjectDeliverable`, `ProjectExpectedMetric`, `ProjectCatalogPhase`, `ProjectTypeSpecific`**: Normalized project catalog arrays.
- **New Models `ExecutionDocOverview`, `ExecutionDocObjective`, `ExecutionDocDeliverable`, `ExecutionDocRisk`, `ExecutionDocSuccessCriteria`, `ExecutionDocSkillRequired`, `ExecutionDocWorkPackage`, `ExecutionDocMilestone`, `ExecutionDocLearningResource`, `ExecutionDocFeature`, `ExecutionDocTeamShare`**: Normalized execution document versions.

### Phase 5: ProjectLog Normalization
- **New Models `ProjectLogDuration`, `ProjectLogDurationHistory`, `ProjectLogMember`, `ProjectLogMemberResponsibility`, `ProjectLogTechnology`, `ProjectLogWorkPackage`, `ProjectLogMilestone`, `ProjectLogMilestoneHistory`, `ProjectLogSkill`, `ProjectLogSkillGap`, `ProjectLogFlag`, `ProjectLogEvaluationRef`**: Normalized project log state.
- **New Model `ProjectLogEventField`**: Normalized project log event payload key-values.
