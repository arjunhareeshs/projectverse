SELECT COUNT(*) as cnt, 'User' as tbl FROM "User"
UNION ALL SELECT COUNT(*), 'Team' FROM "Team"
UNION ALL SELECT COUNT(*), 'TeamMember' FROM "TeamMember"
UNION ALL SELECT COUNT(*), 'UserSkill' FROM "UserSkill"
UNION ALL SELECT COUNT(*), 'GroupRanking' FROM "GroupRanking"
UNION ALL SELECT COUNT(*), 'Project' FROM "Project"
ORDER BY tbl;
