import { PrismaClient, RoleType } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const EXCEL_PATH = path.resolve(__dirname, '../../../data/Final Groups and Project Registration.xlsx');
const DEFAULT_PASSWORD = 'password123';
const TEAM_COLORS = [
  '#7C3AED', '#2F6FED', '#1E2A45', '#F0653B', '#F5B400', '#E94F94',
  '#059669', '#DC2626', '#6366F1', '#8B5CF6', '#14B8A6', '#F97316',
  '#EC4899', '#06B6D4', '#84CC16', '#EF4444', '#A855F7', '#0EA5E9',
];

function pickColor(idx: number): string {
  return TEAM_COLORS[idx % TEAM_COLORS.length];
}

function parseRank(raw: any): { rank: number | null; total: number | null } {
  if (!raw) return { rank: null, total: null };
  const str = String(raw).trim();
  const match = str.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (match) return { rank: parseInt(match[1]), total: parseInt(match[2]) };
  const num = parseInt(str);
  if (!isNaN(num)) return { rank: num, total: null };
  return { rank: null, total: null };
}

function cleanString(v: any): string | null {
  if (v === undefined || v === null || v === '') return null;
  return String(v).trim();
}

function yesNo(v: any): boolean {
  if (!v) return false;
  return String(v).trim().toLowerCase() === 'yes';
}

