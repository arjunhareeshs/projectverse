-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('NORTH_STAR', 'LEADING', 'LAGGING');

-- CreateEnum
CREATE TYPE "MetricScope" AS ENUM ('ORG', 'COHORT', 'TEAM', 'PROJECT', 'USER');

-- CreateEnum
CREATE TYPE "RiskBand" AS ENUM ('GREEN', 'AMBER', 'RED');

-- CreateEnum
CREATE TYPE "RiskDriverKey" AS ENUM ('MILESTONE_SLIPPAGE', 'LOG_NONCOMPLIANCE', 'OPEN_FLAGS', 'COMMIT_DECLINE', 'CONTRIBUTION_IMBALANCE');

-- CreateEnum
CREATE TYPE "BlockerStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'STALE');

-- CreateEnum
CREATE TYPE "CohortReportKind" AS ENUM ('ONBOARDING_FUNNEL', 'FORMATION_HEALTH', 'SEGMENTATION', 'EARLY_WARNING', 'CATALOG_DEMAND', 'ROI');

-- CreateEnum
CREATE TYPE "InterventionKind" AS ENUM ('GENERAL_NUDGE', 'MENTOR_MEETING', 'DEADLINE_EXTENSION', 'TEAM_RESHUFFLE', 'SCOPE_REDUCTION', 'ESCALATION');

-- CreateEnum
CREATE TYPE "InterventionOutcome" AS ENUM ('PENDING', 'IMPROVED', 'UNCHANGED', 'WORSENED', 'INCONCLUSIVE');

-- CreateEnum
CREATE TYPE "MetricRunKind" AS ENUM ('RISK', 'AUTHENTICITY', 'BLOCKERS', 'COHORT', 'BENCHMARK', 'ALL');

