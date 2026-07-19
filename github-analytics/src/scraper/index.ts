import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

export async function scrapeGitHubProfile(username: string) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`https://github.com/${username}`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    const content = await page.content();
    const $ = cheerio.load(content);

    const contributionsText = $('h2.f4.text-normal.mb-2').text();
    const contributionsMatch = contributionsText.match(/([\d,]+)\s+contributions/);
    const totalContributions = contributionsMatch
      ? parseInt(contributionsMatch[1].replace(/,/g, ''))
      : 0;

    return {
      username,
      totalContributions,
    };
  } catch (error) {
    console.error(`Error scraping profile ${username}:`, error);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
