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

async function main() {
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
    console.error('❌ Could not find student sheet!');
    return;
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
  // Insert users in chunks of 1000
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

  // ── Summary ─────────────────────────────────────────────────────
  const end = Date.now();
  const finalCounts = {
    users: await prisma.user.count(),
    teams: await prisma.team.count(),
    teamMembers: await prisma.teamMember.count(),
    userSkills: await prisma.userSkill.count(),
    groupRankings: await prisma.groupRanking.count(),
    projects: await prisma.project.count(),
  };

  console.log('\n' + '═'.repeat(50));
  console.log('✅ IMPORT COMPLETE in ' + ((end - start) / 1000).toFixed(1) + ' seconds');
  console.log('═'.repeat(50));
  console.log(`  Users:          ${finalCounts.users}`);
  console.log(`  Teams:          ${finalCounts.teams}`);
  console.log(`  Team Members:   ${finalCounts.teamMembers}`);
  console.log(`  User Skills:    ${finalCounts.userSkills}`);
  console.log(`  Group Rankings: ${finalCounts.groupRankings}`);
  console.log(`  Projects:       ${finalCounts.projects}`);
  console.log('');
  console.log('  Login accounts:');
  console.log('    Admin  → admin@projectverse.com / password123');
  console.log('    Any student email from Excel / password123');
  console.log('═'.repeat(50));
}

main()
  .catch((e) => {
    console.error('❌ Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