-- CreateTable
CREATE TABLE "MetricDefinition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metricType" "MetricType" NOT NULL,
    "unit" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "targetExpression" TEXT,
    "scope" "MetricScope" NOT NULL DEFAULT 'PROJECT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricSnapshot" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "scope" "MetricScope" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "insufficientData" BOOLEAN NOT NULL DEFAULT false,
    "computeRunId" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskModelVersion" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "weightSlip" DOUBLE PRECISION NOT NULL DEFAULT 0.30,
    "weightLogs" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "weightCommits" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "weightFlags" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "weightFairness" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "amberThreshold" INTEGER NOT NULL DEFAULT 33,
    "redThreshold" INTEGER NOT NULL DEFAULT 66,
    "calibratedFrom" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "RiskModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRiskScore" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "modelVersionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "band" "RiskBand" NOT NULL,
    "percentTimeElapsed" DOUBLE PRECISION NOT NULL,
    "percentMilestonesDone" DOUBLE PRECISION NOT NULL,
    "logComplianceRate" DOUBLE PRECISION NOT NULL,
    "commitVelocityTrend" DOUBLE PRECISION NOT NULL,
    "openFlagSeverity" DOUBLE PRECISION NOT NULL,
    "contributionGini" DOUBLE PRECISION NOT NULL,
    "slippage" DOUBLE PRECISION NOT NULL,
    "logNonCompliance" DOUBLE PRECISION NOT NULL,
    "commitDrop" DOUBLE PRECISION NOT NULL,
    "flagSeverity" DOUBLE PRECISION NOT NULL,
    "contributionImbalance" DOUBLE PRECISION NOT NULL,
    "computeRunId" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectRiskScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRiskDriver" (
    "id" TEXT NOT NULL,
    "riskScoreId" TEXT NOT NULL,
    "driverKey" "RiskDriverKey" NOT NULL,
    "weightPct" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "ProjectRiskDriver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainSkillRequirement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "domain" TEXT NOT NULL,
    "skillName" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainSkillRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectFitScore" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "skillCoverage" DOUBLE PRECISION NOT NULL,
    "timeFit" DOUBLE PRECISION NOT NULL,
    "perfFit" DOUBLE PRECISION NOT NULL,
    "avgPerformance" DOUBLE PRECISION NOT NULL,
    "weeksAvailable" INTEGER NOT NULL,
    "difficultyTier" INTEGER NOT NULL,
    "weightSkillCoverage" DOUBLE PRECISION NOT NULL,
    "weightTimeFit" DOUBLE PRECISION NOT NULL,
    "weightPerfFit" DOUBLE PRECISION NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectFitScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectFitReason" (
    "id" TEXT NOT NULL,
    "fitScoreId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectFitReason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthenticityAudit" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "overallConfidence" INTEGER NOT NULL,
    "signalCount" INTEGER NOT NULL,
    "suspiciousCount" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "evaluationReportId" TEXT,
    "computeRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthenticityAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthenticitySignal" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "logClaimed" BOOLEAN NOT NULL,
    "hoursClaimed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commitCount" INTEGER NOT NULL DEFAULT 0,
    "docActivityCount" INTEGER NOT NULL DEFAULT 0,
    "suspicious" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,

    CONSTRAINT "AuthenticitySignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockerEscalation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "firstSeenDate" DATE NOT NULL,
    "lastSeenDate" DATE NOT NULL,
    "recurrenceCount" INTEGER NOT NULL,
    "severity" INTEGER NOT NULL,
    "status" "BlockerStatus" NOT NULL DEFAULT 'OPEN',
    "acknowledgedById" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "projectLogFlagId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockerEscalation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortBenchmark" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "cohortKey" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "populationSize" INTEGER NOT NULL,
    "median" DOUBLE PRECISION NOT NULL,
    "mean" DOUBLE PRECISION NOT NULL,
    "stdDev" DOUBLE PRECISION NOT NULL,
    "p25" DOUBLE PRECISION NOT NULL,
    "p75" DOUBLE PRECISION NOT NULL,
    "p90" DOUBLE PRECISION NOT NULL,
    "insufficientData" BOOLEAN NOT NULL DEFAULT false,
    "computeRunId" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortBenchmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortMetricSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reportKind" "CohortReportKind" NOT NULL,
    "cohortKey" TEXT NOT NULL DEFAULT '',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "computeRunId" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intervention" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "kind" "InterventionKind" NOT NULL,
    "note" TEXT,
    "baselineRiskScoreId" TEXT,
    "followUpRiskScoreId" TEXT,
    "followUpDueAt" TIMESTAMP(3) NOT NULL,
    "riskDelta" DOUBLE PRECISION,
    "outcome" "InterventionOutcome" NOT NULL DEFAULT 'PENDING',
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Intervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricComputeRun" (
    "id" TEXT NOT NULL,
    "kind" "MetricRunKind" NOT NULL,
    "organizationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "subjectsProcessed" INTEGER NOT NULL DEFAULT 0,
    "snapshotsWritten" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "triggeredById" TEXT,

    CONSTRAINT "MetricComputeRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetricDefinition_metricType_isActive_idx" ON "MetricDefinition"("metricType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MetricDefinition_organizationId_key_key" ON "MetricDefinition"("organizationId", "key");

-- CreateIndex
CREATE INDEX "MetricSnapshot_scope_subjectId_computedAt_idx" ON "MetricSnapshot"("scope", "subjectId", "computedAt");

-- CreateIndex
CREATE INDEX "MetricSnapshot_organizationId_definitionId_periodStart_idx" ON "MetricSnapshot"("organizationId", "definitionId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "MetricSnapshot_definitionId_scope_subjectId_periodStart_key" ON "MetricSnapshot"("definitionId", "scope", "subjectId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "RiskModelVersion_version_key" ON "RiskModelVersion"("version");

-- CreateIndex
CREATE INDEX "RiskModelVersion_isActive_idx" ON "RiskModelVersion"("isActive");

-- CreateIndex
CREATE INDEX "ProjectRiskScore_projectId_computedAt_idx" ON "ProjectRiskScore"("projectId", "computedAt");

-- CreateIndex
CREATE INDEX "ProjectRiskScore_band_computedAt_idx" ON "ProjectRiskScore"("band", "computedAt");

-- CreateIndex
CREATE INDEX "ProjectRiskScore_computedAt_idx" ON "ProjectRiskScore"("computedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRiskScore_projectId_computedAt_key" ON "ProjectRiskScore"("projectId", "computedAt");

-- CreateIndex
CREATE INDEX "ProjectRiskDriver_driverKey_weightPct_idx" ON "ProjectRiskDriver"("driverKey", "weightPct");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRiskDriver_riskScoreId_driverKey_key" ON "ProjectRiskDriver"("riskScoreId", "driverKey");

-- CreateIndex
CREATE INDEX "DomainSkillRequirement_domain_idx" ON "DomainSkillRequirement"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "DomainSkillRequirement_organizationId_domain_skillName_key" ON "DomainSkillRequirement"("organizationId", "domain", "skillName");

-- CreateIndex
CREATE INDEX "ProjectFitScore_teamId_computedAt_idx" ON "ProjectFitScore"("teamId", "computedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectFitScore_projectId_teamId_computedAt_key" ON "ProjectFitScore"("projectId", "teamId", "computedAt");

-- CreateIndex
CREATE INDEX "ProjectFitReason_fitScoreId_order_idx" ON "ProjectFitReason"("fitScoreId", "order");

-- CreateIndex
CREATE INDEX "AuthenticityAudit_projectId_createdAt_idx" ON "AuthenticityAudit"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthenticityAudit_overallConfidence_idx" ON "AuthenticityAudit"("overallConfidence");

-- CreateIndex
CREATE UNIQUE INDEX "AuthenticityAudit_projectId_periodStart_periodEnd_key" ON "AuthenticityAudit"("projectId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "AuthenticitySignal_userId_date_idx" ON "AuthenticitySignal"("userId", "date");

-- CreateIndex
CREATE INDEX "AuthenticitySignal_auditId_suspicious_idx" ON "AuthenticitySignal"("auditId", "suspicious");

-- CreateIndex
CREATE UNIQUE INDEX "AuthenticitySignal_auditId_userId_date_key" ON "AuthenticitySignal"("auditId", "userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "BlockerEscalation_projectLogFlagId_key" ON "BlockerEscalation"("projectLogFlagId");

-- CreateIndex
CREATE INDEX "BlockerEscalation_projectId_status_idx" ON "BlockerEscalation"("projectId", "status");

-- CreateIndex
CREATE INDEX "BlockerEscalation_status_severity_idx" ON "BlockerEscalation"("status", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "BlockerEscalation_projectId_userId_firstSeenDate_key" ON "BlockerEscalation"("projectId", "userId", "firstSeenDate");

-- CreateIndex
CREATE INDEX "CohortBenchmark_definitionId_periodStart_idx" ON "CohortBenchmark"("definitionId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "CohortBenchmark_organizationId_definitionId_cohortKey_perio_key" ON "CohortBenchmark"("organizationId", "definitionId", "cohortKey", "periodStart");

-- CreateIndex
CREATE INDEX "CohortMetricSnapshot_organizationId_reportKind_computedAt_idx" ON "CohortMetricSnapshot"("organizationId", "reportKind", "computedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CohortMetricSnapshot_organizationId_reportKind_cohortKey_pe_key" ON "CohortMetricSnapshot"("organizationId", "reportKind", "cohortKey", "periodStart");

-- CreateIndex
CREATE INDEX "Intervention_projectId_loggedAt_idx" ON "Intervention"("projectId", "loggedAt");

-- CreateIndex
CREATE INDEX "Intervention_organizationId_kind_outcome_idx" ON "Intervention"("organizationId", "kind", "outcome");

-- CreateIndex
CREATE INDEX "Intervention_followUpDueAt_idx" ON "Intervention"("followUpDueAt");

-- CreateIndex
CREATE INDEX "MetricComputeRun_kind_startedAt_idx" ON "MetricComputeRun"("kind", "startedAt");

-- AddForeignKey
ALTER TABLE "MetricDefinition" ADD CONSTRAINT "MetricDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricSnapshot" ADD CONSTRAINT "MetricSnapshot_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "MetricDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricSnapshot" ADD CONSTRAINT "MetricSnapshot_computeRunId_fkey" FOREIGN KEY ("computeRunId") REFERENCES "MetricComputeRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskModelVersion" ADD CONSTRAINT "RiskModelVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRiskScore" ADD CONSTRAINT "ProjectRiskScore_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRiskScore" ADD CONSTRAINT "ProjectRiskScore_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "RiskModelVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRiskScore" ADD CONSTRAINT "ProjectRiskScore_computeRunId_fkey" FOREIGN KEY ("computeRunId") REFERENCES "MetricComputeRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRiskDriver" ADD CONSTRAINT "ProjectRiskDriver_riskScoreId_fkey" FOREIGN KEY ("riskScoreId") REFERENCES "ProjectRiskScore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainSkillRequirement" ADD CONSTRAINT "DomainSkillRequirement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFitScore" ADD CONSTRAINT "ProjectFitScore_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFitScore" ADD CONSTRAINT "ProjectFitScore_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFitReason" ADD CONSTRAINT "ProjectFitReason_fitScoreId_fkey" FOREIGN KEY ("fitScoreId") REFERENCES "ProjectFitScore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthenticityAudit" ADD CONSTRAINT "AuthenticityAudit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthenticityAudit" ADD CONSTRAINT "AuthenticityAudit_evaluationReportId_fkey" FOREIGN KEY ("evaluationReportId") REFERENCES "EvaluationReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthenticityAudit" ADD CONSTRAINT "AuthenticityAudit_computeRunId_fkey" FOREIGN KEY ("computeRunId") REFERENCES "MetricComputeRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthenticitySignal" ADD CONSTRAINT "AuthenticitySignal_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "AuthenticityAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthenticitySignal" ADD CONSTRAINT "AuthenticitySignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockerEscalation" ADD CONSTRAINT "BlockerEscalation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockerEscalation" ADD CONSTRAINT "BlockerEscalation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockerEscalation" ADD CONSTRAINT "BlockerEscalation_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockerEscalation" ADD CONSTRAINT "BlockerEscalation_projectLogFlagId_fkey" FOREIGN KEY ("projectLogFlagId") REFERENCES "ProjectLogFlag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortBenchmark" ADD CONSTRAINT "CohortBenchmark_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortBenchmark" ADD CONSTRAINT "CohortBenchmark_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "MetricDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortBenchmark" ADD CONSTRAINT "CohortBenchmark_computeRunId_fkey" FOREIGN KEY ("computeRunId") REFERENCES "MetricComputeRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMetricSnapshot" ADD CONSTRAINT "CohortMetricSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMetricSnapshot" ADD CONSTRAINT "CohortMetricSnapshot_computeRunId_fkey" FOREIGN KEY ("computeRunId") REFERENCES "MetricComputeRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_baselineRiskScoreId_fkey" FOREIGN KEY ("baselineRiskScoreId") REFERENCES "ProjectRiskScore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_followUpRiskScoreId_fkey" FOREIGN KEY ("followUpRiskScoreId") REFERENCES "ProjectRiskScore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricComputeRun" ADD CONSTRAINT "MetricComputeRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricComputeRun" ADD CONSTRAINT "MetricComputeRun_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

