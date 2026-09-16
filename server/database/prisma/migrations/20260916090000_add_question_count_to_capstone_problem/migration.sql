-- AlterTable CapstoneProblemStatement
ALTER TABLE "CapstoneProblemStatement" ADD COLUMN IF NOT EXISTS "questionCount" INTEGER NOT NULL DEFAULT 15;
