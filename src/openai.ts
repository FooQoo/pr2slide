import * as vscode from 'vscode';
import { PullRequest } from "./github";

export async function generateMarpFromPR(
  pr: PullRequest,
  diff: string,
  readme: string,
  token: string,
  model: string = 'gpt-4o'
): Promise<string> {
  const prompt = `
You are a helpful assistant that generates Marp-format Markdown slide decks.
The slides should explain the pull request below in a way that helps others understand what was changed and why.

## Repository README
${readme}

## Pull Request Metadata
- Number: ${pr.number}
- Title: ${pr.title}
- Author: ${pr.author}
- description: ${pr.description}

## Pull Request Diff (shortened)
\`\`\`diff
${diff.slice(0, 3000)}
\`\`\`

### Please generate a Marp slide deck in Markdown format.
- Use headings for each slide (e.g., #, ##)
- Use slide breaks (---) between slides
- Start with a title slide
- Include slides for: motivation, implementation, summary
- If no clear background or purpose is provided in the description, ask the author to clarify their intent. If any URLs (like issues or tickets) are included, refer to them.
- When showing code changes, include comments on the slide if any part of the diff is unclear, hard to read, or potentially suboptimal.
- Use code snippets (in diff or js format) where appropriate
- Write in Japanese.
- Output the slide content directly as Markdown. Do not wrap the entire response in a code block
- Do not end the final slide with a slide break like '---'
- Include the Marp frontmatter header at the top: 

\`\`\`
---
marp: true
---
\`\`\`
`.trim();

  const config = vscode.workspace.getConfiguration('pr2slide');
  const apiBase = config.get<string>('openaiBaseUrl') || 'https://api.openai.com';

  const response = await fetch(`${apiBase}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are a Marp slide generation assistant.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText} ${await response.text()}`);
  }

  const data: any = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}