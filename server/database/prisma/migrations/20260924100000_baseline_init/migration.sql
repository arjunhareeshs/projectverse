-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('ADMIN', 'STUDENT', 'FACULTY', 'DEVELOPER');

-- CreateEnum
CREATE TYPE "ProjectCategory" AS ENUM ('MINI', 'FINAL_YEAR', 'RESEARCH');

-- CreateEnum
CREATE TYPE "ProjectMode" AS ENUM ('NORMAL', 'CAPSTONE');

-- CreateEnum
CREATE TYPE "CapstoneStatus" AS ENUM ('CLAIMED', 'SUBMITTED', 'MCQ_READY', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "EvaluationFindingKind" AS ENUM ('MISSING_WORK', 'SUSPICIOUS', 'RECOMMENDATION');

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

-- CreateEnum
CREATE TYPE "AIProvider" AS ENUM ('GROQ', 'NVIDIA');

-- CreateEnum
CREATE TYPE "SystemLogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "regNo" TEXT,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "role" "RoleType" NOT NULL,
    "organizationId" TEXT,
    "teamId" TEXT,
    "githubUsername" TEXT,
    "year" TEXT,
    "department" TEXT,
    "deptCode" TEXT,
    "cluster" TEXT,
    "gender" TEXT,
    "resident" TEXT,
    "learningMode" TEXT,
    "ssgEnrolled" BOOLEAN NOT NULL DEFAULT false,
    "ssgDomain" TEXT,
    "groupRegistered" BOOLEAN NOT NULL DEFAULT false,
    "skillsRegistered" BOOLEAN NOT NULL DEFAULT false,
    "rewardPoints" INTEGER NOT NULL DEFAULT 0,
    "activityPoints" INTEGER NOT NULL DEFAULT 0,
    "teamRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain" TEXT,
    "color" TEXT DEFAULT '#7C3AED',
    "leadId" TEXT,
    "maxMembers" INTEGER NOT NULL DEFAULT 6,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "currentProjectLabel" TEXT,
    "groupCode" TEXT,
    "groupLevel" TEXT,
    "groupCategory" TEXT,
    "iYearCount" INTEGER NOT NULL DEFAULT 0,
    "iiYearCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamCollaboration" (
    "id" TEXT NOT NULL,
    "fromTeamId" TEXT NOT NULL,
    "toTeamId" TEXT NOT NULL,
    "projectName" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamCollaboration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamInvite" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "roleLabel" TEXT NOT NULL DEFAULT 'Member',
    "message" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "type" TEXT NOT NULL DEFAULT 'INVITE',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invitedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMessage" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teamId" TEXT,
    "collaboratingTeamId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain" TEXT,
    "difficultyLevel" TEXT,
    "type" TEXT,
    "mode" "ProjectMode" NOT NULL DEFAULT 'NORMAL',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "repoLink" TEXT,
    "problemStatement" TEXT,
    "objective" TEXT,
    "expectedOutcome" TEXT,
    "technologies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requirements" TEXT,
    "innovation" TEXT,
    "problemId" TEXT,
    "sector" TEXT,
    "shortName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "parentProjectId" TEXT,
    "maxTeams" INTEGER NOT NULL DEFAULT 3,
    "soul" TEXT,
    "backgroundContext" TEXT,
    "targetUsers" TEXT,
    "useCases" JSONB,
    "constraints" TEXT,
    "outOfScope" TEXT,
    "expectedMetrics" JSONB,
    "deliverables" JSONB,
    "courseOutcomes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "programOutcomes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "skillsGained" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "prerequisites" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "phases" JSONB,
    "hardwareComponents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "budgetEstimateInr" INTEGER,
    "budgetNotes" TEXT,
    "standards" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expectedImpact" TEXT,
    "sdgAlignment" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "publicationPotential" TEXT,
    "referenceLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "similarProducts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "suggestedDurationWeeks" INTEGER,
    "typeSpecific" JSONB,
    "differentiationApproach" TEXT,
    "differentiationKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "category" "ProjectCategory",

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemStatementProposal" (
    "id" TEXT NOT NULL,
    "submitterId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "scores" JSONB,
    "verdict" TEXT NOT NULL,
    "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "improvementHints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "duplicateOfId" TEXT,
    "extracted" JSONB,
    "publishedProjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProblemStatementProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "RoleType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "category" TEXT DEFAULT 'Development',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subtask" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Subtask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Board" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Board_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardColumn" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "BoardColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Label" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,

    CONSTRAINT "Label_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "startsAt" TIMESTAMP(3),

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT,
    "refId" TEXT,
    "status" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sprint" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),

    CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleLabel" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSkill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillName" TEXT NOT NULL,
    "skillType" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "skillRank" INTEGER,
    "totalRanks" INTEGER,

    CONSTRAINT "UserSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupRanking" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "totalPoints" INTEGER NOT NULL,

    CONSTRAINT "GroupRanking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAchievement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "recipientId" TEXT,
    "teamId" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminChatHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminChatHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStreak" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "totalContributions" INTEGER NOT NULL DEFAULT 0,
    "gridData" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStreak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hackathon" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "dateRange" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Upcoming',
    "url" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hackathon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeetCodeContest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Register',
    "url" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeetCodeContest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectReview" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reportUrl" TEXT,
    "milestone" TEXT,
    "comments" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubRepository" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "owner" TEXT NOT NULL,
    "repository" TEXT NOT NULL,
    "description" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "defaultBranch" TEXT,
    "homepage" TEXT,
    "license" TEXT,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "language" TEXT,
    "languages" JSONB,
    "repoCreatedAt" TIMESTAMP(3),
    "repoUpdatedAt" TIMESTAMP(3),
    "pushedAt" TIMESTAMP(3),
    "sizeKb" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isDisabled" BOOLEAN NOT NULL DEFAULT false,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "hasWiki" BOOLEAN NOT NULL DEFAULT false,
    "hasPages" BOOLEAN NOT NULL DEFAULT false,
    "hasDiscussions" BOOLEAN NOT NULL DEFAULT false,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "forks" INTEGER NOT NULL DEFAULT 0,
    "watchers" INTEGER NOT NULL DEFAULT 0,
    "subscribers" INTEGER NOT NULL DEFAULT 0,
    "latestCommitSha" TEXT,
    "latestCommitMessage" TEXT,
    "latestCommitAuthor" TEXT,
    "latestCommitDate" TIMESTAMP(3),
    "commitCount" INTEGER NOT NULL DEFAULT 0,
    "branchCount" INTEGER NOT NULL DEFAULT 0,
    "releaseCount" INTEGER NOT NULL DEFAULT 0,
    "tagCount" INTEGER NOT NULL DEFAULT 0,
    "contributorCount" INTEGER NOT NULL DEFAULT 0,
    "openIssues" INTEGER NOT NULL DEFAULT 0,
    "closedIssues" INTEGER NOT NULL DEFAULT 0,
    "openPullRequests" INTEGER NOT NULL DEFAULT 0,
    "closedPullRequests" INTEGER NOT NULL DEFAULT 0,
    "mergedPullRequests" INTEGER NOT NULL DEFAULT 0,
    "labels" JSONB,
    "milestones" JSONB,
    "hasReadme" BOOLEAN NOT NULL DEFAULT false,
    "hasContributing" BOOLEAN NOT NULL DEFAULT false,
    "hasCodeOfConduct" BOOLEAN NOT NULL DEFAULT false,
    "hasSecurityPolicy" BOOLEAN NOT NULL DEFAULT false,
    "hasChangelog" BOOLEAN NOT NULL DEFAULT false,
    "structure" JSONB,
    "popularityScore" INTEGER NOT NULL DEFAULT 0,
    "maintenanceScore" INTEGER NOT NULL DEFAULT 0,
    "communityScore" INTEGER NOT NULL DEFAULT 0,
    "freshnessScore" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GithubRepository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubContributor" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "contributions" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GithubContributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubCommit" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "authorLogin" TEXT,
    "authorEmail" TEXT,
    "linkedUserId" TEXT,
    "message" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "isMerge" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GithubCommit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubSnapshot" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metrics" JSONB NOT NULL,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "forks" INTEGER NOT NULL DEFAULT 0,
    "watchers" INTEGER NOT NULL DEFAULT 0,
    "commitCount" INTEGER NOT NULL DEFAULT 0,
    "contributorCount" INTEGER NOT NULL DEFAULT 0,
    "openIssues" INTEGER NOT NULL DEFAULT 0,
    "closedIssues" INTEGER NOT NULL DEFAULT 0,
    "openPullRequests" INTEGER NOT NULL DEFAULT 0,
    "closedPullRequests" INTEGER NOT NULL DEFAULT 0,
    "mergedPullRequests" INTEGER NOT NULL DEFAULT 0,
    "popularityScore" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GithubSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubRepositoryLanguage" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,

    CONSTRAINT "GithubRepositoryLanguage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubRepositoryLabel" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "description" TEXT,

    CONSTRAINT "GithubRepositoryLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubRepositoryMilestone" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'open',
    "dueOn" TIMESTAMP(3),

    CONSTRAINT "GithubRepositoryMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubRepoStructure" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "hasSrc" BOOLEAN NOT NULL DEFAULT false,
    "hasTests" BOOLEAN NOT NULL DEFAULT false,
    "hasDocs" BOOLEAN NOT NULL DEFAULT false,
    "hasCi" BOOLEAN NOT NULL DEFAULT false,
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "directoryCount" INTEGER NOT NULL DEFAULT 0,
    "topLevelFolders" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "GithubRepoStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectUseCase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectUseCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDeliverable" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectDeliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectExpectedMetric" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "unit" TEXT,

    CONSTRAINT "ProjectExpectedMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCatalogPhase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "expected" TEXT NOT NULL,

    CONSTRAINT "ProjectCatalogPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTypeSpecific" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "data" TEXT,
    "attributes" JSONB,

    CONSTRAINT "ProjectTypeSpecific_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "state" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectLogEvent" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectLogEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectLogDuration" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "months" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectLogDuration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectLogDurationHistory" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "months" INTEGER NOT NULL,
    "reason" TEXT,

    CONSTRAINT "ProjectLogDurationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectLogMember" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProjectLogMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectLogMemberResponsibility" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "workPackageId" TEXT NOT NULL,

    CONSTRAINT "ProjectLogMemberResponsibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectLogTechnology" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ProjectLogTechnology_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectLogWorkPackage" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percentage" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "assignedTo" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "ProjectLogWorkPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectLogMilestone" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "expectedOutput" TEXT,
    "dueWeek" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "ProjectLogMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectLogMilestoneHistory" (
    "id" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,

    CONSTRAINT "ProjectLogMilestoneHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectLogSkill" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,

    CONSTRAINT "ProjectLogSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectLogSkillGap" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "missingFor" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "ProjectLogSkillGap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectLogFlag" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProjectLogFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectLogEvaluationRef" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "cycle" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "authenticity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plagiarismRisk" TEXT NOT NULL DEFAULT 'LOW',
    "overall" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reportId" TEXT NOT NULL,

    CONSTRAINT "ProjectLogEvaluationRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectLogEventField" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNum" DOUBLE PRECISION,
    "valueBool" BOOLEAN,
    "valueDate" TIMESTAMP(3),

    CONSTRAINT "ProjectLogEventField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyWorkLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "workDone" TEXT NOT NULL,
    "hoursSpent" DOUBLE PRECISION,
    "blockers" TEXT,
    "evidenceUrls" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyWorkLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceUrl" (
    "id" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceUrl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "markdown" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionDocOverview" (
    "id" TEXT NOT NULL,
    "executionDocumentId" TEXT NOT NULL,
    "background" TEXT,
    "purpose" TEXT,
    "problemStatement" TEXT,
    "scope" TEXT,
    "expectedOutcome" TEXT,
    "targetUsers" TEXT,
    "uniquenessNotes" TEXT,

    CONSTRAINT "ExecutionDocOverview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionDocObjective" (
    "id" TEXT NOT NULL,
    "executionDocumentId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExecutionDocObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionDocDeliverable" (
    "id" TEXT NOT NULL,
    "executionDocumentId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExecutionDocDeliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionDocRisk" (
    "id" TEXT NOT NULL,
    "executionDocumentId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExecutionDocRisk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionDocSuccessCriteria" (
    "id" TEXT NOT NULL,
    "executionDocumentId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExecutionDocSuccessCriteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionDocSkillRequired" (
    "id" TEXT NOT NULL,
    "executionDocumentId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExecutionDocSkillRequired_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionDocWorkPackage" (
    "id" TEXT NOT NULL,
    "executionDocumentId" TEXT NOT NULL,
    "slug" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "percentage" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExecutionDocWorkPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionDocMilestone" (
    "id" TEXT NOT NULL,
    "executionDocumentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "expectedOutput" TEXT,
    "completionWeek" INTEGER NOT NULL,
    "rewardPoints" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExecutionDocMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionDocLearningResource" (
    "id" TEXT NOT NULL,
    "executionDocumentId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "url" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExecutionDocLearningResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionDocFeature" (
    "id" TEXT NOT NULL,
    "executionDocumentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "importance" TEXT NOT NULL DEFAULT 'Medium',
    "points" INTEGER NOT NULL DEFAULT 0,
    "implementationMethod" TEXT,
    "aiRationale" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExecutionDocFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionDocTeamShare" (
    "id" TEXT NOT NULL,
    "executionDocumentId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "sharePercent" INTEGER NOT NULL DEFAULT 0,
    "rewardPoints" INTEGER NOT NULL DEFAULT 0,
    "isLead" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExecutionDocTeamShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "cycle" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "overallScore" INTEGER,
    "plagiarismRisk" TEXT,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "statusNote" TEXT,
    "mentorFeedback" TEXT,
    "content" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationCategoryScore" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "EvaluationCategoryScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationMemberScore" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "EvaluationMemberScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationFinding" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "kind" "EvaluationFindingKind" NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "EvaluationFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationEvidence" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "EvaluationEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalScore" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "feasibility" DOUBLE PRECISION,
    "impact" DOUBLE PRECISION,
    "novelty" DOUBLE PRECISION,
    "technicalDepth" DOUBLE PRECISION,
    "clarity" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalRubricScore" (
    "id" TEXT NOT NULL,
    "scoreId" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "scoreValue" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT,

    CONSTRAINT "ProposalRubricScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalExtraction" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "problemStatement" TEXT,
    "proposedSolution" TEXT,
    "targetAudience" TEXT,
    "domain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalExtractionItem" (
    "id" TEXT NOT NULL,
    "extractionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "ProposalExtractionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectOverlapFlag" (
    "id" TEXT NOT NULL,
    "clusterHash" TEXT NOT NULL,
    "domain" TEXT,
    "severity" TEXT NOT NULL,
    "similarityScore" DOUBLE PRECISION NOT NULL,
    "confidence" INTEGER NOT NULL,
    "overlappingFeatures" TEXT[],
    "sharedTechnologies" TEXT[],
    "keyDifferences" TEXT[],
    "rationale" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectOverlapFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectOverlapMember" (
    "id" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "teamId" TEXT,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectOverlapMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandoutProject" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "teamId" TEXT,
    "verdict" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "evidenceScore" DOUBLE PRECISION NOT NULL,
    "cyclesEvaluated" INTEGER NOT NULL,
    "avgScore" DOUBLE PRECISION NOT NULL,
    "minScore" DOUBLE PRECISION NOT NULL,
    "trendDelta" DOUBLE PRECISION NOT NULL,
    "lastCycleSeen" INTEGER NOT NULL,
    "oneLinePitch" TEXT NOT NULL,
    "marketProblem" TEXT NOT NULL,
    "differentiator" TEXT NOT NULL,
    "defensibility" TEXT NOT NULL,
    "targetMarket" TEXT NOT NULL,
    "evidenceHighlights" TEXT[],
    "risks" TEXT[],
    "nextSteps" TEXT[],
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandoutProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityRecommendation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "teamId" TEXT,
    "opportunityScore" DOUBLE PRECISION NOT NULL,
    "cyclesEvaluated" INTEGER NOT NULL,
    "lastCycleSeen" INTEGER NOT NULL,
    "hackathonFit" INTEGER NOT NULL,
    "presentationFit" INTEGER NOT NULL,
    "incubationFit" INTEGER NOT NULL,
    "recommendations" JSONB NOT NULL,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityRecommendationItem" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "why" TEXT,
    "deadline" TEXT,
    "matchReason" TEXT,

    CONSTRAINT "OpportunityRecommendationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectFeature" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "importance" TEXT NOT NULL,
    "implementationMethod" TEXT,
    "points" INTEGER NOT NULL,
    "aiRationale" TEXT,
    "addedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPhase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phaseNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "expectedDeliverables" TEXT NOT NULL,
    "weekTarget" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "hardwareNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhaseSubmission" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "submissionNote" TEXT NOT NULL,
    "evidenceUrls" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhaseSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "source" TEXT NOT NULL,
    "sourceRefId" TEXT,
    "points" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardTransaction_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "UserAIProvider" (
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
CREATE TABLE "AIUsageLog" (
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
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL,
    "level" "SystemLogLevel" NOT NULL,
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "userId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestLog" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "userId" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemMetricSnapshot" (
    "id" TEXT NOT NULL,
    "instance" TEXT NOT NULL DEFAULT 'unknown',
    "cpuLoadAvg1m" DOUBLE PRECISION NOT NULL,
    "memoryUsedMb" INTEGER NOT NULL,
    "memoryTotalMb" INTEGER NOT NULL,
    "processRssMb" INTEGER NOT NULL,
    "eventLoopLagMs" DOUBLE PRECISION NOT NULL,
    "uptimeSec" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientErrorLog" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "url" TEXT,
    "userAgent" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentCycleScore10" (
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
CREATE TABLE "TeamCycleScore10" (
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
CREATE TABLE "ProjectCycleScore10" (
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

-- CreateTable
CREATE TABLE "CapstoneProblemStatement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "problemText" TEXT NOT NULL,
    "domain" TEXT,
    "difficulty" TEXT,
    "technologies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "questionCount" INTEGER NOT NULL DEFAULT 15,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapstoneProblemStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapstoneSelection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "problemId" TEXT,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "githubUrl" TEXT,
    "status" "CapstoneStatus" NOT NULL DEFAULT 'CLAIMED',
    "githubAnalysis" JSONB,
    "codeAnalysis" JSONB,
    "mcqScore" INTEGER,
    "totalQuestions" INTEGER NOT NULL DEFAULT 15,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapstoneSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapstoneMcqQuestion" (
    "id" TEXT NOT NULL,
    "selectionId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctOption" INTEGER NOT NULL,
    "explanation" TEXT,
    "difficulty" TEXT,
    "topic" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapstoneMcqQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapstoneMcqAnswer" (
    "id" TEXT NOT NULL,
    "selectionId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "selectedOption" INTEGER NOT NULL,
    "correctOption" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapstoneMcqAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProjectScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "regNo" TEXT,
    "projectId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "projectCount" INTEGER NOT NULL DEFAULT 1,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProjectScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_regNo_key" ON "User"("regNo");

-- CreateIndex
CREATE UNIQUE INDEX "Team_groupCode_key" ON "Team"("groupCode");

-- CreateIndex
CREATE UNIQUE INDEX "Project_problemId_key" ON "Project"("problemId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSkill_userId_skillName_key" ON "UserSkill"("userId", "skillName");

-- CreateIndex
CREATE UNIQUE INDEX "GroupRanking_teamId_key" ON "GroupRanking"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "GithubRepository_projectId_key" ON "GithubRepository"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "GithubRepository_owner_repository_key" ON "GithubRepository"("owner", "repository");

-- CreateIndex
CREATE UNIQUE INDEX "GithubContributor_repositoryId_username_key" ON "GithubContributor"("repositoryId", "username");

-- CreateIndex
CREATE INDEX "GithubCommit_repositoryId_date_idx" ON "GithubCommit"("repositoryId", "date");

-- CreateIndex
CREATE INDEX "GithubCommit_linkedUserId_date_idx" ON "GithubCommit"("linkedUserId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "GithubCommit_repositoryId_sha_key" ON "GithubCommit"("repositoryId", "sha");

-- CreateIndex
CREATE INDEX "GithubSnapshot_repositoryId_capturedAt_idx" ON "GithubSnapshot"("repositoryId", "capturedAt");

-- CreateIndex
CREATE INDEX "GithubRepositoryLanguage_repositoryId_idx" ON "GithubRepositoryLanguage"("repositoryId");

-- CreateIndex
CREATE UNIQUE INDEX "GithubRepositoryLanguage_repositoryId_language_key" ON "GithubRepositoryLanguage"("repositoryId", "language");

-- CreateIndex
CREATE INDEX "GithubRepositoryLabel_repositoryId_idx" ON "GithubRepositoryLabel"("repositoryId");

-- CreateIndex
CREATE UNIQUE INDEX "GithubRepositoryLabel_repositoryId_name_key" ON "GithubRepositoryLabel"("repositoryId", "name");

-- CreateIndex
CREATE INDEX "GithubRepositoryMilestone_repositoryId_idx" ON "GithubRepositoryMilestone"("repositoryId");

-- CreateIndex
CREATE UNIQUE INDEX "GithubRepositoryMilestone_repositoryId_title_key" ON "GithubRepositoryMilestone"("repositoryId", "title");

-- CreateIndex
CREATE UNIQUE INDEX "GithubRepoStructure_repositoryId_key" ON "GithubRepoStructure"("repositoryId");

-- CreateIndex
CREATE INDEX "ProjectUseCase_projectId_order_idx" ON "ProjectUseCase"("projectId", "order");

-- CreateIndex
CREATE INDEX "ProjectDeliverable_projectId_order_idx" ON "ProjectDeliverable"("projectId", "order");

-- CreateIndex
CREATE INDEX "ProjectExpectedMetric_projectId_idx" ON "ProjectExpectedMetric"("projectId");

-- CreateIndex
CREATE INDEX "ProjectCatalogPhase_projectId_week_idx" ON "ProjectCatalogPhase"("projectId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTypeSpecific_projectId_key" ON "ProjectTypeSpecific"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectLog_projectId_key" ON "ProjectLog"("projectId");

-- CreateIndex
CREATE INDEX "ProjectLogEvent_logId_type_idx" ON "ProjectLogEvent"("logId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectLogEvent_logId_seq_key" ON "ProjectLogEvent"("logId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectLogDuration_logId_key" ON "ProjectLogDuration"("logId");

-- CreateIndex
CREATE INDEX "ProjectLogDurationHistory_logId_idx" ON "ProjectLogDurationHistory"("logId");

-- CreateIndex
CREATE INDEX "ProjectLogMember_logId_idx" ON "ProjectLogMember"("logId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectLogMember_logId_userId_key" ON "ProjectLogMember"("logId", "userId");

-- CreateIndex
CREATE INDEX "ProjectLogMemberResponsibility_memberId_idx" ON "ProjectLogMemberResponsibility"("memberId");

-- CreateIndex
CREATE INDEX "ProjectLogTechnology_logId_idx" ON "ProjectLogTechnology"("logId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectLogTechnology_logId_name_key" ON "ProjectLogTechnology"("logId", "name");

-- CreateIndex
CREATE INDEX "ProjectLogWorkPackage_logId_idx" ON "ProjectLogWorkPackage"("logId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectLogWorkPackage_logId_slug_key" ON "ProjectLogWorkPackage"("logId", "slug");

-- CreateIndex
CREATE INDEX "ProjectLogMilestone_logId_idx" ON "ProjectLogMilestone"("logId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectLogMilestone_logId_milestoneId_key" ON "ProjectLogMilestone"("logId", "milestoneId");

-- CreateIndex
CREATE INDEX "ProjectLogMilestoneHistory_milestoneId_idx" ON "ProjectLogMilestoneHistory"("milestoneId");

-- CreateIndex
CREATE INDEX "ProjectLogSkill_logId_idx" ON "ProjectLogSkill"("logId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectLogSkill_logId_skill_key" ON "ProjectLogSkill"("logId", "skill");

-- CreateIndex
CREATE INDEX "ProjectLogSkillGap_logId_idx" ON "ProjectLogSkillGap"("logId");

-- CreateIndex
CREATE INDEX "ProjectLogFlag_logId_idx" ON "ProjectLogFlag"("logId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectLogFlag_logId_flagId_key" ON "ProjectLogFlag"("logId", "flagId");

-- CreateIndex
CREATE INDEX "ProjectLogEvaluationRef_logId_idx" ON "ProjectLogEvaluationRef"("logId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectLogEvaluationRef_logId_cycle_key" ON "ProjectLogEvaluationRef"("logId", "cycle");

-- CreateIndex
CREATE INDEX "ProjectLogEventField_eventId_key_idx" ON "ProjectLogEventField"("eventId", "key");

-- CreateIndex
CREATE INDEX "DailyWorkLog_projectId_date_idx" ON "DailyWorkLog"("projectId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyWorkLog_projectId_userId_date_key" ON "DailyWorkLog"("projectId", "userId", "date");

-- CreateIndex
CREATE INDEX "EvidenceUrl_ownerType_ownerId_idx" ON "EvidenceUrl"("ownerType", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionDocument_projectId_version_key" ON "ExecutionDocument"("projectId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionDocOverview_executionDocumentId_key" ON "ExecutionDocOverview"("executionDocumentId");

-- CreateIndex
CREATE INDEX "ExecutionDocObjective_executionDocumentId_order_idx" ON "ExecutionDocObjective"("executionDocumentId", "order");

-- CreateIndex
CREATE INDEX "ExecutionDocDeliverable_executionDocumentId_order_idx" ON "ExecutionDocDeliverable"("executionDocumentId", "order");

-- CreateIndex
CREATE INDEX "ExecutionDocRisk_executionDocumentId_order_idx" ON "ExecutionDocRisk"("executionDocumentId", "order");

-- CreateIndex
CREATE INDEX "ExecutionDocSuccessCriteria_executionDocumentId_order_idx" ON "ExecutionDocSuccessCriteria"("executionDocumentId", "order");

-- CreateIndex
CREATE INDEX "ExecutionDocSkillRequired_executionDocumentId_order_idx" ON "ExecutionDocSkillRequired"("executionDocumentId", "order");

-- CreateIndex
CREATE INDEX "ExecutionDocWorkPackage_executionDocumentId_order_idx" ON "ExecutionDocWorkPackage"("executionDocumentId", "order");

-- CreateIndex
CREATE INDEX "ExecutionDocMilestone_executionDocumentId_order_idx" ON "ExecutionDocMilestone"("executionDocumentId", "order");

-- CreateIndex
CREATE INDEX "ExecutionDocLearningResource_executionDocumentId_order_idx" ON "ExecutionDocLearningResource"("executionDocumentId", "order");

-- CreateIndex
CREATE INDEX "ExecutionDocFeature_executionDocumentId_order_idx" ON "ExecutionDocFeature"("executionDocumentId", "order");

-- CreateIndex
CREATE INDEX "ExecutionDocTeamShare_executionDocumentId_order_idx" ON "ExecutionDocTeamShare"("executionDocumentId", "order");

-- CreateIndex
CREATE INDEX "EvaluationReport_overallScore_idx" ON "EvaluationReport"("overallScore");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationReport_projectId_cycle_key" ON "EvaluationReport"("projectId", "cycle");

-- CreateIndex
CREATE INDEX "EvaluationCategoryScore_reportId_idx" ON "EvaluationCategoryScore"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationCategoryScore_reportId_category_key" ON "EvaluationCategoryScore"("reportId", "category");

-- CreateIndex
CREATE INDEX "EvaluationMemberScore_reportId_idx" ON "EvaluationMemberScore"("reportId");

-- CreateIndex
CREATE INDEX "EvaluationMemberScore_userId_idx" ON "EvaluationMemberScore"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationMemberScore_reportId_userId_key" ON "EvaluationMemberScore"("reportId", "userId");

-- CreateIndex
CREATE INDEX "EvaluationFinding_reportId_kind_idx" ON "EvaluationFinding"("reportId", "kind");

-- CreateIndex
CREATE INDEX "EvaluationEvidence_reportId_category_idx" ON "EvaluationEvidence"("reportId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalScore_proposalId_key" ON "ProposalScore"("proposalId");

-- CreateIndex
CREATE INDEX "ProposalRubricScore_scoreId_family_idx" ON "ProposalRubricScore"("scoreId", "family");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalExtraction_proposalId_key" ON "ProposalExtraction"("proposalId");

-- CreateIndex
CREATE INDEX "ProposalExtractionItem_extractionId_kind_idx" ON "ProposalExtractionItem"("extractionId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectOverlapFlag_clusterHash_key" ON "ProjectOverlapFlag"("clusterHash");

-- CreateIndex
CREATE INDEX "ProjectOverlapFlag_status_idx" ON "ProjectOverlapFlag"("status");

-- CreateIndex
CREATE INDEX "ProjectOverlapFlag_domain_status_idx" ON "ProjectOverlapFlag"("domain", "status");

-- CreateIndex
CREATE INDEX "ProjectOverlapMember_projectId_idx" ON "ProjectOverlapMember"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectOverlapMember_flagId_projectId_key" ON "ProjectOverlapMember"("flagId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "StandoutProject_projectId_key" ON "StandoutProject"("projectId");

-- CreateIndex
CREATE INDEX "StandoutProject_verdict_status_idx" ON "StandoutProject"("verdict", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityRecommendation_projectId_key" ON "OpportunityRecommendation"("projectId");

-- CreateIndex
CREATE INDEX "OpportunityRecommendation_status_idx" ON "OpportunityRecommendation"("status");

-- CreateIndex
CREATE INDEX "OpportunityRecommendation_opportunityScore_idx" ON "OpportunityRecommendation"("opportunityScore");

-- CreateIndex
CREATE INDEX "OpportunityRecommendationItem_recommendationId_idx" ON "OpportunityRecommendationItem"("recommendationId");

-- CreateIndex
CREATE INDEX "ProjectFeature_projectId_status_idx" ON "ProjectFeature"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPhase_projectId_phaseNumber_key" ON "ProjectPhase"("projectId", "phaseNumber");

-- CreateIndex
CREATE INDEX "PhaseSubmission_phaseId_status_idx" ON "PhaseSubmission"("phaseId", "status");

-- CreateIndex
CREATE INDEX "RewardTransaction_userId_idx" ON "RewardTransaction"("userId");

-- CreateIndex
CREATE INDEX "RewardTransaction_projectId_idx" ON "RewardTransaction"("projectId");

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

-- CreateIndex
CREATE INDEX "UserAIProvider_userId_idx" ON "UserAIProvider"("userId");

-- CreateIndex
CREATE INDEX "UserAIProvider_provider_idx" ON "UserAIProvider"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "UserAIProvider_userId_provider_key" ON "UserAIProvider"("userId", "provider");

-- CreateIndex
CREATE INDEX "AIUsageLog_userId_createdAt_idx" ON "AIUsageLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AIUsageLog_provider_createdAt_idx" ON "AIUsageLog"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "SystemLog_source_createdAt_idx" ON "SystemLog"("source", "createdAt");

-- CreateIndex
CREATE INDEX "SystemLog_level_createdAt_idx" ON "SystemLog"("level", "createdAt");

-- CreateIndex
CREATE INDEX "SystemLog_userId_createdAt_idx" ON "SystemLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RequestLog_createdAt_idx" ON "RequestLog"("createdAt");

-- CreateIndex
CREATE INDEX "RequestLog_path_createdAt_idx" ON "RequestLog"("path", "createdAt");

-- CreateIndex
CREATE INDEX "RequestLog_statusCode_createdAt_idx" ON "RequestLog"("statusCode", "createdAt");

-- CreateIndex
CREATE INDEX "SystemMetricSnapshot_createdAt_idx" ON "SystemMetricSnapshot"("createdAt");

-- CreateIndex
CREATE INDEX "SystemMetricSnapshot_instance_createdAt_idx" ON "SystemMetricSnapshot"("instance", "createdAt");

-- CreateIndex
CREATE INDEX "ClientErrorLog_createdAt_idx" ON "ClientErrorLog"("createdAt");

-- CreateIndex
CREATE INDEX "StudentCycleScore10_regNo_cycle_idx" ON "StudentCycleScore10"("regNo", "cycle");

-- CreateIndex
CREATE INDEX "StudentCycleScore10_projectId_cycle_idx" ON "StudentCycleScore10"("projectId", "cycle");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCycleScore10_userId_projectId_cycle_key" ON "StudentCycleScore10"("userId", "projectId", "cycle");

-- CreateIndex
CREATE INDEX "TeamCycleScore10_teamId_cycle_idx" ON "TeamCycleScore10"("teamId", "cycle");

-- CreateIndex
CREATE UNIQUE INDEX "TeamCycleScore10_teamId_projectId_cycle_key" ON "TeamCycleScore10"("teamId", "projectId", "cycle");

-- CreateIndex
CREATE INDEX "ProjectCycleScore10_projectId_cycle_idx" ON "ProjectCycleScore10"("projectId", "cycle");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCycleScore10_projectId_cycle_key" ON "ProjectCycleScore10"("projectId", "cycle");

-- CreateIndex
CREATE INDEX "CapstoneProblemStatement_organizationId_isActive_idx" ON "CapstoneProblemStatement"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "CapstoneSelection_userId_status_idx" ON "CapstoneSelection"("userId", "status");

-- CreateIndex
CREATE INDEX "CapstoneSelection_projectId_idx" ON "CapstoneSelection"("projectId");

-- CreateIndex
CREATE INDEX "CapstoneSelection_dueAt_idx" ON "CapstoneSelection"("dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "CapstoneSelection_userId_projectId_key" ON "CapstoneSelection"("userId", "projectId");

-- CreateIndex
CREATE INDEX "CapstoneMcqQuestion_selectionId_idx" ON "CapstoneMcqQuestion"("selectionId");

-- CreateIndex
CREATE INDEX "CapstoneMcqAnswer_selectionId_idx" ON "CapstoneMcqAnswer"("selectionId");

-- CreateIndex
CREATE INDEX "StudentProjectScore_email_idx" ON "StudentProjectScore"("email");

-- CreateIndex
CREATE INDEX "StudentProjectScore_regNo_idx" ON "StudentProjectScore"("regNo");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProjectScore_userId_projectId_key" ON "StudentProjectScore"("userId", "projectId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamCollaboration" ADD CONSTRAINT "TeamCollaboration_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamCollaboration" ADD CONSTRAINT "TeamCollaboration_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMessage" ADD CONSTRAINT "TeamMessage_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMessage" ADD CONSTRAINT "TeamMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_collaboratingTeamId_fkey" FOREIGN KEY ("collaboratingTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_parentProjectId_fkey" FOREIGN KEY ("parentProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemStatementProposal" ADD CONSTRAINT "ProblemStatementProposal_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemStatementProposal" ADD CONSTRAINT "ProblemStatementProposal_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemStatementProposal" ADD CONSTRAINT "ProblemStatementProposal_publishedProjectId_fkey" FOREIGN KEY ("publishedProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subtask" ADD CONSTRAINT "Subtask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardColumn" ADD CONSTRAINT "BoardColumn_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Label" ADD CONSTRAINT "Label_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSkill" ADD CONSTRAINT "UserSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRanking" ADD CONSTRAINT "GroupRanking_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAchievement" ADD CONSTRAINT "AdminAchievement_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAchievement" ADD CONSTRAINT "AdminAchievement_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminChatHistory" ADD CONSTRAINT "AdminChatHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStreak" ADD CONSTRAINT "UserStreak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hackathon" ADD CONSTRAINT "Hackathon_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeetCodeContest" ADD CONSTRAINT "LeetCodeContest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectReview" ADD CONSTRAINT "ProjectReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectReview" ADD CONSTRAINT "ProjectReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubRepository" ADD CONSTRAINT "GithubRepository_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubContributor" ADD CONSTRAINT "GithubContributor_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "GithubRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubCommit" ADD CONSTRAINT "GithubCommit_linkedUserId_fkey" FOREIGN KEY ("linkedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubCommit" ADD CONSTRAINT "GithubCommit_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "GithubRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubSnapshot" ADD CONSTRAINT "GithubSnapshot_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "GithubRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubRepositoryLanguage" ADD CONSTRAINT "GithubRepositoryLanguage_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "GithubRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubRepositoryLabel" ADD CONSTRAINT "GithubRepositoryLabel_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "GithubRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubRepositoryMilestone" ADD CONSTRAINT "GithubRepositoryMilestone_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "GithubRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubRepoStructure" ADD CONSTRAINT "GithubRepoStructure_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "GithubRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectUseCase" ADD CONSTRAINT "ProjectUseCase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDeliverable" ADD CONSTRAINT "ProjectDeliverable_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectExpectedMetric" ADD CONSTRAINT "ProjectExpectedMetric_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCatalogPhase" ADD CONSTRAINT "ProjectCatalogPhase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTypeSpecific" ADD CONSTRAINT "ProjectTypeSpecific_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLog" ADD CONSTRAINT "ProjectLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLogEvent" ADD CONSTRAINT "ProjectLogEvent_logId_fkey" FOREIGN KEY ("logId") REFERENCES "ProjectLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLogDuration" ADD CONSTRAINT "ProjectLogDuration_logId_fkey" FOREIGN KEY ("logId") REFERENCES "ProjectLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLogDurationHistory" ADD CONSTRAINT "ProjectLogDurationHistory_logId_fkey" FOREIGN KEY ("logId") REFERENCES "ProjectLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLogMember" ADD CONSTRAINT "ProjectLogMember_logId_fkey" FOREIGN KEY ("logId") REFERENCES "ProjectLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLogMemberResponsibility" ADD CONSTRAINT "ProjectLogMemberResponsibility_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "ProjectLogMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLogTechnology" ADD CONSTRAINT "ProjectLogTechnology_logId_fkey" FOREIGN KEY ("logId") REFERENCES "ProjectLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLogWorkPackage" ADD CONSTRAINT "ProjectLogWorkPackage_logId_fkey" FOREIGN KEY ("logId") REFERENCES "ProjectLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLogMilestone" ADD CONSTRAINT "ProjectLogMilestone_logId_fkey" FOREIGN KEY ("logId") REFERENCES "ProjectLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLogMilestoneHistory" ADD CONSTRAINT "ProjectLogMilestoneHistory_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "ProjectLogMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLogSkill" ADD CONSTRAINT "ProjectLogSkill_logId_fkey" FOREIGN KEY ("logId") REFERENCES "ProjectLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLogSkillGap" ADD CONSTRAINT "ProjectLogSkillGap_logId_fkey" FOREIGN KEY ("logId") REFERENCES "ProjectLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLogFlag" ADD CONSTRAINT "ProjectLogFlag_logId_fkey" FOREIGN KEY ("logId") REFERENCES "ProjectLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLogEvaluationRef" ADD CONSTRAINT "ProjectLogEvaluationRef_logId_fkey" FOREIGN KEY ("logId") REFERENCES "ProjectLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLogEventField" ADD CONSTRAINT "ProjectLogEventField_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ProjectLogEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyWorkLog" ADD CONSTRAINT "DailyWorkLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyWorkLog" ADD CONSTRAINT "DailyWorkLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionDocument" ADD CONSTRAINT "ExecutionDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionDocOverview" ADD CONSTRAINT "ExecutionDocOverview_executionDocumentId_fkey" FOREIGN KEY ("executionDocumentId") REFERENCES "ExecutionDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionDocObjective" ADD CONSTRAINT "ExecutionDocObjective_executionDocumentId_fkey" FOREIGN KEY ("executionDocumentId") REFERENCES "ExecutionDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionDocDeliverable" ADD CONSTRAINT "ExecutionDocDeliverable_executionDocumentId_fkey" FOREIGN KEY ("executionDocumentId") REFERENCES "ExecutionDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionDocRisk" ADD CONSTRAINT "ExecutionDocRisk_executionDocumentId_fkey" FOREIGN KEY ("executionDocumentId") REFERENCES "ExecutionDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionDocSuccessCriteria" ADD CONSTRAINT "ExecutionDocSuccessCriteria_executionDocumentId_fkey" FOREIGN KEY ("executionDocumentId") REFERENCES "ExecutionDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionDocSkillRequired" ADD CONSTRAINT "ExecutionDocSkillRequired_executionDocumentId_fkey" FOREIGN KEY ("executionDocumentId") REFERENCES "ExecutionDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionDocWorkPackage" ADD CONSTRAINT "ExecutionDocWorkPackage_executionDocumentId_fkey" FOREIGN KEY ("executionDocumentId") REFERENCES "ExecutionDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionDocMilestone" ADD CONSTRAINT "ExecutionDocMilestone_executionDocumentId_fkey" FOREIGN KEY ("executionDocumentId") REFERENCES "ExecutionDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionDocLearningResource" ADD CONSTRAINT "ExecutionDocLearningResource_executionDocumentId_fkey" FOREIGN KEY ("executionDocumentId") REFERENCES "ExecutionDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionDocFeature" ADD CONSTRAINT "ExecutionDocFeature_executionDocumentId_fkey" FOREIGN KEY ("executionDocumentId") REFERENCES "ExecutionDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionDocTeamShare" ADD CONSTRAINT "ExecutionDocTeamShare_executionDocumentId_fkey" FOREIGN KEY ("executionDocumentId") REFERENCES "ExecutionDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationReport" ADD CONSTRAINT "EvaluationReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationCategoryScore" ADD CONSTRAINT "EvaluationCategoryScore_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EvaluationReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationMemberScore" ADD CONSTRAINT "EvaluationMemberScore_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EvaluationReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationMemberScore" ADD CONSTRAINT "EvaluationMemberScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationFinding" ADD CONSTRAINT "EvaluationFinding_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EvaluationReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationEvidence" ADD CONSTRAINT "EvaluationEvidence_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EvaluationReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalScore" ADD CONSTRAINT "ProposalScore_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ProblemStatementProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalRubricScore" ADD CONSTRAINT "ProposalRubricScore_scoreId_fkey" FOREIGN KEY ("scoreId") REFERENCES "ProposalScore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalExtraction" ADD CONSTRAINT "ProposalExtraction_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ProblemStatementProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalExtractionItem" ADD CONSTRAINT "ProposalExtractionItem_extractionId_fkey" FOREIGN KEY ("extractionId") REFERENCES "ProposalExtraction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectOverlapFlag" ADD CONSTRAINT "ProjectOverlapFlag_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectOverlapMember" ADD CONSTRAINT "ProjectOverlapMember_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "ProjectOverlapFlag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectOverlapMember" ADD CONSTRAINT "ProjectOverlapMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandoutProject" ADD CONSTRAINT "StandoutProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandoutProject" ADD CONSTRAINT "StandoutProject_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityRecommendation" ADD CONSTRAINT "OpportunityRecommendation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityRecommendation" ADD CONSTRAINT "OpportunityRecommendation_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityRecommendationItem" ADD CONSTRAINT "OpportunityRecommendationItem_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "OpportunityRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFeature" ADD CONSTRAINT "ProjectFeature_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPhase" ADD CONSTRAINT "ProjectPhase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseSubmission" ADD CONSTRAINT "PhaseSubmission_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseSubmission" ADD CONSTRAINT "PhaseSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseSubmission" ADD CONSTRAINT "PhaseSubmission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardTransaction" ADD CONSTRAINT "RewardTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "UserAIProvider" ADD CONSTRAINT "UserAIProvider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsageLog" ADD CONSTRAINT "AIUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCycleScore10" ADD CONSTRAINT "StudentCycleScore10_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCycleScore10" ADD CONSTRAINT "StudentCycleScore10_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCycleScore10" ADD CONSTRAINT "StudentCycleScore10_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCycleScore10" ADD CONSTRAINT "StudentCycleScore10_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EvaluationReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamCycleScore10" ADD CONSTRAINT "TeamCycleScore10_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamCycleScore10" ADD CONSTRAINT "TeamCycleScore10_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamCycleScore10" ADD CONSTRAINT "TeamCycleScore10_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EvaluationReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCycleScore10" ADD CONSTRAINT "ProjectCycleScore10_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCycleScore10" ADD CONSTRAINT "ProjectCycleScore10_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "EvaluationReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapstoneProblemStatement" ADD CONSTRAINT "CapstoneProblemStatement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapstoneSelection" ADD CONSTRAINT "CapstoneSelection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapstoneSelection" ADD CONSTRAINT "CapstoneSelection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapstoneSelection" ADD CONSTRAINT "CapstoneSelection_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "CapstoneProblemStatement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapstoneMcqQuestion" ADD CONSTRAINT "CapstoneMcqQuestion_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "CapstoneSelection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapstoneMcqAnswer" ADD CONSTRAINT "CapstoneMcqAnswer_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "CapstoneSelection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProjectScore" ADD CONSTRAINT "StudentProjectScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProjectScore" ADD CONSTRAINT "StudentProjectScore_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

