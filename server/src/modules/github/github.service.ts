import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/database';
import { logger } from '../../shared/logger';
import { githubClient } from './github.client';

const SYNC_TTL_MS = 12 * 60 * 60 * 1000; // serve cached data for 12h before a read triggers a refetch
const MIN_REFRESH_INTERVAL_MS = 60 * 60 * 1000; // manual refresh throttled to once/hour per repo

export class GithubAnalysisError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

function parseRepoUrl(url: string): { owner: string; repo: string } {
  let clean = (url || '').trim();
  if (!clean) throw new GithubAnalysisError('Repository link is required', 'INVALID_URL');

  if (!/^https?:\/\//i.test(clean)) clean = `https://${clean}`;

  let parsed: URL;
  try {
    parsed = new URL(clean);
  } catch {
    throw new GithubAnalysisError('Repository link is not a valid URL', 'INVALID_URL');
  }

  if (!/(^|\.)github\.com$/i.test(parsed.hostname)) {
    throw new GithubAnalysisError('Only github.com repository links are supported', 'INVALID_HOST');
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length < 2) {
    throw new GithubAnalysisError('Expected a URL in the form github.com/owner/repo', 'INVALID_PATH');
  }

  const owner = segments[0]!;
  const repo = segments[1]!.replace(/\.git$/i, '');
  return { owner, repo };
}

async function fetchRepositorySnapshot(owner: string, repo: string) {
  const { data: repoData } = await githubClient.coreGet<any>(`/repos/${owner}/${repo}`);

  if (repoData.private) {
    throw new GithubAnalysisError('Only public repositories can be analyzed', 'PRIVATE_REPO');
  }

  const branch = repoData.default_branch || 'main';

  const [
    languages,
    contributors,
    latestCommits,
    commitCount,
    branchCount,
    releaseCount,
    tagCount,
    community,
    openIssuesTotal,
    closedIssuesTotal,
    openPrTotal,
    closedPrTotal,
    mergedPrTotal,
    labels,
    milestones,
    hasSecurityPolicy,
    hasChangelog,
    tree,
  ] = await Promise.all([
    githubClient.coreGet<Record<string, number>>(`/repos/${owner}/${repo}/languages`).then((r) => r.data).catch(() => ({})),
    githubClient.coreGet<any[]>(`/repos/${owner}/${repo}/contributors`, { params: { per_page: 100 } }).then((r) => r.data).catch(() => []),
    githubClient.coreGet<any[]>(`/repos/${owner}/${repo}/commits`, { params: { per_page: 1 } }).then((r) => r.data).catch(() => []),
    githubClient.countViaPagination(`/repos/${owner}/${repo}/commits`).catch(() => 0),
    githubClient.countViaPagination(`/repos/${owner}/${repo}/branches`).catch(() => 0),
    githubClient.countViaPagination(`/repos/${owner}/${repo}/releases`).catch(() => 0),
    githubClient.countViaPagination(`/repos/${owner}/${repo}/tags`).catch(() => 0),
    githubClient.coreGet<any>(`/repos/${owner}/${repo}/community/profile`).then((r) => r.data).catch(() => null),
    githubClient.searchCount(`repo:${owner}/${repo} type:issue state:open`).catch(() => 0),
    githubClient.searchCount(`repo:${owner}/${repo} type:issue state:closed`).catch(() => 0),
    githubClient.searchCount(`repo:${owner}/${repo} type:pr state:open`).catch(() => 0),
    githubClient.searchCount(`repo:${owner}/${repo} type:pr state:closed`).catch(() => 0),
    githubClient.searchCount(`repo:${owner}/${repo} type:pr is:merged`).catch(() => 0),
    githubClient.coreGet<any[]>(`/repos/${owner}/${repo}/labels`, { params: { per_page: 100 } }).then((r) => r.data).catch(() => []),
    githubClient.coreGet<any[]>(`/repos/${owner}/${repo}/milestones`, { params: { per_page: 100, state: 'all' } }).then((r) => r.data).catch(() => []),
    githubClient.fileExists(owner, repo, 'SECURITY.md'),
    githubClient.fileExists(owner, repo, 'CHANGELOG.md'),
    githubClient.coreGet<any>(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}`, { params: { recursive: 1 } }).then((r) => r.data).catch(() => null),
  ]);

  const latestCommit = latestCommits?.[0];

  const structure = tree?.tree
    ? summarizeTree(tree.tree as Array<{ path: string; type: string }>)
    : null;

  return {
    raw: repoData,
    languages,
    contributors,
    latestCommit,
    commitCount,
    branchCount,
    releaseCount,
    tagCount,
    community,
    issues: { open: openIssuesTotal, closed: closedIssuesTotal },
    pullRequests: { open: openPrTotal, closed: closedPrTotal, merged: mergedPrTotal },
    labels,
    milestones,
    hasSecurityPolicy,
    hasChangelog,
    structure,
  };
}

function summarizeTree(items: Array<{ path: string; type: string }>) {
  const topLevel = new Set<string>();
  let fileCount = 0;
  let dirCount = 0;
  let hasSrc = false;
  let hasTests = false;
  let hasDocs = false;
  let hasCi = false;

  for (const item of items) {
    const segments = item.path.split('/');
    if (segments.length === 1) topLevel.add(item.path);
    else if (segments[0]) topLevel.add(segments[0]);

    if (item.type === 'blob') fileCount++;
    if (item.type === 'tree') dirCount++;

    const lower = item.path.toLowerCase();
    if (lower.startsWith('src/') || lower.startsWith('lib/') || lower.startsWith('app/')) hasSrc = true;
    if (lower.includes('test') || lower.includes('spec') || lower.startsWith('tests/')) hasTests = true;
    if (lower.startsWith('docs/') || lower.startsWith('doc/')) hasDocs = true;
    if (lower.startsWith('.github/workflows')) hasCi = true;
  }

  return {
    hasSrc,
    hasTests,
    hasDocs,
    hasCi,
    fileCount,
    directoryCount: dirCount,
    topLevelFolders: Array.from(topLevel).slice(0, 20),
  };
}

function computeScores(snapshot: Awaited<ReturnType<typeof fetchRepositorySnapshot>>) {
  const r = snapshot.raw;

  let popularity = 0;
  popularity += Math.min(snapshot.raw.stargazers_count || 0, 50) * 1.0;
  popularity += Math.min(snapshot.raw.forks_count || 0, 25) * 1.0;
  popularity += Math.min(snapshot.raw.subscribers_count || 0, 25) * 0.5;
  const popularityScore = Math.min(100, Math.round(popularity));

  let maintenance = 0;
  if (snapshot.latestCommit?.commit?.author?.date) {
    const daysSince =
      (Date.now() - new Date(snapshot.latestCommit.commit.author.date).getTime()) /
      (1000 * 60 * 60 * 24);
    if (daysSince < 30) maintenance += 40;
    else if (daysSince < 90) maintenance += 25;
    else if (daysSince < 180) maintenance += 10;
  }
  const totalIssues = snapshot.issues.open + snapshot.issues.closed;
  if (totalIssues > 0) {
    const closeRatio = snapshot.issues.closed / totalIssues;
    maintenance += Math.round(closeRatio * 30);
  } else {
    maintenance += 15;
  }
  if (snapshot.structure?.hasCi) maintenance += 15;
  if (snapshot.releaseCount > 0) maintenance += 15;
  const maintenanceScore = Math.min(100, Math.round(maintenance));

  let community = 0;
  if (snapshot.community?.files?.readme) community += 25;
  if (snapshot.community?.files?.contributing) community += 20;
  if (snapshot.community?.files?.license) community += 15;
  if (snapshot.community?.files?.code_of_conduct) community += 15;
  if (snapshot.community?.files?.issue_template) community += 10;
  if (snapshot.community?.files?.pull_request_template) community += 10;
  if (snapshot.hasSecurityPolicy) community += 5;
  const communityScore = Math.min(100, Math.round(community));

  let freshness = 0;
  if (r.pushed_at) {
    const daysSincePush = (Date.now() - new Date(r.pushed_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSincePush < 7) freshness = 100;
    else if (daysSincePush < 30) freshness = 80;
    else if (daysSincePush < 90) freshness = 50;
    else if (daysSincePush < 180) freshness = 25;
    else freshness = 10;
  }
  const freshnessScore = freshness;

  return {
    popularityScore,
    maintenanceScore,
    communityScore,
    freshnessScore,
  };
}

/**
 * Synchronizes paginated commit history (up to 2,000 commits) and resolves contributor attribution.
 * Resolves linkedUserId in priority order:
 * 1. commit.author.login -> User.githubUsername (case-insensitive)
 * 2. commit.commit.author.email -> User.email (case-insensitive)
 * 3. null (unattributed)
 */
async function syncCommitHistory(
  repositoryId: string,
  owner: string,
  repo: string,
  maxPages: number = 20,
): Promise<number> {
  const commits = await githubClient.listAllPaginated<any>(`/repos/${owner}/${repo}/commits`, {}, maxPages);
  if (!commits || commits.length === 0) return 0;

  // Build lookup maps for registered users
  const users = await prisma.user.findMany({
    select: { id: true, email: true, githubUsername: true, fullName: true },
  });

  const usernameMap = new Map<string, string>();
  const emailMap = new Map<string, string>();

  for (const u of users) {
    if (u.githubUsername) {
      usernameMap.set(u.githubUsername.trim().toLowerCase(), u.id);
    }
    if (u.email) {
      emailMap.set(u.email.trim().toLowerCase(), u.id);
    }
  }

  const commitData = commits.map((c) => {
    const authorLogin = c.author?.login || null;
    const authorEmail = c.commit?.author?.email || null;

    let linkedUserId: string | null = null;
    if (authorLogin && usernameMap.has(authorLogin.toLowerCase())) {
      linkedUserId = usernameMap.get(authorLogin.toLowerCase())!;
    } else if (authorEmail && emailMap.has(authorEmail.toLowerCase())) {
      linkedUserId = emailMap.get(authorEmail.toLowerCase())!;
    }

    const isMerge = Array.isArray(c.parents) && c.parents.length > 1;

    return {
      repositoryId,
      sha: c.sha,
      author: c.commit?.author?.name || c.author?.login || 'unknown',
      authorLogin,
      authorEmail,
      linkedUserId,
      message: (c.commit?.message || '').slice(0, 1000),
      date: c.commit?.author?.date ? new Date(c.commit.author.date) : new Date(),
      isMerge,
    };
  });

  await prisma.githubCommit.createMany({
    data: commitData,
    skipDuplicates: true,
  });

  return commitData.length;
}

async function persistSnapshot(
  owner: string,
  repo: string,
  projectId: string,
  snapshot: Awaited<ReturnType<typeof fetchRepositorySnapshot>>,
) {
  const r = snapshot.raw;
  const scores = computeScores(snapshot);

  const record = await prisma.githubRepository.upsert({
    where: { owner_repository: { owner, repository: repo } },
    create: {
      projectId,
      owner,
      repository: repo,
      description: r.description,
      visibility: r.private ? 'private' : 'public',
      defaultBranch: r.default_branch || 'main',
      homepage: r.homepage,
      license: r.license?.spdx_id || r.license?.name || null,
      topics: r.topics || [],
      language: r.language,
      languages: snapshot.languages,
      repoCreatedAt: r.created_at ? new Date(r.created_at) : null,
      repoUpdatedAt: r.updated_at ? new Date(r.updated_at) : null,
      pushedAt: r.pushed_at ? new Date(r.pushed_at) : null,
      sizeKb: r.size || 0,
      isArchived: !!r.archived,
      isDisabled: !!r.disabled,
      isTemplate: !!r.is_template,
      hasWiki: !!r.has_wiki,
      hasPages: !!r.has_pages,
      hasDiscussions: !!r.has_discussions,
      stars: r.stargazers_count || 0,
      forks: r.forks_count || 0,
      watchers: r.subscribers_count || 0,
      subscribers: r.subscribers_count || 0,
      latestCommitSha: snapshot.latestCommit?.sha || null,
      latestCommitMessage: snapshot.latestCommit?.commit?.message || null,
      latestCommitAuthor: snapshot.latestCommit?.commit?.author?.name || snapshot.latestCommit?.author?.login || null,
      latestCommitDate: snapshot.latestCommit?.commit?.author?.date ? new Date(snapshot.latestCommit.commit.author.date) : null,
      commitCount: snapshot.commitCount,
      branchCount: snapshot.branchCount,
      releaseCount: snapshot.releaseCount,
      tagCount: snapshot.tagCount,
      contributorCount: snapshot.contributors.length,
      openIssues: snapshot.issues.open,
      closedIssues: snapshot.issues.closed,
      openPullRequests: snapshot.pullRequests.open,
      closedPullRequests: snapshot.pullRequests.closed,
      mergedPullRequests: snapshot.pullRequests.merged,
      labels: snapshot.labels,
      milestones: snapshot.milestones,
      hasReadme: !!snapshot.community?.files?.readme,
      hasContributing: !!snapshot.community?.files?.contributing,
      hasCodeOfConduct: !!snapshot.community?.files?.code_of_conduct,
      hasSecurityPolicy: snapshot.hasSecurityPolicy,
      hasChangelog: snapshot.hasChangelog,
      structure: snapshot.structure ?? Prisma.JsonNull,
      ...scores,
      lastSyncedAt: new Date(),
      lastSyncError: null,
    },
    update: {
      projectId,
      description: r.description,
      visibility: r.private ? 'private' : 'public',
      defaultBranch: r.default_branch || 'main',
      homepage: r.homepage,
      license: r.license?.spdx_id || r.license?.name || null,
      topics: r.topics || [],
      language: r.language,
      languages: snapshot.languages,
      repoCreatedAt: r.created_at ? new Date(r.created_at) : null,
      repoUpdatedAt: r.updated_at ? new Date(r.updated_at) : null,
      pushedAt: r.pushed_at ? new Date(r.pushed_at) : null,
      sizeKb: r.size || 0,
      isArchived: !!r.archived,
      isDisabled: !!r.disabled,
      isTemplate: !!r.is_template,
      hasWiki: !!r.has_wiki,
      hasPages: !!r.has_pages,
      hasDiscussions: !!r.has_discussions,
      stars: r.stargazers_count || 0,
      forks: r.forks_count || 0,
      watchers: r.subscribers_count || 0,
      subscribers: r.subscribers_count || 0,
      latestCommitSha: snapshot.latestCommit?.sha || null,
      latestCommitMessage: snapshot.latestCommit?.commit?.message || null,
      latestCommitAuthor: snapshot.latestCommit?.commit?.author?.name || snapshot.latestCommit?.author?.login || null,
      latestCommitDate: snapshot.latestCommit?.commit?.author?.date ? new Date(snapshot.latestCommit.commit.author.date) : null,
      commitCount: snapshot.commitCount,
      branchCount: snapshot.branchCount,
      releaseCount: snapshot.releaseCount,
      tagCount: snapshot.tagCount,
      contributorCount: snapshot.contributors.length,
      openIssues: snapshot.issues.open,
      closedIssues: snapshot.issues.closed,
      openPullRequests: snapshot.pullRequests.open,
      closedPullRequests: snapshot.pullRequests.closed,
      mergedPullRequests: snapshot.pullRequests.merged,
      labels: snapshot.labels,
      milestones: snapshot.milestones,
      hasReadme: !!snapshot.community?.files?.readme,
      hasContributing: !!snapshot.community?.files?.contributing,
      hasCodeOfConduct: !!snapshot.community?.files?.code_of_conduct,
      hasSecurityPolicy: snapshot.hasSecurityPolicy,
      hasChangelog: snapshot.hasChangelog,
      structure: snapshot.structure ?? Prisma.JsonNull,
      ...scores,
      lastSyncedAt: new Date(),
      lastSyncError: null,
    },
  });

  // Normalized child rows: Contributors
  await prisma.githubContributor.deleteMany({ where: { repositoryId: record.id } });
  if (snapshot.contributors.length) {
    await prisma.githubContributor.createMany({
      data: snapshot.contributors.map((c: any) => ({
        repositoryId: record.id,
        username: c.login,
        contributions: c.contributions || 0,
      })),
      skipDuplicates: true,
    });
  }

  // Normalized child rows: Languages
  if (snapshot.languages && typeof snapshot.languages === 'object') {
    const langEntries = Object.entries(snapshot.languages as Record<string, number>).map(([language, bytes]) => ({
      repositoryId: record.id,
      language,
      bytes: Number(bytes) || 0,
    }));
    if (langEntries.length > 0) {
      await prisma.githubRepositoryLanguage.deleteMany({ where: { repositoryId: record.id } });
      await prisma.githubRepositoryLanguage.createMany({ data: langEntries, skipDuplicates: true });
    }
  }

  // Normalized child rows: Labels
  if (Array.isArray(snapshot.labels) && snapshot.labels.length > 0) {
    const labelEntries = snapshot.labels.map((l: any) => ({
      repositoryId: record.id,
      name: String(l.name || ''),
      color: l.color ? String(l.color) : null,
      description: l.description ? String(l.description) : null,
    }));
    await prisma.githubRepositoryLabel.deleteMany({ where: { repositoryId: record.id } });
    await prisma.githubRepositoryLabel.createMany({ data: labelEntries, skipDuplicates: true });
  }

  // Normalized child rows: Milestones
  if (Array.isArray(snapshot.milestones) && snapshot.milestones.length > 0) {
    const milestoneEntries = snapshot.milestones.map((m: any) => ({
      repositoryId: record.id,
      title: String(m.title || ''),
      state: m.state ? String(m.state) : 'open',
      dueOn: m.due_on ? new Date(m.due_on) : null,
    }));
    await prisma.githubRepositoryMilestone.deleteMany({ where: { repositoryId: record.id } });
    await prisma.githubRepositoryMilestone.createMany({ data: milestoneEntries, skipDuplicates: true });
  }

  // Normalized child rows: Repo Structure
  if (snapshot.structure) {
    await prisma.githubRepoStructure.upsert({
      where: { repositoryId: record.id },
      create: {
        repositoryId: record.id,
        hasSrc: snapshot.structure.hasSrc,
        hasTests: snapshot.structure.hasTests,
        hasDocs: snapshot.structure.hasDocs,
        hasCi: snapshot.structure.hasCi,
        fileCount: snapshot.structure.fileCount,
        directoryCount: snapshot.structure.directoryCount,
        topLevelFolders: snapshot.structure.topLevelFolders,
      },
      update: {
        hasSrc: snapshot.structure.hasSrc,
        hasTests: snapshot.structure.hasTests,
        hasDocs: snapshot.structure.hasDocs,
        hasCi: snapshot.structure.hasCi,
        fileCount: snapshot.structure.fileCount,
        directoryCount: snapshot.structure.directoryCount,
        topLevelFolders: snapshot.structure.topLevelFolders,
      },
    });
  }

  // Real paginated commit history synchronization & contributor attribution
  await syncCommitHistory(record.id, owner, repo).catch((err) => {
    logger.warn('Full commit history sync failed, falling back to latest commit', { repositoryId: record.id, error: err?.message });
  });

  // Normalized snapshot
  await prisma.githubSnapshot.create({
    data: {
      repositoryId: record.id,
      metrics: {
        stars: record.stars,
        forks: record.forks,
        watchers: record.watchers,
        commitCount: record.commitCount,
        contributorCount: record.contributorCount,
        openIssues: record.openIssues,
        closedIssues: record.closedIssues,
        openPullRequests: record.openPullRequests,
        closedPullRequests: record.closedPullRequests,
        mergedPullRequests: record.mergedPullRequests,
        popularityScore: record.popularityScore,
        maintenanceScore: record.maintenanceScore,
        communityScore: record.communityScore,
        freshnessScore: record.freshnessScore,
      },
      stars: record.stars,
      forks: record.forks,
      watchers: record.watchers,
      commitCount: record.commitCount,
      contributorCount: record.contributorCount,
      openIssues: record.openIssues,
      closedIssues: record.closedIssues,
      openPullRequests: record.openPullRequests,
      closedPullRequests: record.closedPullRequests,
      mergedPullRequests: record.mergedPullRequests,
      popularityScore: record.popularityScore,
    },
  });

  return record;
}

async function analyzeAndLinkProject(projectId: string, repoLink: string) {
  const { owner, repo } = parseRepoUrl(repoLink);

  await prisma.project.update({ where: { id: projectId }, data: { repoLink } });

  try {
    const snapshot = await fetchRepositorySnapshot(owner, repo);
    return await persistSnapshot(owner, repo, projectId, snapshot);
  } catch (error: any) {
    logger.error('GitHub analysis failed', { projectId, owner, repo, message: error?.message });
    await prisma.githubRepository
      .upsert({
        where: { owner_repository: { owner, repository: repo } },
        create: { owner, repository: repo, projectId, lastSyncError: error?.message || 'Unknown error' },
        update: { lastSyncError: error?.message || 'Unknown error' },
      })
      .catch(() => undefined);
    throw error;
  }
}

async function getForProject(projectId: string, opts: { forceRefresh?: boolean } = {}) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new GithubAnalysisError('Project not found', 'PROJECT_NOT_FOUND');

  let record = await prisma.githubRepository.findUnique({
    where: { projectId },
    include: {
      contributors: { orderBy: { contributions: 'desc' }, take: 25 },
      languagesList: true,
      structureRecord: true,
    },
  });

  const isStale = !record?.lastSyncedAt || Date.now() - record.lastSyncedAt.getTime() > SYNC_TTL_MS;
  const canForceRefresh =
    !record?.lastSyncedAt || Date.now() - record.lastSyncedAt.getTime() > MIN_REFRESH_INTERVAL_MS;

  if (!record && project.repoLink) {
    record = (await analyzeAndLinkProject(projectId, project.repoLink).catch((err) => {
      logger.error('Initial GitHub sync failed', { projectId, message: err?.message });
      return null;
    })) as any;
    if (record) {
      record = await prisma.githubRepository.findUnique({
        where: { projectId },
        include: {
          contributors: { orderBy: { contributions: 'desc' }, take: 25 },
          languagesList: true,
          structureRecord: true,
        },
      });
    }
  } else if (project.repoLink && ((opts.forceRefresh && canForceRefresh) || isStale)) {
    await analyzeAndLinkProject(projectId, project.repoLink).catch((err) => {
      logger.error('GitHub refresh failed', { projectId, message: err?.message });
    });
    record = await prisma.githubRepository.findUnique({
      where: { projectId },
      include: {
        contributors: { orderBy: { contributions: 'desc' }, take: 25 },
        languagesList: true,
        structureRecord: true,
      },
    });
  }

  return record;
}

/**
 * Returns contributor commit statistics strictly scoped to the project's own repository.
 */
async function getRepoContributorStats(
  projectId: string,
  options: { from?: Date; to?: Date } = {},
) {
  const repo = await prisma.githubRepository.findUnique({
    where: { projectId },
    include: {
      project: {
        include: {
          members: {
            include: {
              user: { select: { id: true, fullName: true, email: true, githubUsername: true } },
            },
          },
        },
      },
    },
  });

  if (!repo) {
    return {
      repositoryId: null,
      projectId,
      totalCommits: 0,
      attributedCommits: 0,
      unattributedCommits: 0,
      contributors: [],
    };
  }

  const dateFilter: Prisma.DateTimeFilter = {};
  if (options.from) dateFilter.gte = options.from;
  if (options.to) dateFilter.lte = options.to;

  const commits = await prisma.githubCommit.findMany({
    where: {
      repositoryId: repo.id,
      ...(options.from || options.to ? { date: dateFilter } : {}),
    },
    include: {
      linkedUser: { select: { id: true, fullName: true, email: true, githubUsername: true } },
    },
    orderBy: { date: 'asc' },
  });

  const memberMap = new Map<string, {
    userId: string;
    githubLogin?: string | null;
    displayName: string;
    commits: number;
    activeDays: Set<string>;
    firstCommitAt: Date | null;
    lastCommitAt: Date | null;
    isAttributed: boolean;
  }>();

  // Initialize registered project members
  if (repo.project?.members) {
    for (const m of repo.project.members) {
      memberMap.set(m.user.id, {
        userId: m.user.id,
        githubLogin: m.user.githubUsername,
        displayName: m.user.fullName,
        commits: 0,
        activeDays: new Set<string>(),
        firstCommitAt: null,
        lastCommitAt: null,
        isAttributed: true,
      });
    }
  }

  const unattributedLogins = new Map<string, {
    userId: null;
    githubLogin: string;
    displayName: string;
    commits: number;
    activeDays: Set<string>;
    firstCommitAt: Date | null;
    lastCommitAt: Date | null;
    isAttributed: boolean;
  }>();

  let totalAttributed = 0;
  let totalUnattributed = 0;

  for (const c of commits) {
    const dayStr = c.date.toISOString().split('T')[0]!;
    if (c.linkedUserId) {
      totalAttributed++;
      let entry = memberMap.get(c.linkedUserId);
      if (!entry) {
        entry = {
          userId: c.linkedUserId,
          githubLogin: c.linkedUser?.githubUsername || c.authorLogin,
          displayName: c.linkedUser?.fullName || c.author,
          commits: 0,
          activeDays: new Set<string>(),
          firstCommitAt: null,
          lastCommitAt: null,
          isAttributed: true,
        };
        memberMap.set(c.linkedUserId, entry);
      }
      entry.commits++;
      entry.activeDays.add(dayStr);
      if (!entry.firstCommitAt || c.date < entry.firstCommitAt) entry.firstCommitAt = c.date;
      if (!entry.lastCommitAt || c.date > entry.lastCommitAt) entry.lastCommitAt = c.date;
    } else {
      totalUnattributed++;
      const loginKey = c.authorLogin || c.authorEmail || c.author || 'unattributed';
      let entry = unattributedLogins.get(loginKey);
      if (!entry) {
        entry = {
          userId: null,
          githubLogin: c.authorLogin || loginKey,
          displayName: c.author,
          commits: 0,
          activeDays: new Set<string>(),
          firstCommitAt: null,
          lastCommitAt: null,
          isAttributed: false,
        };
        unattributedLogins.set(loginKey, entry);
      }
      entry.commits++;
      entry.activeDays.add(dayStr);
      if (!entry.firstCommitAt || c.date < entry.firstCommitAt) entry.firstCommitAt = c.date;
      if (!entry.lastCommitAt || c.date > entry.lastCommitAt) entry.lastCommitAt = c.date;
    }
  }

  const contributors = [
    ...Array.from(memberMap.values()).map((m) => ({
      ...m,
      activeDays: m.activeDays.size,
    })),
    ...Array.from(unattributedLogins.values()).map((u) => ({
      ...u,
      activeDays: u.activeDays.size,
    })),
  ].sort((a, b) => b.commits - a.commits);

  return {
    repositoryId: repo.id,
    projectId,
    totalCommits: commits.length,
    attributedCommits: totalAttributed,
    unattributedCommits: totalUnattributed,
    contributors,
  };
}

async function getSnapshotHistory(projectId: string, limit = 30) {
  const record = await prisma.githubRepository.findUnique({ where: { projectId } });
  if (!record) return [];
  return prisma.githubSnapshot.findMany({
    where: { repositoryId: record.id },
    orderBy: { capturedAt: 'desc' },
    take: limit,
  });
}

async function getCollegeAnalytics(organizationId: string) {
  const repos = await prisma.githubRepository.findMany({
    where: { project: { organizationId } },
    include: { project: { include: { team: { select: { id: true, name: true, domain: true } } } } },
  });

  const mostStarred = [...repos].sort((a, b) => b.stars - a.stars).slice(0, 10);
  const mostForked = [...repos].sort((a, b) => b.forks - a.forks).slice(0, 10);
  const mostActive = [...repos].sort((a, b) => b.commitCount - a.commitCount).slice(0, 10);

  const languageDistribution: Record<string, number> = {};
  for (const r of repos) {
    if (!r.language) continue;
    languageDistribution[r.language] = (languageDistribution[r.language] || 0) + 1;
  }

  const departmentMap: Record<string, { count: number; totalStars: number; totalCommits: number }> = {};
  for (const r of repos) {
    const dept = r.project?.team?.domain || 'Unassigned';
    if (!departmentMap[dept]) departmentMap[dept] = { count: 0, totalStars: 0, totalCommits: 0 };
    departmentMap[dept].count += 1;
    departmentMap[dept].totalStars += r.stars;
    departmentMap[dept].totalCommits += r.commitCount;
  }

  return {
    totalReposAnalyzed: repos.length,
    mostStarred: mostStarred.map(projectRepoSummary),
    mostForked: mostForked.map(projectRepoSummary),
    mostActiveRepository: mostActive.map(projectRepoSummary),
    languageDistribution,
    departmentComparison: Object.entries(departmentMap).map(([domain, stats]) => ({ domain, ...stats })),
  };
}

function projectRepoSummary(r: any) {
  return {
    projectId: r.projectId,
    projectName: r.project?.name,
    teamName: r.project?.team?.name,
    owner: r.owner,
    repository: r.repository,
    stars: r.stars,
    forks: r.forks,
    commitCount: r.commitCount,
  };
}

export const githubService = {
  parseRepoUrl,
  analyzeAndLinkProject,
  getForProject,
  syncCommitHistory,
  getRepoContributorStats,
  getSnapshotHistory,
  getCollegeAnalytics,
};
