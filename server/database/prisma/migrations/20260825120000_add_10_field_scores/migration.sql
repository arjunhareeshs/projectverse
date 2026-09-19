-- CreateEnum if it was not created by the preceding AI provider migration.
DO $$
BEGIN
  CREATE TYPE "AIProvider" AS ENUM ('GROQ', 'NVIDIA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserAIProvider" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AIProvider" NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "keyFingerprint" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastValidatedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAIProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AIUsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AIProvider" NOT NULL,
    "model" TEXT,
    "requestId" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "latencyMs" INTEGER,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StudentCycleScore10" (
    "id" TEXT NOT NULL,
    "regNo" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "teamId" TEXT,
    "reportId" TEXT,
    "cycle" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "scopeAlignmentScore" INTEGER NOT NULL,
    "technicalComplexityScore" INTEGER NOT NULL,
    "milestoneCompletionScore" INTEGER NOT NULL,
    "commitAuthenticityScore" INTEGER NOT NULL,
    "riskMitigationScore" INTEGER NOT NULL,
    "taskPunctualityScore" INTEGER NOT NULL,
    "dailyLogDiligenceScore" INTEGER NOT NULL,
    "taskOwnershipScore" INTEGER NOT NULL,
    "teamCollaborationScore" INTEGER NOT NULL,
    "growthInnovationScore" INTEGER NOT NULL,
    "totalMarks" INTEGER NOT NULL,
    "relativeTeamRank" INTEGER,
    "contributionRatio" DOUBLE PRECISION,
    "previousCycleTotalMarks" INTEGER,
    "deltaMarks" INTEGER,
    "qualitativeStrengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "qualitativeGrowthAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "personalizedActionPlan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentCycleScore10_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TeamCycleScore10" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportId" TEXT,
    "cycle" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "workDistributionEquity" INTEGER NOT NULL,
    "milestoneVelocity" INTEGER NOT NULL,
    "blockerResolutionSpeed" INTEGER NOT NULL,
    "interMemberCollaboration" INTEGER NOT NULL,
    "teamCommitCadence" INTEGER NOT NULL,
    "sharedDocumentation" INTEGER NOT NULL,
    "technicalConsistency" INTEGER NOT NULL,
    "timelineDiscipline" INTEGER NOT NULL,
    "peerReviewParticipation" INTEGER NOT NULL,
    "collectiveOutputQuality" INTEGER NOT NULL,
    "totalTeamMarks" INTEGER NOT NULL,
    "teamSynergyLevel" TEXT NOT NULL,
    "previousCycleTotalMarks" INTEGER,
    "deltaMarks" INTEGER,
    "bottlenecks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "teamFeedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamCycleScore10_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProjectCycleScore10" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportId" TEXT,
    "cycle" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "scopeAlignment" INTEGER NOT NULL,
    "architectureRobustness" INTEGER NOT NULL,
    "hardwareSoftwareProgress" INTEGER NOT NULL,
    "deliverablesReadiness" INTEGER NOT NULL,
    "authenticityConfidence" INTEGER NOT NULL,
    "plagiarismSafety" INTEGER NOT NULL,
    "testCoverageVerification" INTEGER NOT NULL,
    "standardsCompliance" INTEGER NOT NULL,
    "innovationDifferentiation" INTEGER NOT NULL,
    "publicationFeasibility" INTEGER NOT NULL,
    "totalProjectMarks" INTEGER NOT NULL,
    "projectHealthBand" TEXT NOT NULL,
    "previousCycleTotalMarks" INTEGER,
    "trajectoryDelta" DOUBLE PRECISION,
    "keyMilestonesAchieved" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "criticalRisks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectCycleScore10_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserAIProvider_userId_idx" ON "UserAIProvider"("userId");
CREATE INDEX IF NOT EXISTS "UserAIProvider_provider_idx" ON "UserAIProvider"("provider");
CREATE UNIQUE INDEX IF NOT EXISTS "UserAIProvider_userId_provider_key" ON "UserAIProvider"("userId", "provider");

CREATE INDEX IF NOT EXISTS "AIUsageLog_userId_createdAt_idx" ON "AIUsageLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AIUsageLog_provider_createdAt_idx" ON "AIUsageLog"("provider", "createdAt");

CREATE INDEX IF NOT EXISTS "StudentCycleScore10_regNo_cycle_idx" ON "StudentCycleScore10"("regNo", "cycle");
CREATE INDEX IF NOT EXISTS "StudentCycleScore10_projectId_cycle_idx" ON "StudentCycleScore10"("projectId", "cycle");
CREATE UNIQUE INDEX IF NOT EXISTS "StudentCycleScore10_userId_projectId_cycle_key" ON "StudentCycleScore10"("userId", "projectId", "cycle");

CREATE INDEX IF NOT EXISTS "TeamCycleScore10_teamId_cycle_idx" ON "TeamCycleScore10"("teamId", "cycle");
CREATE UNIQUE INDEX IF NOT EXISTS "TeamCycleScore10_teamId_projectId_cycle_key" ON "TeamCycleScore10"("teamId", "projectId", "cycle");

CREATE INDEX IF NOT EXISTS "ProjectCycleScore10_projectId_cycle_idx" ON "ProjectCycleScore10"("projectId", "cycle");
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectCycleScore10_projectId_cycle_key" ON "ProjectCycleScore10"("projectId", "cycle");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "UserAIProvider" ADD CONSTRAINT "UserAIProvider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AIUsageLog" ADD CONSTRAINT "AIUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StudentCycleScore10" ADD CONSTRAINT "StudentCycleScore10_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StudentCycleScore10" ADD CONSTRAINT "StudentCycleScore10_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StudentCycleScore10" ADD CONSTRAINT "StudentCycleScore10_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StudentCycleScore10" ADD CONSTRAINT "StudentCycleScore10_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EvaluationReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamCycleScore10" ADD CONSTRAINT "TeamCycleScore10_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamCycleScore10" ADD CONSTRAINT "TeamCycleScore10_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TeamCycleScore10" ADD CONSTRAINT "TeamCycleScore10_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EvaluationReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectCycleScore10" ADD CONSTRAINT "ProjectCycleScore10_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectCycleScore10" ADD CONSTRAINT "ProjectCycleScore10_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EvaluationReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
