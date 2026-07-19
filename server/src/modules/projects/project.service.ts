import { prisma } from '../../shared/database';

export const projectService = {
  async getProjects(organizationId: string) {
    const projects = await prisma.project.findMany({
      where: { organizationId },
      include: {
        team: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by domain
    const grouped = projects.reduce((acc: any, proj) => {
      const domain = proj.domain || 'Uncategorized';
      if (!acc[domain]) acc[domain] = [];
      acc[domain].push(proj);
      return acc;
    }, {});

    return grouped;
  },

  async getActiveProjects(organizationId: string) {
    const projects = await prisma.project.findMany({
      where: {
        organizationId,
      },
      include: {
        team: true,
        tasks: true,
        members: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform into the format expected by the Dashboard ActiveProjectsList
    return projects.map((project) => {
      const totalTasks = project.tasks.length;
      const completedTasks = project.tasks.filter((t) => t.status === 'done').length;
      const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

      // Calculate days left: use the earliest open task due date as a proxy
      const openTasksWithDue = project.tasks.filter(
        (t) => t.dueDate && t.status !== 'done' && t.status !== 'completed',
      );
      const earliestDue =
        openTasksWithDue.length > 0
          ? openTasksWithDue.reduce(
              (min, t) => (t.dueDate! < min ? t.dueDate! : min),
              openTasksWithDue[0].dueDate!,
            )
          : null;
      const daysLeft = earliestDue
        ? Math.max(0, Math.ceil((earliestDue.getTime() - Date.now()) / 86_400_000))
        : null;

      return {
        id: project.id,
        name: project.name,
        client: project.description || 'Internal',
        teamSize: project.members.length,
        dueDate: earliestDue
          ? earliestDue.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : 'No due date',
        progress,
        daysLeft,
        status: project.status,
        color: 'bg-primary',
        initials: project.name.substring(0, 2).toUpperCase(),
      };
    });
  },

  async createProject(
    organizationId: string,
    data: {
      name: string;
      description?: string;
      status?: string;
      domain?: string;
      difficultyLevel?: string;
      type?: string;
      problemStatement?: string;
      objective?: string;
      expectedOutcome?: string;
      technologies?: string[];
      requirements?: string;
      innovation?: string;
      teamId?: string | null;
      userId: string;
      teamMembers?: string[];
    },
  ) {
    const project = await prisma.project.create({
      data: {
        organizationId,
        teamId: data.teamId,
        name: data.name,
        description: data.description,
        status: data.status || 'planned',
        domain: data.domain,
        difficultyLevel: data.difficultyLevel,
        type: data.type,
        problemStatement: data.problemStatement,
        objective: data.objective,
        expectedOutcome: data.expectedOutcome,
        technologies: data.technologies || [],
        requirements: data.requirements,
        innovation: data.innovation,
      },
    });

    const membersData = [{ projectId: project.id, userId: data.userId, role: 'ADMIN' as const }];

    if (data.teamMembers && data.teamMembers.length > 0) {
      data.teamMembers.slice(0, 3).forEach((memberId) => {
        membersData.push({ projectId: project.id, userId: memberId, role: 'STUDENT' as const });
      });
    }

    await prisma.projectMember.createMany({
      data: membersData,
    });

    return project;
  },

  async analyzeSimilarity(projectData: any) {
    // In a real implementation, this would call the Python AI service
    // For now, we mock the similarity analysis
    const existingProjects = await prisma.project.findMany({
      select: { id: true, name: true, problemStatement: true, technologies: true },
    });

    // Mock similarity algorithm
    let maxSim = 0;
    let mostSimilar = null;

    for (const proj of existingProjects) {
      let sim = Math.random() * 40; // Random similarity up to 40%
      if (proj.name.toLowerCase().includes(projectData.name.toLowerCase())) sim += 40;
      if (sim > maxSim) {
        maxSim = sim;
        mostSimilar = proj;
      }
    }

    return {
      similarityPercentage: Math.round(maxSim),
      matchingProjects: mostSimilar ? [mostSimilar] : [],
      workflowComparison: 'Analysis of workflows indicates unique approaches.',
      recommendations:
        maxSim > 70
          ? 'High similarity detected. Please modify your workflow to ensure uniqueness.'
          : 'Project is sufficiently unique. Approved for continuation.',
    };
  },

  async addProjectReview(
    projectId: string,
    reviewerId: string,
    data: { status: string; comments?: string; score?: number },
  ) {
    return prisma.projectReview.create({
      data: {
        projectId,
        reviewerId,
        status: data.status,
        comments: data.comments,
        // score is omitted since it doesn't exist in Prisma model
      },
    });
  },

  async getProjectReviews(projectId: string) {
    return prisma.projectReview.findMany({
      where: { projectId },
      include: {
        reviewer: {
          select: { id: true, fullName: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async recommendTechnology(data: {
    domain: string;
    technicalInterests: string[];
    careerGoals: string;
  }) {
    // Mock AI recommendation based on roles/interests
    const recommendations: string[] = [];

    if (data.domain.toLowerCase().includes('web')) {
      recommendations.push('React', 'Node.js', 'Next.js', 'PostgreSQL');
    } else if (
      data.domain.toLowerCase().includes('ai') ||
      data.domain.toLowerCase().includes('data')
    ) {
      recommendations.push('Python', 'TensorFlow', 'PyTorch', 'FastAPI');
    } else if (data.domain.toLowerCase().includes('mobile')) {
      recommendations.push('Flutter', 'React Native', 'Swift', 'Kotlin');
    } else {
      recommendations.push('Docker', 'AWS', 'TypeScript');
    }

    // Mix in interests
    data.technicalInterests.forEach((interest) => {
      if (!recommendations.includes(interest)) {
        recommendations.push(interest);
      }
    });

    return {
      recommendedTechnologies: recommendations,
      reasoning: `Based on your interest in ${data.domain} and goal of ${data.careerGoals}, we recommend focusing on these core technologies.`,
    };
  },

  async recommendCatalog(data: {
    domain: string;
    technicalInterests: string[];
    careerGoals: string;
    preferredTechnologies: string[];
    projectType: string;
    difficultyLevel: string;
  }) {
    // 1. Fetch all catalog templates
    const templates = await prisma.project.findMany({
      where: {
        isTemplate: true,
        status: 'CATALOG',
      },
      include: {
        _count: {
          select: { childProjects: true },
        },
      },
    });

    // 2. Score templates based on criteria
    const scoredTemplates = templates.map((t) => {
      let score = 0;

      // Domain match (High weight)
      if (t.domain === data.domain) score += 40;

      // Type match (High weight)
      if (t.type === data.projectType) score += 30;

      // Difficulty match (Medium weight)
      if (t.difficultyLevel === data.difficultyLevel) score += 15;

      // Technology match (Medium weight)
      const tTechs = t.technologies.map((tech) => tech.toLowerCase());
      const pTechs = data.preferredTechnologies.map((tech) => tech.toLowerCase());

      let techMatches = 0;
      for (const pt of pTechs) {
        if (tTechs.some((tt) => tt.includes(pt) || pt.includes(tt))) {
          techMatches++;
        }
      }

      if (pTechs.length > 0) {
        score += Math.min(15, (techMatches / pTechs.length) * 15);
      }

      return {
        ...t,
        matchScore: Math.round(score),
      };
    });

    // 3. Sort by score descending and filter out very low scores (optional)
    const sorted = scoredTemplates
      .filter((t) => t.matchScore > 30) // Only recommend if somewhat relevant
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5); // Return top 5 matches

    return { recommendations: sorted };
  },
};
