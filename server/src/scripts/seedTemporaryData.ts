import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const start = Date.now();
  console.log('🌱 Starting safe temporary data seeding...');

  // 1. Fetch all teams, projects, and memberships
  const teams = await prisma.team.findMany();
  const projects = await prisma.project.findMany();
  const memberships = await prisma.teamMember.findMany({
    include: { user: true },
  });

  console.log(`  Found ${teams.length} teams, ${projects.length} projects, and ${memberships.length} memberships in database.`);

  // Group memberships by teamId
  const teamMembersMap = new Map<string, any[]>();
  for (const m of memberships) {
    const list = teamMembersMap.get(m.teamId) || [];
    list.push(m);
    teamMembersMap.set(m.teamId, list);
  }

  // 2. Prepare mock details
  const taskTitles = [
    'Database Schema Initialization',
    'User Registration & Login API',
    'Kanban Board Frontend layout',
    'Timeline Gantt chart view',
    'AI assistant service integration',
    'Workspace activity log tracker',
    'Document management setup',
    'Notifications bell dropdown',
    'Team collaboration workspace',
    'Project detail summary stats',
  ];

  const chatMessages = [
    'Hey team! Welcome to our workspace. Let\'s get started with setup.',
    'I just pushed the initial database schema to git. Please review.',
    'Great work! I am starting on the UI/UX layout today.',
    'Is anyone working on the auth backend?',
    'Yes, I am configuring the JWT middleware right now.',
    'Perfect. Let\'s schedule a quick call tomorrow to sync up.',
  ];

  const boardNames = ['Sprint Kanban Board', 'Backlog Board'];
  const columnNames = ['Todo', 'In Progress', 'In Review', 'Done'];

  const docTitles = [
    'Software Requirements Specification',
    'System Architecture Design',
    'API Documentation Reference',
    'Weekly Status Report',
  ];

  const meetingTitles = [
    'Sprint Planning Sync',
    'Architecture Review Call',
    'Daily Standup & Sync',
  ];

  const activityActions = [
    'pushed new code to branch "main"',
    'created task "Database Schema Initialization"',
    'moved task "User Registration & Login" to "In Progress"',
    'uploaded document "API Reference.pdf"',
    'scheduled a meeting "Daily Standup"',
    'resolved subtask "Setup prisma client"',
  ];

  // We will collect objects to insert in batch
  const boardsToCreate: any[] = [];
  const boardColumnsToCreate: any[] = [];
  const sprintsToCreate: any[] = [];
  const tasksToCreate: any[] = [];
  const teamMessagesToCreate: any[] = [];
  const activityLogsToCreate: any[] = [];
  const documentsToCreate: any[] = [];
  const meetingsToCreate: any[] = [];
  const scheduleEventsToCreate: any[] = [];

  console.log('\n⚡ Preparing records to seed...');

  const genId = (prefix: string, idx: number, projId: string) => {
    return `${prefix}_${idx}_${projId.slice(-10)}`.replace(/[^a-zA-Z0-9_]/g, '_');
  };

  for (const project of projects) {
    const teamId = project.teamId;
    if (!teamId) continue;

    const members = teamMembersMap.get(teamId) || [];
    const memberIds = members.map((m) => m.userId);
    const primaryMemberId = memberIds[0] || null;

    // Check if team already has boards
    const existingBoards = await prisma.board.findMany({ where: { projectId: project.id } });
    if (existingBoards.length === 0) {
      for (let bIdx = 0; bIdx < boardNames.length; bIdx++) {
        const boardId = genId('brd', bIdx, project.id);
        boardsToCreate.push({
          id: boardId,
          projectId: project.id,
          name: boardNames[bIdx],
        });

        for (let cIdx = 0; cIdx < columnNames.length; cIdx++) {
          boardColumnsToCreate.push({
            id: genId(`col_${bIdx}`, cIdx, project.id),
            boardId,
            name: columnNames[cIdx],
            position: cIdx + 1,
          });
        }
      }
    }

    // Check if team already has sprints
    const existingSprints = await prisma.sprint.findMany({ where: { projectId: project.id } });
    if (existingSprints.length === 0) {
      sprintsToCreate.push({
        id: genId('spr', 1, project.id),
        projectId: project.id,
        name: 'Sprint 1: Architecture & Core setup',
        startsAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
        endsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      });
    }

    // Check if team already has tasks
    const existingTasks = await prisma.task.findMany({ where: { projectId: project.id } });
    if (existingTasks.length === 0) {
      for (let tIdx = 0; tIdx < 6; tIdx++) {
        const assigneeId = memberIds.length > 0 ? memberIds[tIdx % memberIds.length] : null;
        const statusVal = tIdx < 2 ? 'done' : tIdx < 4 ? 'in_progress' : 'todo';
        const complDate = statusVal === 'done' ? new Date(Date.now() - tIdx * 24 * 3600 * 1000) : null;
        
        tasksToCreate.push({
          id: genId('tsk', tIdx, project.id),
          projectId: project.id,
          assigneeId,
          title: taskTitles[tIdx % taskTitles.length],
          description: `Description details for ${taskTitles[tIdx % taskTitles.length]} task in the workspace.`,
          status: statusVal,
          priority: tIdx % 3 === 0 ? 'high' : tIdx % 3 === 1 ? 'medium' : 'low',
          category: tIdx % 2 === 0 ? 'Development' : 'Design',
          progress: statusVal === 'done' ? 100 : statusVal === 'in_progress' ? 40 : 0,
          completedAt: complDate,
          dueDate: new Date(Date.now() + (tIdx + 1) * 24 * 3600 * 1000),
        });
      }
    }

    // Chat messages
    if (primaryMemberId) {
      const existingMessages = await prisma.teamMessage.findFirst({ where: { teamId } });
      if (!existingMessages) {
        for (let mIdx = 0; mIdx < 4; mIdx++) {
          const senderId = memberIds.length > 0 ? memberIds[mIdx % memberIds.length] : primaryMemberId;
          teamMessagesToCreate.push({
            teamId,
            userId: senderId,
            message: chatMessages[mIdx % chatMessages.length],
            createdAt: new Date(Date.now() - (5 - mIdx) * 3600 * 1000),
          });
        }
      }
    }

    // Activity Logs
    if (primaryMemberId) {
      const existingLogs = await prisma.activityLog.findFirst({ where: { userId: primaryMemberId } });
      if (!existingLogs) {
        for (let lIdx = 0; lIdx < 4; lIdx++) {
          const uId = memberIds.length > 0 ? memberIds[lIdx % memberIds.length] : primaryMemberId;
          activityLogsToCreate.push({
            userId: uId,
            action: activityActions[lIdx % activityActions.length],
            entityType: 'Task',
            entityId: genId('tsk', lIdx, project.id),
            createdAt: new Date(Date.now() - lIdx * 6 * 3600 * 1000),
          });
        }
      }
    }

    // Documents
    if (primaryMemberId) {
      const existingDocs = await prisma.document.findMany({ where: { projectId: project.id } });
      if (existingDocs.length === 0) {
        for (let dIdx = 0; dIdx < 2; dIdx++) {
          documentsToCreate.push({
            projectId: project.id,
            userId: primaryMemberId,
            title: docTitles[dIdx % docTitles.length],
            fileName: docTitles[dIdx % docTitles.length] + '.pdf',
            fileSize: 1024 * 256 * (dIdx + 1),
            fileUrl: 'https://projectverse-assets.s3.amazonaws.com/mock-doc.pdf',
            mimeType: 'application/pdf',
          });
        }
      }
    }

    // Meetings
    const existingMeetings = await prisma.meeting.findMany({ where: { projectId: project.id } });
    if (existingMeetings.length === 0) {
      for (let mtIdx = 0; mtIdx < 2; mtIdx++) {
        meetingsToCreate.push({
          projectId: project.id,
          title: meetingTitles[mtIdx % meetingTitles.length],
          notes: `Sync agenda for ${meetingTitles[mtIdx % meetingTitles.length]} to review sprint progress.`,
          startsAt: new Date(Date.now() + (mtIdx + 1) * 24 * 3600 * 1000),
        });

        if (primaryMemberId) {
          scheduleEventsToCreate.push({
            userId: primaryMemberId,
            title: meetingTitles[mtIdx % meetingTitles.length],
            date: new Date(Date.now() + (mtIdx + 1) * 24 * 3600 * 1000).toISOString().split('T')[0],
            timeString: '10:00 AM',
            hour: 10.0,
            duration: 0.5,
            room: 'Virtual Room B1',
            color: '#7C3AED',
          });
        }
      }
    }
  }

  // 3. Batch Create
  const chunkSize = 2000;

  if (boardsToCreate.length > 0) {
    console.log(`🎬 Creating ${boardsToCreate.length} Boards...`);
    await prisma.board.createMany({ data: boardsToCreate, skipDuplicates: true });
  }
  if (boardColumnsToCreate.length > 0) {
    console.log(`📋 Creating ${boardColumnsToCreate.length} BoardColumns...`);
    for (let i = 0; i < boardColumnsToCreate.length; i += chunkSize) {
      await prisma.boardColumn.createMany({
        data: boardColumnsToCreate.slice(i, i + chunkSize),
        skipDuplicates: true,
      });
    }
  }
  if (sprintsToCreate.length > 0) {
    console.log(`🏃 Creating ${sprintsToCreate.length} Sprints...`);
    await prisma.sprint.createMany({ data: sprintsToCreate, skipDuplicates: true });
  }
  if (tasksToCreate.length > 0) {
    console.log(`✅ Creating ${tasksToCreate.length} Tasks...`);
    for (let i = 0; i < tasksToCreate.length; i += chunkSize) {
      await prisma.task.createMany({
        data: tasksToCreate.slice(i, i + chunkSize),
        skipDuplicates: true,
      });
    }
  }
  if (teamMessagesToCreate.length > 0) {
    console.log(`💬 Creating ${teamMessagesToCreate.length} TeamMessages...`);
    for (let i = 0; i < teamMessagesToCreate.length; i += chunkSize) {
      await prisma.teamMessage.createMany({
        data: teamMessagesToCreate.slice(i, i + chunkSize),
        skipDuplicates: true,
      });
    }
  }
  if (activityLogsToCreate.length > 0) {
    console.log(`📝 Creating ${activityLogsToCreate.length} ActivityLogs...`);
    for (let i = 0; i < activityLogsToCreate.length; i += chunkSize) {
      await prisma.activityLog.createMany({
        data: activityLogsToCreate.slice(i, i + chunkSize),
        skipDuplicates: true,
      });
    }
  }
  if (documentsToCreate.length > 0) {
    console.log(`📁 Creating ${documentsToCreate.length} Documents...`);
    await prisma.document.createMany({ data: documentsToCreate, skipDuplicates: true });
  }
  if (meetingsToCreate.length > 0) {
    console.log(`📅 Creating ${meetingsToCreate.length} Meetings...`);
    await prisma.meeting.createMany({ data: meetingsToCreate, skipDuplicates: true });
  }
  if (scheduleEventsToCreate.length > 0) {
    console.log(`⏰ Creating ${scheduleEventsToCreate.length} ScheduleEvents...`);
    await prisma.scheduleEvent.createMany({ data: scheduleEventsToCreate, skipDuplicates: true });
  }

  const end = Date.now();
  console.log(`\n🎉 SAFE SEED COMPLETE in ${((end - start) / 1000).toFixed(1)} seconds!`);
}

main()
  .catch((e) => {
    console.error('❌ Safe seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
