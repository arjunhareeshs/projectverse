import { StatusCodes } from 'http-status-codes';
import { prisma } from '../../shared/database';
import { logger } from '../../shared/logger';
import { chatJSON, ChatMessage } from '../ai/llm.service';
import { analyzeCapstoneRepository } from './capstone.githubAnalysis';
import {
  MCQ_SYSTEM_PROMPT,
  buildMcqUserPrompt,
  generateFallbackMcqs,
  McqPayloadSchema,
  GeneratedMcqQuestion,
} from './capstone.mcqPrompt';

export class CapstoneServiceError extends Error {
  constructor(message: string, public statusCode: number = StatusCodes.BAD_REQUEST) {
    super(message);
  }
}

export const capstoneService = {
  /**
   * Retrieves capstone problem statements.
   * Regular users receive active ones; admins can view all.
   */
  async getProblems(filters: { domain?: string; difficulty?: string }, isAdmin = false) {
    const where: any = {};
    if (!isAdmin) {
      where.isActive = true;
    }
    if (filters.domain && filters.domain !== 'all') {
      where.domain = filters.domain;
    }
    if (filters.difficulty && filters.difficulty !== 'all') {
      where.difficulty = filters.difficulty;
    }

    const problems = await prisma.capstoneProblemStatement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        selections: {
          select: {
            id: true,
            status: true,
            mcqScore: true,
          },
        },
      },
    });

    return problems.map((p) => {
      const selectionsCount = p.selections.length;
      const submittedCount = p.selections.filter((s) =>
        ['SUBMITTED', 'MCQ_READY', 'COMPLETED'].includes(s.status)
      ).length;
      const completedSelections = p.selections.filter((s) => s.status === 'COMPLETED' && s.mcqScore !== null);
      const completedCount = completedSelections.length;

      const avgScore =
        completedCount > 0
          ? Number(
              (
                completedSelections.reduce((acc, s) => acc + (s.mcqScore || 0), 0) /
                completedCount
              ).toFixed(1)
            )
          : null;

      const { selections, ...rest } = p;
      return {
        ...rest,
        stats: {
          selectionsCount,
          submittedCount,
          completedCount,
          avgScore,
        },
      };
    });
  },

  /**
   * Admin creates a new capstone problem statement.
   */
  async createProblem(
    data: {
      title: string;
      problemText: string;
      domain?: string;
      difficulty?: string;
      technologies?: string[];
      isActive?: boolean;
      questionCount?: number;
    },
    adminUserId: string,
    organizationId?: string
  ) {
    if (!data.title?.trim() || !data.problemText?.trim()) {
      throw new CapstoneServiceError('Title and problem statement text are required');
    }

    // Resolve organization
    let orgId = organizationId;
    if (!orgId) {
      const admin = await prisma.user.findUnique({
        where: { id: adminUserId },
        select: { organizationId: true },
      });
      orgId = admin?.organizationId ?? undefined;
    }

    if (!orgId) {
      const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
      orgId = firstOrg?.id;
    }

    if (!orgId) {
      throw new CapstoneServiceError('No valid organization found to associate problem statement');
    }

    return prisma.capstoneProblemStatement.create({
      data: {
        organizationId: orgId,
        title: data.title.trim(),
        problemText: data.problemText.trim(),
        domain: data.domain || null,
        difficulty: data.difficulty || 'Medium',
        technologies: data.technologies || [],
        isActive: data.isActive ?? true,
        questionCount: data.questionCount !== undefined && data.questionCount > 0 ? Number(data.questionCount) : 15,
        createdById: adminUserId,
      },
    });
  },

  /**
   * Admin updates an existing capstone problem statement.
   */
  async updateProblem(
    id: string,
    data: {
      title?: string;
      problemText?: string;
      domain?: string;
      difficulty?: string;
      technologies?: string[];
      isActive?: boolean;
      questionCount?: number;
    }
  ) {
    const existing = await prisma.capstoneProblemStatement.findUnique({ where: { id } });
    if (!existing) {
      throw new CapstoneServiceError('Capstone problem statement not found', StatusCodes.NOT_FOUND);
    }

    return prisma.capstoneProblemStatement.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.problemText !== undefined ? { problemText: data.problemText.trim() } : {}),
        ...(data.domain !== undefined ? { domain: data.domain } : {}),
        ...(data.difficulty !== undefined ? { difficulty: data.difficulty } : {}),
        ...(data.technologies !== undefined ? { technologies: data.technologies } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.questionCount !== undefined && data.questionCount > 0
          ? { questionCount: Number(data.questionCount) }
          : {}),
      },
    });
  },

  /**
   * Admin deletes a capstone problem statement.
   * If selections exist, soft-deletes by deactivating; otherwise deletes row.
   */
  async deleteProblem(id: string) {
    const existing = await prisma.capstoneProblemStatement.findUnique({
      where: { id },
      include: { _count: { select: { selections: true } } },
    });

    if (!existing) {
      throw new CapstoneServiceError('Capstone problem statement not found', StatusCodes.NOT_FOUND);
    }

    if (existing._count.selections > 0) {
      return prisma.capstoneProblemStatement.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return prisma.capstoneProblemStatement.delete({ where: { id } });
  },

  /**
   * Student claims a capstone problem statement.
   * Exactly 7 days deadline is assigned.
   */
  async claimProblem(userId: string, problemId: string, approachText?: string) {
    const problem = await prisma.capstoneProblemStatement.findUnique({
      where: { id: problemId },
    });

    if (!problem || !problem.isActive) {
      throw new CapstoneServiceError('Selected capstone problem statement is not available.', StatusCodes.NOT_FOUND);
    }

    // Rule 1: A student cannot claim the same capstone twice
    const existingClaim = await prisma.capstoneSelection.findFirst({
      where: { userId, problemId },
    });
    if (existingClaim) {
      throw new CapstoneServiceError('You have already claimed this capstone project.');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, organizationId: true, teamId: true, fullName: true },
    });

    if (!user) {
      throw new CapstoneServiceError('User not found', StatusCodes.NOT_FOUND);
    }

    const orgId = user.organizationId || problem.organizationId;
    const selectedAt = new Date();
    const dueAt = new Date(selectedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Create Project and CapstoneSelection atomically
    return prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          organizationId: orgId,
          teamId: user.teamId || null,
          name: problem.title,
          problemStatement: problem.problemText,
          description: `Capstone Project based on "${problem.title}".`,
          domain: problem.domain,
          difficultyLevel: problem.difficulty,
          technologies: problem.technologies,
          mode: 'CAPSTONE',
          status: 'in_progress',
          differentiationApproach: approachText?.trim() || null,
          members: {
            create: {
              userId: user.id,
              role: 'ADMIN',
            },
          },
        },
      });

      const selection = await tx.capstoneSelection.create({
        data: {
          userId,
          projectId: project.id,
          problemId: problem.id,
          selectedAt,
          dueAt,
          status: 'CLAIMED',
          totalQuestions: problem.questionCount || 15,
        },
      });

      return {
        selection,
        project,
      };
    });
  },

  /**
   * Retrieves all capstone selections for the current student.
   */
  async getMySelections(userId: string) {
    return prisma.capstoneSelection.findMany({
      where: { userId },
      include: {
        problem: true,
        project: {
          select: {
            id: true,
            name: true,
            domain: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Retrieves capstone project details and metrics for a specific project.
   * Includes problem statement, days balance, submission info, and MCQ status.
   */
  async getCapstoneByProjectId(projectId: string, userId: string, isAdmin = false) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        capstoneSelections: {
          include: {
            problem: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!project) {
      throw new CapstoneServiceError('Project not found', StatusCodes.NOT_FOUND);
    }

    if (project.mode !== 'CAPSTONE') {
      return null;
    }

    let selection = project.capstoneSelections.find((s) => s.userId === userId);
    if (!selection && isAdmin && project.capstoneSelections.length > 0) {
      selection = project.capstoneSelections[0];
    }

    if (!selection) {
      const member = await prisma.projectMember.findFirst({
        where: { projectId, userId },
      });
      if (member && project.capstoneSelections.length > 0) {
        selection = project.capstoneSelections[0];
      }
    }

    if (!selection) {
      // If user claimed it or project was just created as capstone
      if (project.capstoneSelections.length > 0) {
        selection = project.capstoneSelections[0];
      } else {
        throw new CapstoneServiceError('Capstone selection not found for this project', StatusCodes.NOT_FOUND);
      }
    }

    const now = new Date();
    const dueAt = new Date(selection.dueAt);
    const selectedAt = new Date(selection.selectedAt);
    const diffMs = dueAt.getTime() - now.getTime();
    const daysBalance = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const totalDays = 7;
    const elapsedDays = Math.min(totalDays, Math.max(0, Math.floor((now.getTime() - selectedAt.getTime()) / (1000 * 60 * 60 * 24))));
    const isSubmissionWindowOpen = now.getTime() >= dueAt.getTime();

    return {
      isCapstone: true,
      project: {
        id: project.id,
        name: project.name,
        problemStatement: project.problemStatement,
        description: project.description,
        domain: project.domain,
        difficultyLevel: project.difficultyLevel,
        technologies: project.technologies,
        mode: project.mode,
        status: project.status,
        differentiationApproach: project.differentiationApproach,
        createdAt: project.createdAt,
      },
      selection: {
        id: selection.id,
        userId: selection.userId,
        status: selection.status,
        selectedAt: selection.selectedAt,
        dueAt: selection.dueAt,
        submittedAt: selection.submittedAt,
        githubUrl: selection.githubUrl,
        mcqScore: selection.mcqScore,
        totalQuestions: selection.totalQuestions,
        completedAt: selection.completedAt,
        githubAnalysis: selection.githubAnalysis,
      },
      problem: selection.problem || {
        id: '',
        title: project.name,
        problemText: project.problemStatement || project.description,
        domain: project.domain,
        difficulty: project.difficultyLevel,
        technologies: project.technologies,
        questionCount: selection.totalQuestions || 15,
      },
      metrics: {
        daysBalance,
        elapsedDays,
        totalDays,
        isSubmissionWindowOpen,
      },
    };
  },

  /**
   * Student submits their GitHub URL after 7 days.
   * Runs deep code analysis and generates configured MCQs with 6 options.
   */
  async submitGithub(selectionId: string, userId: string, githubUrl: string, isDevBypass = false) {
    const selection = await prisma.capstoneSelection.findUnique({
      where: { id: selectionId },
      include: {
        problem: true,
        project: true,
      },
    });

    if (!selection) {
      throw new CapstoneServiceError('Capstone project selection not found', StatusCodes.NOT_FOUND);
    }

    if (selection.userId !== userId) {
      throw new CapstoneServiceError('Unauthorized to submit for this project', StatusCodes.FORBIDDEN);
    }

    if (selection.status === 'COMPLETED') {
      throw new CapstoneServiceError('This capstone assessment is already completed.');
    }

    // Rule 2 & Flow 7: Submission is accessible after 7 days
    const isDue = new Date().getTime() >= new Date(selection.dueAt).getTime();
    if (!isDue && !isDevBypass) {
      throw new CapstoneServiceError(
        'GitHub repository submission is only available after the 7-day development window.'
      );
    }

    // Target question count configured by admin (fallback to 15)
    const targetCount = selection.totalQuestions || selection.problem?.questionCount || 15;

    // 1. Run deep code analysis from GitHub
    logger.info('Starting deep code analysis for capstone submission', { selectionId, githubUrl, targetCount });
    const repoSummary = await analyzeCapstoneRepository(githubUrl);

    // 2. Generate exactly targetCount MCQs (6 options each)
    let generatedQuestions: GeneratedMcqQuestion[] = [];
    const problemText = selection.problem?.problemText || selection.project.problemStatement || selection.project.name;

    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: MCQ_SYSTEM_PROMPT },
        { role: 'user', content: buildMcqUserPrompt(problemText, repoSummary, targetCount) },
      ];

      const llmResult = await chatJSON<{ questions: GeneratedMcqQuestion[] }>(
        messages,
        { questions: [] },
        { feature: 'capstone_mcq_generation', maxTokens: 4000, userId }
      );

      if (llmResult?.questions && Array.isArray(llmResult.questions) && llmResult.questions.length >= Math.min(5, targetCount)) {
        // Sanitize options count to exactly 6
        generatedQuestions = llmResult.questions.slice(0, targetCount).map((q, idx) => {
          let opts = Array.isArray(q.options) ? q.options.filter(Boolean) : [];
          while (opts.length < 6) {
            opts.push(`Alternative technical implementation approach ${opts.length + 1}`);
          }
          if (opts.length > 6) {
            opts = opts.slice(0, 6);
          }
          let correct = Number.isInteger(q.correctOption) ? q.correctOption : 0;
          if (correct < 0 || correct > 5) correct = idx % 6;

          return {
            question: q.question,
            options: opts,
            correctOption: correct,
            topic: q.topic || 'Implementation',
            difficulty: q.difficulty || 'medium',
            explanation: q.explanation || '',
          };
        });
      }
    } catch (llmErr) {
      logger.warn('LLM MCQ generation failed, falling back to deterministic generator', { error: String(llmErr) });
    }

    // If LLM returned empty or failed, use high-fidelity fallback generator
    if (generatedQuestions.length < targetCount) {
      logger.info('Using framework-aware deterministic MCQ generator for capstone', { selectionId, targetCount });
      generatedQuestions = generateFallbackMcqs(problemText, repoSummary, targetCount);
    }

    // Persist questions and update selection
    await prisma.$transaction(async (tx) => {
      // Clear previous questions if any retry
      await tx.capstoneMcqQuestion.deleteMany({ where: { selectionId } });

      for (const q of generatedQuestions) {
        await tx.capstoneMcqQuestion.create({
          data: {
            selectionId,
            question: q.question,
            options: q.options,
            correctOption: q.correctOption,
            explanation: q.explanation,
            difficulty: q.difficulty,
            topic: q.topic,
          },
        });
      }

      await tx.capstoneSelection.update({
        where: { id: selectionId },
        data: {
          githubUrl,
          submittedAt: new Date(),
          status: 'MCQ_READY',
          totalQuestions: generatedQuestions.length,
          githubAnalysis: {
            owner: repoSummary.owner,
            repo: repoSummary.repo,
            defaultBranch: repoSummary.defaultBranch,
            framework: repoSummary.framework,
            languages: repoSummary.languages,
            architecture: repoSummary.architecture,
            totalFilesCount: repoSummary.totalFilesCount,
          } as any,
          codeAnalysis: repoSummary as any,
        },
      });
    });

    return {
      success: true,
      status: 'MCQ_READY',
      questionsCount: generatedQuestions.length,
    };
  },

  /**
   * Retrieves the 15 MCQs for the student to answer.
   * CRITICAL: Strips correctOption and explanation so answers are not exposed in network response.
   */
  async getMcqQuestions(selectionId: string, userId: string) {
    const selection = await prisma.capstoneSelection.findUnique({
      where: { id: selectionId },
      include: {
        project: { select: { name: true, domain: true } },
      },
    });

    if (!selection) {
      throw new CapstoneServiceError('Selection not found', StatusCodes.NOT_FOUND);
    }

    if (selection.userId !== userId) {
      throw new CapstoneServiceError('Unauthorized', StatusCodes.FORBIDDEN);
    }

    // Rule 3: Cannot attend MCQ before GitHub submission
    if (selection.status !== 'MCQ_READY') {
      if (selection.status === 'COMPLETED') {
        throw new CapstoneServiceError('This assessment has already been completed.');
      }
      throw new CapstoneServiceError('Please submit your GitHub repository before attending the MCQ.');
    }

    const questions = await prisma.capstoneMcqQuestion.findMany({
      where: { selectionId },
      orderBy: { createdAt: 'asc' },
    });

    if (questions.length === 0) {
      throw new CapstoneServiceError('MCQ questions are being prepared. Please try again in a moment.');
    }

    // Strip answers
    const clientQuestions = questions.map((q, index) => ({
      id: q.id,
      index: index + 1,
      question: q.question,
      options: q.options as string[],
      topic: q.topic,
      difficulty: q.difficulty,
    }));

    return {
      selectionId,
      projectName: selection.project.name,
      totalQuestions: clientQuestions.length,
      questions: clientQuestions,
    };
  },

  /**
   * Student submits all 15 answers.
   * Calculates score server-side, saves audit answers, deletes MCQs, updates status to COMPLETED.
   */
  async submitMcqAnswers(
    selectionId: string,
    userId: string,
    answers: { questionId: string; selectedOption: number }[]
  ) {
    const selection = await prisma.capstoneSelection.findUnique({
      where: { id: selectionId },
    });

    if (!selection) {
      throw new CapstoneServiceError('Selection not found', StatusCodes.NOT_FOUND);
    }

    if (selection.userId !== userId) {
      throw new CapstoneServiceError('Unauthorized', StatusCodes.FORBIDDEN);
    }

    // Rule 4: A student cannot submit MCQ twice
    if (selection.status === 'COMPLETED') {
      throw new CapstoneServiceError('Assessment already submitted and completed.');
    }

    const storedQuestions = await prisma.capstoneMcqQuestion.findMany({
      where: { selectionId },
    });

    if (storedQuestions.length === 0) {
      throw new CapstoneServiceError('No questions found for this assessment session.');
    }

    if (answers.length < storedQuestions.length) {
      throw new CapstoneServiceError(`Please answer all ${storedQuestions.length} questions before submitting.`);
    }

    // Score evaluation
    let score = 0;
    const answerRecords: {
      selectionId: string;
      questionText: string;
      selectedOption: number;
      correctOption: number;
      isCorrect: boolean;
    }[] = [];

    const questionMap = new Map(storedQuestions.map((q) => [q.id, q]));

    for (const ans of answers) {
      const q = questionMap.get(ans.questionId);
      if (q) {
        const isCorrect = q.correctOption === ans.selectedOption;
        if (isCorrect) score += 1;
        answerRecords.push({
          selectionId,
          questionText: q.question,
          selectedOption: ans.selectedOption,
          correctOption: q.correctOption,
          isCorrect,
        });
      }
    }

    // Atomically save answers, delete MCQs, update status & score
    await prisma.$transaction(async (tx) => {
      // 1. Save answer audit trail
      for (const rec of answerRecords) {
        await tx.capstoneMcqAnswer.create({ data: rec });
      }

      // 2. Rule 7: Delete the generated MCQs after completion
      await tx.capstoneMcqQuestion.deleteMany({ where: { selectionId } });

      // 3. Rule 8: Store final score in CapstoneSelection and mark COMPLETED
      await tx.capstoneSelection.update({
        where: { id: selectionId },
        data: {
          mcqScore: score,
          totalQuestions: storedQuestions.length,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // 4. Update associated project status to completed
      await tx.project.update({
        where: { id: selection.projectId },
        data: { status: 'completed' },
      });
    });

    return {
      success: true,
      score,
      totalQuestions: storedQuestions.length,
      percentage: Math.round((score / storedQuestions.length) * 100),
      completedAt: new Date(),
    };
  },

  /**
   * Admin dashboard analytics for capstone projects.
   */
  async getAdminStats() {
    const [totalProblems, activeProblems, totalSelections, completedSelections] = await Promise.all([
      prisma.capstoneProblemStatement.count(),
      prisma.capstoneProblemStatement.count({ where: { isActive: true } }),
      prisma.capstoneSelection.count(),
      prisma.capstoneSelection.findMany({
        where: { status: 'COMPLETED', mcqScore: { not: null } },
        select: { mcqScore: true },
      }),
    ]);

    const completedCount = completedSelections.length;
    const avgScore =
      completedCount > 0
        ? Number(
            (
              completedSelections.reduce((acc, s) => acc + (s.mcqScore || 0), 0) /
              completedCount
            ).toFixed(1)
          )
        : 0;

    return {
      totalProblems,
      activeProblems,
      totalSelections,
      completedCount,
      avgScore,
    };
  },
};
