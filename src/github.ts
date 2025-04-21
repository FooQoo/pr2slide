import * as vscode from 'vscode';
import fetch from 'node-fetch';

export interface PullRequest {
  number: number;
  title: string;
  description: string;
  author: string;
}

export async function getPullRequests(repo: string, token: string): Promise<PullRequest[]> {
  const config = vscode.workspace.getConfiguration('pr2slide');
  const githubBase = config.get<string>('githubApiBaseUrl') || 'https://api.github.com';

  const response = await fetch(`${githubBase}/repos/${repo}/pulls?state=all`, {
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