async function runSeed() {
  const start = Date.now();
  console.log('📖 Reading Excel file:', EXCEL_PATH);
  const workbook = XLSX.readFile(EXCEL_PATH);

  console.log('📄 Sheets found:', workbook.SheetNames.join(', '));

  // ── 1. Clean Database ──────────────────────────────────────
  console.log('\n🧹 Cleaning database...');
  await prisma.activityLog.deleteMany().catch(() => null);
  await prisma.aiChat.deleteMany().catch(() => null);
  await prisma.notification.deleteMany().catch(() => null);
  await prisma.comment.deleteMany().catch(() => null);
  await prisma.subtask.deleteMany().catch(() => null);
  await prisma.label.deleteMany().catch(() => null);
  await prisma.task.deleteMany().catch(() => null);
  await prisma.projectMember.deleteMany().catch(() => null);
  await prisma.project.deleteMany().catch(() => null);
  await prisma.teamMember.deleteMany().catch(() => null);
  await prisma.teamInvite.deleteMany().catch(() => null);
  await prisma.teamMessage.deleteMany().catch(() => null);
  await prisma.teamCollaboration.deleteMany().catch(() => null);
  await prisma.scheduleEvent.deleteMany().catch(() => null);
  await prisma.document.deleteMany().catch(() => null);
  await prisma.fileAsset.deleteMany().catch(() => null);
  await prisma.meeting.deleteMany().catch(() => null);
  await prisma.report.deleteMany().catch(() => null);
  await prisma.sprint.deleteMany().catch(() => null);
  await prisma.milestone.deleteMany().catch(() => null);
  await prisma.boardColumn.deleteMany().catch(() => null);
  await prisma.board.deleteMany().catch(() => null);
  await prisma.auditLog.deleteMany().catch(() => null);
  await prisma.permission.deleteMany().catch(() => null);
  await prisma.role.deleteMany().catch(() => null);
  await prisma.userSkill.deleteMany().catch(() => null);
  await prisma.groupRanking.deleteMany().catch(() => null);
  
  await prisma.user.updateMany({ data: { teamId: null } });
  await prisma.team.deleteMany().catch(() => null);
  await prisma.user.deleteMany().catch(() => null);
  await prisma.organization.deleteMany().catch(() => null);

  const org = await prisma.organization.create({
    data: { name: 'BITSathy PBL Program' },
  });
  console.log('  ✅ Organization created:', org.id);

  // Hash the default password once
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // ── 2. Create Admin user ────────────────────────────────────────
  console.log('\n👤 Creating Admin user...');
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@projectverse.com',
      fullName: 'Admin User',
      passwordHash,
      role: RoleType.ADMIN,
      organizationId: org.id,
      regNo: 'ADMIN001',
    },
  });
  console.log('  ✅ Admin created:', adminUser.email);

  // ── 3. Parse student data sheet ────────────
  console.log('\n📊 Parsing student data sheet...');
  const studentSheetName = workbook.SheetNames.find(
    (n) => n.toLowerCase().includes('i year') && n.toLowerCase().includes('ii year')
  );
  if (!studentSheetName) {
    throw new Error('❌ Could not find student sheet!');
  }
  const studentSheet = workbook.Sheets[studentSheetName];
  const studentRows: any[] = XLSX.utils.sheet_to_json(studentSheet, { defval: '' });
  console.log('  Total student rows:', studentRows.length);

  // Collect unique group names from students
  const groupNames = new Set<string>();
  for (const row of studentRows) {
    const groupName = cleanString(row['Group Name']);
    if (groupName) groupNames.add(groupName);
  }

  // ── 4. Parse "Group Summary" sheet ──────────────────────────────
  console.log('\n📊 Parsing Group Summary...');
  const groupSummarySheetName = workbook.SheetNames.find(
    (n) => n.toLowerCase() === 'group summary'
  );
  const groupSummaryMap = new Map<string, any>();
  if (groupSummarySheetName) {
    const gsSheet = workbook.Sheets[groupSummarySheetName];
    const gsRows: any[] = XLSX.utils.sheet_to_json(gsSheet, { defval: '' });
    for (const row of gsRows) {
      const gn = cleanString(row['Group Name']);
      if (gn) {
        groupSummaryMap.set(gn, {
          level: cleanString(row['Group Level']),
          captainRollNo: cleanString(row['Captain Roll Number']),
          captainName: cleanString(row['Captain Name']),
          captainEmail: cleanString(row['Captain Email']),
          iYearCount: parseInt(row['I Year Count']) || 0,
          iiYearCount: parseInt(row['II Year Count']) || 0,
          totalCount: parseInt(row['Total Count']) || 0,
          maxMembers: parseInt(row['Max Members Limits']) || 16,
        });
      }
    }
  }

  // ── 5. Create Teams ─────────────────────────────────────────────
  console.log('\n🏗️ Creating teams...');
  const emailToUserId = new Map<string, string>();
  const regNoToUserId = new Map<string, string>();
  const groupNameToTeamId = new Map<string, string>();

  let teamIdx = 0;
  for (const groupName of groupNames) {
    const summary = groupSummaryMap.get(groupName);
    const team = await prisma.team.create({
      data: {
        organizationId: org.id,
        name: groupName,
        groupCode: groupName,
        groupLevel: summary?.level || null,
        maxMembers: summary?.maxMembers || 16,
        iYearCount: summary?.iYearCount || 0,
        iiYearCount: summary?.iiYearCount || 0,
        color: pickColor(teamIdx),
        isPublic: true,
      },
    });
    groupNameToTeamId.set(groupName, team.id);
    teamIdx++;
  }
  console.log(`  ✅ ${groupNameToTeamId.size} teams created`);

  // ── 6. Create Students in Batch ──────────────────────────────────
  console.log('\n👥 Preparing student records for batch insert...');
  const usersToCreate: any[] = [];
  const processedEmails = new Set<string>();
  processedEmails.add('admin@projectverse.com');

  for (const row of studentRows) {
    const email = cleanString(row['Email Id']);
    const regNo = cleanString(row['Roll Number']);
    const name = cleanString(row['Name']);

    if (!email || !name) continue;
    if (processedEmails.has(email.toLowerCase())) continue;
    processedEmails.add(email.toLowerCase());

    const groupName = cleanString(row['Group Name']);
    const teamId = groupName ? groupNameToTeamId.get(groupName) : null;
    const ap = parseInt(row['AP in PS Technical']) || 0;
    const rpRaw = parseRank(row['Rank in PS Technical']);

    usersToCreate.push({
      email: email.toLowerCase(),
      regNo: regNo || null,
      fullName: name,
      passwordHash,
      mustChangePassword: true,
      role: RoleType.STUDENT,
      organizationId: org.id,
      teamId: teamId || null,
      year: cleanString(row['Year']),
      department: cleanString(row['Department']),
      deptCode: cleanString(row['Dept. Code']),
      cluster: cleanString(row['Cluster']),
      gender: cleanString(row['Gender']),
      resident: cleanString(row['Resident']),
      learningMode: cleanString(row['Learning Mode']),
      ssgEnrolled: yesNo(row['SSG']),
      ssgDomain: cleanString(row['SSG Domain']),
      groupRegistered: yesNo(row['Group Registered']),
      skillsRegistered: yesNo(row['Skills Registered']),
      rewardPoints: ap,
      activityPoints: rpRaw.rank || 0,
      teamRole: cleanString(row['Role']),
    });
  }

  console.log(`  Inserting ${usersToCreate.length} student users...`);
  const userChunkSize = 1000;
  for (let i = 0; i < usersToCreate.length; i += userChunkSize) {
    const chunk = usersToCreate.slice(i, i + userChunkSize);
    await prisma.user.createMany({
      data: chunk,
      skipDuplicates: true,
    });
  }

  // Populate maps for quick lookups
  console.log('  Mapping user emails to IDs in memory...');
  const dbUsers = await prisma.user.findMany({
    select: { id: true, email: true, regNo: true },
  });
  for (const u of dbUsers) {
    emailToUserId.set(u.email.toLowerCase(), u.id);
    if (u.regNo) regNoToUserId.set(u.regNo.toLowerCase(), u.id);
  }
  console.log(`  Mapped ${dbUsers.length} users`);

  // ── 7. Read "User Skill wise rank" to build a point map ────────
  console.log('\n📊 Parsing User Skill wise rank point data...');
  const rankMap = new Map<string, { totalPoints: number; skillRank: number | null; totalRanks: number | null }>();
  const skillRankSheetName = workbook.SheetNames.find(
    (n) => n.toLowerCase().includes('user skill wise rank')
  );
  if (skillRankSheetName) {
    const srSheet = workbook.Sheets[skillRankSheetName];
    const srRows: any[] = XLSX.utils.sheet_to_json(srSheet, { defval: '' });
    console.log(`  Found ${srRows.length} skill rank rows`);
    for (const row of srRows) {
      const email = cleanString(row['Email ID']);
      const skillName = cleanString(row['Skill Name']);
      const totalPoints = parseInt(row['Total Point']) || 0;
      const skillRank = parseInt(row['Skill Rank']) || null;
      const totalRanks = parseInt(row['Total Ranks']) || null;
      if (email && skillName) {
        rankMap.set(`${email.toLowerCase()}:${skillName.toLowerCase()}`, {
          totalPoints,
          skillRank,
          totalRanks,
        });
      }
    }
  }

  // ── 8. Prepare and Create UserSkills in Batch ───────────────────
  console.log('\n🎯 Preparing user skills in batch...');
  const skillsToCreate: any[] = [];
  for (const row of studentRows) {
    const email = cleanString(row['Email Id']);
    if (!email) continue;
    const userId = emailToUserId.get(email.toLowerCase());
    if (!userId) continue;

    const skillColumns = [
      { name: 'Primary Skill 1', rank: 'Primary Skill 1 - Rank', type: 'primary' },
      { name: 'Primary Skill 2', rank: 'Primary Skill 2 - Rank', type: 'primary' },
      { name: 'Secondary Skill 1', rank: 'Secondary Skill 1 - Rank', type: 'secondary' },
      { name: 'Secondary Skill 2', rank: 'Secondary Skill 2 - Rank', type: 'secondary' },
      { name: 'Specialization Skill 1', rank: 'Specialization Skill 1 - Rank', type: 'specialization' },
      { name: 'Specialization Skill 2', rank: 'Specialization Skill 2 - Rank', type: 'specialization' },
    ];

    for (const col of skillColumns) {
      const skillName = cleanString(row[col.name]);
      if (skillName) {
        const rankKey = `${email.toLowerCase()}:${skillName.toLowerCase()}`;
        const pointsData = rankMap.get(rankKey);
        
        let rankValue: number | null = null;
        let totalRanksValue: number | null = null;
        let totalPointsValue = 0;

        if (pointsData) {
          rankValue = pointsData.skillRank;
          totalRanksValue = pointsData.totalRanks;
          totalPointsValue = pointsData.totalPoints;
        } else {
          const rankData = parseRank(row[col.rank]);
          rankValue = rankData.rank;
          totalRanksValue = rankData.total;
        }

        skillsToCreate.push({
          userId,
          skillName,
          skillType: col.type,
          skillRank: rankValue,
          totalRanks: totalRanksValue,
          totalPoints: totalPointsValue,
        });
      }
    }
  }

  // De-duplicate skillsToCreate
  const uniqueSkills: any[] = [];
  const seenSkillKeys = new Set<string>();
  for (const s of skillsToCreate) {
    const key = `${s.userId}:${s.skillName.toLowerCase()}`;
    if (seenSkillKeys.has(key)) continue;
    seenSkillKeys.add(key);
    uniqueSkills.push(s);
  }

  console.log(`  Inserting ${uniqueSkills.length} user skills...`);
  const skillChunkSize = 2000;
  for (let i = 0; i < uniqueSkills.length; i += skillChunkSize) {
    const chunk = uniqueSkills.slice(i, i + skillChunkSize);
    await prisma.userSkill.createMany({
      data: chunk,
      skipDuplicates: true,
    });
  }
  console.log(`  ✅ User skills inserted`);

  // ── 9. Create TeamMember records in Batch ───────────────────────
  console.log('\n🔗 Creating team memberships...');
  const groupRegSheetName = workbook.SheetNames.find(
    (n) => n.toLowerCase() === 'group registration'
  );
  const teamMembersToCreate: any[] = [];

  if (groupRegSheetName) {
    const grSheet = workbook.Sheets[groupRegSheetName];
    const grRows: any[] = XLSX.utils.sheet_to_json(grSheet, { defval: '' });
    console.log('  Group registration rows:', grRows.length);

    for (const row of grRows) {
      const email = cleanString(row['Email']);
      const groupName = cleanString(row['Group Name']);
      const role = cleanString(row['Role']) || 'Member';

      if (!email || !groupName) continue;
      const userId = emailToUserId.get(email.toLowerCase());
      const teamId = groupNameToTeamId.get(groupName);
      if (!userId || !teamId) continue;

      teamMembersToCreate.push({
        teamId,
        userId,
        roleLabel: role,
      });
    }
  } else {
    for (const row of studentRows) {
      const email = cleanString(row['Email Id']);
      const groupName = cleanString(row['Group Name']);
      const role = cleanString(row['Role']) || 'Member';

      if (!email || !groupName) continue;
      const userId = emailToUserId.get(email.toLowerCase());
      const teamId = groupNameToTeamId.get(groupName);
      if (!userId || !teamId) continue;

      teamMembersToCreate.push({
        teamId,
        userId,
        roleLabel: role,
      });
    }
  }

  // De-duplicate team memberships
  const uniqueTeamMembers: any[] = [];
  const seenMemberKeys = new Set<string>();
  for (const tm of teamMembersToCreate) {
    const key = `${tm.teamId}:${tm.userId}`;
    if (seenMemberKeys.has(key)) continue;
    seenMemberKeys.add(key);
    uniqueTeamMembers.push(tm);
  }

  console.log(`  Inserting ${uniqueTeamMembers.length} team memberships...`);
  const memberChunkSize = 2000;
  for (let i = 0; i < uniqueTeamMembers.length; i += memberChunkSize) {
    const chunk = uniqueTeamMembers.slice(i, i + memberChunkSize);
    await prisma.teamMember.createMany({
      data: chunk,
      skipDuplicates: true,
    });
  }
  console.log('  ✅ Team memberships created');

  // ── 10. Set team leads (captains) via Transaction ───────────────
  console.log('\n👑 Setting team captains...');
  const teamUpdates = [];
  for (const [groupName, summary] of groupSummaryMap) {
    const teamId = groupNameToTeamId.get(groupName);
    if (!teamId || !summary.captainEmail) continue;
    const captainId = emailToUserId.get(summary.captainEmail.toLowerCase());
    if (!captainId) continue;

    teamUpdates.push(
      prisma.team.update({
        where: { id: teamId },
        data: { leadId: captainId },
      })
    );
  }
  
  console.log(`  Executing ${teamUpdates.length} team captain updates...`);
  const updateChunkSize = 100;
  for (let i = 0; i < teamUpdates.length; i += updateChunkSize) {
    const chunk = teamUpdates.slice(i, i + updateChunkSize);
    await prisma.$transaction(chunk);
  }
  console.log(`  ✅ Team captains set`);

  // ── 11. Parse Group Ranking in Batch ────────────────────────────
  console.log('\n🏆 Parsing Group Ranking...');
  const rankingSheetName = workbook.SheetNames.find(
    (n) => n.toLowerCase() === 'group ranking'
  );
  if (rankingSheetName) {
    const rkSheet = workbook.Sheets[rankingSheetName];
    const rkRows: any[] = XLSX.utils.sheet_to_json(rkSheet, { defval: '' });
    const rankingsToCreate = [];

    for (const row of rkRows) {
      const groupName = cleanString(row['Group Name']);
      const rank = parseInt(row['Rank']);
      const totalPoints = parseInt(row['Total Points']) || 0;

      if (!groupName || isNaN(rank)) continue;
      const teamId = groupNameToTeamId.get(groupName);
      if (!teamId) continue;

      rankingsToCreate.push({
        teamId,
        rank,
        totalPoints,
      });
    }

    console.log(`  Inserting ${rankingsToCreate.length} group rankings...`);
    await prisma.groupRanking.createMany({
      data: rankingsToCreate,
      skipDuplicates: true,
    });
    console.log(`  ✅ Group rankings created`);
  }

  // ── 12. Parse SSG sheet for domain mapping in Transaction ───────
  console.log('\n🔧 Parsing SSG domain data...');
  const ssgSheetName = workbook.SheetNames.find(
    (n) => n.toLowerCase() === 'ssg'
  );
  if (ssgSheetName) {
    const ssgSheet = workbook.Sheets[ssgSheetName];
    const ssgRows: any[] = XLSX.utils.sheet_to_json(ssgSheet, { defval: '' });
    const ssgUpdates = [];

    for (const row of ssgRows) {
      const email = cleanString(row['Email Id']);
      const mode = cleanString(row['Mode']);

      if (!email || !mode) continue;
      const userId = emailToUserId.get(email.toLowerCase());
      if (!userId) continue;

      ssgUpdates.push(
        prisma.user.update({
          where: { id: userId },
          data: { ssgEnrolled: true, ssgDomain: mode },
        })
      );
    }

    console.log(`  Executing ${ssgUpdates.length} SSG domain updates...`);
    for (let i = 0; i < ssgUpdates.length; i += updateChunkSize) {
      const chunk = ssgUpdates.slice(i, i + updateChunkSize);
      await prisma.$transaction(chunk);
    }
    console.log(`  ✅ SSG domains updated`);
  }

  // ── 13. Create a demo project for each team in Batch ────────────
  console.log('\n📁 Creating default workspace projects for teams...');
  const projectsToCreate = [];
  for (const [groupName, teamId] of groupNameToTeamId) {
    projectsToCreate.push({
      organizationId: org.id,
      teamId,
      name: `${groupName} Workspace`,
      description: `Default workspace project for team ${groupName}`,
      status: 'active',
    });
  }
  
  console.log(`  Inserting ${projectsToCreate.length} default projects...`);
  await prisma.project.createMany({
    data: projectsToCreate,
    skipDuplicates: true,
  });
  console.log(`  ✅ Workspace projects created`);

  // ── 14. Query newly created projects to seed tasks/sprints/boards/etc. ──────
  console.log('\n🌱 Populating safe temporary workspace data...');
  const createdProjects = await prisma.project.findMany();
  
  // Group memberships by teamId for seeding
  const teamMembersMap = new Map<string, any[]>();
  for (const m of uniqueTeamMembers) {
    const list = teamMembersMap.get(m.teamId) || [];
    list.push(m);
    teamMembersMap.set(m.teamId, list);
  }

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

  const boardsToCreate: any[] = [];
  const boardColumnsToCreate: any[] = [];
  const sprintsToCreate: any[] = [];
  const tasksToCreate: any[] = [];
  const teamMessagesToCreate: any[] = [];
  const activityLogsToCreate: any[] = [];
  const documentsToCreate: any[] = [];
  const meetingsToCreate: any[] = [];
  const scheduleEventsToCreate: any[] = [];

  const genId = (prefix: string, idx: number, projId: string) => {
    return `${prefix}_${idx}_${projId.slice(-10)}`.replace(/[^a-zA-Z0-9_]/g, '_');
  };

  for (const project of createdProjects) {
    const teamId = project.teamId;
    if (!teamId) continue;

    const members = teamMembersMap.get(teamId) || [];
    const memberIds = members.map((m) => m.userId);
    const primaryMemberId = memberIds[0] || null;

    // 1. Prepare Boards and Columns
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

    // 2. Prepare Sprints
    sprintsToCreate.push({
      id: genId('spr', 1, project.id),
      projectId: project.id,
      name: 'Sprint 1: Architecture & Core setup',
      startsAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      endsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    });

    // 3. Prepare Tasks
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

    // Chat messages
    if (primaryMemberId) {
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

    // Activity Logs
    if (primaryMemberId) {
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

    // Documents
    if (primaryMemberId) {
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

    // Meetings
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

  // Batch Insert Seeding
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

  // ── Seeding Hackathons, LeetCode Contests, and User Streaks ─────
  console.log('\n🔥 Seeding Hackathons, LeetCode Contests, and User Streaks...');
  await prisma.hackathon.deleteMany().catch(() => null);
  await prisma.leetCodeContest.deleteMany().catch(() => null);
  await prisma.userStreak.deleteMany().catch(() => null);

  const hackathonsToCreate = [
    { name: 'Smart India Hackathon 2025', dateRange: 'Aug 1 - Aug 3, 2025', status: 'Upcoming' },
    { name: 'HackMIT 2025', dateRange: 'Sep 5 - Sep 7, 2025', status: 'Upcoming' },
    { name: 'Google Solution Challenge', dateRange: 'Oct 10 - Oct 12, 2025', status: 'Upcoming' }
  ];

  const contestsToCreate = [
    { name: 'Biweekly Contest 128', startTime: new Date('2025-07-12T20:30:00Z'), status: 'Register' },
    { name: 'Weekly Contest 445', startTime: new Date('2025-07-19T20:30:00Z'), status: 'Register' },
    { name: 'Biweekly Contest 129', startTime: new Date('2025-07-26T20:30:00Z'), status: 'Register' }
  ];

  await prisma.hackathon.createMany({ data: hackathonsToCreate });
  await prisma.leetCodeContest.createMany({ data: contestsToCreate });

  const allUsersList = await prisma.user.findMany({ select: { id: true } });
  const userStreaksToCreate = allUsersList.map((u) => {
    // Generate static streak stats to match target screenshot dashboard, but dynamic counts
    const now = new Date();
    const grid: { [key: string]: number } = {};
    let total = 0;
    for (let d = 0; d < 365; d++) {
      const date = new Date(now.getTime() - d * 24 * 3600 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      if (Math.random() < 0.25) {
        const val = Math.floor(Math.random() * 4) + 1;
        grid[dateStr] = val;
        total += val;
      }
    }

    return {
      userId: u.id,
      currentStreak: 12,
      longestStreak: 28,
      totalContributions: total || 276,
      gridData: JSON.stringify(grid),
    };
  });

  console.log(`  Inserting ${userStreaksToCreate.length} user streaks...`);
  for (let i = 0; i < userStreaksToCreate.length; i += chunkSize) {
    await prisma.userStreak.createMany({
      data: userStreaksToCreate.slice(i, i + chunkSize),
      skipDuplicates: true,
    });
  }

  // ── Summary ─────────────────────────────────────────────────────
  const end = Date.now();
  const finalCounts = {
    users: await prisma.user.count(),
    teams: await prisma.team.count(),
    teamMembers: await prisma.teamMember.count(),
    userSkills: await prisma.userSkill.count(),
    groupRankings: await prisma.groupRanking.count(),
    projects: await prisma.project.count(),
    tasks: await prisma.task.count(),
    sprints: await prisma.sprint.count(),
    messages: await prisma.teamMessage.count(),
  };

  console.log('\n' + '═'.repeat(50));
  console.log('✅ SEED & IMPORT COMPLETE in ' + ((end - start) / 1000).toFixed(1) + ' seconds');
  console.log('═'.repeat(50));
  console.log(`  Users:          ${finalCounts.users}`);
  console.log(`  Teams:          ${finalCounts.teams}`);
  console.log(`  Team Members:   ${finalCounts.teamMembers}`);
  console.log(`  User Skills:    ${finalCounts.userSkills}`);
  console.log(`  Group Rankings: ${finalCounts.groupRankings}`);
  console.log(`  Projects:       ${finalCounts.projects}`);
  console.log(`  Tasks:          ${finalCounts.tasks}`);
  console.log(`  Sprints:        ${finalCounts.sprints}`);
  console.log(`  Team Messages:  ${finalCounts.messages}`);
  console.log('');
  console.log('  Login accounts:');
  console.log('    Admin  → admin@projectverse.com / password123');
  console.log('    Any student email from Excel / password123');
  console.log('═'.repeat(50));
}

runSeed()
  .catch((e) => {
    console.error('❌ Fatal seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
