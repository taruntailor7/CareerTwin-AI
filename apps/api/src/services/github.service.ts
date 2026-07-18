import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

interface GithubUser {
  login: string;
  name: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  public_repos: number;
  followers: number;
  created_at: string;
}

interface GithubRepo {
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  fork: boolean;
  pushed_at: string;
  topics?: string[];
}

export interface GithubAnalysis {
  username: string;
  profile: { name: string | null; bio: string | null; company: string | null; followers: number; accountAgeYears: number };
  repoCount: number;
  originalRepoCount: number;
  totalStars: number;
  languages: string[];
  recentlyActiveRepoCount: number;
  readmeCoveredSample: number;
  topRepos: Array<{ name: string; description: string | null; stars: number; language: string | null }>;
  score: number;
}

const GITHUB_API_BASE = "https://api.github.com";
const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 182;

// Unauthenticated GitHub API requests are capped at 60/hour per IP, which is
// easily exhausted on shared hosting (e.g. Render's pooled egress IPs). A
// token (no scopes needed for public data) raises this to 5,000/hour.
function githubHeaders(): HeadersInit {
  const headers: HeadersInit = { Accept: "application/vnd.github+json", "User-Agent": "careertwin-ai" };
  if (env.GITHUB_TOKEN) {
    (headers as Record<string, string>).Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  }
  return headers;
}

export function extractGithubUsername(githubUrl: string): string | null {
  try {
    const url = new URL(githubUrl);
    if (!url.hostname.includes("github.com")) return null;
    const [username] = url.pathname.split("/").filter(Boolean);
    return username || null;
  } catch {
    return null;
  }
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${GITHUB_API_BASE}${path}`, { headers: githubHeaders() });
    if (!response.ok) {
      logger.warn(
        { status: response.status, path, rateLimitRemaining: response.headers.get("x-ratelimit-remaining") },
        "GitHub API request returned a non-OK status"
      );
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    logger.warn({ error, path }, "GitHub API request failed");
    return null;
  }
}

async function checkReadmeExists(owner: string, repo: string): Promise<boolean> {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/readme`, { headers: githubHeaders() });
    return response.ok;
  } catch {
    return false;
  }
}

export async function analyzeGithubProfile(githubUrl: string): Promise<GithubAnalysis | null> {
  const username = extractGithubUsername(githubUrl);
  if (!username) return null;

  const [user, repos] = await Promise.all([
    fetchJson<GithubUser>(`/users/${username}`),
    fetchJson<GithubRepo[]>(`/users/${username}/repos?per_page=100&sort=updated`)
  ]);

  if (!user) return null;

  const allRepos = repos ?? [];
  const originalRepos = allRepos.filter((repo) => !repo.fork);
  const languages = [...new Set(allRepos.map((repo) => repo.language).filter((lang): lang is string => Boolean(lang)))];
  const totalStars = allRepos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  const now = Date.now();
  const recentlyActiveRepoCount = allRepos.filter((repo) => now - new Date(repo.pushed_at).getTime() < SIX_MONTHS_MS).length;

  const topRepos = [...originalRepos]
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 5)
    .map((repo) => ({ name: repo.name, description: repo.description, stars: repo.stargazers_count, language: repo.language }));

  const readmeChecks = await Promise.all(topRepos.slice(0, 3).map((repo) => checkReadmeExists(username, repo.name)));
  const readmeCoveredSample = readmeChecks.filter(Boolean).length;

  const accountAgeYears = Math.max(0, (now - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24 * 365));

  const score = Math.round(
    Math.max(
      30,
      Math.min(
        97,
        40 +
          Math.min(20, originalRepos.length * 2) +
          Math.min(15, languages.length * 3) +
          Math.min(15, recentlyActiveRepoCount * 3) +
          Math.min(10, readmeCoveredSample * 3.3)
      )
    )
  );

  return {
    username,
    profile: {
      name: user.name,
      bio: user.bio,
      company: user.company,
      followers: user.followers,
      accountAgeYears: Math.round(accountAgeYears * 10) / 10
    },
    repoCount: allRepos.length,
    originalRepoCount: originalRepos.length,
    totalStars,
    languages,
    recentlyActiveRepoCount,
    readmeCoveredSample,
    topRepos,
    score
  };
}
