-- CreateEnum
CREATE TYPE "ProjectMode" AS ENUM ('NORMAL', 'CAPSTONE');

-- CreateEnum
CREATE TYPE "CapstoneStatus" AS ENUM ('CLAIMED', 'SUBMITTED', 'MCQ_READY', 'COMPLETED', 'EXPIRED');

-- AlterTable Project
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "mode" "ProjectMode" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "differentiationApproach" TEXT;

-- CreateTable CapstoneProblemStatement
CREATE TABLE IF NOT EXISTS "CapstoneProblemStatement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "problemText" TEXT NOT NULL,
    "domain" TEXT,
    "difficulty" TEXT,
    "technologies" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "questionCount" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "CapstoneProblemStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable CapstoneSelection
CREATE TABLE IF NOT EXISTS "CapstoneSelection" (
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

-- CreateTable CapstoneMcqQuestion
CREATE TABLE IF NOT EXISTS "CapstoneMcqQuestion" (
    "id" TEXT NOT NULL,
    "selectionId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctOption" INTEGER NOT NULL,
    "explanation" TEXT,
    "topic" TEXT,
    "difficulty" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapstoneMcqQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable CapstoneMcqAnswer
CREATE TABLE IF NOT EXISTS "CapstoneMcqAnswer" (
    "id" TEXT NOT NULL,
    "selectionId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "selectedOption" INTEGER NOT NULL,
    "correctOption" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapstoneMcqAnswer_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey CapstoneProblemStatement -> Organization
ALTER TABLE "CapstoneProblemStatement" DROP CONSTRAINT IF EXISTS "CapstoneProblemStatement_organizationId_fkey";
ALTER TABLE "CapstoneProblemStatement" ADD CONSTRAINT "CapstoneProblemStatement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey CapstoneProblemStatement -> User (createdById)
ALTER TABLE "CapstoneProblemStatement" DROP CONSTRAINT IF EXISTS "CapstoneProblemStatement_createdById_fkey";
ALTER TABLE "CapstoneProblemStatement" ADD CONSTRAINT "CapstoneProblemStatement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey CapstoneSelection -> User
ALTER TABLE "CapstoneSelection" DROP CONSTRAINT IF EXISTS "CapstoneSelection_userId_fkey";
ALTER TABLE "CapstoneSelection" ADD CONSTRAINT "CapstoneSelection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey CapstoneSelection -> Project
ALTER TABLE "CapstoneSelection" DROP CONSTRAINT IF EXISTS "CapstoneSelection_projectId_fkey";
ALTER TABLE "CapstoneSelection" ADD CONSTRAINT "CapstoneSelection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey CapstoneSelection -> CapstoneProblemStatement
ALTER TABLE "CapstoneSelection" DROP CONSTRAINT IF EXISTS "CapstoneSelection_problemId_fkey";
ALTER TABLE "CapstoneSelection" ADD CONSTRAINT "CapstoneSelection_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "CapstoneProblemStatement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey CapstoneMcqQuestion -> CapstoneSelection
ALTER TABLE "CapstoneMcqQuestion" DROP CONSTRAINT IF EXISTS "CapstoneMcqQuestion_selectionId_fkey";
ALTER TABLE "CapstoneMcqQuestion" ADD CONSTRAINT "CapstoneMcqQuestion_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "CapstoneSelection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey CapstoneMcqAnswer -> CapstoneSelection
ALTER TABLE "CapstoneMcqAnswer" DROP CONSTRAINT IF EXISTS "CapstoneMcqAnswer_selectionId_fkey";
ALTER TABLE "CapstoneMcqAnswer" ADD CONSTRAINT "CapstoneMcqAnswer_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "CapstoneSelection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
