import express, { Request, Response } from 'express';
import { fetchGitHubRepoDetails } from './api/github';
import { scrapeGitHubProfile } from './scraper';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4001;

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'github-analytics' });
});

app.post('/api/github/repo', async (req: Request, res: Response) => {
  const { owner, repo } = req.body;
  if (!owner || !repo) {
    return res.status(400).json({ error: 'owner and repo are required' });
  }

  const details = await fetchGitHubRepoDetails(owner, repo);
  if (!details) {
    return res.status(404).json({ error: 'Repository not found or error fetching details' });
  }

  res.json(details);
});

app.post('/api/github/profile', async (req: Request, res: Response) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }

  const details = await scrapeGitHubProfile(username);
  if (!details) {
    return res.status(404).json({ error: 'Profile not found or error scraping' });
  }

  res.json(details);
});

app.listen(PORT, () => {
  console.log(`GitHub Analytics Service running on port ${PORT}`);
});
