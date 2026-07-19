import axios from 'axios';

export async function fetchGitHubRepoDetails(owner: string, repo: string) {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}`;
    const response = await axios.get(url);
    const data = response.data;

    return {
      repoName: data.name,
      stars: data.stargazers_count,
      forks: data.forks_count,
      openIssues: data.open_issues_count,
      language: data.language,
      lastUpdate: data.updated_at,
    };
  } catch (error) {
    console.error(`Error fetching GitHub API for ${owner}/${repo}:`, error);
    return null;
  }
}
