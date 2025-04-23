import * as vscode from 'vscode';
import fetch from 'node-fetch';

export interface PullRequest {
  number: number;
  title: string;
  description: string;
  author: string;
}

export async function getPullRequests(repo: string, token: string, page: number = 1, state: string = 'all', perPage: number = 30): Promise<PullRequest[]> {
  const config = vscode.workspace.getConfiguration('pr2slide');
  const githubBase = config.get<string>('githubApiBaseUrl') || 'https://api.github.com';

  const response = await fetch(`${githubBase}/repos/${repo}/pulls?state=${state}&page=${page}&per_page=${perPage}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.map((pr: any) => ({
    number: pr.number,
    title: pr.title,
    description: pr.body ?? '',
    author: pr.user?.login ?? 'unknown',
  }));
}

export async function getPullRequestDiff(repo: string, prNumber: number, token: string): Promise<string> {
  const config = vscode.workspace.getConfiguration('pr2slide');
  const githubBase = config.get<string>('githubApiBaseUrl') || 'https://api.github.com';

  const response = await fetch(`${githubBase}/repos/${repo}/pulls/${prNumber}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3.diff',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error (diff): ${response.status} ${response.statusText}`);
  }

  return await response.text();
}

export async function getRepositoryReadme(repo: string, token: string): Promise<string> {
  const config = vscode.workspace.getConfiguration('pr2slide');
  const githubBase = config.get<string>('githubApiBaseUrl') || 'https://api.github.com';

  const response = await fetch(`${githubBase}/repos/${repo}/readme`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3.raw',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error (README): ${response.status} ${response.statusText}`);
  }

  return await response.text();
}


export async function getPullRequestDetails(
  repo: string,
  prNumber: number,
  token: string
): Promise<{
  diff: string;
  state: string;
  merged: boolean;
  comments: any[];
  createdAt: string;
  commits: { author: string; date: string; message: string }[];
}> {
  const config = vscode.workspace.getConfiguration('pr2slide');
  const githubBase = config.get<string>('githubApiBaseUrl') || 'https://api.github.com';

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
  };

  // Fetch PR metadata
  const prResponse = await fetch(`${githubBase}/repos/${repo}/pulls/${prNumber}`, { headers });
  if (!prResponse.ok) {
    throw new Error(`GitHub API error (PR metadata): ${prResponse.status} ${prResponse.statusText}`);
  }
  const prData = await prResponse.json();
  const createdAt = prData.created_at;

  // Fetch commits info
  const commitsResponse = await fetch(`${githubBase}/repos/${repo}/pulls/${prNumber}/commits`, { headers });
  if (!commitsResponse.ok) {
    throw new Error(`GitHub API error (commits): ${commitsResponse.status} ${commitsResponse.statusText}`);
  }
  const commitsJson = await commitsResponse.json();
  const commits = commitsJson.map((commit: any) => ({
    author: commit.commit.author.name,
    date: commit.commit.author.date,
    message: commit.commit.message,
  }));

  // Fetch PR diff
  const diffResponse = await fetch(`${githubBase}/repos/${repo}/pulls/${prNumber}`, {
    headers: {
      ...headers,
      'Accept': 'application/vnd.github.v3.diff',
    },
  });
  if (!diffResponse.ok) {
    throw new Error(`GitHub API error (diff): ${diffResponse.status} ${diffResponse.statusText}`);
  }
  const diff = await diffResponse.text();

  // Fetch review comments
  const commentsResponse = await fetch(`${githubBase}/repos/${repo}/pulls/${prNumber}/comments`, { headers });
  if (!commentsResponse.ok) {
    throw new Error(`GitHub API error (comments): ${commentsResponse.status} ${commentsResponse.statusText}`);
  }
  const comments = await commentsResponse.json();

  return {
    diff,
    state: prData.state,
    merged: prData.merged,
    comments,
    createdAt,
    commits,
  };
}