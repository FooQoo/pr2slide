import * as vscode from 'vscode';
import { getPullRequests, getPullRequestDiff, getRepositoryReadme } from './github';
import { generateMarpFromPR } from './openai';

export function activate(context: vscode.ExtensionContext) {
  const generateCommand = vscode.commands.registerCommand('pr2slide.generateSlide', async () => {
    const token = await getSecret(context, 'pr2slide.githubToken');
    const openaiToken = await getSecret(context, 'pr2slide.openaiToken');

    if (!token || !openaiToken) {
      vscode.window.showErrorMessage('Missing GitHub or OpenAI token in SecretStorage.');
      return;
    }

    const repo = await detectRepo();
    if (!repo) {
      vscode.window.showErrorMessage('Could not detect GitHub repository.');
      return;
    }

    const prs = await vscode.window.withProgress({
      location: vscode.ProgressLocation.Window,
      title: "Fetching Pull Requests",
      cancellable: false
    }, async (progress) => {
      progress.report({ message: "Fetching pull requests..." });
      return await getPullRequests(repo, token);
    });
    const selected = await vscode.window.showQuickPick(
      prs.map((pr) => ({ label: `#${pr.number}: ${pr.title}`, pr })),
      { placeHolder: 'Select a pull request to generate slides' }
    );
    if (!selected) {return;}

    const pr = selected.pr;

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Window,
      title: "Generating Slides",
      cancellable: false
    }, async (progress) => {
      progress.report({ message: "Fetching pull request diff..." });
      const diff = await getPullRequestDiff(repo, pr.number, token);
      progress.report({ message: "Fetching repository README..." });
      const readme = await getRepositoryReadme(repo, token);
      progress.report({ message: "Generating slides..." });
      const markdown = await generateMarpFromPR(pr, diff, readme, openaiToken);

      const doc = await vscode.workspace.openTextDocument({ language: 'markdown', content: markdown });
      await vscode.window.showTextDocument(doc);
      await vscode.commands.executeCommand('markdown.showPreviewToSide');
    });
  });

  const setGithubTokenCommand = vscode.commands.registerCommand('pr2slide.setGitHubToken', async () => {
    const githubToken = await vscode.window.showInputBox({
      prompt: 'Enter your GitHub Personal Access Token',
      ignoreFocusOut: true,
      password: true,
    });
    if (githubToken) {
      await context.secrets.store('pr2slide.githubToken', githubToken);
      vscode.window.showInformationMessage('GitHub token saved securely.');
    }
  });

  const setOpenaiTokenCommand = vscode.commands.registerCommand('pr2slide.setOpenAIApiKey', async () => {
    const openaiToken = await vscode.window.showInputBox({
      prompt: 'Enter your OpenAI API Key',
      ignoreFocusOut: true,
      password: true,
    });
    if (openaiToken) {
      await context.secrets.store('pr2slide.openaiToken', openaiToken);
      vscode.window.showInformationMessage('OpenAI token saved securely.');
    }
  });


  context.subscriptions.push(generateCommand, setGithubTokenCommand, setOpenaiTokenCommand);
}

async function detectRepo(): Promise<string | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {return undefined;}
  const uri = folders[0].uri;
  const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
  const api = gitExtension?.getAPI(1);
  const repo = api?.repositories?.[0]?.state?.remotes?.[0]?.fetchUrl;
  if (!repo) {return undefined;}
  const match = repo.match(/github.com[/:](.+?)\.(git)?$/);
  return match?.[1];
}

async function getSecret(context: vscode.ExtensionContext, key: string): Promise<string | undefined> {
  return await context.secrets.get(key);
}