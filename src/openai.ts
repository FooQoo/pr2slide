import * as vscode from 'vscode';
import { PullRequest } from "./github";

export async function generateMarpFromPR(
  pr: PullRequest,
  diff: string,
  readme: string,
  token: string,
  model: string = 'gpt-4o',
  meta?: {
    state?: string;
    merged?: boolean;
    comments?: any[];
    createdAt?: string;
    commits?: { author: string; date: string; message: string }[];
  }
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
 - State: ${meta?.state ?? 'N/A'}
 - Merged: ${meta?.merged ? 'Yes' : 'No'}
 - Review Comments: ${meta?.comments?.length ?? 0}

## Pull Request Diff (shortened)
\`\`\`diff
${diff.slice(0, 3000)}
\`\`\`

${meta?.comments?.length
  ? `## Review Comments
${meta.comments
  .slice(0, 3)
  .map((c: any) => `- ${c.user?.login}: ${c.body?.slice(0, 200)}`)
  .join('\n')}
`
  : ''
}

${meta?.commits?.length
  ? `## Recent Commits
${meta.commits
  .slice(0, 3)
  .map((c: any) => `- ${c.author} (${c.date}): ${c.message.split('\n')[0]}`)
  .join('\n')}
`
  : ''
}

### Please generate a Marp slide deck in Markdown format.

- Use headings for each slide (e.g., \`#\`, \`##\`)
- Use slide breaks (\`---\`) between slides (**except after the final slide**)
- Write all slide content in **Japanese**
- Output the entire result as raw Markdown text.
- Do not wrap the entire output in triple backticks or any code block.
- Each slide should be plain Markdown separated by \`---\`, without any outer formatting.

---

### Slide Structure and Rules

#### 1. Title Slide
- Include: Repository name (linked), PR title (linked), author name, and creation date.

Example:
\`\`\`markdown
---
marp: true
theme: default
header: 'produced by pr2slide'
footer: ''
paginate: true
size: 16:9
style: |
  section {
    font-size: 28px;
  }
---

# PR: Add percentile configuration to Locust

Repository: [org/repository](url)  
Author: Someone
Date: ${meta?.createdAt ?? 'YYYY-MM-DD'}
\`\`\`

YYYY-MM-DD is the date of the creation of the PR.
Marp header must be described in the first slide.

---

#### 2. Context and Motivation
- Describe the background and necessity of this PR.
- Include an "About <repo>" slide if helpful, using information from the README.
- Include:
  - Limitations or constraints in the existing system
  - How they impacted users or dev workflow
  - Why it was timely to fix them
- If project management tickets (e.g., Jira, Linear) are referenced, include their URLs.
- If any GitHub Issues are referenced, link them like \`[Issue #123](url)\`.
- If the PR lacks motivation or purpose, include this message directly on this slide: 'Could you please explain in more detail the purpose of this change?'

Example:
\`\`\`markdown
## Context and Motivation

describe the context and motivation in detail

Related: [Issue #xxxx](url)  
Ticket: [Ticket #xxxx](url)
\`\`\`

---

#### 3. Problem and Approach
- State the problems this PR aims to solve.
- Describe the chosen approach and its rationale.

Example:
\`\`\`markdown
## Problem and Approach

**Problem:** describe the problem in detail
**Approach:** describe the approach in detail
\`\`\`

---

#### 4. Implementation and Code Changes
- Generate **one slide per diff**.
- For each diff, include:
  - The code in \`diff\` or \`js\` format
  - A brief explanation of the change
  - Suggested comments if anything is unclear, surprising, or can be improved

Example:
\`\`\`markdown
## Code Change: Add config variable

\`\`\`diff
+xxxx
\`\`\`

describe the change in detail
→ explain why this change is needed
\`\`\`

---

#### 5. Technologies Used (Optional)
- Summarize frameworks, libraries, or tools introduced or modified in this PR.

Example:
\`\`\`markdown
## Technologies Used

- Language
- Framework
- Library
- API
\`\`\`

---

#### 7. Review Feedback and Author Responses (**Only show if PR is merged**)
- One slide per reviewer
- Highlight notable praise, especially if given after a revision
- Summarize key review points

Example:
\`\`\`markdown
## Reviewer: @testuser1

💬 "Great improvement after your changes!"  
- Suggested renaming \`foo\` to \`bar\` (done)
- Requested doc update (done)
\`\`\`

---

#### 8. Timeline So Far
- Outline the progress from PR creation to now.
- Include stages like draft, review, feedback, fixes, etc.

Example:
\`\`\`markdown
## Timeline So Far

- YYYY-MM-DD: PR created  
- YYYY-MM-DD: Initial review  
- YYYY-MM-DD: Refactor completed  
- YYYY-MM-DD: Approval pending
\`\`\`

YYYY-MM-DD is the date of the last commit in the PR.

---

#### 9. Summary: Achievements (**Only show if PR is merged**)
- Recap improvements made and impact on the product or team.

Example:
\`\`\`markdown
## Summary: Achievements

- describe the improvements made
\`\`\`

---

#### 10. Conclusion
- Wrap up the presentation.

Example:
\`\`\`markdown
## Conclusion
- describe the conclusion in detail

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