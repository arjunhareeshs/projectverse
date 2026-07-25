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
    repo: repoData,
    branch,
    languages,
    contributors: (contributors || []).filter((c: any) => c && c.login),
    latestCommit,
    commitCount,
    branchCount,
    releaseCount,
    tagCount,
    community,
    issues: { open: openIssuesTotal, closed: closedIssuesTotal },
    pullRequests: { open: openPrTotal, closed: closedPrTotal, merged: mergedPrTotal },
    labels: (labels || []).map((l: any) => ({ name: l.name, color: l.color })),
    milestones: (milestones || []).map((m: any) => ({ title: m.title, state: m.state, dueOn: m.due_on })),
    hasSecurityPolicy,
    hasChangelog,
    structure,
  };
}

function summarizeTree(entries: Array<{ path: string; type: string }>) {
  const folders = new Set<string>();
  const extensions: Record<string, number> = {};
  let maxDepth = 0;
  let fileCount = 0;

  for (const entry of entries) {
    const depth = entry.path.split('/').length;
    maxDepth = Math.max(maxDepth, depth);
    if (entry.type === 'tree') {
      folders.add(entry.path);
    } else if (entry.type === 'blob') {
      fileCount += 1;
      const dot = entry.path.lastIndexOf('.');
      const ext = dot > -1 ? entry.path.slice(dot) : '(none)';
      extensions[ext] = (extensions[ext] || 0) + 1;
    }
  }

  return {
    folderCount: folders.size,
    fileCount,
    maxDepth,
    topExtensions: Object.entries(extensions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([ext, count]) => ({ ext, count })),
  };
}

function clampScore(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function computeScores(input: {
  stars: number;
  forks: number;
  watchers: number;
  pushedAt: Date | null;
  commitCount: number;
  contributorCount: number;
  hasReadme: boolean;
  hasContributing: boolean;
  hasCodeOfConduct: boolean;
  hasSecurityPolicy: boolean;
  hasChangelog: boolean;
  isArchived: boolean;
}) {
  const popularityScore = clampScore(
    Math.log2(input.stars + 1) * 12 + Math.log2(input.forks + 1) * 8 + Math.log2(input.watchers + 1) * 5,
  );

  const daysSincePush = input.pushedAt
    ? (Date.now() - input.pushedAt.getTime()) / (1000 * 60 * 60 * 24)
    : 9999;
  const freshnessScore = clampScore(100 - daysSincePush / 3.65); // ~0 after 1 year stale

  const maintenanceScore = clampScore(
    (input.isArchived ? 0 : 1) * (freshnessScore * 0.5 + Math.log2(input.commitCount + 1) * 6),
  );

  const communityFlags = [
    input.hasReadme,
    input.hasContributing,
    input.hasCodeOfConduct,
    input.hasSecurityPolicy,
    input.hasChangelog,
  ];
  const communityScore = clampScore(
    (communityFlags.filter(Boolean).length / communityFlags.length) * 70 +
      Math.log2(input.contributorCount + 1) * 10,
  );

  return { popularityScore, maintenanceScore, communityScore, freshnessScore };
}

async function persistSnapshot(owner: string, repo: string, projectId: string | null, snapshot: Awaited<ReturnType<typeof fetchRepositorySnapshot>>) {
  const r = snapshot.repo;

  const scores = computeScores({
    stars: r.stargazers_count || 0,
    forks: r.forks_count || 0,
    watchers: r.subscribers_count || 0,
    pushedAt: r.pushed_at ? new Date(r.pushed_at) : null,
    commitCount: snapshot.commitCount,
    contributorCount: snapshot.contributors.length,
    hasReadme: !!snapshot.community?.files?.readme,
    hasContributing: !!snapshot.community?.files?.contributing,
    hasCodeOfConduct: !!snapshot.community?.files?.code_of_conduct,
    hasSecurityPolicy: snapshot.hasSecurityPolicy,
    hasChangelog: snapshot.hasChangelog,
    isArchived: !!r.archived,
  });

  const record = await prisma.githubRepository.upsert({
    where: { owner_repository: { owner, repository: repo } },
    create: {
      owner,
      repository: repo,
      projectId: projectId || undefined,
      description: r.description || null,
      visibility: r.private ? 'private' : 'public',
      defaultBranch: snapshot.branch,
      homepage: r.homepage || null,
      license: r.license?.spdx_id || r.license?.name || null,
      topics: r.topics || [],
      language: r.language || null,
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
      projectId: projectId || undefined,
      description: r.description || null,
      visibility: r.private ? 'private' : 'public',
      defaultBranch: snapshot.branch,
      homepage: r.homepage || null,
      license: r.license?.spdx_id || r.license?.name || null,
      topics: r.topics || [],
      language: r.language || null,
      languages: snapshot.languages,
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

  if (snapshot.latestCommit) {
    await prisma.githubCommit.upsert({
      where: { repositoryId_sha: { repositoryId: record.id, sha: snapshot.latestCommit.sha } },
      create: {
        repositoryId: record.id,
        sha: snapshot.latestCommit.sha,
        author: snapshot.latestCommit.commit?.author?.name || snapshot.latestCommit.author?.login || 'unknown',
        message: snapshot.latestCommit.commit?.message || '',
        date: snapshot.latestCommit.commit?.author?.date ? new Date(snapshot.latestCommit.commit.author.date) : new Date(),
      },
      update: {},
    });
  }

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
    include: { contributors: { orderBy: { contributions: 'desc' }, take: 25 } },
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
        include: { contributors: { orderBy: { contributions: 'desc' }, take: 25 } },
      });
    }
  } else if (project.repoLink && ((opts.forceRefresh && canForceRefresh) || isStale)) {
    await analyzeAndLinkProject(projectId, project.repoLink).catch((err) => {
      logger.error('GitHub refresh failed', { projectId, message: err?.message });
    });
    record = await prisma.githubRepository.findUnique({
      where: { projectId },
      include: { contributors: { orderBy: { contributions: 'desc' }, take: 25 } },
    });
  }

  return record;
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
  getSnapshotHistory,
  getCollegeAnalytics,
};
